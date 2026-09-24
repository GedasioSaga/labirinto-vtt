import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { PlayerInfo } from './hostSession'

/**
 * AJUDANTE CONTRATADO, lado da PONTE: o despertador do prazo. Depois do
 * empréstimo ninguém mexe na mesa — nem jogador, nem mestre — e mesmo assim,
 * no minuto do prazo, a ficha volta ao mestre, a Duda lê o recado e o painel
 * do mestre deixa de mostrar o Tiziu com ela.
 */

const ROOM = { code: 'AJ12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const MINUTO = 60_000
const PRAZO_MINUTOS = 30
const RECADO = 'Menino voltou ao mestre: o acordo acabou.'
/** Intervalo do ping do aparelho vivo no teste (bem abaixo de `HOST_STALE_AFTER_MS`). */
const PING_MS = 1_000

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

function porto(): MapData {
  return {
    ...createEmptyMap('m-porto', 'Porto', 30, 10, 50),
    tokens: [ficha('arco', 'Arco', 100), ficha('tiziu', 'Tiziu espião', 1300, { publicName: 'Menino', npc: true })],
  }
}

function setup() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const enviados: { clientId: string; msg: unknown }[] = []
  const invoke = vi.fn(async (cmd: string, args?: unknown) => {
    if (cmd === 'net_start_room') return ROOM
    if (cmd === 'net_send' && typeof args === 'object' && args !== null) {
      const clientId: unknown = Reflect.get(args, 'clientId')
      if (typeof clientId === 'string') enviados.push({ clientId, msg: Reflect.get(args, 'msg') })
    }
    return undefined
  })
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const jogadores: PlayerInfo[][] = []
  const map = porto()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => map,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: (list) => jogadores.push(list),
    now: () => Date.now(),
  })
  const entrar = (clientId: string, name: string) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener para net:message')
    handler({ payload: { clientId, msg: { type: 'join', code: ROOM.code, name } } })
  }
  const recadosPara = (clientId: string): string[] =>
    enviados.flatMap(({ clientId: para, msg }) => {
      if (para !== clientId || typeof msg !== 'object' || msg === null || Reflect.get(msg, 'type') !== 'scene.note') return []
      const text: unknown = Reflect.get(msg, 'text')
      return typeof text === 'string' ? [text] : []
    })
  const fichasDe = (name: string): string[] | undefined => jogadores.at(-1)?.find((p) => p.name === name)?.tokenIds
  /**
   * O aparelho da Duda segue vivo: o ping de fundo a cada segundo, como o
   * cliente real. Sem ele, a varredura de conexão muda (`HOST_STALE_AFTER_MS`)
   * a daria por caída muito antes do prazo, e o recado ficaria guardado para a volta.
   * O ping sai ANTES de cada passo: no instante do prazo quem age é o despertador.
   */
  const passarComAparelhoVivo = async (clientId: string, ms: number) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener para net:message')
    for (let falta = ms; falta > 0; falta -= PING_MS) {
      handler({ payload: { clientId, msg: { type: 'ping' } } })
      await vi.advanceTimersByTimeAsync(Math.min(PING_MS, falta))
    }
  }
  return { bridge, entrar, recadosPara, fichasDe, jogadores, enviados, passarComAparelhoVivo }
}

describe('hostBridge: o ajudante volta sozinho no fim do prazo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sem nenhuma outra ação, no prazo a Duda recebe o recado e o painel perde o Tiziu', async () => {
    const t = setup()
    await t.bridge.start()
    t.entrar('c1', 'Duda')
    const duda = t.bridge.players().find((p) => p.name === 'Duda')?.playerId
    if (duda === undefined) throw new Error('esperava a Duda na sala')
    t.bridge.assignToken(duda, 'arco')
    t.bridge.lendToken(duda, 'tiziu', { tarefa: 'levar o recado', minutos: PRAZO_MINUTOS, visao: false })
    expect(t.fichasDe('Duda')).toEqual(['arco', 'tiziu'])
    const avisosAntes = t.jogadores.length

    // Um milissegundo antes do prazo: nada volta.
    await t.passarComAparelhoVivo('c1', PRAZO_MINUTOS * MINUTO - 1)
    expect(t.recadosPara('c1')).toEqual([])
    expect(t.fichasDe('Duda')).toEqual(['arco', 'tiziu'])

    // No prazo: só o despertador agiu.
    await vi.advanceTimersByTimeAsync(1)
    expect(t.recadosPara('c1')).toEqual([RECADO])
    expect(t.fichasDe('Duda')).toEqual(['arco'])
    expect(t.jogadores.length).toBeGreaterThan(avisosAntes)
    expect(t.bridge.players().find((p) => p.name === 'Duda')?.tokenIds).toEqual(['arco'])

    // O despertador não repete o recado.
    await vi.advanceTimersByTimeAsync(PRAZO_MINUTOS * MINUTO)
    expect(t.recadosPara('c1')).toEqual([RECADO])
  })

  it('"Até eu tirar" não arma despertador: a ficha segue com ela depois de um dia', async () => {
    const t = setup()
    await t.bridge.start()
    t.entrar('c1', 'Duda')
    const duda = t.bridge.players().find((p) => p.name === 'Duda')?.playerId
    if (duda === undefined) throw new Error('esperava a Duda na sala')
    t.bridge.lendToken(duda, 'tiziu', { tarefa: '', minutos: null, visao: false })
    await vi.advanceTimersByTimeAsync(24 * 60 * MINUTO)
    expect(t.recadosPara('c1')).toEqual([])
    expect(t.fichasDe('Duda')).toEqual(['tiziu'])
  })
})

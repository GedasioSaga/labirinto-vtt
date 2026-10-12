import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { minigamePadrao } from '../lib/pins'
import type { MinigameDoPino } from '../minigames/danca/tipos'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token, Wall } from '../types/map'
import { createHostBridge, linhasDoDesfechoDaDanca } from './hostBridge'
import type { AppliedItems } from './hostSession'
import type { DancaAoVivo } from './dancaNoHost'
import type { DancaPlacarFinal } from './protocoloDaDanca'

/**
 * MINIGAME DE DANÇA, lado do integrador: o convite sai pelo `net_send` só a
 * quem o mestre chamou, o painel acompanha por `onDancaChange`, e o desfecho
 * vira mapa — a porta ligada destrancada e aberta pelo mesmo caminho do
 * "Destrancar e abrir", o item na mochila da ficha de cada um — e aviso na
 * tela do mestre (bônus e consequência para aplicar à mão).
 */

const ROOM = { code: 'D4NC4R', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 200, size: 1, image: null, mochila: [{ id: 'velho', nome: 'Corda' }] })
const PORTA: Wall = { id: 'porta-ziza', x1: 900, y1: 0, x2: 900, y2: 1000, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }

function mapa(extra: Partial<MinigameDoPino> = {}): MapData {
  const pino = { ...buildPin('pino-danca', { x: 300, y: 300 }, 'minigame'), portaLigada: PORTA.id, minigame: { ...minigamePadrao(), ...extra } }
  return { ...createEmptyMap('m', 'Salão', 1000, 1000, 50), walls: [PORTA], pins: [pino], tokens: [ficha('ficha-gabi', 100), ficha('ficha-ana', 200)] }
}

const PASSOU: DancaPlacarFinal = { precisao: 0.9, letra: 'A', falhou: false, perfeito: 50, bom: 8, ok: 2, errou: 1, comboMax: 40, segOk: 0, segTotal: 0 }

async function mesa(map: MapData = mapa()) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const applyDoor = vi.fn()
  const unlockAndOpenDoor = vi.fn()
  const applyItems = vi.fn<(change: AppliedItems) => void>()
  const onDancaChange = vi.fn<(danca: DancaAoVivo | null) => void>()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor, unlockAndOpenDoor, applyItems, onDancaChange, now: () => 0 })
  await bridge.start()
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener de ${name}`)
    handler({ payload })
  }
  const entra = (clientId: string, name: string, tokenId: string): string => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
    return player.playerId
  }
  const gabi = entra('c-gabi', 'Gabi', 'ficha-gabi')
  const ana = entra('c-ana', 'Ana', 'ficha-ana')
  const enviados = () => invoke.mock.calls.filter(([cmd]) => cmd === 'net_send').map(([, args]) => JSON.stringify(args))
  const toasts = () => useToastStore.getState().toasts.map((t) => t.text)
  /** Chama os dois, os dois marcam Pronto e a música começa. */
  const dancando = (): string => {
    const convite = bridge.convidarParaDanca('pino-danca', [gabi, ana])
    if (convite === null || !convite.ok) throw new Error('o convite devia ter saído')
    for (const clientId of ['c-gabi', 'c-ana']) emit('net:message', { clientId, msg: { type: 'danca.pronto', sessao: convite.sessao, dificuldade: 'expert' } })
    expect(bridge.comecarDanca()).toBe(true)
    return convite.sessao
  }
  const fim = (clientId: string, sessao: string, placar: DancaPlacarFinal) => emit('net:message', { clientId, msg: { type: 'danca.fim', sessao, placar } })
  return { bridge, emit, gabi, ana, invoke, enviados, toasts, applyDoor, unlockAndOpenDoor, applyItems, onDancaChange, dancando, fim }
}

afterEach(() => {
  for (const toast of useToastStore.getState().toasts) useToastStore.getState().dismiss(toast.id)
})

describe('hostBridge: dança', () => {
  it('o convite sai só para os chamados, e o painel acompanha do convite ao placar ao vivo', async () => {
    const { bridge, gabi, emit, invoke, enviados, onDancaChange } = await mesa()
    invoke.mockClear()
    const convite = bridge.convidarParaDanca('pino-danca', [gabi])
    expect(convite).toEqual({ ok: true, sessao: expect.any(String), convidados: 1 })
    expect(enviados()).toEqual([expect.stringContaining('"c-gabi"')])
    expect(enviados()[0]).toContain('danca.convite')
    expect(onDancaChange).toHaveBeenLastCalledWith(expect.objectContaining({ fase: 'convite', participantes: [expect.objectContaining({ playerId: gabi, status: 'convidado' })] }))
    const sessao = convite?.ok === true ? convite.sessao : ''
    emit('net:message', { clientId: 'c-gabi', msg: { type: 'danca.pronto', sessao, dificuldade: 'diversao' } })
    expect(onDancaChange.mock.lastCall?.[0]?.participantes[0]).toMatchObject({ status: 'pronto', dificuldade: 'diversao' })
    expect(bridge.comecarDanca()).toBe(true)
    emit('net:message', { clientId: 'c-gabi', msg: { type: 'danca.toques', sessao, eventos: [], placar: { precisao: 1, combo: 3, vida: 60, julgadas: 3 } } })
    expect(onDancaChange.mock.lastCall?.[0]?.participantes[0]?.placar).toEqual({ precisao: 1, combo: 3, vida: 60, julgadas: 3 })
    expect(bridge.pausarDanca()).toBe(true)
    expect(bridge.danca()?.fase).toBe('pausa')
    expect(bridge.retomarDanca()).toBe(true)
  })

  it('todos passam: a porta é destrancada e aberta, e o item entra na mochila da ficha de cada um', async () => {
    const { dancando, fim, unlockAndOpenDoor, applyItems, toasts, onDancaChange } = await mesa()
    const sessao = dancando()
    fim('c-gabi', sessao, PASSOU)
    expect(unlockAndOpenDoor).not.toHaveBeenCalled()
    fim('c-ana', sessao, PASSOU)
    expect(unlockAndOpenDoor).toHaveBeenCalledWith(PORTA.id, undefined)
    expect(applyItems.mock.calls.map(([change]) => change.mochilas.map((m) => [m.tokenId, m.mochila.map((item) => item.nome)]))).toEqual([
      [['ficha-gabi', ['Corda', 'Chave de latão']]],
      [['ficha-ana', ['Corda', 'Chave de latão']]],
    ])
    expect(toasts()).toContain('Dança de Dona Ziza: todos passaram — a porta abriu')
    expect(onDancaChange.mock.lastCall?.[0]).toMatchObject({ fase: 'fim', desfecho: { todosPassaram: true, portaAberta: true } })
  })

  it('um falha: porta e mochilas intocadas, e o mestre lê a consequência para aplicar à mão', async () => {
    const { dancando, fim, unlockAndOpenDoor, applyDoor, applyItems, toasts } = await mesa()
    const sessao = dancando()
    fim('c-gabi', sessao, PASSOU)
    fim('c-ana', sessao, { ...PASSOU, letra: 'D', precisao: 0.3 })
    expect(unlockAndOpenDoor).not.toHaveBeenCalled()
    expect(applyDoor).not.toHaveBeenCalled()
    expect(applyItems).not.toHaveBeenCalled()
    expect(toasts()).toEqual(expect.arrayContaining(['Dança de Dona Ziza: Ana não passou', 'Consequência para Ana: −2 no próximo teste de Agilidade. Aplique à mão.']))
  })

  it('quem cai no meio conta como "não passou", e o desfecho sai na queda do último', async () => {
    const { dancando, fim, emit, unlockAndOpenDoor, toasts, enviados } = await mesa()
    const sessao = dancando()
    fim('c-gabi', sessao, PASSOU)
    emit('net:peer', { clientId: 'c-ana', event: 'disconnected' })
    expect(unlockAndOpenDoor).not.toHaveBeenCalled()
    expect(toasts()).toContain('Dança de Dona Ziza: Ana não passou')
    expect(enviados().some((envio) => envio.includes('"c-gabi"') && envio.includes('danca.desfecho') && envio.includes('Saiu'))).toBe(true)
  })

  it('"Encerrar para todos": sem desfecho, nada muda no mapa; sala fechada apaga o painel', async () => {
    const { bridge, dancando, fim, unlockAndOpenDoor, applyItems, onDancaChange } = await mesa()
    const sessao = dancando()
    expect(bridge.encerrarDanca()).toBe(true)
    fim('c-gabi', sessao, PASSOU)
    fim('c-ana', sessao, PASSOU)
    expect(unlockAndOpenDoor).not.toHaveBeenCalled()
    expect(applyItems).not.toHaveBeenCalled()
    expect(onDancaChange.mock.lastCall?.[0]?.fase).toBe('encerrada')
    await bridge.stop()
    expect(onDancaChange).toHaveBeenLastCalledWith(null)
    expect(bridge.convidarParaDanca('pino-danca', [])).toBeNull()
    expect(bridge.comecarDanca()).toBe(false)
  })

  it('os avisos: bônus para todos, barulho, e quem ficou sem ficha para o item', () => {
    const base = { sessao: 's', npc: '', porta: undefined, consequencia: { tipo: 'nada' as const, texto: '' }, itens: [] }
    const mesaDe = (passou: boolean) => [{ playerId: 'a', nome: 'Ana', passou: true, letra: 'A' as const, precisao: 0.9 }, { playerId: 'b', nome: 'Bia', passou, letra: 'B' as const, precisao: 0.8 }]
    expect(linhasDoDesfechoDaDanca({ ...base, todosPassaram: true, premio: { tipo: 'bonus', texto: '+2 em Carisma' }, mesa: mesaDe(true) })).toEqual(['Dança: todos passaram', 'Bônus para Ana e Bia: +2 em Carisma. Aplique à mão no próximo teste.'])
    expect(linhasDoDesfechoDaDanca({ ...base, todosPassaram: false, premio: { tipo: 'nada', texto: '' }, consequencia: { tipo: 'barulho', texto: '' }, mesa: mesaDe(false) })).toEqual(['Dança: Bia não passou', 'O barulho chamou atenção.'])
    expect(linhasDoDesfechoDaDanca({ ...base, todosPassaram: true, premio: { tipo: 'item', texto: 'Chave' }, mesa: mesaDe(true) }, ['Bia'])).toContain('Não deu para entregar "Chave" a Bia: a ficha não está numa cena aberta.')
  })
})

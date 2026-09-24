import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { withStoredTokens } from '../lib/storedTokens'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Token } from '../types/map'
import type { PlayerInfo } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * VOLTAR É A MESMA PESSOA, lado do mestre:
 * - "Ana voltou?" na Caixa, com "É ela" e "Outra pessoa", quando alguém entra
 *   com o nome de quem está fora. "É ela" junta tudo numa Ana só.
 * - Aba nova da mesma Ana: a aba velha recebe `session.replaced` e é derrubada.
 * - "Guardar ficha" tira a ficha de quem foi embora do mapa; ela volta
 *   sozinha quando ele volta.
 * - "Dispensar" tira o card.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, name: string, x: number): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null }
}

async function mesa(extras: Token[] = []) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  let players: PlayerInfo[] = []
  let map: MapData = { ...createEmptyMap('m', 'Mapa', 30, 10, 50), tokens: [ficha('f-lirio', 'Lírio', 100), ficha('f-escudo', 'Escudo', 300), ...extras] }
  const removeToken = vi.fn((tokenId: string, _sceneId?: string) => {
    map = { ...map, tokens: map.tokens.filter((t) => t.id !== tokenId) }
  })
  const restoreToken = vi.fn((token: Token, _sceneId?: string) => {
    map = { ...map, tokens: [...map.tokens, token] }
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => map,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    removeToken,
    restoreToken,
    onPlayersChange: (list) => {
      players = list
    },
  })
  await bridge.start()
  const emit = (event: string, payload: unknown) => {
    const handler = handlers.get(event)
    if (handler === undefined) throw new Error(`sem listener de ${event}`)
    handler({ payload })
  }
  const resumes = new Map<string, string>()
  const enviados = (clientId: string) =>
    invoke.mock.calls
      .filter((call) => call[0] === 'net_send')
      .map((call) => call[1])
      .filter((args): args is { clientId: string; msg: { type: string } } => typeof args === 'object' && args !== null && 'clientId' in args && args.clientId === clientId)
      .map((args) => args.msg)
  const entra = (clientId: string, name: string, resume?: string) => {
    emit('net:message', { clientId, msg: resume === undefined ? { type: 'join', code: ROOM.code, name } : { type: 'join', code: ROOM.code, name, resume } })
    const welcome = enviados(clientId).find((msg) => msg.type === 'welcome')
    const match = /"resumeToken":"([^"]+)"/.exec(JSON.stringify(welcome ?? {}))
    if (match?.[1] !== undefined && resume === undefined) resumes.set(name, match[1])
  }
  const cai = (clientId: string) => emit('net:peer', { clientId, event: 'disconnected' })
  entra('c1', 'Ana')
  entra('c2', 'Fábio')
  const ana = bridge.players().find((p) => p.name === 'Ana')
  const fabio = bridge.players().find((p) => p.name === 'Fábio')
  if (ana === undefined || fabio === undefined) throw new Error('Ana e Fábio deveriam ter entrado')
  bridge.assignToken(ana.playerId, 'f-lirio')
  bridge.assignToken(fabio.playerId, 'f-escudo')
  useToastStore.setState({ toasts: [] })
  return {
    bridge,
    invoke,
    emit,
    entra,
    cai,
    enviados,
    resumes,
    ana,
    fabio,
    removeToken,
    restoreToken,
    mapa: () => map,
    players: () => players,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('hostBridge: "Ana voltou?" na Caixa', () => {
  it('"ana" noutro celular com a Ana fora: pergunta na Caixa; "É ela" junta numa Ana só, com a ficha', async () => {
    const m = await mesa()
    m.cai('c1')
    m.entra('c9', 'ana')
    const pergunta = useToastStore.getState().toasts.find((t) => t.text === 'Ana voltou?')
    if (pergunta === undefined) throw new Error('esperava a pergunta "Ana voltou?"')
    expect(pergunta.grupo).toBeDefined()
    expect(pergunta.sempreEmCaixa).toBe(true)
    expect(pergunta.actions?.map((a) => a.label)).toEqual(['É ela', 'Outra pessoa'])
    pergunta.actions?.find((a) => a.label === 'É ela')?.run()
    // A pergunta sai da Caixa.
    expect(useToastStore.getState().toasts.some((t) => t.text === 'Ana voltou?')).toBe(false)
    // O celular novo vira a Ana: o welcome dela e, atrás, o mapa com o Lírio.
    const novos = m.enviados('c9').map((msg) => msg.type)
    expect(novos.filter((t) => t === 'welcome')).toHaveLength(2)
    expect(novos).toContain('snapshot')
    expect(m.players().map((p) => p.name)).toEqual(['Ana', 'Fábio'])
    expect(m.players()[0]).toMatchObject({ playerId: m.ana.playerId, clientId: 'c9', connected: true, tokenIds: ['f-lirio'] })
  })

  it('"Outra pessoa": a pergunta sai e ficam as duas', async () => {
    const m = await mesa()
    m.cai('c1')
    m.entra('c9', 'ana')
    const pergunta = useToastStore.getState().toasts.find((t) => t.text === 'Ana voltou?')
    pergunta?.actions?.find((a) => a.label === 'Outra pessoa')?.run()
    expect(useToastStore.getState().toasts.some((t) => t.text === 'Ana voltou?')).toBe(false)
    expect(m.players().map((p) => p.name)).toEqual(['Ana', 'Fábio', 'ana (2)'])
    expect(m.enviados('c9').filter((msg) => msg.type === 'welcome')).toHaveLength(1)
  })

  it('"É ela" com pedidos abertos da "ana (2)": a ação no ponto e a mão saem da Caixa', async () => {
    const m = await mesa([ficha('f-tocha', 'Tocha', 500)])
    m.cai('c1')
    m.entra('c9', 'ana')
    // Enquanto a pergunta espera, o mestre dá uma ficha à "ana (2)" e ela pede.
    const segunda = m.players().find((p) => p.name === 'ana (2)')
    if (segunda === undefined) throw new Error('esperava a "ana (2)"')
    m.bridge.assignToken(segunda.playerId, 'f-tocha')
    m.emit('net:message', { clientId: 'c9', msg: { type: 'point.action', action: 'procurar', x: 500, y: 120 } })
    m.emit('net:message', { clientId: 'c9', msg: { type: 'call.raise', reason: 'agir', text: 'abro o baú' } })
    const daSegunda = () => useToastStore.getState().toasts.filter((t) => t.text.startsWith('ana (2)')).map((t) => t.text)
    expect(daSegunda()).toHaveLength(2)
    const pergunta = useToastStore.getState().toasts.find((t) => t.text === 'Ana voltou?')
    pergunta?.actions?.find((a) => a.label === 'É ela')?.run()
    // A "ana (2)" deixou de existir: o "Nada aqui" e o "Visto" dela não chegariam a ninguém.
    expect(daSegunda()).toEqual([])
    expect(m.players().map((p) => p.name)).toEqual(['Ana', 'Fábio'])
  })

  it('"Outra pessoa" com pedido aberto da "ana (2)": o pedido fica na Caixa', async () => {
    const m = await mesa([ficha('f-tocha', 'Tocha', 500)])
    m.cai('c1')
    m.entra('c9', 'ana')
    const segunda = m.players().find((p) => p.name === 'ana (2)')
    if (segunda === undefined) throw new Error('esperava a "ana (2)"')
    m.bridge.assignToken(segunda.playerId, 'f-tocha')
    m.emit('net:message', { clientId: 'c9', msg: { type: 'point.action', action: 'procurar', x: 500, y: 120 } })
    const pergunta = useToastStore.getState().toasts.find((t) => t.text === 'Ana voltou?')
    pergunta?.actions?.find((a) => a.label === 'Outra pessoa')?.run()
    expect(useToastStore.getState().toasts.filter((t) => t.text.startsWith('ana (2) quer'))).toHaveLength(1)
  })

  it('a Ana volta pelo resume antes da resposta: a pergunta some sozinha', async () => {
    const m = await mesa()
    m.cai('c1')
    m.entra('c9', 'ana')
    m.entra('c3', 'Ana', m.resumes.get('Ana'))
    expect(useToastStore.getState().toasts.some((t) => t.text === 'Ana voltou?')).toBe(false)
  })
})

describe('hostBridge: aba nova da mesma Ana', () => {
  it('a aba velha recebe session.replaced e é derrubada no transporte', async () => {
    const m = await mesa()
    m.entra('c7', 'Ana', m.resumes.get('Ana'))
    expect(m.enviados('c1').at(-1)).toEqual({ type: 'session.replaced' })
    // O envio é uma promise: o kick sai depois dela (a varredura de conexão é um intervalo sem fim, daí só 1 ms).
    await vi.advanceTimersByTimeAsync(1)
    expect(m.invoke).toHaveBeenCalledWith('net_kick', { clientId: 'c1' })
    expect(m.players().filter((p) => p.name === 'Ana')).toHaveLength(1)
  })
})

describe('hostBridge: Guardar ficha e Dispensar', () => {
  it('"Guardar ficha" tira o Escudo do mapa; o Fábio volta e o Escudo volta com ele', async () => {
    const m = await mesa()
    m.cai('c2')
    expect(m.bridge.storeTokens(m.fabio.playerId)).toBe(true)
    expect(m.removeToken).toHaveBeenCalledWith('f-escudo', undefined)
    expect(m.mapa().tokens.map((t) => t.id)).toEqual(['f-lirio'])
    const guardado = m.players().find((p) => p.playerId === m.fabio.playerId)
    expect(guardado).toMatchObject({ tokenIds: [], storedTokenNames: ['Escudo'] })
    m.entra('c5', 'Fábio', m.resumes.get('Fábio'))
    expect(m.restoreToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'f-escudo', name: 'Escudo', x: 300 }), undefined)
    expect(m.mapa().tokens.map((t) => t.id).sort()).toEqual(['f-escudo', 'f-lirio'])
    const voltou = m.players().find((p) => p.playerId === m.fabio.playerId)
    expect(voltou).toMatchObject({ connected: true, tokenIds: ['f-escudo'], status: 'playing' })
    expect(voltou?.storedTokenNames).toBeUndefined()
  })

  it('"Guardar ficha" de quem está conectado não faz nada', async () => {
    const m = await mesa()
    expect(m.bridge.storeTokens(m.fabio.playerId)).toBe(false)
    expect(m.removeToken).not.toHaveBeenCalled()
  })

  it('"Guardar ficha" + Salvar: o arquivo leva o Escudo, mesmo com ele fora do mapa do editor', async () => {
    const m = await mesa()
    m.cai('c2')
    m.bridge.storeTokens(m.fabio.playerId)
    // A ponte entrega a cópia a quem grava; o mapa do editor segue sem o Escudo.
    const guardadas = m.bridge.storedTokens()
    expect(guardadas).toEqual([{ token: ficha('f-escudo', 'Escudo', 300), sceneId: null }])
    expect(m.mapa().tokens.map((t) => t.id)).toEqual(['f-lirio'])
    const noDisco = withStoredTokens(m.mapa(), guardadas)
    expect(noDisco.tokens.map((t) => t.id)).toEqual(['f-lirio', 'f-escudo'])
    // Cópia: mexer no que foi entregue não muda o que a ponte guarda.
    guardadas.length = 0
    expect(m.bridge.storedTokens()).toHaveLength(1)
  })

  it('ninguém guardado: nada a acrescentar ao arquivo', async () => {
    const m = await mesa()
    expect(m.bridge.storedTokens()).toEqual([])
    expect(withStoredTokens(m.mapa(), m.bridge.storedTokens())).toBe(m.mapa())
  })

  it('"Dispensar" tira da Caixa o pedido de ação no ponto de quem saiu', async () => {
    const m = await mesa()
    m.emit('net:message', { clientId: 'c2', msg: { type: 'point.action', action: 'procurar', x: 300, y: 120 } })
    expect(useToastStore.getState().toasts.some((t) => t.text.startsWith('Fábio quer'))).toBe(true)
    m.cai('c2')
    // A queda não tira a linha (o mestre ainda quer ler o pedido)…
    expect(useToastStore.getState().toasts.some((t) => t.text.startsWith('Fábio quer'))).toBe(true)
    // …o Dispensar tira: não há mais a quem responder.
    expect(m.bridge.dismissPlayer(m.fabio.playerId)).toBe(true)
    expect(useToastStore.getState().toasts.some((t) => t.text.startsWith('Fábio quer'))).toBe(false)
  })

  it('"Dispensar" tira o card; a ficha guardada volta ao mapa, sem dono', async () => {
    const m = await mesa()
    m.cai('c2')
    m.bridge.storeTokens(m.fabio.playerId)
    expect(m.bridge.dismissPlayer(m.fabio.playerId)).toBe(true)
    expect(m.players().map((p) => p.name)).toEqual(['Ana'])
    expect(m.mapa().tokens.map((t) => t.id).sort()).toEqual(['f-escudo', 'f-lirio'])
  })
})

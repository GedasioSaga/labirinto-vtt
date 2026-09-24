/**
 * "VOLTO JÁ" no host: o jogador avisa que saiu da mesa por um instante. A
 * ficha dele fica travada (o host recusa o movimento), o pedido de passagem
 * que esperava o mestre fica SUSPENSO — não morre com a conexão, e o "Deixar
 * ir" dado enquanto ele está fora espera a volta — e o mestre lê "fora" no
 * painel. Ao voltar, tudo está como estava.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

const CODE = 'AB12CD'
const SALAO = 'cena-salao'
const TORRE = 'cena-torre'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino']): Pin {
  return { id, x, y, kind: 'viagem', description: id, image: null, destino }
}

/** Salão (aberto) com a ficha de Ana e uma escada que pede ao mestre; a Torre do outro lado. */
function mundo(): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50),
    tokens: [ficha('heroi', 200, 200)],
    pins: [viagem('escada', 350, 200, { sceneId: TORRE, pinId: 'topo' })],
  }
  const torre: MapData = {
    ...createEmptyMap('mapa-torre', 'Torre Alta', 40, 10, 50),
    pins: [viagem('topo', 600, 300, { sceneId: SALAO, pinId: 'escada' })],
  }
  return {
    open: { sceneId: SALAO, name: 'Salão', map: salao },
    background: [{ sceneId: TORRE, name: 'Torre Alta', map: torre }],
  }
}

function mesa() {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: 700,
    now: () => 1_000_000,
    randomId: () => `id-${(n += 1)}`,
  })
  const w = mundo()
  const entrada = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound[0]?.msg
  if (entrada?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(entrada.playerId, 'heroi')
  // O recorte é o que diz ao host que ela vê a escada: sem snapshot, o pedido seria recusado.
  s.broadcast(w)
  return { s, w, playerId: entrada.playerId, resume: entrada.resumeToken }
}

function msgs(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

/** Ana pede a escada; o host guarda o pedido e devolve o id que o aviso do mestre usa. */
function pedeEscada(m: ReturnType<typeof mesa>, clientId = 'c1'): string {
  const r = m.s.handleMessage(clientId, { type: 'pin.travel.request', pinId: 'escada' }, m.w)
  const id = r.travelRequest?.requestId
  if (id === undefined) throw new Error(`esperava pedido ao mestre, veio ${JSON.stringify(r.outbound)}`)
  return id
}

describe('protocolo: away', () => {
  it('aceita só o liga/desliga booleano', () => {
    expect(parsePlayerMessage({ type: 'away', away: true, extra: 'x' })).toEqual({ type: 'away', away: true })
    expect(parsePlayerMessage({ type: 'away', away: false })).toEqual({ type: 'away', away: false })
    expect(parsePlayerMessage({ type: 'away', away: 'sim' })).toBeNull()
    expect(parsePlayerMessage({ type: 'away' })).toBeNull()
  })
})

describe('hostSession: Volto já', () => {
  it('confirma ao jogador e o mestre lê "fora" no painel, com a conexão de pé', () => {
    const m = mesa()
    const r = m.s.handleMessage('c1', { type: 'away', away: true }, m.w)
    expect(msgs(r, 'c1')).toEqual([{ type: 'away', away: true }])
    const ana = m.s.listPlayers(m.w)[0]
    expect(ana?.away).toBe(true)
    expect(ana?.connected).toBe(true)
    // Continua jogando e na mesma cena: a ficha não sai do mapa.
    expect(ana?.status).toBe('playing')
    expect(ana?.sceneId).toBe(SALAO)
  })

  it('a ficha fica travada enquanto está fora, e volta a andar ao voltar', () => {
    const m = mesa()
    m.s.handleMessage('c1', { type: 'away', away: true }, m.w)
    const fora = m.s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 250, y: 200 }, m.w)
    expect(fora.applyMove).toBeUndefined()
    expect(msgs(fora, 'c1')).toEqual([{ type: 'token.move.rejected', reqId: 'r1', reason: 'locked' }])

    const volta = m.s.handleMessage('c1', { type: 'away', away: false }, m.w)
    expect(msgs(volta, 'c1')).toEqual([{ type: 'away', away: false }])
    expect(m.s.listPlayers(m.w)[0]?.away).toBeUndefined()
    const anda = m.s.handleMessage('c1', { type: 'token.move', reqId: 'r2', tokenId: 'heroi', x: 250, y: 200 }, m.w)
    expect(anda.applyMove).toEqual({ tokenId: 'heroi', x: 250, y: 200 })
  })

  it('não aceita pedido de passagem novo de quem está fora', () => {
    const m = mesa()
    m.s.handleMessage('c1', { type: 'away', away: true }, m.w)
    const r = m.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada' }, m.w)
    expect(r.travelRequest).toBeUndefined()
    expect(msgs(r, 'c1')).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
  })

  it('o pedido que esperava fica suspenso: a queda da conexão durante o Volto já não o apaga', () => {
    const m = mesa()
    const pedido = pedeEscada(m)
    m.s.handleMessage('c1', { type: 'away', away: true }, m.w)
    m.s.disconnect('c1')
    expect(m.s.isTravelPending(pedido)).toBe(true)
    const ana = m.s.listPlayers(m.w)[0]
    expect(ana?.travelPending).toBe(true)
    expect(ana?.away).toBe(true)
    expect(ana?.connected).toBe(false)
  })

  it('controle: sem o Volto já, a queda apaga o pedido como sempre', () => {
    const m = mesa()
    const pedido = pedeEscada(m)
    m.s.disconnect('c1')
    expect(m.s.isTravelPending(pedido)).toBe(false)
    expect(m.s.listPlayers(m.w)[0]?.travelPending).toBeUndefined()
  })

  it('"Deixar ir" dado enquanto ela está fora não a leva: o pedido volta ao mestre quando ela voltar', () => {
    const m = mesa()
    const pedido = pedeEscada(m)
    m.s.handleMessage('c1', { type: 'away', away: true }, m.w)

    const aprovado = m.s.approveTravel(pedido, m.w)
    expect(aprovado.applyTransfer).toBeUndefined()
    expect(aprovado.outbound).toEqual([])
    expect(m.s.isTravelPending(pedido)).toBe(true)

    const volta = m.s.handleMessage('c1', { type: 'away', away: false }, m.w)
    // A tela dela volta a dizer "Aguardando o mestre…", e o mestre recebe a pergunta de novo.
    expect(msgs(volta, 'c1')).toEqual([{ type: 'away', away: false, travelPending: true }])
    expect(volta.travelRequest).toEqual({
      requestId: pedido,
      playerId: m.playerId,
      playerName: 'Ana',
      pinLabel: 'escada',
      toSceneId: TORRE,
      toSceneName: 'Torre Alta',
    })
    const agora = m.s.approveTravel(pedido, m.w)
    expect(agora.applyTransfer?.toSceneId).toBe(TORRE)
    expect(agora.applyTransfer?.tokenId).toBe('heroi')
  })

  it('voltar sem "Deixar ir" pendurado não repete a pergunta ao mestre (o aviso dele ainda está aberto)', () => {
    const m = mesa()
    pedeEscada(m)
    m.s.handleMessage('c1', { type: 'away', away: true }, m.w)
    const volta = m.s.handleMessage('c1', { type: 'away', away: false }, m.w)
    expect(volta.travelRequest).toBeUndefined()
    expect(msgs(volta, 'c1')).toEqual([{ type: 'away', away: false, travelPending: true }])
  })

  it('retomar a sessão durante o Volto já avisa a tela ANTES do mapa, com o pedido que espera', () => {
    const m = mesa()
    pedeEscada(m)
    m.s.handleMessage('c1', { type: 'away', away: true }, m.w)
    m.s.disconnect('c1')
    const r = m.s.handleMessage('c9', { type: 'join', code: CODE, name: 'Ana', resume: m.resume }, m.w)
    const tipos = msgs(r, 'c9').map((msg) => msg.type)
    expect(tipos.slice(0, 3)).toEqual(['welcome', 'away', 'snapshot'])
    expect(msgs(r, 'c9')[1]).toEqual({ type: 'away', away: true, travelPending: true })
    // Voltou como a mesma Ana: nada de "Ana (2)".
    expect(m.s.listPlayers(m.w).map((p) => p.name)).toEqual(['Ana'])
  })

  it('expulsar apaga o Volto já junto com o resto', () => {
    const m = mesa()
    m.s.handleMessage('c1', { type: 'away', away: true }, m.w)
    m.s.kick('c1')
    expect(m.s.listPlayers(m.w)).toEqual([])
    const nova = m.s.handleMessage('c2', { type: 'join', code: CODE, name: 'Ana' }, m.w)
    expect(msgs(nova, 'c2').some((msg) => msg.type === 'away')).toBe(false)
  })

  it('quem não entrou não pode se declarar fora', () => {
    const m = mesa()
    const r = m.s.handleMessage('cx', { type: 'away', away: true }, m.w)
    expect(msgs(r, 'cx')).toEqual([{ type: 'error', reason: 'not_joined' }])
  })
})

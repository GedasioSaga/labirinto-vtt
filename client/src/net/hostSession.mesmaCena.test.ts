import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { arrivalSpot } from '../lib/pinTravel'
import type { MapData, Pin, PinPassage, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ATALHO NA MESMA CENA no host: a escada do térreo leva ao topo da MESMA
 * torre. O pedido passa pelas mesmas regras da viagem entre cenas (pino
 * visível, ligado em mão dupla, modo livre/pede/trancada), a ficha anda
 * dentro do mapa e o jogador continua na cena, com a memória dela.
 *
 * O que NUNCA chega ao jogador: o destino do pino (id do par), o par que está
 * no escuro e a chegada oculta da mão única.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const TORRE = 'cena-torre'
const CRIPTA = 'cena-cripta'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: `Escada ${id}`, image: null, destino, ...extra }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/** A torre: o herói no térreo, ao lado da escada que sobe; o topo fica a 1.600 px, no escuro. */
function mundo(opts: { passagem?: PinPassage; mudo?: boolean; soChegada?: boolean; heroi?: { x: number; y: number } } = {}): HostWorld {
  const heroi = opts.heroi ?? { x: 200, y: 200 }
  const map: MapData = {
    ...createEmptyMap('mapa-torre', 'Torre', 40, 10, 50),
    tokens: [token('heroi', heroi.x, heroi.y)],
    pins: [
      viagem('escada-baixo', 250, 200, { sceneId: TORRE, pinId: 'escada-topo' }, {
        ...(opts.passagem === undefined ? {} : { passagem: opts.passagem }),
        ...(opts.mudo === true ? { mudo: true } : {}),
      }),
      viagem('escada-topo', 1800, 250, { sceneId: TORRE, pinId: 'escada-baixo' }, opts.soChegada === true ? { soChegada: true } : {}),
    ],
  }
  const cripta: MapData = { ...createEmptyMap('mapa-cripta', 'Cripta Secreta', 20, 10, 50) }
  return {
    open: { sceneId: TORRE, name: 'Torre', map },
    background: [{ sceneId: CRIPTA, name: 'Cripta Secreta', map: cripta }],
  }
}

function mesa(opts: Parameters<typeof mundo>[0] = {}) {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const w = mundo(opts)
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  s.assignToken(ana.playerId, 'heroi')
  return { s, w, ana, pedir: (pinId: string) => s.handleMessage('c1', { type: 'pin.travel.request', pinId }, w) }
}

function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' | 'delta' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId && (o.msg.type === 'snapshot' || o.msg.type === 'delta'))?.msg
  if (msg === undefined || (msg.type !== 'snapshot' && msg.type !== 'delta')) throw new Error(`sem snapshot para ${clientId}`)
  return msg
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.travel.rejected' ? msg.reason : null
}

const chegada = (w: HostWorld) => {
  const topo = w.open.map.pins.find((p) => p.id === 'escada-topo')
  if (topo === undefined) throw new Error('sem topo')
  return arrivalSpot(w.open.map, topo, 1)
}

describe('hostSession: atalho na mesma cena', () => {
  it('livre: a ficha vai direto ao topo da MESMA cena, e o jogador lê que chegou', () => {
    const t = mesa({ passagem: 'livre' })
    const r = t.pedir('escada-baixo')
    const spot = chegada(t.w)
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toEqual({
      tokenId: 'heroi',
      playerId: t.ana.playerId,
      playerName: 'Ana',
      fromSceneId: TORRE,
      toSceneId: TORRE,
      toSceneName: 'Torre',
      x: spot.x,
      y: spot.y,
    })
    // No atalho o mapa é o mesmo: o jogador precisa saber QUAL ficha dele
    // atravessou para centrá-la (é dele, então o id não revela nada).
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed', tokenId: 'heroi' } }])
  })

  it('duas fichas do jogador: o "Você chegou" diz a que atravessou (a mais perto do pino), não a primeira', () => {
    const t = mesa({ passagem: 'livre' })
    const w: HostWorld = { ...t.w, open: { ...t.w.open, map: { ...t.w.open.map, tokens: [token('heroi', 200, 200), token('cachorro', 245, 205)] } } }
    t.s.assignToken(t.ana.playerId, 'cachorro')
    const r = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada-baixo' }, w)
    expect(r.applyTransfer?.tokenId).toBe('cachorro')
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed', tokenId: 'cachorro' } }])
  })

  it('pede: o mestre lê o pedido para a própria cena, e o "Deixar ir" move dentro dela', () => {
    const t = mesa()
    const r = t.pedir('escada-baixo')
    expect(r.outbound).toEqual([])
    expect(r.travelRequest).toMatchObject({ playerName: 'Ana', pinLabel: 'Escada escada-baixo', toSceneId: TORRE, toSceneName: 'Torre' })
    if (r.travelRequest === undefined) throw new Error('o pedido deveria valer')
    const ok = t.s.approveTravel(r.travelRequest.requestId, t.w)
    expect(ok.applyTransfer).toMatchObject({ tokenId: 'heroi', fromSceneId: TORRE, toSceneId: TORRE, x: chegada(t.w).x, y: chegada(t.w).y })
  })

  it('trancada: ninguém passa e nada chega ao mestre', () => {
    // Trancada MUDA: a que aceita tentativas (o padrão) vira pedido ao mestre (hostSession.pinoTrancado).
    const t = mesa({ passagem: 'trancada', mudo: true })
    const r = t.pedir('escada-baixo')
    expect(recusa(r)).toBe('unavailable')
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toBeUndefined()
  })

  it('depois de passar, o jogador continua na MESMA cena, com o que já viu dela', () => {
    const t = mesa({ passagem: 'livre' })
    const antes = snapshotDe(t.s.broadcast(t.w), 'c1')
    const r = t.pedir('escada-baixo')
    const spot = chegada(t.w)
    const depois = mundo({ passagem: 'livre', heroi: spot })
    const snap = snapshotDe(t.s.broadcast(depois), 'c1')
    expect(snap.map.id).toBe('mapa-torre')
    expect(snap.map.tokens.find((tk) => tk.id === 'heroi')).toMatchObject({ x: spot.x, y: spot.y })
    expect(t.s.listPlayers(depois).find((p) => p.playerId === t.ana.playerId)?.sceneName).toBe('Torre')
    // A memória é da cena: o térreo que ela viu antes de subir continua explorado.
    expect(r.applyTransfer?.toSceneId).toBe(TORRE)
    expect(snap.explored).not.toEqual(antes.explored)
    expect(snap.map.pins.map((p) => p.id).sort()).toEqual(['escada-baixo', 'escada-topo'])
  })

  it('SEGURANÇA — o recorte não leva o destino nem o par que está no escuro', () => {
    const t = mesa()
    const snap = snapshotDe(t.s.broadcast(t.w), 'c1')
    const escada = snap.map.pins.find((p) => p.id === 'escada-baixo')
    expect(escada).toBeDefined()
    expect(escada).not.toHaveProperty('destino')
    expect(escada).not.toHaveProperty('saidas')
    expect(snap.map.pins.map((p) => p.id)).toEqual(['escada-baixo'])
    // Nem por outro campo: o id do topo e o nome de outra cena não saem em lugar nenhum.
    const texto = JSON.stringify(snap)
    expect(texto).not.toContain('escada-topo')
    expect(texto).not.toContain('Cripta Secreta')
  })

  it('SEGURANÇA — o par no escuro não serve de atalho: pedido por ele é recusado', () => {
    const t = mesa({ passagem: 'livre' })
    const r = t.pedir('escada-topo')
    expect(recusa(r)).toBe('unavailable')
    expect(r.applyTransfer).toBeUndefined()
  })

  it('SEGURANÇA — mão única na mesma cena: a chegada oculta não chega nem com a ficha em cima', () => {
    const t = mesa({ passagem: 'livre', soChegada: true })
    // Ela viu o térreo antes de cair: o pino de baixo fica na memória, o de cima nunca.
    t.s.broadcast(t.w)
    const r = t.pedir('escada-baixo')
    expect(r.applyTransfer).toMatchObject({ fromSceneId: TORRE, toSceneId: TORRE })
    const snap = snapshotDe(t.s.broadcast(mundo({ passagem: 'livre', soChegada: true, heroi: chegada(t.w) })), 'c1')
    expect(snap.map.pins.map((p) => p.id)).toEqual(['escada-baixo'])
    expect(JSON.stringify(snap)).not.toContain('escada-topo')
  })
})

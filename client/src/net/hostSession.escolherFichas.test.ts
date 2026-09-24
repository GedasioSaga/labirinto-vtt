import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import {
  createHostSession,
  TRAVEL_REQUEST_MIN_INTERVAL_MS,
  TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS,
  type HostResult,
  type HostWorld,
} from './hostSession'
import { PIN_TRAVEL_MAX_TOKENS, type HostMessage } from './protocol'
import { travelCandidates } from '../lib/pinGroup'

/**
 * ESCOLHER FICHAS NO PINO — quem tem várias fichas perto do pino escolhe quais
 * passam (`tokenIds` no pedido), em vez de o host levar só a mais perto.
 *
 * A autoridade é do host: cada ficha da lista tem de ser DO jogador, estar no
 * recorte dele (a ficha que o mestre escondeu não conta) e estar no grupo do
 * pino (`travelCandidates`). Qualquer falha é o mesmo `unavailable` de sempre —
 * a recusa não ensina ao jogador que a ficha escondida existe. Os nomes das
 * fichas vão só ao mestre.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const PORAO = 'cena-porao'
const BEIRAL = 'cena-beiral'
const GRID = 50

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, description: string, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino, ...extra }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

interface Posicoes {
  enzo: { x: number; y: number }
  rufo: { x: number; y: number }
  /** O mestre escondeu a ficha `sumido` (dele) e, com `enzoEscondido`, a do próprio Enzo. */
  enzoEscondido: boolean
}

/**
 * O Porão aberto: o pino `escotilha` (pede) e o `alcapao` (livre), os dois para
 * o Beiral. Enzo tem `enzo` (60 px do pino), `rufo` (30 px: a mais perto),
 * `longe` (a 900 px) e `sumido` (colada no pino, escondida pelo mestre). Bia
 * tem `bia`, colada no pino.
 */
function mundo(p: Posicoes): HostWorld {
  const porao: MapData = {
    ...createEmptyMap('mapa-porao', 'Aventura', 40, 10, GRID),
    tokens: [
      ficha('enzo', 'Enzo', p.enzo.x, p.enzo.y, p.enzoEscondido ? { hidden: true } : {}),
      ficha('rufo', 'Rufo', p.rufo.x, p.rufo.y),
      ficha('longe', 'Tito', 1200, 200),
      ficha('sumido', 'Vulto', 290, 200, { hidden: true }),
      ficha('bia', 'Bia', 310, 200),
    ],
    pins: [
      viagem('escotilha', 300, 200, 'Escotilha', { sceneId: BEIRAL, pinId: 'chegada' }),
      viagem('alcapao', 300, 300, 'Alçapão', { sceneId: BEIRAL, pinId: 'queda' }, { passagem: 'livre' }),
    ],
  }
  const beiral: MapData = {
    ...createEmptyMap('mapa-beiral', 'Beiral', 40, 10, GRID),
    pins: [
      viagem('chegada', 1000, 250, 'Topo da escotilha', { sceneId: PORAO, pinId: 'escotilha' }),
      viagem('queda', 600, 250, 'Fundo do alçapão', { sceneId: PORAO, pinId: 'alcapao' }),
    ],
  }
  return { open: { sceneId: PORAO, name: 'Porão', map: porao }, background: [{ sceneId: BEIRAL, name: 'Beiral', map: beiral }] }
}

function mesa() {
  let clock = 1_000_000
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => clock,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const pos: Posicoes = { enzo: { x: 240, y: 200 }, rufo: { x: 270, y: 200 }, enzoEscondido: false }
  const w = () => mundo(pos)
  const enzo = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Enzo' }, w()).outbound)
  for (const id of ['enzo', 'rufo', 'longe', 'sumido']) s.assignToken(enzo.playerId, id)
  const bia = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w()).outbound)
  s.assignToken(bia.playerId, 'bia')
  s.broadcast(w())
  return {
    s,
    pos,
    w,
    /** Passa o intervalo mínimo entre pedidos (por jogador e por pino). */
    esperar: () => {
      clock += Math.max(TRAVEL_REQUEST_MIN_INTERVAL_MS, TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS)
    },
    pedir: (tokenIds?: unknown, pinId = 'escotilha'): HostResult =>
      s.handleMessage('c1', tokenIds === undefined ? { type: 'pin.travel.request', pinId } : { type: 'pin.travel.request', pinId, tokenIds }, w()),
  }
}

const RECUSA = [{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }]

describe('hostSession: escolher quais fichas passam pelo pino', () => {
  it('sem lista (cliente antigo) nada muda: vai só a ficha mais perto, e o mestre lê o pedido de sempre', () => {
    const t = mesa()
    const pedido = t.pedir().travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    expect(pedido.tokenNames).toBeUndefined()
    const r = t.s.approveTravel(pedido.requestId, t.w())
    expect(r.applyTransfer).toMatchObject({ tokenId: 'rufo', toSceneId: BEIRAL })
    expect(r.applyTransfer?.companions).toBeUndefined()
  })

  it('Enzo escolhe só a ficha dele: passa ENZO, não o Rufo que está mais perto, e o mestre lê o nome da ficha', () => {
    const t = mesa()
    const r = t.pedir(['enzo'])
    // Nada volta ao jogador enquanto espera: o nome da ficha é só do mestre.
    expect(r.outbound).toEqual([])
    const pedido = r.travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    expect(pedido.tokenNames).toEqual(['Enzo'])
    const ida = t.s.approveTravel(pedido.requestId, t.w())
    expect(ida.applyTransfer).toMatchObject({ tokenId: 'enzo', fromSceneId: PORAO, toSceneId: BEIRAL })
    expect(ida.applyTransfer?.companions).toBeUndefined()
    expect(ida.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
  })

  it('as duas escolhidas passam juntas: a mais perto no pino par, a outra na casa vizinha', () => {
    const t = mesa()
    const pedido = t.pedir(['enzo', 'rufo']).travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    // Da mais perto do pino para a mais longe: é a ordem em que chegam.
    expect(pedido.tokenNames).toEqual(['Rufo', 'Enzo'])
    const ida = t.s.approveTravel(pedido.requestId, t.w())
    const transfer = ida.applyTransfer
    if (transfer === undefined) throw new Error('deveria transferir')
    expect(transfer.tokenId).toBe('rufo')
    expect(transfer.companions?.map((c) => c.tokenId)).toEqual(['enzo'])
    const outra = transfer.companions?.[0]
    if (outra === undefined) throw new Error('faltou a companheira')
    expect(Math.max(Math.abs(outra.x - transfer.x), Math.abs(outra.y - transfer.y))).toBe(GRID)
  })

  it('pino livre: as escolhidas passam na hora, sem o mestre, todas juntas', () => {
    const t = mesa()
    const r = t.pedir(['rufo', 'enzo'], 'alcapao')
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toMatchObject({ tokenId: 'rufo', toSceneId: BEIRAL })
    expect(r.applyTransfer?.companions?.map((c) => c.tokenId)).toEqual(['enzo'])
  })

  it('SEGURANÇA — NPC em zona oculta na cena de destino não empurra a companheira; à vista, empurra', () => {
    const passar = (npc: Partial<MapData>) => {
      const t = mesa()
      const w = t.w()
      const destino = w.background[0]
      if (destino === undefined) throw new Error('faltou o Beiral')
      const mundoComNpc: HostWorld = { ...w, background: [{ ...destino, map: { ...destino.map, ...npc } }] }
      const r = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'alcapao', tokenIds: ['rufo', 'enzo'] }, mundoComNpc)
      const outra = r.applyTransfer?.companions?.[0]
      if (outra === undefined) throw new Error('faltou a companheira')
      return { x: outra.x, y: outra.y }
    }
    const livre = passar({})
    const guarda = ficha('guarda', 'Guarda', livre.x, livre.y)
    const zona = {
      id: 'zona',
      name: 'nome-da-zona',
      revealed: false,
      points: [
        { x: livre.x - 20, y: livre.y - 20 },
        { x: livre.x + 20, y: livre.y - 20 },
        { x: livre.x + 20, y: livre.y + 20 },
        { x: livre.x - 20, y: livre.y + 20 },
      ],
    }
    // Escondido pela zona: o jogador vê a casa vazia, e a companheira senta nela como se nada houvesse.
    expect(passar({ tokens: [guarda], concealZones: [zona] })).toEqual(livre)
    // CONTROLE: o mesmo guarda à vista ocupa a casa.
    expect(passar({ tokens: [guarda] })).not.toEqual(livre)
  })

  it('SEGURANÇA — ficha escondida pelo mestre, de outro jogador, longe ou inventada: o mesmo "indisponível", e nada chega ao mestre', () => {
    const t = mesa()
    const casos: string[][] = [['sumido'], ['enzo', 'sumido'], ['bia'], ['enzo', 'bia'], ['longe'], ['inventada']]
    for (const tokenIds of casos) {
      const r = t.pedir(tokenIds)
      expect(r.outbound).toEqual(RECUSA)
      expect(r.travelRequest).toBeUndefined()
      expect(r.applyTransfer).toBeUndefined()
      t.esperar()
    }
    // Controle positivo: a mesma mesa aceita a lista certa.
    expect(t.pedir(['enzo']).travelRequest).toMatchObject({ tokenNames: ['Enzo'] })
  })

  it('SEGURANÇA — o mestre esconde uma escolhida antes do "Deixar ir": ninguém passa, nem a outra', () => {
    const t = mesa()
    const pedido = t.pedir(['enzo', 'rufo']).travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    t.pos.enzoEscondido = true
    const r = t.s.approveTravel(pedido.requestId, t.w())
    expect(r.applyTransfer).toBeUndefined()
    expect(r.outbound).toEqual(RECUSA)
  })

  it('o pedido cai quando uma ESCOLHIDA se afasta; a ficha que ficou de fora anda à vontade', () => {
    const t = mesa()
    expect(t.pedir(['enzo']).travelRequest).toBeDefined()
    // O Rufo não vai: afastá-lo não derruba o pedido do Enzo.
    const rufoAnda = t.s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'rufo', x: 25, y: 200 }, t.w())
    expect(rufoAnda.travelCancelled).toBeUndefined()
    t.pos.rufo = { x: 25, y: 200 }
    const enzoAnda = t.s.handleMessage('c1', { type: 'token.move', reqId: 'r2', tokenId: 'enzo', x: 25, y: 250 }, t.w())
    expect(enzoAnda.travelCancelled).toMatchObject({ reason: 'far' })
    expect(enzoAnda.outbound).toContainEqual({ clientId: 'c1', msg: { type: 'pin.travel.cancelled', reason: 'far' } })
  })

  it('a ficha que ficou de fora chega mais perto do pino: o pedido segue e o "Deixar ir" leva a escolhida', () => {
    const t = mesa()
    // Rufo a 30 px, Enzo a 125 px: no grupo (30 + 2 casas = 130 px).
    t.pos.enzo = { x: 175, y: 200 }
    const pedido = t.pedir(['enzo']).travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    // Rufo não vai e encosta no pino: o grupo contado a partir dele encolheria para 105 px.
    const rufoAnda = t.s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'rufo', x: 300, y: 205 }, t.w())
    expect(rufoAnda.travelCancelled).toBeUndefined()
    t.pos.rufo = { x: 300, y: 205 }
    expect(t.s.isTravelPending(pedido.requestId)).toBe(true)
    const r = t.s.approveTravel(pedido.requestId, t.w())
    expect(r.applyTransfer).toMatchObject({ tokenId: 'enzo', fromSceneId: PORAO, toSceneId: BEIRAL })
    expect(r.applyTransfer?.companions).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
  })

  it('a escolhida da frente chega mais perto do pino: o pedido segue e as duas passam', () => {
    const t = mesa()
    t.pos.enzo = { x: 175, y: 200 }
    const pedido = t.pedir(['enzo', 'rufo']).travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    const rufoAnda = t.s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'rufo', x: 300, y: 205 }, t.w())
    expect(rufoAnda.travelCancelled).toBeUndefined()
    t.pos.rufo = { x: 300, y: 205 }
    const r = t.s.approveTravel(pedido.requestId, t.w())
    expect(r.applyTransfer).toMatchObject({ tokenId: 'rufo', toSceneId: BEIRAL })
    expect(r.applyTransfer?.companions?.map((c) => c.tokenId)).toEqual(['enzo'])
  })

  it('o "Deixar ir" recusa quando a escolhida está além da folga do pedido (o mestre a arrastou para longe)', () => {
    const t = mesa()
    t.pos.enzo = { x: 175, y: 200 }
    const pedido = t.pedir(['enzo']).travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    // O mestre move sem passar pelo handleMove: 125 px + 2 casas = 225 px; a 250 px, passou.
    t.pos.enzo = { x: 50, y: 200 }
    const r = t.s.approveTravel(pedido.requestId, t.w())
    expect(r.applyTransfer).toBeUndefined()
    expect(r.outbound).toEqual(RECUSA)
  })

  it('com mais fichas junto do pino do que o teto, o que o cartão oferece (todas marcadas) é um pedido que VALE — ninguém fica preso esperando', () => {
    const t = mesa()
    const w = t.w()
    // Enzo ganha uma tropa colada no pino: com Enzo e Rufo, PIN_TRAVEL_MAX_TOKENS + 1 fichas no grupo.
    const tropa = Array.from({ length: PIN_TRAVEL_MAX_TOKENS - 1 }, (_, i) => ficha(`tropa${i}`, `Tropa ${i}`, 300, 150 - i * 5))
    const mundoTropa: HostWorld = { ...w, open: { ...w.open, map: { ...w.open.map, tokens: [...w.open.map.tokens, ...tropa] } } }
    const enzoId = t.s.listPlayers().find((p) => p.name === 'Enzo')?.playerId
    if (enzoId === undefined) throw new Error('faltou o Enzo')
    for (const f of tropa) t.s.assignToken(enzoId, f.id)
    const deleNoRecorte = mundoTropa.open.map.tokens.filter((f) => f.hidden !== true && f.id !== 'bia')
    const pino = mundoTropa.open.map.pins.find((p) => p.id === 'escotilha')
    if (pino === undefined) throw new Error('faltou a escotilha')
    // Rufo, a mais perto, a 30 px: o grupo vai até 30 px + 2 casas = 130 px.
    const noGrupo = deleNoRecorte.filter((f) => Math.hypot(f.x - pino.x, f.y - pino.y) <= 130)
    expect(noGrupo).toHaveLength(PIN_TRAVEL_MAX_TOKENS + 1)
    // O que o cartão do jogador oferece, todas marcadas de início.
    const oferecidas = travelCandidates(deleNoRecorte, pino, GRID).map((f) => f.id)
    const r = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escotilha', tokenIds: oferecidas }, mundoTropa)
    expect(r.outbound).toEqual([])
    const pedido = r.travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    expect(pedido.tokenNames).toHaveLength(PIN_TRAVEL_MAX_TOKENS)
    const ida = t.s.approveTravel(pedido.requestId, mundoTropa)
    expect(ida.applyTransfer?.companions).toHaveLength(PIN_TRAVEL_MAX_TOKENS - 1)
  })

  it('lista fora da forma é mensagem inválida: vazia, repetida, com não-texto, grande demais ou texto solto', () => {
    const t = mesa()
    const grande = Array.from({ length: PIN_TRAVEL_MAX_TOKENS + 1 }, (_, i) => `f${i}`)
    for (const tokenIds of [[], ['enzo', 'enzo'], ['enzo', 7], grande, 'enzo', ['']]) {
      const r = t.pedir(tokenIds)
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } }])
    }
  })
})

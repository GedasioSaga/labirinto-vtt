import { describe, expect, it } from 'vitest'
import { countExploredCells, decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap, setTokenPosition } from '../lib/mapFactory'
import type { MapData, Pin, Region, Token, Wall } from '../types/map'
import { SIGNAL_MIN_INTERVAL_MS, signalColor } from '../lib/signals'
import {
  createHostSession,
  DOOR_TOGGLE_MIN_INTERVAL_MS,
  TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS,
  MAX_SCENE_MEMORIES_PER_PLAYER,
  TRAVEL_REQUEST_MIN_INTERVAL_MS,
  VISION_RADIUS_MAX,
  VISION_RADIUS_MIN,
  type HostResult,
  type HostWorld,
} from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const RADIUS = 700

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function roomRegion(id: string, name: string, points: { x: number; y: number }[]): Region {
  return { id, points, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name } }
}

/** Duas salas separadas por parede vertical em x=500. */
function twoRooms(): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    walls: [wall('divisoria', 500, 0, 500, 1000)],
    tokens: [token('heroi', 200, 200), token('ladino', 800, 200)],
  }
}

function sequentialIds(): () => string {
  let n = 0
  return () => {
    n += 1
    return `id-${n}`
  }
}

function newSession() {
  return createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 0, randomId: sequentialIds() })
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string; resumeToken: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

describe('hostSession', () => {
  it('join com código errado devolve error bad_code e não cria jogador', () => {
    const s = newSession()
    const r = s.handleMessage('c1', { type: 'join', code: 'ZZZZZZ', name: 'Ana' }, twoRooms())
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'bad_code' } }])
    expect(s.listPlayers()).toEqual([])
  })

  it('mensagem inválida devolve error invalid_message; ping é ignorado', () => {
    const s = newSession()
    expect(s.handleMessage('c1', { name: 'x' }, twoRooms()).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } },
    ])
    expect(s.handleMessage('c1', { type: 'ping' }, twoRooms()).outbound).toEqual([])
  })

  it('join ok devolve welcome + lobby.waiting e lista jogador aguardando', () => {
    const s = newSession()
    const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, twoRooms())
    expect(r.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
    expect(s.listPlayers()).toMatchObject([{ clientId: 'c1', name: 'Ana', status: 'waiting', connected: true }])
  })

  it('assign + broadcast: jogador recebe só o próprio token, nunca o alheio atrás da parede', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    const p2 = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    s.assignToken(p2.playerId, 'ladino')

    const r = s.broadcast(map)
    expect(s.rev).toBe(1)
    const toC1 = r.outbound.find((o) => o.clientId === 'c1')?.msg
    if (toC1?.type !== 'snapshot') throw new Error('esperava snapshot para c1')
    expect(toC1.rev).toBe(1)
    expect(toC1.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(toC1)).not.toContain('ladino')
    expect(toC1.vision.length).toBe(1)
  })

  it('A5 SEGURANÇA: zona oculta ativa sai só como geometria, esconde o token e não vira explorado; Revelar devolve', () => {
    const s = newSession()
    const zonePoints = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
      { x: 100, y: 300 },
    ]
    const withZone = (revealed: boolean): MapData => ({
      ...twoRooms(),
      tokens: [token('heroi', 50, 50), token('ladino', 800, 200), token('espiao-na-zona', 200, 200)],
      concealZones: [{ id: 'zona-x', name: 'nome-zona-secreta', revealed, points: zonePoints }],
    })
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, withZone(false)).outbound)
    s.assignToken(p1.playerId, 'heroi')

    const hidden = s.broadcast(withZone(false)).outbound[0]?.msg
    if (hidden?.type !== 'snapshot') throw new Error('esperava snapshot')
    const json = JSON.stringify(hidden)
    expect(json).not.toContain('espiao-na-zona')
    expect(json).not.toContain('nome-zona-secreta')
    expect(json).not.toContain('zona-x')
    expect(hidden.concealed).toEqual([zonePoints])
    const expHidden = decodeExploration(hidden.explored)
    if (expHidden === null) throw new Error('explored inválido')
    expect(isPointExplored(expHidden, { x: 200, y: 200 })).toBe(false)
    expect(isPointExplored(expHidden, { x: 50, y: 400 })).toBe(true)

    const shown = s.broadcast(withZone(true)).outbound[0]?.msg
    if (shown?.type !== 'snapshot') throw new Error('esperava snapshot')
    expect(JSON.stringify(shown)).toContain('espiao-na-zona')
    expect(shown.concealed).toEqual([])
    const expShown = decodeExploration(shown.explored)
    if (expShown === null) throw new Error('explored inválido')
    expect(isPointExplored(expShown, { x: 200, y: 200 })).toBe(true)
  })

  describe('B3: controles do mestre por jogador', () => {
    const farRoom = [
      { x: 600, y: 600 },
      { x: 900, y: 600 },
      { x: 900, y: 900 },
      { x: 600, y: 900 },
    ]
    /** Duas salas; Ana (heroi) à esquerda, Bia (ladino) à direita; "Cripta distante" atrás da divisória. */
    function controlsSetup(extra: Partial<MapData> = {}) {
      const s = newSession()
      const map: MapData = { ...twoRooms(), regions: [roomRegion('cripta', 'Cripta distante', farRoom)], ...extra }
      const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound).playerId
      const bia = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound).playerId
      s.assignToken(ana, 'heroi')
      s.assignToken(bia, 'ladino')
      const snapshotTo = (clientId: string, m: MapData = map) => {
        const msg = s.broadcast(m).outbound.find((o) => o.clientId === clientId)?.msg
        if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
        return msg
      }
      return { s, map, ana, bia, snapshotTo }
    }
    const maxDistance = (vision: { x: number; y: number }[][], from: { x: number; y: number }) =>
      Math.max(...vision.flat().map((p) => Math.hypot(p.x - from.x, p.y - from.y)))

    it('raio por jogador muda a visão só daquele jogador; null volta ao global', () => {
      const t = controlsSetup()
      t.s.setVisionRadius(t.ana, 100)
      const both = t.s.broadcast(t.map).outbound
      const toAna = both.find((o) => o.clientId === 'c1')?.msg
      const toBia = both.find((o) => o.clientId === 'c2')?.msg
      if (toAna?.type !== 'snapshot' || toBia?.type !== 'snapshot') throw new Error('esperava snapshots')
      expect(maxDistance(toAna.vision, { x: 200, y: 200 })).toBeLessThanOrEqual(100 + 1)
      expect(maxDistance(toBia.vision, { x: 800, y: 200 })).toBeGreaterThan(100 + 1)
      expect(t.s.listPlayers().map((p) => p.visionRadius)).toEqual([100, RADIUS])

      t.s.setVisionRadius(t.ana, null)
      expect(maxDistance(t.snapshotTo('c1').vision, { x: 200, y: 200 })).toBeGreaterThan(100 + 1)
    })

    it('raio fora da faixa é limitado; não finito ou jogador desconhecido é ignorado', () => {
      const t = controlsSetup()
      t.s.setVisionRadius(t.ana, 1)
      expect(t.s.listPlayers()[0]?.visionRadius).toBe(VISION_RADIUS_MIN)
      t.s.setVisionRadius(t.ana, 1e9)
      expect(t.s.listPlayers()[0]?.visionRadius).toBe(VISION_RADIUS_MAX)
      t.s.setVisionRadius(t.ana, Number.NaN)
      expect(t.s.listPlayers()[0]?.visionRadius).toBe(VISION_RADIUS_MAX)
      t.s.setVisionRadius('fantasma', 300)
      expect(t.s.listPlayers().map((p) => p.visionRadius)).toEqual([VISION_RADIUS_MAX, RADIUS])
    })

    it('SEGURANÇA: Revelar planta envia a sala distante, mas não o token fora da visão', () => {
      const t = controlsSetup()
      const before = JSON.stringify(t.snapshotTo('c1'))
      expect(before).not.toContain('Cripta distante')

      t.s.revealPlan(t.ana, t.map)
      const after = t.snapshotTo('c1')
      const json = JSON.stringify(after)
      expect(json).toContain('Cripta distante')
      expect(json).not.toContain('ladino')
      expect(after.map.tokens.map((tk) => tk.id)).toEqual(['heroi'])
      const exp = decodeExploration(after.explored)
      if (exp === null) throw new Error('explored inválido')
      expect(isPointExplored(exp, { x: 800, y: 800 })).toBe(true)
      // Só a Ana: a Bia continua sem a planta do lado da Ana.
      const bia = decodeExploration(t.snapshotTo('c2').explored)
      if (bia === null) throw new Error('explored inválido')
      expect(isPointExplored(bia, { x: 100, y: 800 })).toBe(false)
    })

    it('Esconder de novo zera a exploração e as portas lembradas; a visão atual volta a marcar', () => {
      const door: Wall['door'] = { open: false, locked: false, kind: 'normal' }
      const t = controlsSetup({ walls: [wall('divisoria', 500, 0, 500, 1000), wall('porta-longe', 600, 950, 700, 950, door)] })
      t.s.revealPlan(t.ana, t.map)
      const revealed = t.snapshotTo('c1')
      expect(JSON.stringify(revealed)).toContain('porta-longe')

      t.s.hidePlan(t.ana)
      const hidden = t.snapshotTo('c1')
      const json = JSON.stringify(hidden)
      expect(json).not.toContain('Cripta distante')
      expect(json).not.toContain('porta-longe')
      const exp = decodeExploration(hidden.explored)
      if (exp === null) throw new Error('explored inválido')
      expect(isPointExplored(exp, { x: 800, y: 800 })).toBe(false)
      expect(isPointExplored(exp, { x: 200, y: 250 })).toBe(true)
      expect(countExploredCells(exp)).toBeLessThan(exp.cols * exp.rows / 2)
    })

    it('SEGURANÇA: com a planta revelada, zona oculta ativa continua escondida e não vira explorada', () => {
      const zone = { id: 'zona-cripta', name: 'nome-zona', revealed: false, points: farRoom }
      const t = controlsSetup({ concealZones: [zone] })
      t.s.revealPlan(t.ana, t.map)
      const snap = t.snapshotTo('c1')
      const json = JSON.stringify(snap)
      expect(json).not.toContain('Cripta distante')
      expect(json).not.toContain('nome-zona')
      const exp = decodeExploration(snap.explored)
      if (exp === null) throw new Error('explored inválido')
      expect(isPointExplored(exp, { x: 750, y: 750 })).toBe(false)
      expect(isPointExplored(exp, { x: 800, y: 100 })).toBe(true)
    })

    it('SEGURANÇA: Revelar planta não marca o interior de sala secreta como explorado', () => {
      const t = controlsSetup({ regions: [{ ...roomRegion('cripta-secreta', 'Cripta secreta', farRoom), secret: true }] })
      t.s.revealPlan(t.ana, t.map)
      const snap = t.snapshotTo('c1')
      expect(JSON.stringify(snap)).not.toContain('Cripta secreta')
      const exp = decodeExploration(snap.explored)
      if (exp === null) throw new Error('explored inválido')
      expect(isPointExplored(exp, { x: 750, y: 750 })).toBe(false)
      expect(isPointExplored(exp, { x: 800, y: 100 })).toBe(true)
    })

    it('kick apaga o raio ajustado', () => {
      const t = controlsSetup()
      t.s.setVisionRadius(t.ana, 100)
      t.s.kick('c1')
      const again = welcomeOf(t.s.handleMessage('c3', { type: 'join', code: CODE, name: 'Ana' }, t.map).outbound).playerId
      expect(t.s.listPlayers().find((p) => p.playerId === again)?.visionRadius).toBe(RADIUS)
    })
  })

  it('broadcast ignora jogador sem token', () => {
    const s = newSession()
    s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, twoRooms())
    expect(s.broadcast(twoRooms()).outbound).toEqual([])
  })

  it('token.move de token alheio é rejeitado com not_owner, sem applyMove', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ladino', x: 810, y: 200 }, map)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'not_owner' } }])
    expect(r.applyMove).toBeUndefined()
  })

  it('token.move antes do join devolve not_joined', () => {
    const s = newSession()
    const r = s.handleMessage('c9', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 1, y: 1 }, twoRooms())
    expect(r.outbound).toEqual([{ clientId: 'c9', msg: { type: 'error', reason: 'not_joined' } }])
  })

  it('move válido devolve accepted e applyMove para o integrador', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r2', tokenId: 'heroi', x: 240, y: 200 }, map)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.accepted', reqId: 'r2', x: 240, y: 200 } }])
    expect(r.applyMove).toEqual({ tokenId: 'heroi', x: 240, y: 200 })
  })

  it('tocha presa: o jogador move a própria ficha e o próximo snapshot traz a luz junto; o vínculo alheio não vaza', () => {
    const s = newSession()
    const map: MapData = {
      ...twoRooms(),
      lights: [
        { id: 'tocha', x: 250, y: 200, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'heroi' },
        { id: 'tocha-do-ladino', x: 450, y: 200, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'ladino' },
      ],
    }
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    const p2 = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    s.assignToken(p2.playerId, 'ladino')
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r9', tokenId: 'heroi', x: 240, y: 260 }, map)
    if (r.applyMove === undefined) throw new Error('esperava applyMove')
    // O integrador aplica o movimento com o mesmo setTokenPosition do editor.
    const moved = setTokenPosition(map, r.applyMove.tokenId, r.applyMove.x, r.applyMove.y)

    const toC1 = s.broadcast(moved).outbound.find((o) => o.clientId === 'c1')?.msg
    if (toC1?.type !== 'snapshot') throw new Error('esperava snapshot para c1')
    expect(toC1.map.lights.find((l) => l.id === 'tocha')).toEqual({ id: 'tocha', x: 290, y: 260, radius: 80, color: '#f00', intensity: 1, attachedTokenId: 'heroi' })
    const alheia = toC1.map.lights.find((l) => l.id === 'tocha-do-ladino')
    expect(alheia).toMatchObject({ x: 450, y: 200 })
    expect(alheia !== undefined && 'attachedTokenId' in alheia).toBe(false)
    expect(JSON.stringify(toC1)).not.toContain('"ladino"')
  })

  it('move atravessando parede é rejeitado com wall', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r3', tokenId: 'heroi', x: 700, y: 200 }, map)
    expect(r.outbound[0]?.msg).toEqual({ type: 'token.move.rejected', reqId: 'r3', reason: 'wall' })
  })

  it('resume após disconnect reassume o playerId e manda snapshot se já tinha token', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    s.disconnect('c1')
    expect(s.listPlayers()[0]).toMatchObject({ connected: false, clientId: null })

    const r = s.handleMessage('c7', { type: 'join', code: CODE, name: 'Ana', resume: p1.resumeToken }, map)
    expect(welcomeOf(r.outbound)).toEqual(p1)
    expect(r.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'snapshot'])
    expect(s.listPlayers()).toMatchObject([{ clientId: 'c7', playerId: p1.playerId, status: 'playing' }])
    // A conexão antiga não fala mais por esse jogador.
    expect(s.handleMessage('c1', { type: 'token.move', reqId: 'x', tokenId: 'heroi', x: 1, y: 1 }, map).outbound[0]?.msg).toEqual({
      type: 'error',
      reason: 'not_joined',
    })
  })

  it('resume com token desconhecido cria jogador novo aguardando', () => {
    const s = newSession()
    const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana', resume: 'inexistente' }, twoRooms())
    expect(r.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
  })

  it('kick gera kicked, remove o jogador e invalida o resume', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    expect(s.kick('c1').outbound).toEqual([{ clientId: 'c1', msg: { type: 'kicked' } }])
    expect(s.listPlayers()).toEqual([])
    const r = s.handleMessage('c2', { type: 'join', code: CODE, name: 'Ana', resume: p1.resumeToken }, map)
    expect(welcomeOf(r.outbound).playerId).not.toBe(p1.playerId)
    expect(s.kick('desconhecido').outbound).toEqual([])
  })

  it('closeRoom avisa room.closed a todo jogador CONECTADO (jogando ou aguardando), antes de o mestre derrubar a sala', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
    welcomeOf(s.handleMessage('c3', { type: 'join', code: CODE, name: 'Caio' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    s.disconnect('c3') // caiu antes: não tem para onde enviar
    expect(s.closeRoom().outbound).toEqual([
      { clientId: 'c1', msg: { type: 'room.closed' } },
      { clientId: 'c2', msg: { type: 'room.closed' } },
    ])
  })

  it('assignToken tira o token do dono anterior; unassign volta a aguardando', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    const p2 = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    s.assignToken(p2.playerId, 'heroi')
    expect(s.listPlayers().map((p) => p.tokenIds)).toEqual([[], ['heroi']])
    s.unassignToken(p2.playerId, 'heroi')
    expect(s.listPlayers().map((p) => p.status)).toEqual(['waiting', 'waiting'])
  })

  describe('explorado', () => {
    const SMALL_RADIUS = 150

    function smallSession() {
      return createHostSession({ code: CODE, visionRadius: SMALL_RADIUS, now: () => 0, randomId: sequentialIds() })
    }

    /** Sala da esquerda com uma região pequena perto do ponto inicial do herói. */
    function mapAt(heroX: number, heroY: number, patch: Partial<MapData> = {}): MapData {
      const base = twoRooms()
      return {
        ...base,
        tokens: [token('heroi', heroX, heroY), token('ladino', 800, 200)],
        regions: [
          { id: 'sala-a', points: [{ x: 150, y: 150 }, { x: 250, y: 150 }, { x: 250, y: 250 }, { x: 150, y: 250 }], tag: '', fillColor: '#3a3', fillPattern: 'solid', data: {} },
        ],
        ...patch,
      }
    }

    function snapshotTo(result: { outbound: { clientId: string; msg: HostMessage }[] }, clientId: string) {
      const msg = result.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
      if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
      const explored = decodeExploration(msg.explored)
      if (explored === null) throw new Error('explored inválido')
      return { msg, explored }
    }

    function joinPlaying(s: ReturnType<typeof smallSession>, clientId: string, map: MapData) {
      const p = welcomeOf(s.handleMessage(clientId, { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
      s.assignToken(p.playerId, 'heroi')
      return p
    }

    it('acumula entre broadcasts quando o token anda, e a sala vista continua no payload', () => {
      const s = smallSession()
      joinPlaying(s, 'c1', mapAt(200, 200))
      const first = snapshotTo(s.broadcast(mapAt(200, 200)), 'c1')
      const firstCount = countExploredCells(first.explored)
      expect(firstCount).toBeGreaterThan(0)
      expect(isPointExplored(first.explored, { x: 200, y: 200 })).toBe(true)
      expect(first.msg.map.regions.map((r) => r.id)).toEqual(['sala-a'])

      const second = snapshotTo(s.broadcast(mapAt(200, 800)), 'c1')
      expect(countExploredCells(second.explored)).toBeGreaterThan(firstCount)
      expect(isPointExplored(second.explored, { x: 200, y: 200 })).toBe(true)
      expect(isPointExplored(second.explored, { x: 200, y: 800 })).toBe(true)
      // Fora da visão atual, mas explorada antes: a planta segue.
      expect(second.msg.map.regions.map((r) => r.id)).toEqual(['sala-a'])
    })

    it('snapshot marca a visão atual antes de enviar (primeiro envio já traz a área vista)', () => {
      const s = smallSession()
      joinPlaying(s, 'c1', mapAt(200, 200))
      const { explored } = snapshotTo(s.broadcast(mapAt(200, 200)), 'c1')
      expect(isPointExplored(explored, { x: 200, y: 800 })).toBe(false)
      expect(isPointExplored(explored, { x: 800, y: 200 })).toBe(false)
    })

    it('SEGURANÇA: a visão não marca como explorada célula que toca sala secreta', () => {
      const s = smallSession()
      const secret = { id: 'sala-secreta', points: [{ x: 230, y: 180 }, { x: 330, y: 180 }, { x: 330, y: 280 }, { x: 230, y: 280 }], tag: '', fillColor: '#000', fillPattern: 'solid' as const, data: {}, room: { shape: 'rect' as const, name: 's' }, secret: true }
      const map = mapAt(200, 200, { regions: [secret] })
      joinPlaying(s, 'c1', map)
      const { explored } = snapshotTo(s.broadcast(map), 'c1')
      expect(isPointExplored(explored, { x: 280, y: 230 })).toBe(false)
      expect(isPointExplored(explored, { x: 150, y: 200 })).toBe(true)
    })

    it('kick zera: o jogador que volta começa sem memória', () => {
      const s = smallSession()
      joinPlaying(s, 'c1', mapAt(200, 200))
      s.broadcast(mapAt(200, 200))
      s.kick('c1')
      joinPlaying(s, 'c2', mapAt(200, 800))
      const { explored, msg } = snapshotTo(s.broadcast(mapAt(200, 800)), 'c2')
      expect(isPointExplored(explored, { x: 200, y: 200 })).toBe(false)
      expect(msg.map.regions).toEqual([])
    })

    it('resume mantém o explorado', () => {
      const s = smallSession()
      const p1 = joinPlaying(s, 'c1', mapAt(200, 200))
      s.broadcast(mapAt(200, 200))
      s.disconnect('c1')
      const r = s.handleMessage('c9', { type: 'join', code: CODE, name: 'Ana', resume: p1.resumeToken }, mapAt(200, 800))
      const { explored, msg } = snapshotTo(r, 'c9')
      expect(isPointExplored(explored, { x: 200, y: 200 })).toBe(true)
      expect(msg.map.regions.map((reg) => reg.id)).toEqual(['sala-a'])
    })

    it.each([
      ['id', { id: 'outro' }],
      ['width', { width: 1200 }],
      ['height', { height: 1200 }],
      ['grid', { grid: 50 }],
    ])('troca de mapa (%s) reinicia o explorado', (_label, patch) => {
      const s = smallSession()
      joinPlaying(s, 'c1', mapAt(200, 200))
      s.broadcast(mapAt(200, 200))
      const { explored, msg } = snapshotTo(s.broadcast(mapAt(200, 800, patch)), 'c1')
      expect(isPointExplored(explored, { x: 200, y: 200 })).toBe(false)
      expect(msg.map.regions).toEqual([])
    })

    it('mapa com largura/altura em células: o explorado cobre o mundo inteiro em px', () => {
      // 20x12 células de 50 px = 1000x600 px. Tratar width como px encolhia o
      // explorado para 25x12,5 px e a sala saía do payload ao sair da visão.
      const cellsMap = (heroX: number, heroY: number): MapData =>
        mapAt(heroX, heroY, { width: 20, height: 12, grid: 50, walls: [], tokens: [token('heroi', heroX, heroY)] })
      const s = smallSession()
      joinPlaying(s, 'c1', cellsMap(200, 200))
      const first = snapshotTo(s.broadcast(cellsMap(200, 200)), 'c1')
      expect(first.explored.cols * first.explored.cell).toBeGreaterThanOrEqual(1000)
      expect(first.explored.rows * first.explored.cell).toBeGreaterThanOrEqual(600)
      expect(isPointExplored(first.explored, { x: 200, y: 200 })).toBe(true)

      const second = snapshotTo(s.broadcast(cellsMap(800, 450)), 'c1')
      expect(isPointExplored(second.explored, { x: 200, y: 200 })).toBe(true)
      expect(isPointExplored(second.explored, { x: 800, y: 450 })).toBe(true)
      expect(second.msg.map.regions.map((r) => r.id)).toEqual(['sala-a'])
    })

    it('ownTokens traz só os tokens do próprio jogador que saíram no mapa', () => {
      const s = smallSession()
      const map = mapAt(200, 200, {
        tokens: [token('heroi', 200, 200), token('ladino', 800, 200), { ...token('sombra', 210, 200), hidden: true }],
      })
      const p1 = joinPlaying(s, 'c1', map)
      const p2 = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
      s.assignToken(p1.playerId, 'sombra')
      s.assignToken(p2.playerId, 'ladino')
      const r = s.broadcast(map)
      expect(snapshotTo(r, 'c1').msg.ownTokens).toEqual(['heroi'])
      expect(snapshotTo(r, 'c2').msg.ownTokens).toEqual(['ladino'])
    })

    function sessionWithRadius(radius: number) {
      return createHostSession({ code: CODE, visionRadius: radius, now: () => 0, randomId: sequentialIds() })
    }

    it.each([
      // grid 20: célula mínima de 8 px, desalinhada da grade; a célula [256, 264] cobre a parede em x=260.
      ['grid 20, célula 8', { cells: 30, grid: 20, wallX: 260, vertexX: 257, heroX: 400, heroY: 300, radius: 300 }],
      // grid 70 em 1500x1500 células: a célula dobra até 140 px; [1400, 1540] cobre a parede em x=1440.
      ['grid 70, célula 140', { cells: 1500, grid: 70, wallX: 1440, vertexX: 1400, heroX: 1700, heroY: 1500, radius: 400 }],
    ])('SEGURANÇA: célula de explorado não atravessa parede (%s)', (_label, c) => {
      const worldH = c.cells * c.grid
      const map: MapData = {
        ...createEmptyMap('m-parede', 'M', c.cells, c.cells, c.grid),
        walls: [wall('parede', c.wallX, 0, c.wallX, worldH)],
        tokens: [token('heroi', c.heroX, c.heroY)],
        regions: [
          roomRegion('r-cofre', 'COFRE-SECRETO', [
            { x: c.vertexX, y: c.heroY - 100 },
            { x: c.vertexX - 200, y: c.heroY - 100 },
            { x: c.vertexX - 200, y: c.heroY + 100 },
            { x: c.vertexX, y: c.heroY + 100 },
          ]),
        ],
      }
      const s = sessionWithRadius(c.radius)
      joinPlaying(s, 'c1', map)
      const first = snapshotTo(s.broadcast(map), 'c1')
      expect(first.msg.map.regions).toEqual([])
      const second = snapshotTo(s.broadcast(map), 'c1')
      expect(isPointExplored(second.explored, { x: c.vertexX, y: c.heroY })).toBe(false)
      expect(second.msg.map.regions).toEqual([])
      expect(JSON.stringify(second.msg)).not.toContain('COFRE-SECRETO')
      // O lado do herói continua sendo explorado.
      expect(isPointExplored(second.explored, { x: c.heroX, y: c.heroY })).toBe(true)
    })

    /** Taverna [300,500] e Salão [500,700] dividem a parede x=500; o herói está dentro do Salão. */
    function sharedWallMap(): MapData {
      return {
        ...createEmptyMap('m-vizinhas', 'M', 25, 25, 40),
        walls: [
          wall('topo', 300, 300, 700, 300),
          wall('base', 300, 500, 700, 500),
          wall('oeste', 300, 300, 300, 500),
          wall('leste', 700, 300, 700, 500),
          wall('divisoria', 500, 300, 500, 500),
        ],
        tokens: [token('heroi', 650, 400)],
        regions: [
          roomRegion('r-taverna', 'Taverna', [{ x: 300, y: 300 }, { x: 500, y: 300 }, { x: 500, y: 500 }, { x: 300, y: 500 }]),
          roomRegion('r-salao', 'Salao', [{ x: 500, y: 300 }, { x: 700, y: 300 }, { x: 700, y: 500 }, { x: 500, y: 500 }]),
        ],
        drawings: [
          { id: 'tapete-taverna', kind: 'rect', x: 300, y: 300, w: 200, h: 200, color: '#000', width: 2, filled: true, fillAlpha: 1 },
        ],
      }
    }

    it('SEGURANÇA: sala vizinha com parede compartilhada não é enviada nem explorada; sala com interior visível é', () => {
      const s = sessionWithRadius(RADIUS)
      const map = sharedWallMap()
      joinPlaying(s, 'c1', map)
      for (let i = 0; i < 2; i += 1) {
        const { msg, explored } = snapshotTo(s.broadcast(map), 'c1')
        expect(msg.map.regions.map((r) => r.id)).toEqual(['r-salao'])
        const json = JSON.stringify(msg.map)
        expect(json).not.toContain('Taverna')
        expect(json).not.toContain('tapete-taverna')
        expect(isPointExplored(explored, { x: 495, y: 400 })).toBe(false)
        expect(isPointExplored(explored, { x: 600, y: 400 })).toBe(true)
      }
    })

    it('SEGURANÇA: porta explorada fora da visão manda o último estado visto; ao voltar a ver, o real', () => {
      const s = sessionWithRadius(SMALL_RADIUS)
      const closed = { open: false, locked: false, kind: 'normal' as const }
      const at = (heroY: number, door: Wall['door']): MapData => ({
        ...createEmptyMap('m-porta', 'M', 25, 25, 40),
        walls: [wall('porta', 400, 500, 500, 500, door)],
        tokens: [token('heroi', 450, heroY)],
      })
      joinPlaying(s, 'c1', at(420, closed))
      const doorOf = (msg: HostMessage) => (msg.type === 'snapshot' ? msg.map.walls.find((w) => w.id === 'porta')?.door : undefined)

      expect(doorOf(snapshotTo(s.broadcast(at(420, closed)), 'c1').msg)).toEqual(closed)
      // Herói longe (a 400 px, raio 150): o mestre abre e tranca a porta.
      const away = snapshotTo(s.broadcast(at(100, { open: true, locked: true, kind: 'normal' })), 'c1').msg
      expect(doorOf(away)).toEqual(closed)
      expect(JSON.stringify(away)).not.toContain('"open":true')
      // De volta perto da porta: o estado real aparece.
      const back = snapshotTo(s.broadcast(at(420, { open: true, locked: true, kind: 'normal' })), 'c1').msg
      expect(doorOf(back)).toEqual({ open: true, locked: true, kind: 'normal' })
      // Longe de novo com a porta fechada pelo mestre: fica a lembrança "aberta e trancada".
      const awayAgain = snapshotTo(s.broadcast(at(100, closed)), 'c1').msg
      expect(doorOf(awayAgain)).toEqual({ open: true, locked: true, kind: 'normal' })
    })
  })

  it('perder o último token manda lobby.waiting; ainda com token, não', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    const p2 = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
    expect(s.assignToken(p1.playerId, 'heroi').outbound).toEqual([])
    expect(s.assignToken(p1.playerId, 'ladino').outbound).toEqual([])
    expect(s.unassignToken(p1.playerId, 'ladino').outbound).toEqual([])
    expect(s.unassignToken(p1.playerId, 'heroi').outbound).toEqual([{ clientId: 'c1', msg: { type: 'lobby.waiting' } }])
    // Sem token nenhum: remover de novo não reenvia.
    expect(s.unassignToken(p1.playerId, 'heroi').outbound).toEqual([])
    expect(s.unassignToken('desconhecido', 'heroi').outbound).toEqual([])

    // Token tomado por outro jogador: o dono anterior volta ao lobby.
    s.assignToken(p1.playerId, 'heroi')
    expect(s.assignToken(p2.playerId, 'heroi').outbound).toEqual([{ clientId: 'c1', msg: { type: 'lobby.waiting' } }])

    // Desconectado não recebe nada (o resume entrega o estado certo).
    s.disconnect('c2')
    expect(s.unassignToken(p2.playerId, 'heroi').outbound).toEqual([])
  })
})

describe('hostSession: sinal do jogador', () => {
  const WORLD = 1000 * 40

  /** Ana (heroi, lado esquerdo) e Bia (ladino, lado direito) jogando; Caio aguardando. Relógio controlado. */
  function signalSetup() {
    let clock = 0
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => clock, randomId: sequentialIds() })
    const map = twoRooms()
    const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    const bia = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
    s.handleMessage('c3', { type: 'join', code: CODE, name: 'Caio' }, map)
    s.assignToken(ana.playerId, 'heroi')
    s.assignToken(bia.playerId, 'ladino')
    s.broadcast(map)
    return {
      s,
      map,
      ana,
      advance: (ms: number) => {
        clock += ms
      },
    }
  }

  const toClient = (result: HostResult, clientId: string) => result.outbound.filter((o) => o.clientId === clientId)

  it('de quem não entrou devolve not_joined; de quem aguarda ou fora do mapa é descartado sem gastar o limite', () => {
    const t = signalSetup()
    expect(t.s.handleMessage('cx', { type: 'signal', x: 10, y: 10 }, t.map)).toEqual({ outbound: [{ clientId: 'cx', msg: { type: 'error', reason: 'not_joined' } }] })
    expect(t.s.handleMessage('c3', { type: 'signal', x: 10, y: 10 }, t.map)).toEqual({ outbound: [] })
    expect(t.s.handleMessage('c1', { type: 'signal', x: -1, y: 10 }, t.map)).toEqual({ outbound: [] })
    expect(t.s.handleMessage('c1', { type: 'signal', x: 10, y: WORLD + 1 }, t.map)).toEqual({ outbound: [] })
    expect(t.s.handleMessage('c1', { type: 'signal', x: 'a', y: 10 }, t.map).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } },
    ])
    expect(t.s.handleMessage('c1', { type: 'signal', x: 300, y: 300 }, t.map).signal).toBeDefined()
  })

  it('segurança: outro jogador só recebe o sinal num ponto que ele vê (JSON do payload)', () => {
    const t = signalSetup()
    const color = signalColor(t.ana.playerId)
    // Ana sinaliza no lado dela; a Bia está atrás da parede e nunca viu esse lado.
    const hidden = t.s.handleMessage('c1', { type: 'signal', x: 300, y: 300 }, t.map)
    expect(hidden.signal).toEqual({ playerId: t.ana.playerId, name: 'Ana', color, x: 300, y: 300 })
    expect(toClient(hidden, 'c1')).toEqual([{ clientId: 'c1', msg: { type: 'signal', x: 300, y: 300, from: 'Ana', color } }])
    expect(JSON.stringify(toClient(hidden, 'c2'))).toBe('[]')
    expect(JSON.stringify(hidden.outbound)).not.toContain('"c2"')
    expect(toClient(hidden, 'c3')).toEqual([])

    // Controle positivo: no lado que a Bia vê, ela recebe (e o Caio, aguardando, não).
    t.advance(SIGNAL_MIN_INTERVAL_MS)
    const seen = t.s.handleMessage('c1', { type: 'signal', x: 800, y: 300 }, t.map)
    expect(toClient(seen, 'c2')).toEqual([{ clientId: 'c2', msg: { type: 'signal', x: 800, y: 300, from: 'Ana', color } }])
    expect(toClient(seen, 'c3')).toEqual([])
  })

  it('ponto explorado fora da visão atual também é repassado', () => {
    const t = signalSetup()
    // Bia passa pelo lado esquerdo e volta: (300,300) sai da visão, mas fica explorado.
    t.s.broadcast({ ...t.map, tokens: t.map.tokens.map((tk) => (tk.id === 'ladino' ? { ...tk, x: 200, y: 600 } : tk)) })
    t.s.broadcast(t.map)
    const r = t.s.handleMessage('c1', { type: 'signal', x: 300, y: 300 }, t.map)
    expect(toClient(r, 'c2')).toEqual([{ clientId: 'c2', msg: expect.objectContaining({ type: 'signal', x: 300, y: 300 }) }])
  })

  it('segurança: ponto dentro de zona oculta ativa não é repassado nem a quem vê o lugar; revelada, é', () => {
    const t = signalSetup()
    const withZone = (revealed: boolean): MapData => ({
      ...t.map,
      concealZones: [{ id: 'z', name: 'cofre', revealed, points: [{ x: 700, y: 200 }, { x: 900, y: 200 }, { x: 900, y: 400 }, { x: 700, y: 400 }] }],
    })
    const hidden = t.s.handleMessage('c1', { type: 'signal', x: 800, y: 300 }, withZone(false))
    expect(JSON.stringify(toClient(hidden, 'c2'))).toBe('[]')
    expect(toClient(hidden, 'c1')).toHaveLength(1)
    expect(hidden.signal).toBeDefined()

    t.advance(SIGNAL_MIN_INTERVAL_MS)
    expect(toClient(t.s.handleMessage('c1', { type: 'signal', x: 800, y: 300 }, withZone(true)), 'c2')).toHaveLength(1)
  })

  it('segurança: ponto dentro de sala secreta não é repassado nem a quem vê o lugar; sem segredo, é', () => {
    const t = signalSetup()
    const square = [{ x: 700, y: 200 }, { x: 900, y: 200 }, { x: 900, y: 400 }, { x: 700, y: 400 }]
    const withRoom = (secret: boolean): MapData => ({ ...t.map, regions: [{ ...roomRegion('cofre', 'Cofre', square), secret }] })
    const hidden = t.s.handleMessage('c1', { type: 'signal', x: 800, y: 300 }, withRoom(true))
    expect(JSON.stringify(toClient(hidden, 'c2'))).toBe('[]')
    expect(toClient(hidden, 'c1')).toHaveLength(1)
    expect(hidden.signal).toBeDefined()

    t.advance(SIGNAL_MIN_INTERVAL_MS)
    expect(toClient(t.s.handleMessage('c1', { type: 'signal', x: 800, y: 300 }, withRoom(false)), 'c2')).toHaveLength(1)
  })

  it('segurança: nome repetido de outro jogador ganha sufixo; o sinal não se passa pelo outro; resume mantém o nome', () => {
    const s = newSession()
    const map = twoRooms()
    const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    const impostor = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: ' A NA ' }, map).outbound)
    s.handleMessage('c3', { type: 'join', code: CODE, name: 'ana' }, map)
    expect(s.listPlayers().map((p) => p.name)).toEqual(['Ana', 'A NA (2)', 'ana (3)'])
    s.assignToken(impostor.playerId, 'heroi')
    const signal = s.handleMessage('c2', { type: 'signal', x: 200, y: 200 }, map)
    expect(signal.outbound[0]?.msg).toMatchObject({ type: 'signal', from: 'A NA (2)' })

    s.disconnect('c1')
    s.handleMessage('c9', { type: 'join', code: CODE, name: 'Ana', resume: ana.resumeToken }, map)
    expect(s.listPlayers().map((p) => p.name)).toEqual(['Ana', 'A NA (2)', 'ana (3)'])
  })

  it('limita a 1 sinal por segundo por jogador, sem afetar os outros', () => {
    const t = signalSetup()
    const signal = (clientId: string) => t.s.handleMessage(clientId, { type: 'signal', x: 250, y: 250 }, t.map)
    expect(signal('c1').signal).toBeDefined()
    t.advance(SIGNAL_MIN_INTERVAL_MS - 1)
    expect(signal('c1')).toEqual({ outbound: [] })
    expect(signal('c2').signal).toBeDefined()
    t.advance(1)
    expect(signal('c1').signal).toBeDefined()
  })
})

describe('hostSession door.toggle (jogador abre porta)', () => {
  const GRID = 40
  /** Parede vertical em x=500 partida por uma porta (y 180..220), como a ferramenta Porta faz. */
  function doorMap(door: NonNullable<Wall['door']>, tokenX = 460): MapData {
    return {
      ...createEmptyMap('m', 'M', 1000, 1000, GRID),
      walls: [
        wall('acima', 500, 0, 500, 180),
        { ...wall('porta', 500, 180, 500, 220, door), blocksLight: false },
        wall('abaixo', 500, 220, 500, 1000),
      ],
      tokens: [token('heroi', tokenX, 200)],
    }
  }

  const closed = { open: false, locked: false, kind: 'normal' as const }

  /** Sessão com Ana jogando com o 'heroi' e um snapshot já enviado (a memória de visão existe). */
  function doorSetup(map: MapData) {
    let clock = 0
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => clock, randomId: sequentialIds() })
    const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(ana.playerId, 'heroi')
    s.broadcast(map)
    return { s, ana, advance: (ms: number) => void (clock += ms) }
  }

  it('porta destrancada encostada no token: abre e devolve applyDoor, sem mensagem de recusa', () => {
    const map = doorMap(closed)
    const t = doorSetup(map)
    const r = t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true })
    expect(r.outbound).toEqual([])
  })

  it('porta aberta encostada no token: fecha', () => {
    const map = doorMap({ ...closed, open: true })
    const t = doorSetup(map)
    expect(t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map).applyDoor).toEqual({ wallId: 'porta', open: false })
  })

  it('token longe: recusa "far" e não mexe na porta', () => {
    const map = doorMap(closed, 200)
    const t = doorSetup(map)
    const r = t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'far' } }])
  })

  it('porta trancada: recusa "locked" mesmo com o token encostado', () => {
    const map = doorMap({ ...closed, locked: true })
    const t = doorSetup(map)
    const r = t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'locked' } }])
  })

  it('porta que o jogador não vê, parede sem porta e id inexistente: todas "not_visible" (não dizem o que existe no escuro)', () => {
    const map = doorMap(closed)
    // Porta do outro lado do mapa, fora da visão do herói.
    const longe: Wall = { ...wall('longe', 40, 900, 40, 940, closed), blocksLight: false }
    const withFar: MapData = { ...map, walls: [...map.walls, longe] }
    const t = doorSetup(withFar)
    for (const wallId of ['longe', 'acima', 'nao-existe']) {
      t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
      const r = t.s.handleMessage('c1', { type: 'door.toggle', wallId }, withFar)
      expect(r.applyDoor).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId, reason: 'not_visible' } }])
    }
  })

  it('de quem não entrou devolve not_joined; de quem só aguarda é descartado', () => {
    const map = doorMap(closed)
    const t = doorSetup(map)
    expect(t.s.handleMessage('cx', { type: 'door.toggle', wallId: 'porta' }, map).outbound).toEqual([
      { clientId: 'cx', msg: { type: 'error', reason: 'not_joined' } },
    ])
    t.s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map)
    expect(t.s.handleMessage('c2', { type: 'door.toggle', wallId: 'porta' }, map)).toEqual({ outbound: [] })
  })

  it('limita a 1 pedido de porta por janela por jogador', () => {
    const map = doorMap(closed)
    const t = doorSetup(map)
    expect(t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map).applyDoor).toBeDefined()
    t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS - 1)
    expect(t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map)).toEqual({ outbound: [] })
    t.advance(1)
    expect(t.s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map).applyDoor).toBeDefined()
  })

  it('wallId malformado é mensagem inválida', () => {
    const map = doorMap(closed)
    const t = doorSetup(map)
    expect(t.s.handleMessage('c1', { type: 'door.toggle', wallId: 7 }, map).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } },
    ])
  })
})

/*
 * CADA JOGADOR NO SEU MAPA e o PEDIDO DE PASSAGEM pelo pino de viagem.
 *
 * Duas cenas do mesmo tamanho (2000 x 500 px): o Salão (aberto no editor) e a
 * Cripta (de fundo). A escada do Salão e a da Cripta são um par em mão dupla.
 * Ana joga com o 'heroi' e Bia com o 'ladino', os dois no Salão.
 */
describe('hostSession: cada jogador no seu mapa e o pedido de passagem', () => {
  const CENA_A = 'cena-salao'
  const CENA_B = 'cena-cripta'
  const NOME_A = 'Salão'
  const NOME_B = 'Cripta'
  const ALTAR = 'Altar de ossos'

  function viagem(id: string, x: number, y: number, description: string, destino: Pin['destino']): Pin {
    return { id, x, y, kind: 'viagem', description, image: null, destino }
  }

  interface Mundo {
    heroi: { cena: 'A' | 'B'; x: number; y: number }
  }

  /** O mundo que o host lê: o Salão aberto, a Cripta de fundo, o herói onde `m` diz. */
  function mundo(m: Mundo = { heroi: { cena: 'A', x: 200, y: 200 } }): HostWorld {
    const heroi = token('heroi', m.heroi.x, m.heroi.y)
    const salao: MapData = {
      ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, 50),
      tokens: [...(m.heroi.cena === 'A' ? [heroi] : []), token('ladino', 300, 200)],
      pins: [
        viagem('escada-a', 400, 200, 'Escada que desce', { sceneId: CENA_B, pinId: 'escada-b' }),
        { id: 'estatua', x: 450, y: 200, kind: 'exclamacao', description: 'Estátua', image: null },
        viagem('sem-destino', 420, 250, 'Porta emparedada', null),
        viagem('orfa', 430, 150, 'Alçapão', { sceneId: CENA_B, pinId: 'nao-existe' }),
        // Longe de todo mundo (1700 px do herói, raio 700): no escuro.
        viagem('escada-longe', 1900, 250, 'Poço', { sceneId: CENA_B, pinId: 'poco-b' }),
      ],
    }
    const cripta: MapData = {
      ...createEmptyMap('mapa-cripta', NOME_B, 40, 10, 50),
      tokens: m.heroi.cena === 'B' ? [heroi] : [],
      pins: [
        viagem('escada-b', 1000, 250, 'Escada que sobe', { sceneId: CENA_A, pinId: 'escada-a' }),
        viagem('poco-b', 100, 100, 'Fundo do poço', { sceneId: CENA_A, pinId: 'escada-longe' }),
        { id: 'altar', x: 1100, y: 250, kind: 'exclamacao', description: ALTAR, image: null },
      ],
    }
    return {
      open: { sceneId: CENA_A, name: NOME_A, map: salao },
      background: [{ sceneId: CENA_B, name: NOME_B, map: cripta }],
    }
  }

  function mesa() {
    let clock = 1_000_000
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => clock, randomId: sequentialIds() })
    const w = mundo()
    const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
    const bia = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w).outbound)
    s.assignToken(ana.playerId, 'heroi')
    s.assignToken(bia.playerId, 'ladino')
    s.broadcast(w)
    return {
      s,
      w,
      ana,
      bia,
      advance: (ms: number) => {
        clock += ms
      },
      pedir: (pinId: string, world: HostWorld = w, clientId = 'c1') => s.handleMessage(clientId, { type: 'pin.travel.request', pinId }, world),
    }
  }

  function recusa(r: HostResult): string | null {
    const msg = r.outbound[0]?.msg
    return msg?.type === 'pin.travel.rejected' ? msg.reason : null
  }

  function snapshotDe(r: HostResult, clientId: string) {
    const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
    if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
    return msg
  }

  it('pedido válido vai ao mestre com o nome do pino e da cena; o jogador não recebe nada', () => {
    const t = mesa()
    const r = t.pedir('escada-a')
    expect(r.outbound).toEqual([])
    expect(r.travelRequest).toEqual({
      requestId: expect.any(String),
      playerId: t.ana.playerId,
      playerName: 'Ana',
      pinLabel: 'Escada que desce',
      toSceneId: CENA_B,
      toSceneName: NOME_B,
    })
  })

  it('recusa: pino que não existe na cena do jogador', () => {
    const t = mesa()
    const r = t.pedir('nao-existe')
    expect(recusa(r)).toBe('unavailable')
    expect(r.travelRequest).toBeUndefined()
  })

  it('SEGURANÇA — recusa: pino de viagem ligado, mas no escuro para o jogador (névoa)', () => {
    const t = mesa()
    // Mesmo pino, mesmo par: a ÚNICA diferença é o jogador não o ver.
    expect(recusa(t.pedir('escada-longe'))).toBe('unavailable')
    // Controle positivo: com o herói perto do poço, o mesmo pedido vale.
    const perto = mundo({ heroi: { cena: 'A', x: 1850, y: 250 } })
    t.s.broadcast(perto)
    t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
    expect(t.pedir('escada-longe', perto).travelRequest?.pinLabel).toBe('Poço')
  })

  it('recusa: pino que não é de viagem', () => {
    const t = mesa()
    expect(recusa(t.pedir('estatua'))).toBe('unavailable')
  })

  it('recusa: pino de viagem sem destino', () => {
    const t = mesa()
    expect(recusa(t.pedir('sem-destino'))).toBe('unavailable')
  })

  it('recusa: o par do destino não existe', () => {
    const t = mesa()
    expect(recusa(t.pedir('orfa'))).toBe('unavailable')
  })

  it('recusa: jogador sem token na cena do pino (o dele está na Cripta) e jogador sem token nenhum', () => {
    const t = mesa()
    const naCripta = mundo({ heroi: { cena: 'B', x: 1000, y: 250 } })
    t.s.broadcast(naCripta)
    // A escada do Salão não está na cena da Ana: ela está na Cripta.
    expect(recusa(t.pedir('escada-a', naCripta))).toBe('unavailable')
    t.s.unassignToken(t.bia.playerId, 'ladino')
    expect(recusa(t.pedir('escada-a', t.w, 'c2'))).toBe('unavailable')
  })

  it('recusa: segundo pedido enquanto o primeiro espera o mestre', () => {
    const t = mesa()
    expect(t.pedir('escada-a').travelRequest).toBeDefined()
    t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
    expect(recusa(t.pedir('escada-a'))).toBe('pending')
  })

  it('recusa: pedido repetido pelo mesmo pino dentro do intervalo mínimo, e vale de novo depois dele', () => {
    const t = mesa()
    const primeiro = t.pedir('escada-a').travelRequest
    if (primeiro === undefined) throw new Error('o primeiro pedido deveria valer')
    t.s.denyTravel(primeiro.requestId)
    // Passou o limite do jogador, mas não o do pino: ainda cedo para ESTE pino.
    t.advance(TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS)
    expect(recusa(t.pedir('escada-a'))).toBe('too_soon')
    // Completa o intervalo do pino (e mais um intervalo do jogador desde a tentativa): vale.
    t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS - TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS)
    expect(t.pedir('escada-a').travelRequest).toBeDefined()
  })

  it('mensagem de forma errada é recusada como inválida, sem derrubar nada', () => {
    const t = mesa()
    for (const msg of [{ type: 'pin.travel.request' }, { type: 'pin.travel.request', pinId: 7 }, { type: 'pin.travel.request', pinId: '' }, { type: 'pin.travel.request', pinId: 'x'.repeat(65) }]) {
      expect(t.s.handleMessage('c1', msg, t.w).outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } }])
    }
    expect(t.pedir('escada-a').travelRequest).toBeDefined()
  })

  it('"Não": pin.travel.denied só para quem pediu; decidir de novo não faz nada', () => {
    const t = mesa()
    const pedido = t.pedir('escada-a').travelRequest
    if (pedido === undefined) throw new Error('pedido deveria valer')
    expect(t.s.denyTravel(pedido.requestId).outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.denied' } }])
    expect(t.s.isTravelPending(pedido.requestId)).toBe(false)
    expect(t.s.approveTravel(pedido.requestId, t.w)).toEqual({ outbound: [] })
  })

  it('listPlayers marca quem tem pedido esperando, e a marca some ao decidir ou ao cair a conexão', () => {
    const pendentes = (t: ReturnType<typeof mesa>) => t.s.listPlayers(t.w).filter((p) => p.travelPending === true).map((p) => p.clientId)
    const t = mesa()
    expect(pendentes(t)).toEqual([])
    const pedido = t.pedir('escada-a').travelRequest
    if (pedido === undefined) throw new Error('pedido deveria valer')
    expect(pendentes(t)).toEqual(['c1'])
    t.s.denyTravel(pedido.requestId)
    expect(pendentes(t)).toEqual([])

    const outra = mesa()
    if (outra.pedir('escada-a').travelRequest === undefined) throw new Error('pedido deveria valer')
    outra.s.disconnect('c1')
    expect(pendentes(outra)).toEqual([])
  })

  it('quem sai da sala com pedido pendente: o pedido morre e "Deixar ir" fica inofensivo', () => {
    const t = mesa()
    const pedido = t.pedir('escada-a').travelRequest
    if (pedido === undefined) throw new Error('pedido deveria valer')
    t.s.disconnect('c1')
    expect(t.s.isTravelPending(pedido.requestId)).toBe(false)
    expect(t.s.approveTravel(pedido.requestId, t.w)).toEqual({ outbound: [] })
  })

  it('"Deixar ir": o herói sai do Salão e entra no par da Cripta; Bia no Salão não recebe nada da Cripta', () => {
    const t = mesa()
    const pedido = t.pedir('escada-a').travelRequest
    if (pedido === undefined) throw new Error('pedido deveria valer')
    const r = t.s.approveTravel(pedido.requestId, t.w)
    // Ao dono, só o aviso — sem nome de cena. O mapa novo vem no broadcast.
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
    // Chega no par (1000, 250), assentado no centro da célula como o snap de token.
    expect(r.applyTransfer).toEqual({
      tokenId: 'heroi',
      playerId: t.ana.playerId,
      playerName: 'Ana',
      fromSceneId: CENA_A,
      toSceneId: CENA_B,
      toSceneName: NOME_B,
      x: 1025,
      y: 275,
    })

    // O integrador aplicou: o herói agora mora na Cripta.
    const depois = mundo({ heroi: { cena: 'B', x: 1025, y: 275 } })
    const b = t.s.broadcast(depois)
    const daAna = snapshotDe(b, 'c1')
    expect(daAna.map.id).toBe('mapa-cripta')
    expect(daAna.map.tokens.map((tk) => tk.id)).toEqual(['heroi'])
    expect(daAna.ownTokens).toEqual(['heroi'])
    const daBia = snapshotDe(b, 'c2')
    expect(daBia.map.id).toBe('mapa-salao')
    expect(daBia.map.tokens.map((tk) => tk.id)).toEqual(['ladino'])
    const textoDaBia = JSON.stringify(b.outbound.filter((o) => o.clientId === 'c2'))
    expect(textoDaBia).not.toContain('mapa-cripta')
    expect(textoDaBia).not.toContain(ALTAR)
    expect(textoDaBia).not.toContain('"destino"')
    // O painel do mestre diz onde cada um está.
    expect(t.s.listPlayers(depois).map((p) => [p.name, p.sceneName])).toEqual([
      ['Ana', NOME_B],
      ['Bia', NOME_A],
    ])
  })

  it('a memória do Salão volta com a Ana: o fundo que ela explorou antes da viagem continua lembrado', () => {
    const t = mesa()
    // Longe da escada do Salão E do ponto de chegada na Cripta (mais que o raio de 700 dos dois).
    const FUNDO = { x: 1850, y: 300 }
    // Ana anda até o fundo do Salão e volta para perto da escada.
    t.s.broadcast(mundo({ heroi: { cena: 'A', x: FUNDO.x, y: FUNDO.y } }))
    const pertoDaEscada = mundo({ heroi: { cena: 'A', x: 380, y: 200 } })
    const antes = decodeExploration(snapshotDe(t.s.broadcast(pertoDaEscada), 'c1').explored)
    expect(antes !== null && isPointExplored(antes, FUNDO)).toBe(true)

    const ida = t.pedir('escada-a', pertoDaEscada).travelRequest
    if (ida === undefined) throw new Error('a ida deveria valer')
    t.s.approveTravel(ida.requestId, pertoDaEscada)
    const naCripta = decodeExploration(snapshotDe(t.s.broadcast(mundo({ heroi: { cena: 'B', x: 1025, y: 275 } })), 'c1').explored)
    // Na Cripta a memória é OUTRA: o fundo do Salão não está lá.
    expect(naCripta !== null && isPointExplored(naCripta, FUNDO)).toBe(false)

    // Volta pelo par: de novo no Salão, junto da escada (longe do fundo: 1100 px > raio 700).
    const deVolta = decodeExploration(snapshotDe(t.s.broadcast(mundo({ heroi: { cena: 'A', x: 425, y: 225 } })), 'c1').explored)
    expect(deVolta !== null && isPointExplored(deVolta, FUNDO)).toBe(true)
  })

  it('o mestre trocar a cena do editor não leva o jogador junto', () => {
    const t = mesa()
    // O editor abre a Cripta: agora ela é a aberta e o Salão é de fundo.
    const w = mundo()
    const trocado: HostWorld = { open: w.background[0], background: [w.open] }
    const b = t.s.broadcast(trocado)
    expect(snapshotDe(b, 'c1').map.id).toBe('mapa-salao')
    expect(snapshotDe(b, 'c2').map.id).toBe('mapa-salao')
  })

  it('movimento, porta e sinal de quem está numa cena de fundo valem NELA', () => {
    const t = mesa()
    const naCripta = mundo({ heroi: { cena: 'B', x: 1025, y: 275 } })
    t.s.broadcast(naCripta)
    const move = t.s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 1075, y: 275 }, naCripta)
    expect(move.applyMove).toEqual({ tokenId: 'heroi', x: 1075, y: 275, sceneId: CENA_B })
    // Sinal da Ana na Cripta não chega à Bia, que está no Salão (mesmo num ponto que ela conhece).
    const sinal = t.s.handleMessage('c1', { type: 'signal', x: 300, y: 200 }, naCripta)
    expect(sinal.outbound.map((o) => o.clientId)).toEqual(['c1'])
    // O laser do mestre (na cena aberta, o Salão) não vai a quem está na Cripta.
    expect(t.s.laser({ type: 'laser', off: true }, naCripta).outbound.map((o) => o.clientId)).toEqual(['c2'])
  })

  it('cada jogador lembra no máximo MAX_SCENE_MEMORIES_PER_PLAYER cenas: a mais antiga é esquecida', () => {
    const t = mesa()
    const FUNDO = { x: 1500, y: 250 }
    t.s.broadcast(mundo({ heroi: { cena: 'A', x: FUNDO.x, y: FUNDO.y } }))
    // A Ana passa por mais MAX cenas (mapas de id novo): o Salão sai da memória.
    for (let i = 0; i < MAX_SCENE_MEMORIES_PER_PLAYER; i += 1) {
      const outra: MapData = { ...createEmptyMap(`mapa-${i}`, `Cena ${i}`, 40, 10, 50), tokens: [token('heroi', 200, 200)] }
      t.s.broadcast({ open: { sceneId: `cena-${i}`, name: `Cena ${i}`, map: outra }, background: [] })
    }
    const deVolta = decodeExploration(snapshotDe(t.s.broadcast(mundo({ heroi: { cena: 'A', x: 200, y: 200 } })), 'c1').explored)
    expect(deVolta !== null && isPointExplored(deVolta, FUNDO)).toBe(false)
  })

  describe('modos de passagem do pino', () => {
    /** O mesmo mundo, com o pino `pinId` do Salão no modo `passagem`. */
    function comPassagem(w: HostWorld, pinId: string, passagem: Pin['passagem']): HostWorld {
      const pins = w.open.map.pins.map((p) => (p.id === pinId ? { ...p, passagem } : p))
      return { ...w, open: { ...w.open, map: { ...w.open.map, pins } } }
    }

    it('livre: passa direto — scene.changed ao dono e applyTransfer, sem pedido ao mestre e sem pendente', () => {
      const t = mesa()
      const livre = comPassagem(t.w, 'escada-a', 'livre')
      const r = t.pedir('escada-a', livre)
      expect(r.travelRequest).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
      expect(r.applyTransfer).toEqual({
        tokenId: 'heroi',
        playerId: t.ana.playerId,
        playerName: 'Ana',
        fromSceneId: CENA_A,
        toSceneId: CENA_B,
        toSceneName: NOME_B,
        x: 1025,
        y: 275,
      })
      // Nada ficou esperando: um próximo pedido não é recusado como 'pending'.
      t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
      const naCripta = mundo({ heroi: { cena: 'B', x: 1025, y: 275 } })
      t.s.broadcast(naCripta)
      expect(recusa(t.pedir('escada-b', naCripta))).toBeNull()
      // A cena dela já é a Cripta.
      expect(t.s.listPlayers(naCripta).find((p) => p.name === 'Ana')?.sceneName).toBe(NOME_B)
    })

    it('livre: as mesmas recusas do pedido — névoa, e os limites por jogador e por pino', () => {
      const t = mesa()
      const livre = comPassagem(comPassagem(t.w, 'escada-longe', 'livre'), 'escada-a', 'livre')
      // No escuro, livre ou não, é o mesmo "unavailable".
      expect(recusa(t.pedir('escada-longe', livre))).toBe('unavailable')
      // A tentativa acima já conta no limite do jogador.
      expect(recusa(t.pedir('escada-a', livre))).toBe('too_soon')
      t.advance(TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS)
      expect(t.pedir('escada-a', livre).applyTransfer).toBeDefined()
      // A Bia (no Salão) insiste pela mesma escada livre: o limite por pino vale para ela também.
      expect(t.pedir('escada-a', livre, 'c2').applyTransfer).toBeDefined()
      t.advance(TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS)
      expect(recusa(t.pedir('escada-a', livre, 'c2'))).toBe('too_soon')
    })

    it('livre não passa por cima de um pedido pendente de outro pino', () => {
      const t = mesa()
      const w = comPassagem(t.w, 'escada-a', 'livre')
      // Pedido pelo mesmo pino antes de ele ficar livre: espera o mestre.
      expect(t.pedir('escada-a').travelRequest).toBeDefined()
      t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
      const r = t.pedir('escada-a', w)
      expect(recusa(r)).toBe('pending')
      expect(r.applyTransfer).toBeUndefined()
    })

    it('trancada: recusa com o motivo genérico, sem nada ao mestre e sem nome da outra cena', () => {
      const t = mesa()
      const trancada = comPassagem(t.w, 'escada-a', 'trancada')
      const r = t.pedir('escada-a', trancada)
      expect(r).toEqual({ outbound: [{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }] })
      expect(JSON.stringify(r)).not.toContain(NOME_B)
      // Controle: o mesmo pino, no modo de sempre, vai ao mestre.
      t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
      expect(t.pedir('escada-a').travelRequest).toBeDefined()
    })

    it('trancar com pedido pendente: o "Deixar ir" recusa e o herói fica', () => {
      const t = mesa()
      const pedido = t.pedir('escada-a').travelRequest
      if (pedido === undefined) throw new Error('pedido deveria valer')
      const r = t.s.approveTravel(pedido.requestId, comPassagem(t.w, 'escada-a', 'trancada'))
      expect(r.applyTransfer).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }])
      expect(t.s.isTravelPending(pedido.requestId)).toBe(false)
    })

    it('cada pino tem o seu: o par trancado não tranca a ida', () => {
      const t = mesa()
      const w = t.w
      const trancarVolta = (p: Pin): Pin => (p.id === 'escada-b' ? { ...p, passagem: 'trancada' } : p)
      const background = w.background.map((b) => ({ ...b, map: { ...b.map, pins: b.map.pins.map(trancarVolta) } }))
      const r = t.pedir('escada-a', comPassagem({ ...w, background }, 'escada-a', 'livre'))
      expect(r.applyTransfer?.toSceneId).toBe(CENA_B)
    })
  })
})

describe('hostSession: revisão de segurança do pedido de passagem', () => {
  // Reaproveita o mesmo mundo de duas cenas do bloco acima, com os casos da revisão.
  const CENA_A = 'cena-salao'
  const CENA_B = 'cena-cripta'

  function viagem(id: string, x: number, y: number, description: string, destino: Pin['destino']): Pin {
    return { id, x, y, kind: 'viagem', description, image: null, destino }
  }

  function mundo(heroi: 'A' | 'nenhuma', religado = false): HostWorld {
    const salao: MapData = {
      ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, 50),
      tokens: [...(heroi === 'A' ? [token('heroi', 200, 200)] : []), token('ladino', 300, 200)],
      pins: [viagem('escada-a', 400, 200, 'Escada que desce', { sceneId: CENA_B, pinId: religado ? 'torre-b' : 'escada-b' })],
    }
    const cripta: MapData = {
      ...createEmptyMap('mapa-cripta', 'Cripta', 40, 10, 50),
      pins: [
        viagem('escada-b', 1000, 250, 'Escada que sobe', religado ? null : { sceneId: CENA_A, pinId: 'escada-a' }),
        viagem('torre-b', 1800, 100, 'Alto da torre', religado ? { sceneId: CENA_A, pinId: 'escada-a' } : null),
      ],
    }
    return { open: { sceneId: CENA_A, name: 'Salão', map: salao }, background: [{ sceneId: CENA_B, name: 'Cripta', map: cripta }] }
  }

  function mesa() {
    let clock = 1_000_000
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => clock, randomId: sequentialIds() })
    const w = mundo('A')
    const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
    const bia = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w).outbound)
    s.assignToken(ana.playerId, 'heroi')
    s.assignToken(bia.playerId, 'ladino')
    s.broadcast(w)
    return { s, w, ana, advance: (ms: number) => void (clock += ms) }
  }

  function recusa(r: HostResult): string | null {
    const msg = r.outbound[0]?.msg
    return msg?.type === 'pin.travel.rejected' ? msg.reason : null
  }

  it('1. com aventura, quem não tem ficha em cena nenhuma recebe a espera: nem a cena do editor, nem laser, nem sinal', () => {
    const t = mesa()
    const semFicha = mundo('nenhuma')
    const b = t.s.broadcast(semFicha)
    expect(b.outbound.find((o) => o.clientId === 'c1')?.msg).toEqual({ type: 'lobby.waiting' })
    expect(JSON.stringify(b.outbound.filter((o) => o.clientId === 'c1'))).not.toContain('mapa-salao')
    // Bia, que está no Salão, continua recebendo o Salão.
    expect(b.outbound.find((o) => o.clientId === 'c2')?.msg.type).toBe('snapshot')
    expect(t.s.laser({ type: 'laser', off: true }, semFicha).outbound.map((o) => o.clientId)).toEqual(['c2'])
    expect(t.s.handleMessage('c1', { type: 'signal', x: 300, y: 200 }, semFicha).outbound).toEqual([])
    expect(t.s.listPlayers(semFicha).map((p) => [p.name, p.status, p.sceneName])).toEqual([
      ['Ana', 'waiting', undefined],
      ['Bia', 'playing', 'Salão'],
    ])
    // Reconectar não fura: o resume também cai na espera.
    t.s.disconnect('c1')
    const volta = t.s.handleMessage('c3', { type: 'join', code: CODE, name: 'Ana', resume: t.ana.resumeToken }, semFicha)
    expect(volta.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
  })

  it('1b. mapa solto continua como sempre: sem ficha no mapa, o jogador vê o mapa aberto', () => {
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 0, randomId: sequentialIds() })
    const map = twoRooms()
    const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(ana.playerId, 'heroi')
    const semFicha: MapData = { ...map, tokens: map.tokens.filter((tk) => tk.id !== 'heroi') }
    expect(s.broadcast(semFicha).outbound[0]?.msg.type).toBe('snapshot')
  })

  it('2. mil pedidos com ids de pino inventados não fazem os limites crescer além do número de jogadores', () => {
    const t = mesa()
    for (let i = 0; i < 1000; i += 1) {
      t.advance(TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS)
      expect(recusa(t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: `inventado-${i}` }, t.w))).toBe('unavailable')
    }
    expect(t.s.travelLimitEntries()).toBeLessThanOrEqual(2)
  })

  it('3. reconectar com o resume não zera o limite: pedir de novo logo depois é too_soon', () => {
    const t = mesa()
    expect(t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada-a' }, t.w).travelRequest).toBeDefined()
    t.s.disconnect('c1')
    t.s.handleMessage('c3', { type: 'join', code: CODE, name: 'Ana', resume: t.ana.resumeToken }, t.w)
    expect(recusa(t.s.handleMessage('c3', { type: 'pin.travel.request', pinId: 'outro-pino' }, t.w))).toBe('too_soon')
    expect(recusa(t.s.handleMessage('c3', { type: 'pin.travel.request', pinId: 'escada-a' }, t.w))).toBe('too_soon')
    t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
    expect(t.s.handleMessage('c3', { type: 'pin.travel.request', pinId: 'escada-a' }, t.w).travelRequest).toBeDefined()
  })

  it('4. o mestre religa o pino depois de ler o aviso: "Deixar ir" é recusado, e o jogador não vai para o destino novo', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada-a' }, t.w).travelRequest
    if (pedido === undefined) throw new Error('pedido deveria valer')
    const r = t.s.approveTravel(pedido.requestId, mundo('A', true))
    expect(r.applyTransfer).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }])
    expect(t.s.isTravelPending(pedido.requestId)).toBe(false)
    // Controle positivo: sem religar, o mesmo caminho deixa ir.
    t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
    const outro = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada-a' }, t.w).travelRequest
    if (outro === undefined) throw new Error('segundo pedido deveria valer')
    expect(t.s.approveTravel(outro.requestId, t.w).applyTransfer?.toSceneId).toBe(CENA_B)
  })
})

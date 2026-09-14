import { describe, expect, it } from 'vitest'
import { countExploredCells, decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token, Wall } from '../types/map'
import { SIGNAL_MIN_INTERVAL_MS, signalColor } from '../lib/signals'
import { createHostSession, VISION_RADIUS_MAX, VISION_RADIUS_MIN, type HostResult } from './hostSession'
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

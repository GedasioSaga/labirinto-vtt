import { describe, expect, it } from 'vitest'
import { countExploredCells, decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
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

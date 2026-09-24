/**
 * CUSTO DO MESTRE COM 7 JOGADORES. Cada movimento aceito faz o integrador
 * (`hostBridge`) aplicar o passo e mandar um snapshot a TODO jogador da cena:
 * sete recortes (`filterMapForPlayer`), sete marcações de exploração, sete
 * codificações. Isto roda na thread do mestre; tarefa acima de ~100 ms é o
 * editor engasgando enquanto ele digita.
 *
 * Cenário "vila": 12 casas com quarto, porta na frente e no quarto, metade com
 * teto, chão por casa e rua; os 7 na mesma cena, andando pela rua.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { FloorPiece, MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostSession } from './hostSession'

const CODE = 'AB12CD'
const GRID = 50
const COLS = 80
const ROWS = 60
const VISION = 700
const HOUSE_W = 400
const HOUSE_H = 300
/** Aceite da peça: nenhum movimento vira tarefa acima disto no mestre. */
const TASK_BUDGET_MS = 100
const STEPS = 12

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function porta(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return parede(id, x1, y1, x2, y2, { door: { open: false, locked: false, kind: 'normal' } })
}

function sala(id: string, x: number, y: number, w: number, h: number, roof: boolean, parentId?: string): Region {
  const region: Region = {
    id,
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    tag: '',
    fillColor: '#333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: `nome-${id}`, roof },
  }
  if (parentId !== undefined) region.parentId = parentId
  return region
}

function chao(id: string, cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

/** Uma casa: 4 paredes (a da frente partida pela porta), quarto com divisória e porta, NPC dentro. */
function casa(n: number, x: number, y: number, roof: boolean) {
  const id = `casa${n}`
  const doorX = x + HOUSE_W / 2
  const walls: Wall[] = [
    parede(`${id}-n`, x, y, x + HOUSE_W, y, { regionId: id, regionEdgeIndex: 0 }),
    parede(`${id}-l`, x + HOUSE_W, y, x + HOUSE_W, y + HOUSE_H, { regionId: id, regionEdgeIndex: 1 }),
    parede(`${id}-s1`, x + HOUSE_W, y + HOUSE_H, doorX + 25, y + HOUSE_H, { regionId: id, regionEdgeIndex: 2 }),
    porta(`${id}-porta`, doorX + 25, y + HOUSE_H, doorX - 25, y + HOUSE_H),
    parede(`${id}-s2`, doorX - 25, y + HOUSE_H, x, y + HOUSE_H, { regionId: id, regionEdgeIndex: 2 }),
    parede(`${id}-o`, x, y + HOUSE_H, x, y, { regionId: id, regionEdgeIndex: 3 }),
    // Quarto no canto de cima à esquerda.
    parede(`${id}-q1`, x + 150, y, x + 150, y + 100),
    porta(`${id}-qporta`, x + 150, y + 100, x + 150, y + 150),
    parede(`${id}-q2`, x, y + 150, x + 150, y + 150),
  ]
  const regions = [sala(id, x, y, HOUSE_W, HOUSE_H, roof), sala(`${id}-quarto`, x, y, 150, 150, false, id)]
  return {
    walls,
    regions,
    floor: [chao(`${id}-chao`, x + HOUSE_W / 2, y + HOUSE_H / 2, HOUSE_W, HOUSE_H)],
    tokens: [ficha(`${id}-morador`, x + 300, y + 100)],
  }
}

/** Vila de 4x3 casas separadas por ruas de 300 px; a rua é o chão que liga tudo. */
function vila(players: number): MapData {
  const base = createEmptyMap('vila', 'Vila', COLS, ROWS, GRID)
  const houses = Array.from({ length: 12 }, (_, i) => casa(i, 200 + (i % 4) * 900, 200 + Math.floor(i / 4) * 900, i % 2 === 0))
  const street = chao('rua', (COLS * GRID) / 2, (ROWS * GRID) / 2, COLS * GRID - 100, ROWS * GRID - 100)
  const heroes = Array.from({ length: players }, (_, i) => ficha(`heroi${i}`, 1025 + i * GRID, 725))
  return {
    ...base,
    walls: houses.flatMap((h) => h.walls),
    regions: houses.flatMap((h) => h.regions),
    floor: [street, ...houses.flatMap((h) => h.floor)],
    tokens: [...heroes, ...houses.flatMap((h) => h.tokens)],
  }
}

interface Mesa {
  session: HostSession
  clients: string[]
}

function mesa(map: MapData, players: number): Mesa {
  let n = 0
  const session = createHostSession({ code: CODE, visionRadius: VISION, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const clients: string[] = []
  for (let i = 0; i < players; i += 1) {
    const clientId = `c${i}`
    const welcome = session.handleMessage(clientId, { type: 'join', code: CODE, name: `Jogador ${i}` }, map).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    session.assignToken(welcome.playerId, `heroi${i}`)
    clients.push(clientId)
  }
  // Primeiro snapshot de todos: é o estado de uma mesa já em jogo.
  session.broadcast(map)
  return { session, clients }
}

/**
 * O caminho do integrador num movimento: valida, aplica no mapa e manda o
 * snapshot a todos. O `JSON.stringify` de cada envio é o que o `invoke` do
 * Tauri faz com a mensagem antes de ela sair da thread do mestre.
 */
function mover(session: HostSession, map: MapData, clientId: string, tokenId: string, x: number, y: number): MapData {
  const result = session.handleMessage(clientId, { type: 'token.move', reqId: `r-${x}-${y}`, tokenId, x, y }, map)
  const applied = result.applyMove
  if (applied === undefined) throw new Error(`movimento recusado: ${JSON.stringify(result.outbound)}`)
  const next: MapData = { ...map, tokens: map.tokens.map((t) => (t.id === applied.tokenId ? { ...t, x: applied.x, y: applied.y } : t)) }
  const outbound = [...result.outbound, ...session.broadcast(next).outbound]
  const bytes = outbound.reduce((sum, o) => sum + JSON.stringify(o).length, 0)
  if (bytes === 0) throw new Error('nada enviado')
  return next
}

/** Maior tempo de um movimento (validação + snapshot de todos), com um jogador por vez andando pela rua. */
function piorMovimento(players: number): { maxMs: number; snapshots: number } {
  let map = vila(players)
  const { session, clients } = mesa(map, players)
  let maxMs = 0
  for (let step = 1; step <= STEPS; step += 1) {
    const who = step % players
    const token = map.tokens.find((t) => t.id === `heroi${who}`)
    if (token === undefined) throw new Error('ficha sumiu')
    const clientId = clients[who]
    if (clientId === undefined) throw new Error('cliente sumiu')
    const start = performance.now()
    map = mover(session, map, clientId, token.id, token.x, token.y + GRID)
    maxMs = Math.max(maxMs, performance.now() - start)
  }
  return { maxMs, snapshots: session.broadcast(map).outbound.length }
}

describe('custo do mestre com 7 jogadores na vila', () => {
  it('mede 1, 4 e 7 jogadores; com 7, nenhum movimento passa de 100 ms', () => {
    const medidas = [1, 4, 7].map((players) => ({ players, ...piorMovimento(players) }))
    // A medida fica registrada na saída do teste (comando e saída vão no relatório da peça).
    console.info(`[custo-host] ${medidas.map((m) => `${m.players} jogador(es): pior movimento ${m.maxMs.toFixed(1)} ms`).join(' | ')}`)
    expect(medidas.map((m) => m.snapshots)).toEqual([1, 4, 7])
    const sete = medidas[2]
    expect(sete?.players).toBe(7)
    expect(sete?.maxMs).toBeGreaterThan(0)
    expect(sete?.maxMs).toBeLessThan(TASK_BUDGET_MS)
  })
})

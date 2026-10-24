/**
 * DIA/TARDE/NOITE (Luz L1) — custo no mestre. Dois tetos do plano
 * (`docs/planos/luz-dia-tarde-noite-2026-10-24.md`):
 *  - o recorte do jogador (`filterMapForPlayer`) na vila com 20 luzes e 30
 *    NPCs fica em p95 <= 10 ms por jogador (e não piora com os campos de
 *    período no mapa do mestre, que o recorte só tira);
 *  - a troca de período com 7 jogadores na cena externa sai numa tarefa só
 *    abaixo de 200 ms (o `broadcast` mais o `JSON.stringify` de cada envio,
 *    que é o que o `invoke` do Tauri faz antes de a mensagem sair da thread).
 *
 * Teste de tempo: mora no projeto `desempenho` (`client/vitest.projetos.json`).
 */
import { describe, expect, it } from 'vitest'
import { filterMapForPlayer, raioDaNoite, type VisionRadius } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import type { FloorPiece, Light, MapData, Periodo, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostSession } from './hostSession'

const CODE = 'AB12CD'
const GRID = 50
const COLS = 80
const ROWS = 60
const VISION = 700
const HOUSE_W = 400
const HOUSE_H = 300
const PLAYERS = 7
const LIGHTS = 20
const NPCS = 30
/** Teto do plano: recorte de um jogador, p95. */
const FILTER_P95_BUDGET_MS = 10
/** Teto do plano: nenhuma tarefa longa (>= 200 ms) na troca. */
const SWITCH_BUDGET_MS = 200
const FILTER_ROUNDS = 30
/** Guarda da L2: a noite com luz mediu 3,3x a noite de antes (só o raio curto); acima de 5x algo piorou. */
const L2_RAZAO_MAXIMA = 5
/** Abaixo disto a diferença é ruído do relógio (o p95 de antes fica perto de 1 ms). */
const RUIDO_MS = 0.25

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function porta(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return parede(id, x1, y1, x2, y2, { door: { open: false, locked: false, kind: 'normal' } })
}

function sala(id: string, x: number, y: number, w: number, h: number, roof: boolean): Region {
  return {
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
}

function chao(id: string, cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function luz(id: string, x: number, y: number): Light {
  return { id, x, y, radius: 175, color: '#ffb347', intensity: 0.8 }
}

/** Uma casa: 4 paredes (a da frente partida pela porta), um morador e um lampião dentro. */
function casa(n: number, x: number, y: number) {
  const id = `casa${n}`
  const doorX = x + HOUSE_W / 2
  return {
    walls: [
      parede(`${id}-n`, x, y, x + HOUSE_W, y),
      parede(`${id}-l`, x + HOUSE_W, y, x + HOUSE_W, y + HOUSE_H),
      parede(`${id}-s1`, x + HOUSE_W, y + HOUSE_H, doorX + 25, y + HOUSE_H),
      porta(`${id}-porta`, doorX + 25, y + HOUSE_H, doorX - 25, y + HOUSE_H),
      parede(`${id}-s2`, doorX - 25, y + HOUSE_H, x, y + HOUSE_H),
      parede(`${id}-o`, x, y + HOUSE_H, x, y),
    ],
    region: sala(id, x, y, HOUSE_W, HOUSE_H, n % 2 === 0),
    floor: chao(`${id}-chao`, x + HOUSE_W / 2, y + HOUSE_H / 2, HOUSE_W, HOUSE_H),
    npc: ficha(`${id}-morador`, x + 300, y + 100),
    light: luz(`${id}-lampiao`, x + 100, y + 200),
  }
}

/**
 * Vila de 4x3 casas, cena EXTERNA, com 20 luzes (12 lampiões nas casas e 8
 * postes na rua) e 30 NPCs (12 moradores e 18 na rua). `comCamposDoPeriodo`
 * põe no mapa do mestre os campos de período que o recorte tem de tirar.
 */
function vila(comCamposDoPeriodo: boolean): MapData {
  const base = createEmptyMap('vila', 'Vila', COLS, ROWS, GRID)
  const houses = Array.from({ length: 12 }, (_, i) => casa(i, 200 + (i % 4) * 900, 200 + Math.floor(i / 4) * 900))
  const street = chao('rua', (COLS * GRID) / 2, (ROWS * GRID) / 2, COLS * GRID - 100, ROWS * GRID - 100)
  const heroes = Array.from({ length: PLAYERS }, (_, i) => ficha(`heroi${i}`, 1025 + i * GRID, 725))
  const streetNpcs = Array.from({ length: NPCS - houses.length }, (_, i) => ficha(`passante${i}`, 700 + (i % 9) * 300, 650 + Math.floor(i / 9) * 900))
  const postes = Array.from({ length: LIGHTS - houses.length }, (_, i) => luz(`poste${i}`, 650 + i * 400, 700))
  const map: MapData = {
    ...base,
    externa: true,
    walls: houses.flatMap((h) => h.walls),
    regions: houses.map((h) => h.region),
    floor: [street, ...houses.map((h) => h.floor)],
    tokens: [...heroes, ...houses.map((h) => h.npc), ...streetNpcs],
    lights: [...houses.map((h) => h.light), ...postes],
  }
  if (!comCamposDoPeriodo) return map
  return { ...map, ambientePorPeriodo: { noite: { cor: '#203050', forca: 0.9 } }, visaoPorPeriodo: { noite: 3 } }
}

function p95(amostras: number[]): number {
  const ordenadas = [...amostras].sort((a, b) => a - b)
  return ordenadas[Math.min(ordenadas.length - 1, Math.ceil(ordenadas.length * 0.95) - 1)] ?? 0
}

/** p95 do recorte de um jogador: `FILTER_ROUNDS` rodadas dos 7, com o raio `raio` (o de dia, por padrão). */
function filtroP95(map: MapData, raio: VisionRadius = VISION): number {
  const ownership: Record<string, string[]> = {}
  for (let i = 0; i < PLAYERS; i += 1) ownership[`p${i}`] = [`heroi${i}`]
  // Aquecimento: o JIT e os caches de visibilidade não entram na medida.
  for (let i = 0; i < PLAYERS; i += 1) filterMapForPlayer(map, `p${i}`, ownership, raio)
  const amostras: number[] = []
  for (let rodada = 0; rodada < FILTER_ROUNDS; rodada += 1) {
    for (let i = 0; i < PLAYERS; i += 1) {
      const start = performance.now()
      filterMapForPlayer(map, `p${i}`, ownership, raio)
      amostras.push(performance.now() - start)
    }
  }
  return p95(amostras)
}

function mesa(map: MapData, periodo: { atual: Periodo }): { session: HostSession; clients: string[] } {
  let n = 0
  const session = createHostSession({ code: CODE, visionRadius: VISION, now: () => 0, randomId: () => `id-${(n += 1)}`, getPeriodo: () => periodo.atual })
  const clients: string[] = []
  for (let i = 0; i < PLAYERS; i += 1) {
    const clientId = `c${i}`
    const welcome = session.handleMessage(clientId, { type: 'join', code: CODE, name: `Jogador ${i}` }, map).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    session.assignToken(welcome.playerId, `heroi${i}`)
    clients.push(clientId)
  }
  session.broadcast(map)
  return { session, clients }
}

describe('Dia/Tarde/Noite: custo no mestre na vila com 20 luzes e 30 NPCs', () => {
  it('recorte do jogador: p95 <= 10 ms, com e sem os campos de período no mapa do mestre', () => {
    const sem = filtroP95(vila(false))
    const com = filtroP95(vila(true))
    console.info(`[luz-l1] recorte p95 por jogador: sem campos ${sem.toFixed(2)} ms | com campos ${com.toFixed(2)} ms`)
    expect(sem).toBeLessThanOrEqual(FILTER_P95_BUDGET_MS)
    expect(com).toBeLessThanOrEqual(FILTER_P95_BUDGET_MS)
  })

  /**
   * O RISCO do plano medido (24/10/2026): a noite com o claro das luzes é
   * conta nova (o `darkVision` na vila inteira), não dá para ficar a 20% do
   * raio curto sem luz. Primeira versão 6,7 ms (5,8x); com o claro inteiro na
   * linha de visão sem sementes (`ringInside`), 3,5 ms (3,3x). O teto do plano
   * é o absoluto; a razão segura uma piora acidental.
   */
  it('Luz L2, a noite com o claro das luzes (darkVision na vila inteira): p95 <= 10 ms', () => {
    const linhas: string[] = []
    for (const [nome, map, raio] of [
      ['sem campo (350 px)', vila(false), 350],
      ['noite 3 casas (150 px)', vila(true), 150],
    ] as const) {
      // Antes da L2 a noite era só o raio curto (número); agora o raio vai marcado e as luzes entram.
      const antes = filtroP95(map, raio)
      const depois = filtroP95(map, raioDaNoite(() => raio))
      linhas.push(`${nome}: antes ${antes.toFixed(2)} ms, depois ${depois.toFixed(2)} ms`)
      expect(depois).toBeLessThanOrEqual(FILTER_P95_BUDGET_MS)
      expect(depois).toBeLessThanOrEqual(Math.max(antes * L2_RAZAO_MAXIMA, antes + RUIDO_MS))
    }
    console.info(`[luz-l2] recorte p95 por jogador à noite: ${linhas.join(' | ')}`)
  })

  it('troca de período com 7 jogadores: 1 mensagem por jogador e nenhuma tarefa >= 200 ms', () => {
    const map = vila(true)
    const periodo: { atual: Periodo } = { atual: 'dia' }
    const { session, clients } = mesa(map, periodo)
    const tempos: number[] = []
    for (const proximo of ['tarde', 'noite', 'dia', 'noite'] as const) {
      periodo.atual = proximo
      const start = performance.now()
      const envio = session.broadcast(map).outbound
      for (const o of envio) JSON.stringify(o.msg)
      tempos.push(performance.now() - start)
      // Uma mensagem por jogador: a troca não vira rajada.
      expect(envio.map((o) => o.clientId).sort()).toEqual([...clients].sort())
    }
    const pior = Math.max(...tempos)
    console.info(`[luz-l1] troca de período com 7 jogadores: ${tempos.map((t) => t.toFixed(1)).join(' / ')} ms (pior ${pior.toFixed(1)})`)
    expect(pior).toBeLessThan(SWITCH_BUDGET_MS)
  })
})

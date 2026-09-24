/**
 * ANDAR ATÉ AQUI: o caminho que a tela do jogador calcula usa SÓ o que ele já
 * conhece (memória explorada + visão de agora, fora de zona oculta). O que a
 * névoa esconde não vira atalho: se a única rua passa pelo escuro, não há
 * caminho. E cada trecho do caminho passa, sozinho, na validação do host.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { createExploration, markAll, markRings } from './exploration'
import { moveCrossesWall } from './collision'
import { validateTokenMove } from './moveValidation'
import { findKnownPath, isPointKnown, type KnownArea } from './knownPath'
import type { MapData, RegionPoint, Wall } from '../types/map'

const GRID = 50
/** 20 x 12 células de 50 px: mundo de 1000 x 600. */
const W = 1000
const H = 600

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Prédio fechado no meio da praça: x 400-600, y 150-450. Rua por cima (y < 150) e por baixo (y > 450). */
const PREDIO: Wall[] = [
  parede('n', 400, 150, 600, 150),
  parede('l', 600, 150, 600, 450),
  parede('s', 600, 450, 400, 450),
  parede('o', 400, 450, 400, 150),
]

function praca(): MapData {
  return { ...createEmptyMap('capital', 'Capital', 20, 12, GRID), walls: PREDIO }
}

function retangulo(x1: number, y1: number, x2: number, y2: number): RegionPoint[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

function conhecido(aneis: RegionPoint[][] | 'tudo', extra: Partial<KnownArea> = {}): KnownArea {
  // Em px de mundo, como o host monta a memória (`hostSession`).
  const explored = createExploration({ width: W, height: H, grid: GRID })
  if (aneis === 'tudo') markAll(explored)
  else markRings(explored, aneis)
  return { explored, vision: [], concealed: [], ...extra }
}

const ORIGEM = { x: 300, y: 300 }
const BECO = { x: 700, y: 300 }

/** Pontos a cada 5 px ao longo do caminho inteiro (origem incluída). */
function amostras(de: { x: number; y: number }, caminho: { x: number; y: number }[]): { x: number; y: number }[] {
  const pontos: { x: number; y: number }[] = []
  let a = de
  for (const b of caminho) {
    const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5))
    for (let i = 0; i <= passos; i += 1) pontos.push({ x: a.x + ((b.x - a.x) * i) / passos, y: a.y + ((b.y - a.y) * i) / passos })
    a = b
  }
  return pontos
}

describe('findKnownPath: andar até aqui pelas ruas conhecidas', () => {
  it('rua livre: um trecho só, direto ao ponto', () => {
    const caminho = findKnownPath(praca(), ORIGEM, { x: 300, y: 500 }, conhecido('tudo'))
    expect(caminho).toEqual([{ x: 300, y: 500 }])
  })

  it('prédio no meio: dobra as esquinas, nenhum trecho atravessa parede e termina no beco', () => {
    const mapa = praca()
    const caminho = findKnownPath(mapa, ORIGEM, BECO, conhecido('tudo'))
    if (caminho === null) throw new Error('esperava caminho em volta do prédio')
    expect(caminho.length).toBeGreaterThanOrEqual(3)
    expect(caminho.at(-1)).toEqual(BECO)
    let de = ORIGEM
    for (const ponto of caminho) {
      expect(mapa.walls.filter((w) => moveCrossesWall(de, ponto, w))).toEqual([])
      de = ponto
    }
  })

  it('cada trecho, um depois do outro, passa na validação do host (igual no mestre)', () => {
    const mapa = { ...praca(), tokens: [{ id: 'enzo', characterId: null, name: 'Enzo', x: ORIGEM.x, y: ORIGEM.y, size: 1, image: null }] }
    const caminho = findKnownPath(mapa, ORIGEM, BECO, conhecido('tudo'))
    if (caminho === null) throw new Error('esperava caminho')
    let atual = mapa
    for (const ponto of caminho) {
      const x = Math.round(ponto.x)
      const y = Math.round(ponto.y)
      const resultado = validateTokenMove(atual, { playerId: 'p1', tokenId: 'enzo', x, y }, { p1: ['enzo'] })
      expect(resultado).toEqual({ ok: true, x, y })
      atual = { ...atual, tokens: atual.tokens.map((t) => ({ ...t, x, y })) }
    }
    expect(atual.tokens[0]).toMatchObject({ x: BECO.x, y: BECO.y })
  })

  it('área preta (nunca vista): não há caminho', () => {
    // Só a metade esquerda foi explorada; o beco fica no escuro.
    expect(findKnownPath(praca(), ORIGEM, BECO, conhecido([retangulo(0, 0, 500, H)]))).toBeNull()
  })

  it('a única rua passa pelo escuro: não há caminho, mesmo que o chão exista', () => {
    // Conhece os dois lados do prédio, mas nem a rua de cima nem a de baixo.
    const lados = [retangulo(0, 150, 400, 450), retangulo(600, 150, W, 450)]
    expect(findKnownPath(praca(), ORIGEM, BECO, conhecido(lados))).toBeNull()
  })

  it('conhece só a rua de cima: o caminho inteiro fica no que ele conhece', () => {
    const semRuaDeBaixo = [retangulo(0, 0, W, 150), retangulo(0, 150, 400, 450), retangulo(600, 150, W, 450)]
    const area = conhecido(semRuaDeBaixo)
    const caminho = findKnownPath(praca(), ORIGEM, BECO, area)
    if (caminho === null) throw new Error('esperava caminho pela rua de cima')
    const fora = amostras(ORIGEM, caminho).filter((p) => !isPointKnown(area, p))
    expect(fora).toEqual([])
    expect(Math.min(...caminho.map((p) => p.y))).toBeLessThan(150)
    expect(caminho.at(-1)).toEqual(BECO)
  })

  it('zona oculta do mestre conta como escuro, mesmo explorada antes', () => {
    const ocultas = [retangulo(0, 0, W, 150), retangulo(0, 450, W, H)]
    expect(findKnownPath(praca(), ORIGEM, BECO, conhecido('tudo', { concealed: ocultas }))).toBeNull()
    expect(isPointKnown(conhecido('tudo', { concealed: ocultas }), { x: 100, y: 100 })).toBe(false)
  })

  it('a visão de agora vale como conhecido, sem memória nenhuma', () => {
    const area: KnownArea = { explored: undefined, vision: [retangulo(0, 0, W, H)], concealed: [] }
    const caminho = findKnownPath(praca(), ORIGEM, BECO, area)
    expect(caminho?.at(-1)).toEqual(BECO)
    expect(isPointKnown({ explored: undefined, vision: [], concealed: [] }, ORIGEM)).toBe(false)
  })

  it('porta fechada no único acesso: não há caminho; aberta, passa pelo vão', () => {
    // Beco DENTRO do prédio, com porta na parede leste.
    const fechada: Wall[] = [
      parede('n', 400, 150, 600, 150),
      parede('l1', 600, 150, 600, 275),
      { ...parede('porta', 600, 275, 600, 325), door: { open: false, locked: false, kind: 'normal' } },
      parede('l2', 600, 325, 600, 450),
      parede('s', 600, 450, 400, 450),
      parede('o', 400, 450, 400, 150),
    ]
    const dentro = { x: 500, y: 300 }
    const mapaFechado = { ...praca(), walls: fechada }
    expect(findKnownPath(mapaFechado, ORIGEM, dentro, conhecido('tudo'))).toBeNull()
    const aberta = fechada.map((w) => (w.door === null ? w : { ...w, door: { ...w.door, open: true } }))
    const caminho = findKnownPath({ ...praca(), walls: aberta }, ORIGEM, dentro, conhecido('tudo'))
    expect(caminho?.at(-1)).toEqual(dentro)
    expect(Math.max(...(caminho ?? []).map((p) => p.x))).toBeGreaterThan(600)
  })
})

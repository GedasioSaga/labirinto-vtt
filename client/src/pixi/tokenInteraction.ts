import type { GridShape, Token } from '../types/map'
import type { Point } from './world'
import { axialToPixel, hexCorners, pixelToAxial, snapToHexGrid } from './hexGrid'
import type { SnapTargetKind } from './grid'

/**
 * Gruda x/y no VÉRTICE (canto) da célula quadrada mais próxima — arredonda
 * os dois eixos de forma independente. Comportamento histórico deste
 * arquivo, mantido como está: é o certo para Parede e Objeto, que devem
 * encostar no canto/aresta da grade ao arrastar. Para Token, que deve
 * grudar no CENTRO da célula, use `snapToGridCenter` — ver `snapPointForTarget`.
 */
export function snapToGrid(x: number, y: number, gridSize: number): Point {
  if (gridSize <= 0) return { x, y }
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  }
}

/**
 * Gruda x/y no CENTRO da célula quadrada mais próxima: mesma fórmula de
 * `snapToGrid`, deslocando meia célula antes e depois do arredondamento.
 *
 * MUDANÇA DE COMPORTAMENTO VISÍVEL (PLANO-FASES.md §5, risco nº 5): antes
 * desta fase, `applySnap` (PixiCanvas.tsx) usava `snapToGrid` — canto — para
 * TODOS os alvos, Token incluído. Um token de mapa já salvo que estava
 * grudado num canto de célula vai "pular" meio grid (`gridSize / 2` em x e
 * y) no primeiro arraste depois que o integrador ligar `snapPointForTarget`
 * em `applySnap`. Não corrompe o arquivo — só reposiciona visualmente no
 * próximo drag. Avisar o usuário antes de publicar.
 */
export function snapToGridCenter(x: number, y: number, gridSize: number): Point {
  if (gridSize <= 0) return { x, y }
  const half = gridSize / 2
  return {
    x: Math.round((x - half) / gridSize) * gridSize + half,
    y: Math.round((y - half) / gridSize) * gridSize + half,
  }
}

/**
 * Gruda x/y no VÉRTICE hexagonal mais próximo, para Parede/Objeto em grade
 * hexagonal. Acha o hexágono cujo centro está mais perto do ponto
 * (`pixelToAxial`, mesma função que `snapToHexGrid` já usa) e escolhe, entre
 * os 6 cantos desse hexágono (`hexCorners`), o mais próximo de (x, y). Cada
 * vértice hexagonal é compartilhado por até 3 células; usar só os cantos do
 * hexágono mais próximo do ponto já resolve o vértice certo na prática —
 * evita varrer os vizinhos pra um ganho que não muda o resultado no uso
 * normal (arraste perto da própria célula).
 */
export function snapToHexVertex(x: number, y: number, size: number): Point {
  if (size <= 0) return { x, y }
  const center = axialToPixel(pixelToAxial({ x, y }, size), size)
  const corners = hexCorners(center, size)
  let nearest = corners[0]
  let nearestDist = Math.hypot(nearest.x - x, nearest.y - y)
  for (let i = 1; i < corners.length; i += 1) {
    const dist = Math.hypot(corners[i].x - x, corners[i].y - y)
    if (dist < nearestDist) {
      nearest = corners[i]
      nearestDist = dist
    }
  }
  return nearest
}

/**
 * Ponto único de "snap por alvo": reúne as 4 combinações {token, wall/prop}
 * x {square, hex} numa função só, para `applySnap` (PixiCanvas.tsx, do
 * integrador) não reimplementar a regra em cada um dos call sites. Regra:
 * Token gruda no CENTRO da célula; Parede e Objeto grudam no VÉRTICE/aresta
 * — ver PLANO-FASES.md §1.2 e §5 (risco nº 5).
 */
export function snapPointForTarget(target: SnapTargetKind, gridShape: GridShape, x: number, y: number, gridSize: number): Point {
  if (gridShape === 'hex') {
    return target === 'token' ? snapToHexGrid(x, y, gridSize) : snapToHexVertex(x, y, gridSize)
  }
  return target === 'token' ? snapToGridCenter(x, y, gridSize) : snapToGrid(x, y, gridSize)
}

export function findTokenAt(tokens: Token[], point: Point, gridSize: number): Token | null {
  const baseRadius = gridSize / 2
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i]
    const hitRadius = baseRadius * token.size
    const dx = point.x - token.x
    const dy = point.y - token.y
    if (Math.hypot(dx, dy) <= hitRadius) {
      return token
    }
  }
  return null
}

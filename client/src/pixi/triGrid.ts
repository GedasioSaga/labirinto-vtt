/**
 * Grade TRIANGULAR — matemática derivada da grade hexagonal (`hexGrid.ts`),
 * não reescrita do zero.
 *
 * O motivo: a grade triangular é o GRAFO DUAL da grade hexagonal. Se você
 * pega os CENTROS de hexágonos vizinhos (via `axialToPixel` de `hexGrid.ts`)
 * e conecta cada centro aos 6 vizinhos, o resultado é exatamente uma malha
 * de triângulos equiláteros — cada vértice tem 6 arestas ao redor, formando
 * 6 triângulos, igual a qualquer lattice triangular regular.
 *
 * Prova rápida do tamanho: em `axialToPixel({q,r}, hexSize)`, a distância
 * entre dois centros vizinhos (ex.: (0,0) e (1,0)) é sempre
 * `hexSize * Math.sqrt(3)` — ver `hexGrid.test.ts`, teste
 * "desloca em q e r conforme o tamanho". Então, para gerar uma malha
 * triangular cujo LADO do triângulo seja `size`, basta chamar as funções
 * axiais de `hexGrid.ts` com `hexSize = size / Math.sqrt(3)` — é isso que
 * `triSizeToHexSize` faz, e é a única conversão nova deste arquivo.
 *
 * Todo o resto (arredondamento pro vértice mais próximo, cálculo do
 * viewport visível) é `pixelToAxial`/`roundAxial`/`computeVisibleHexCenters`
 * de `hexGrid.ts`, chamados com esse `hexSize` convertido — nenhuma
 * trigonometria nova.
 */
import type { Point } from './world'
import type { Viewport } from './grid'
import { axialToPixel, computeVisibleHexCenters, pixelToAxial, pixelToAxialRaw, type AxialCoord } from './hexGrid'

export type { Point, AxialCoord }

/** Segmento de reta entre dois vértices adjacentes da malha triangular. */
export interface TriEdge {
  a: Point
  b: Point
}

export type TriOrientation = 'up' | 'down'

/**
 * Identifica um triângulo pela mesma coordenada axial (q, r) do vértice que
 * fica no seu canto "de origem", mais a orientação. Cada célula axial (q, r)
 * cobre um losango — os vértices (q,r), (q+1,r), (q,r+1), (q+1,r+1) — que a
 * malha triangular corta em dois: o triângulo 'up' (contém o vértice (q,r))
 * e o 'down' (contém o vértice (q+1,r+1)), divididos pela aresta comum entre
 * (q+1,r) e (q,r+1). Ver `findTriCell` para a regra que decide o lado.
 */
export interface TriCell {
  q: number
  r: number
  orientation: TriOrientation
}

/** Ver o comentário do topo do arquivo — a prova de que isto gera lado `size`. */
function triSizeToHexSize(size: number): number {
  return size / Math.sqrt(3)
}

/**
 * As 3 direções axiais (de um total de 6 vizinhas, mesmo conjunto que
 * `tokenInteraction.ts`/`hexGrid.ts` usam implicitamente) escolhidas de modo
 * que nenhuma seja o oposto de outra do grupo. Resultado: para cada vértice
 * visível, desenhar as arestas só nessas 3 direções cobre TODAS as arestas
 * da malha exatamente uma vez — a aresta na direção oposta já foi (ou será)
 * desenhada a partir do outro extremo. Evita desenhar cada aresta 2x.
 */
const EDGE_DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: 1, r: -1 },
]

/**
 * Gruda (x, y) no VÉRTICE da malha triangular mais próximo. Reaproveita
 * `pixelToAxial` (que já faz o arredondamento pro ponto de lattice mais
 * próximo via `roundAxial`) — não há "vértice fracionário" a resolver aqui
 * como em `snapToHexVertex` (tokenInteraction.ts), porque os vértices desta
 * malha SÃO os pontos axiais inteiros, não os cantos de um polígono.
 */
export function snapToTriVertex(x: number, y: number, size: number): Point {
  if (size <= 0) return { x, y }
  const hexSize = triSizeToHexSize(size)
  return axialToPixel(pixelToAxial({ x, y }, hexSize), hexSize)
}

/**
 * Os 3 vértices de uma `TriCell`, em pixels de mundo — ver o comentário de
 * `TriCell` para a definição dos dois triângulos do losango (q, r).
 */
export function triCellVertices(cell: TriCell, size: number): [Point, Point, Point] {
  const hexSize = triSizeToHexSize(size)
  const { q, r, orientation } = cell
  if (orientation === 'up') {
    return [
      axialToPixel({ q, r }, hexSize),
      axialToPixel({ q: q + 1, r }, hexSize),
      axialToPixel({ q, r: r + 1 }, hexSize),
    ]
  }
  return [
    axialToPixel({ q: q + 1, r }, hexSize),
    axialToPixel({ q, r: r + 1 }, hexSize),
    axialToPixel({ q: q + 1, r: r + 1 }, hexSize),
  ]
}

/** Centroide (média dos 3 vértices) de uma `TriCell`, em pixels de mundo. */
export function triCellCentroid(cell: TriCell, size: number): Point {
  const [a, b, c] = triCellVertices(cell, size)
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
  }
}

/**
 * Acha a `TriCell` que contém (x, y). Usa a coordenada axial CRUA (fração,
 * `pixelToAxialRaw` — não arredondada) pra localizar o losango (q0, r0) =
 * (floor(q), floor(r)), depois decide o lado com a mesma regra clássica de
 * split de quadrado unitário pela anti-diagonal: fração (fq, fr) dentro do
 * losango, `fq + fr <= 1` cai no triângulo 'up' (perto da origem do
 * losango), senão 'down'. Isso vale porque `axialToPixel` é um mapa AFIM
 * (linear + translação) de (q, r) pra pixel — mapa afim leva reta em reta e
 * preserva de que lado de uma aresta um ponto cai, então o teste em espaço
 * (q, r) e o teste geométrico em pixels dão a mesma resposta.
 */
export function findTriCell(x: number, y: number, size: number): TriCell {
  if (size <= 0) return { q: 0, r: 0, orientation: 'up' }
  const hexSize = triSizeToHexSize(size)
  const raw = pixelToAxialRaw({ x, y }, hexSize)
  const q0 = Math.floor(raw.q)
  const r0 = Math.floor(raw.r)
  const fq = raw.q - q0
  const fr = raw.r - r0
  const orientation: TriOrientation = fq + fr <= 1 ? 'up' : 'down'
  return { q: q0, r: r0, orientation }
}

/**
 * Gruda (x, y) no CENTRO (centroide) do triângulo que contém o ponto —
 * equivalente triangular de `snapToHexGrid`/`snapToGridCenter`, para Token
 * em grade triangular (ver `snapPointForTarget`, tokenInteraction.ts).
 */
export function snapToTriCenter(x: number, y: number, size: number): Point {
  if (size <= 0) return { x, y }
  return triCellCentroid(findTriCell(x, y, size), size)
}

/**
 * Vértices visíveis no viewport — mesma assinatura de `computeVisibleHexCenters`.
 * Delega inteiramente pra ela com o `hexSize` convertido: os "centros de
 * hexágono" que ela devolve SÃO os vértices da malha triangular (ver
 * comentário do topo do arquivo).
 */
export function computeVisibleTriVertices(size: number, viewport: Viewport): Point[] {
  if (size <= 0) return []
  return computeVisibleHexCenters(triSizeToHexSize(size), viewport)
}

/**
 * Arestas visíveis no viewport, prontas pra `drawTriGrid` traçar. Para cada
 * vértice visível, gera a aresta para os 3 vizinhos de `EDGE_DIRECTIONS` —
 * cobre a malha inteira sem repetir aresta (ver comentário de
 * `EDGE_DIRECTIONS`). O vizinho pode cair 1 vértice fora da faixa que
 * `computeVisibleHexCenters` devolveria sozinha; não tem problema, ele só
 * fecha a borda da malha — mesma margem de 1 célula que `computeVisibleHexCenters`
 * já aplica internamente para as pontas do viewport.
 */
export function computeVisibleTriEdges(size: number, viewport: Viewport): TriEdge[] {
  if (size <= 0) return []
  const hexSize = triSizeToHexSize(size)
  const vertices = computeVisibleHexCenters(hexSize, viewport)
  const edges: TriEdge[] = []
  for (const vertex of vertices) {
    const a = pixelToAxial(vertex, hexSize)
    for (const dir of EDGE_DIRECTIONS) {
      const b: AxialCoord = { q: a.q + dir.q, r: a.r + dir.r }
      edges.push({ a: vertex, b: axialToPixel(b, hexSize) })
    }
  }
  return edges
}

import type { Container, Graphics } from 'pixi.js'
import type { Wall } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { HATCH_TILE_REFERENCE_GRID, wallColorFor, wallWidthFor } from './dungeonStyle'

/**
 * Espessura nomeada da parede (Fase 6, pedido do usuário: "se eu quero
 * poligono finos ou medios ou gordos") — EIXO SEPARADO de `wall.wallKind`.
 * `wallKind` (interior/exterior) é classificação SEMÂNTICA; `thickness` é
 * preferência de ESTILO por cima disso. Qualquer uma das 6 combinações é
 * representável. `undefined` === 'medium'.
 */
export type WallThickness = 'thin' | 'medium' | 'thick'

/**
 * Ponta/canto reto ou arredondado (Fase 6: "quero a opcao de colocar reta ou
 * redondo"). Numa parede solta vira o `cap`; num canto fechado (Sala) vira o
 * `join`. 'round' → cap/join 'round'. 'straight' → cap 'butt' + join 'miter'.
 * `undefined` === 'round'.
 */
export type WallLineStyle = 'round' | 'straight'

export type WallWithStyle = Wall & { thickness?: WallThickness; lineStyle?: WallLineStyle }

/**
 * Grade padrão para quem chama sem `grid` (testes antigos): a mesma de
 * `HATCH_TILE_REFERENCE_GRID`, em que a parede externa média dá 16 px.
 */
export const DEFAULT_WALL_GRID = HATCH_TILE_REFERENCE_GRID

interface WallVisualStyle {
  width: number
  color: number
  cap: 'round' | 'butt'
  join: 'round' | 'miter'
}

function capJoinFor(lineStyle: WallLineStyle): Pick<WallVisualStyle, 'cap' | 'join'> {
  return lineStyle === 'straight' ? { cap: 'butt', join: 'miter' } : { cap: 'round', join: 'round' }
}

/**
 * Resolve os eixos (`wallKind`/`thickness`/`lineStyle`) num estilo concreto.
 * Passo 3 (BAR "Dyson Logos"): a largura é fração da célula (`wallWidthFor`,
 * dungeonStyle.ts) — 0,25 célula externa, 0,125 interna — e a cor é tinta
 * escura. A seleção NÃO entra aqui: é contorno à parte e a parede
 * selecionada mantém cor e espessura reais.
 */
function resolveWallStyle(wall: WallWithStyle, grid: number): WallVisualStyle {
  return { width: wallWidthFor(wall, grid), color: wallColorFor(wall), ...capJoinFor(wall.lineStyle ?? 'round') }
}

function sameStyle(a: WallVisualStyle, b: WallVisualStyle): boolean {
  return a.width === b.width && a.color === b.color && a.cap === b.cap && a.join === b.join
}

type RegionEdgeWall = WallWithStyle & { regionId: string; regionEdgeIndex: number }

function hasRegionEdge(wall: WallWithStyle): wall is RegionEdgeWall {
  return wall.regionId !== undefined && wall.regionEdgeIndex !== undefined
}

/**
 * Agrupa paredes em cadeias contíguas — sequências que viram UM path com UM
 * `stroke()`. Paredes da MESMA Região, ordenadas por `regionEdgeIndex`, formam
 * um path contínuo e o canto fecha pelo *line join* (correção de B1,
 * docs/DOSSIE-FEEDBACK-F4.md). A cadeia quebra quando:
 *  1. `regionEdgeIndex` não é consecutivo (aresta apagada no meio);
 *  2. `breaksBetween(anterior, próxima)` diz que sim (estilo diferente, porta…).
 * Parede sem `regionId`+`regionEdgeIndex` é cadeia de 1.
 * Exportada para a hachura (drawHatch.ts) usar a mesma geometria de canto.
 */
export function groupWallChains<T extends WallWithStyle>(walls: T[], breaksBetween: (previous: T, next: T) => boolean): T[][] {
  const byRegion = new Map<string, (T & RegionEdgeWall)[]>()
  const chains: T[][] = []

  for (const wall of walls) {
    if (hasRegionEdge(wall)) {
      const list = byRegion.get(wall.regionId) ?? []
      list.push(wall)
      byRegion.set(wall.regionId, list)
    } else {
      chains.push([wall])
    }
  }

  for (const group of byRegion.values()) {
    const sorted = [...group].sort((a, b) => a.regionEdgeIndex - b.regionEdgeIndex)
    let current: T[] = []
    let previous: (T & RegionEdgeWall) | null = null
    for (const wall of sorted) {
      const contiguous = previous !== null && wall.regionEdgeIndex === previous.regionEdgeIndex + 1
      if (previous !== null && contiguous && !breaksBetween(previous, wall)) {
        current.push(wall)
      } else {
        if (current.length > 0) chains.push(current)
        current = [wall]
      }
      previous = wall
    }
    if (current.length > 0) chains.push(current)
  }

  return chains
}

const CLOSE_EPSILON = 1e-6

/** A cadeia fecha (loop, `closePath()`) quando a última parede termina onde a
 *  primeira começa — checagem GEOMÉTRICA. `length >= 3` descarta "polígono" de 2 lados. */
export function isClosedChain(chain: readonly Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>[]): boolean {
  if (chain.length < 3) return false
  const first = chain[0]
  const last = chain[chain.length - 1]
  return Math.abs(last.x2 - first.x1) < CLOSE_EPSILON && Math.abs(last.y2 - first.y1) < CLOSE_EPSILON
}

/** Traça a cadeia como UM path (`moveTo` + `lineTo`s, `closePath` se fechar); quem chama faz o stroke. */
export function traceWallChain(graphics: Graphics, chain: readonly Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>[]): void {
  const [first, ...rest] = chain
  graphics.moveTo(first.x1, first.y1).lineTo(first.x2, first.y2)
  for (const wall of rest) {
    graphics.lineTo(wall.x2, wall.y2)
  }
  if (isClosedChain(chain)) {
    graphics.closePath()
  }
}

/**
 * Runs da LINHA da parede: parede com porta NÃO é desenhada como linha (o vão
 * é da porta, drawDoors.ts) e por isso quebra a cadeia; estilo diferente
 * também quebra (Pixi aceita um width/color/cap/join por stroke).
 */
function groupWallsForPath(walls: WallWithStyle[], grid: number): { walls: WallWithStyle[]; style: WallVisualStyle }[] {
  const solid = walls.filter((wall) => wall.door === null)
  const chains = groupWallChains(solid, (previous, next) => !sameStyle(resolveWallStyle(previous, grid), resolveWallStyle(next, grid)))
  return chains.map((chain) => ({ walls: chain, style: resolveWallStyle(chain[0], grid) }))
}

/**
 * Desenha a LINHA das paredes sem porta — largura em fração de célula
 * (`grid`), cor de tinta e ponta por `lineStyle`.
 *
 * `cameraScale`: `camera.scale` atual (default 1). `screenSafeWidth` impõe o
 * piso de 1 px de tela; o PixiCanvas redesenha quando a escala muda.
 *
 * Seleção é contorno POR BAIXO, `SELECTION_OUTLINE_SCREEN_PX` mais largo de
 * cada lado da parede grossa — cor e espessura reais continuam por cima:
 *  - `selectedWallId`: a parede selecionada;
 *  - `highlightedRegionId`: a Sala selecionada — o contorno segue todas as
 *    paredes dela (inclusive as de porta, para não abrir no vão). Sem isso o
 *    contorno da Região (drawRegions.ts) ficaria escondido sob a parede de
 *    0,25 célula.
 */
export function drawWalls(
  graphics: Graphics,
  walls: WallWithStyle[],
  selectedWallId: string | null = null,
  cameraScale = 1,
  grid: number = DEFAULT_WALL_GRID,
  highlightedRegionId: string | null = null,
): void {
  graphics.clear()
  if (highlightedRegionId !== null) drawRegionWallsOutline(graphics, walls, highlightedRegionId, cameraScale, grid)
  const selected = selectedWallId === null ? undefined : walls.find((wall) => wall.id === selectedWallId)
  if (selected) drawWallSelectionOutline(graphics, selected, cameraScale, grid)
  for (const { walls: run, style } of groupWallsForPath(walls, grid)) {
    traceWallChain(graphics, run)
    graphics.stroke({ width: screenSafeWidth(style.width, cameraScale), color: style.color, cap: style.cap, join: style.join })
  }
}

/** Traço mais largo em `SELECTION_COLOR` sob a parede. Ponta reta (`butt`)
 *  vira `square` no contorno: sem isso as duas pontas ficariam sem moldura. */
function drawWallSelectionOutline(graphics: Graphics, wall: WallWithStyle, cameraScale: number, grid: number): void {
  const style = resolveWallStyle(wall, grid)
  const width = screenSafeWidth(style.width, cameraScale) + 2 * selectionOutlineWidth(cameraScale)
  graphics.moveTo(wall.x1, wall.y1).lineTo(wall.x2, wall.y2)
  graphics.stroke({ width, color: SELECTION_COLOR, cap: style.cap === 'butt' ? 'square' : 'round', join: style.join })
}

function drawRegionWallsOutline(graphics: Graphics, walls: WallWithStyle[], regionId: string, cameraScale: number, grid: number): void {
  const own = walls.filter((wall) => wall.regionId === regionId)
  if (own.length === 0) return
  const outline = 2 * selectionOutlineWidth(cameraScale)
  for (const chain of groupWallChains(own, () => false)) {
    const width = Math.max(...chain.map((wall) => screenSafeWidth(wallWidthFor(wall, grid), cameraScale)))
    traceWallChain(graphics, chain)
    graphics.stroke({ width: width + outline, color: SELECTION_COLOR, cap: 'square', join: 'miter' })
  }
}

/**
 * Espessura, em px de TELA, do contorno de seleção de parede, região e
 * desenho (auditoria 14/09: o destaque amarelo pintava por cima da cor real).
 * Fica POR FORA do objeto, sem preencher.
 */
export const SELECTION_OUTLINE_SCREEN_PX = 2

/** `SELECTION_OUTLINE_SCREEN_PX` convertido para px de mundo na escala atual. */
export function selectionOutlineWidth(cameraScale: number): number {
  return SELECTION_OUTLINE_SCREEN_PX / cameraScale
}

/**
 * Escala da câmera para quem desenha: a explícita, se válida; senão a escala
 * de mundo do próprio nó (filho de `world`, cujo `scale` é `camera.scale`),
 * que o Pixi atualiza a cada render. Fora da cena (testes) dá 1.
 */
export function resolveCameraScale(node: Container, explicit: number | undefined): number {
  if (explicit !== undefined && Number.isFinite(explicit) && explicit > 0) return explicit
  const t = node.worldTransform
  const scale = Math.hypot(t.a, t.b)
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/**
 * Largura mínima de um traço em px de TELA: abaixo de 1 px a linha cai entre
 * os centros de pixel e some.
 */
export const MIN_SCREEN_STROKE_PX = 1

/**
 * Largura de mundo que garante pelo menos `MIN_SCREEN_STROKE_PX` na tela.
 * Acima do piso a espessura acompanha o zoom; só abaixo dele o traço é
 * engordado o mínimo para continuar visível.
 */
export function screenSafeWidth(worldWidth: number, cameraScale: number): number {
  return Math.max(worldWidth, MIN_SCREEN_STROKE_PX / cameraScale)
}

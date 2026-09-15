import type { Container, Graphics } from 'pixi.js'
import type { Wall } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { alignToPixel, pixelGrid, strokeWidthInWorld, type PixelGrid } from './pixelAlign'

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
 * Visual "minimapa do Resident Evil" (15/09/2026, pedido do usuário): parede é
 * uma linha FINA e CLARA sobre fundo escuro, com a mesma espessura na tela em
 * qualquer zoom — é planta de consulta, não desenho à mão. Por isso a largura
 * vive em px de TELA (não em fração de célula) e o PixiCanvas redesenha a cada
 * mudança de escala.
 */
export const WALL_SCREEN_PX: Record<WallThickness, number> = { thin: 1, medium: 2, thick: 3 }

/** Mesma cor para externa e interna; a interna se distingue só pela opacidade. */
export const WALL_COLOR = 0xd8d2c4
export const WALL_EXTERIOR_ALPHA = 1
export const WALL_INTERIOR_ALPHA = 0.6

/** Espessura da parede em px de TELA (antes do arredondamento ao pixel físico). */
export function wallScreenWidth(wall: Pick<WallWithStyle, 'thickness'>): number {
  return WALL_SCREEN_PX[wall.thickness ?? 'medium']
}

export function wallAlphaFor(wall: Pick<Wall, 'wallKind'>): number {
  return wall.wallKind === 'interior' ? WALL_INTERIOR_ALPHA : WALL_EXTERIOR_ALPHA
}

interface WallVisualStyle {
  /** Grade de pixel físico da espessura: dá a largura de mundo e o alinhamento do centro. */
  pixel: PixelGrid
  width: number
  alpha: number
  cap: 'round' | 'butt'
  join: 'round' | 'miter'
}

function capJoinFor(lineStyle: WallLineStyle): Pick<WallVisualStyle, 'cap' | 'join'> {
  return lineStyle === 'straight' ? { cap: 'butt', join: 'miter' } : { cap: 'round', join: 'round' }
}

/**
 * Resolve os eixos (`wallKind`/`thickness`/`lineStyle`) num estilo concreto.
 * A largura sai em px físicos inteiros (`pixelAlign.ts`): sem isso a linha de
 * 1-2 px cai entre dois pixels e vira borrão cinza. A seleção NÃO entra aqui:
 * é contorno à parte e a parede selecionada mantém cor e espessura reais.
 */
function resolveWallStyle(wall: WallWithStyle, cameraScale: number, rendererResolution: number): WallVisualStyle {
  const pixel = pixelGrid(cameraScale, rendererResolution, wallScreenWidth(wall))
  return { pixel, width: strokeWidthInWorld(pixel), alpha: wallAlphaFor(wall), ...capJoinFor(wall.lineStyle ?? 'round') }
}

function sameStyle(a: WallVisualStyle, b: WallVisualStyle): boolean {
  return a.width === b.width && a.alpha === b.alpha && a.cap === b.cap && a.join === b.join
}

/**
 * Cadeia com as pontas no meio do pixel físico. Paredes da planta são quase
 * sempre horizontais ou verticais: alinhar x e y de cada vértice deixa essas
 * linhas com colunas inteiras de pixel; numa diagonal o deslocamento é < 1 px.
 */
function alignChain<T extends WallWithStyle>(chain: readonly T[], pixel: PixelGrid): T[] {
  return chain.map((wall) => ({
    ...wall,
    x1: alignToPixel(wall.x1, pixel),
    y1: alignToPixel(wall.y1, pixel),
    x2: alignToPixel(wall.x2, pixel),
    y2: alignToPixel(wall.y2, pixel),
  }))
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
function groupWallsForPath(walls: WallWithStyle[], cameraScale: number, rendererResolution: number): { walls: WallWithStyle[]; style: WallVisualStyle }[] {
  const solid = walls.filter((wall) => wall.door === null)
  const styleOf = (wall: WallWithStyle) => resolveWallStyle(wall, cameraScale, rendererResolution)
  const chains = groupWallChains(solid, (previous, next) => !sameStyle(styleOf(previous), styleOf(next)))
  return chains.map((chain) => ({ walls: chain, style: styleOf(chain[0]) }))
}

/**
 * Desenha a LINHA das paredes sem porta — largura em px de TELA
 * (`WALL_SCREEN_PX`), cor clara e ponta por `lineStyle`.
 *
 * `cameraScale`: `camera.scale` atual (default 1) e `rendererResolution`:
 * resolução do renderer (default 1). A largura de mundo é recalculada a partir
 * dos dois, então quem chama redesenha quando qualquer um muda.
 *
 * Seleção é contorno POR BAIXO, `SELECTION_OUTLINE_SCREEN_PX` mais largo de
 * cada lado da parede — cor e espessura reais continuam por cima:
 *  - `selectedWallId`: a parede selecionada;
 *  - `highlightedRegionId`: a Sala selecionada — o contorno segue todas as
 *    paredes dela (inclusive as de porta, para não abrir no vão).
 */
export function drawWalls(
  graphics: Graphics,
  walls: WallWithStyle[],
  selectedWallId: string | null = null,
  cameraScale = 1,
  rendererResolution = 1,
  highlightedRegionId: string | null = null,
): void {
  graphics.clear()
  if (highlightedRegionId !== null) drawRegionWallsOutline(graphics, walls, highlightedRegionId, cameraScale, rendererResolution)
  // Parede com porta: a moldura de seleção vem de drawDoors, em volta do retângulo
  // (60% do vão). Contornar o vão inteiro aqui deixaria pontas amarelas soltas.
  const selected = selectedWallId === null ? undefined : walls.find((wall) => wall.id === selectedWallId && wall.door === null)
  if (selected) drawWallSelectionOutline(graphics, selected, cameraScale, rendererResolution)
  for (const { walls: run, style } of groupWallsForPath(walls, cameraScale, rendererResolution)) {
    traceWallChain(graphics, alignChain(run, style.pixel))
    graphics.stroke({ width: style.width, color: WALL_COLOR, alpha: style.alpha, cap: style.cap, join: style.join })
  }
}

/** Traço mais largo em `SELECTION_COLOR` sob a parede. Ponta reta (`butt`)
 *  vira `square` no contorno: sem isso as duas pontas ficariam sem moldura. */
function drawWallSelectionOutline(graphics: Graphics, wall: WallWithStyle, cameraScale: number, rendererResolution: number): void {
  const style = resolveWallStyle(wall, cameraScale, rendererResolution)
  const width = style.width + 2 * selectionOutlineWidth(cameraScale)
  const [aligned] = alignChain([wall], style.pixel)
  graphics.moveTo(aligned.x1, aligned.y1).lineTo(aligned.x2, aligned.y2)
  graphics.stroke({ width, color: SELECTION_COLOR, cap: style.cap === 'butt' ? 'square' : 'round', join: style.join })
}

function drawRegionWallsOutline(graphics: Graphics, walls: WallWithStyle[], regionId: string, cameraScale: number, rendererResolution: number): void {
  const own = walls.filter((wall) => wall.regionId === regionId)
  if (own.length === 0) return
  const outline = 2 * selectionOutlineWidth(cameraScale)
  for (const chain of groupWallChains(own, () => false)) {
    // A parede mais grossa da cadeia define a moldura (e o alinhamento, para o contorno ficar centrado nela).
    const widest = chain.reduce((best, wall) => (wallScreenWidth(wall) > wallScreenWidth(best) ? wall : best))
    const style = resolveWallStyle(widest, cameraScale, rendererResolution)
    traceWallChain(graphics, alignChain(chain, style.pixel))
    graphics.stroke({ width: style.width + outline, color: SELECTION_COLOR, cap: 'square', join: 'miter' })
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

import type { Container, Graphics } from 'pixi.js'
import type { Wall, WallThickness, WallThicknessPreset } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { alignToPixel, pixelGrid, strokeWidthInWorld, type PixelGrid } from './pixelAlign'

/**
 * Espessura da parede (Fase 6, pedido do usuário: "se eu quero poligono finos
 * ou medios ou gordos"; 17/09/2026: "isso era para ser uma muralha de castelo
 * mas nao consigo engrossar a linha o quanto eu quiser") — EIXO SEPARADO de
 * `wall.wallKind`. `wallKind` (interior/exterior) é classificação SEMÂNTICA;
 * `thickness` é preferência de ESTILO por cima disso. `undefined` === 'medium'.
 *
 * O tipo mora em `types/map.ts` (é campo do schema, persistido em map.json);
 * aqui só é reexportado para quem já importava daqui (`WallStyleControls`).
 */
export type { WallThickness, WallThicknessPreset }

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
 * dos DEGRAUS vive em px de TELA (não em fração de célula) e o PixiCanvas
 * redesenha a cada mudança de escala.
 *
 * A muralha de castelo (valor contínuo, px de mundo) é o outro caso e continua
 * dentro do mesmo visual: a COR não muda (`WALL_COLOR` claro sobre fundo
 * escuro, nunca preenchimento preto, nunca hachura) — muda só a largura da
 * mesma faixa clara. O que era fio de planta vira massa clara de planta.
 */
export const WALL_SCREEN_PX: Record<WallThicknessPreset, number> = { thin: 1, medium: 2, thick: 3 }

/** `undefined` === este degrau: mapa antigo abre idêntico ao de antes. */
export const DEFAULT_WALL_THICKNESS: WallThicknessPreset = 'medium'

/**
 * Faixa do valor CONTÍNUO, em px de MUNDO (o que o controle de grossura
 * oferece). O topo é uma célula inteira da grade padrão (64 px): acima disso a
 * parede engoliria o cômodo que ela delimita, e "mais grosso que a sala" não é
 * muralha, é mancha. O piso é 1 px de mundo — mais fino que isso o traço já
 * está no limite de 1 px físico em qualquer zoom (`hairlinePhysicalWidth`).
 */
export const WALL_WIDTH_WORLD_MIN = 1
export const WALL_WIDTH_WORLD_MAX = 64

/** Mesma cor para externa e interna; a interna se distingue só pela opacidade. */
export const WALL_COLOR = 0xd8d2c4
export const WALL_EXTERIOR_ALPHA = 1
export const WALL_INTERIOR_ALPHA = 0.6

export function clampWallWidth(width: number): number {
  return Math.min(WALL_WIDTH_WORLD_MAX, Math.max(WALL_WIDTH_WORLD_MIN, width))
}

/**
 * Largura em px de MUNDO quando a parede usa o controle contínuo — `null`
 * quando ela está num dos degraus nomeados. Número não-finito (mapa salvo
 * corrompido, `"thickness": null` virando NaN) devolve `null` de propósito: cai
 * no degrau default em vez de pintar `NaN` de largura e sumir com a parede.
 */
function continuousWorldWidth(thickness: WallThickness | undefined): number | null {
  return typeof thickness === 'number' && Number.isFinite(thickness) ? clampWallWidth(thickness) : null
}

/**
 * Degrau nomeado de fato existente. A checagem no objeto não é cerimônia: o
 * mapa salvo entra por `JSON.parse(json) as Partial<MapData>`
 * (`lib/mapFile.ts:73`), então o compilador ACREDITA que a string é um dos 3
 * degraus sem nunca ter conferido. Com `"thickness": "muralha"` num map.json
 * editado à mão, `WALL_SCREEN_PX[...]` devolveria `undefined`, o stroke sairia
 * com `width: NaN` e a parede sumiria do desenho — sem erro nenhum na tela.
 */
function presetOf(thickness: WallThickness | undefined): WallThicknessPreset {
  return typeof thickness === 'string' && thickness in WALL_SCREEN_PX ? thickness : DEFAULT_WALL_THICKNESS
}

/** Escala de câmera utilizável; `pixelGrid` faz a mesma guarda para o resto. */
function usableScale(cameraScale: number): number {
  return Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
}

/**
 * Largura em px de MUNDO que o controle de grossura mostra e edita. Degrau
 * nomeado vira o equivalente dele a 100% de zoom (fina 1, média 2, grossa 3),
 * para arrastar o controle a partir de onde a parede já está — e não de um
 * salto invisível.
 */
export function wallWorldWidth(thickness: WallThickness | undefined): number {
  return continuousWorldWidth(thickness) ?? WALL_SCREEN_PX[presetOf(thickness)]
}

/**
 * Espessura da parede em px de TELA (antes do arredondamento ao pixel físico).
 * Degrau nomeado: constante na tela em qualquer zoom (fio de planta). Valor
 * contínuo: px de mundo × escala, então a muralha engrossa junto com o mapa,
 * como qualquer coisa que tem largura construída.
 */
export function wallScreenWidth(wall: Pick<WallWithStyle, 'thickness'>, cameraScale = 1): number {
  const world = continuousWorldWidth(wall.thickness)
  return world === null ? WALL_SCREEN_PX[presetOf(wall.thickness)] : world * usableScale(cameraScale)
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
  const pixel = pixelGrid(cameraScale, rendererResolution, wallScreenWidth(wall, cameraScale))
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
    const regionChains: T[][] = []
    let current: T[] = []
    let previous: (T & RegionEdgeWall) | null = null
    for (const wall of sorted) {
      // Pedaços da mesma aresta (porta no meio) também encadeiam, mas só se
      // encostam: sem isso o lineTo cruzaria o vão da porta.
      const nextEdge = previous !== null && (wall.regionEdgeIndex === previous.regionEdgeIndex + 1 || wall.regionEdgeIndex === previous.regionEdgeIndex)
      const contiguous = previous !== null && nextEdge && touches(previous, wall)
      if (previous !== null && contiguous && !breaksBetween(previous, wall)) {
        current.push(wall)
      } else {
        if (current.length > 0) regionChains.push(current)
        current = [wall]
      }
      previous = wall
    }
    if (current.length > 0) regionChains.push(current)
    // Porta na aresta 0 parte o contorno: a última cadeia termina onde a
    // primeira começa e vira uma só, para o canto fechar pelo line join.
    if (regionChains.length >= 2) {
      const first = regionChains[0]
      const last = regionChains[regionChains.length - 1]
      if (touches(last[last.length - 1], first[0]) && !breaksBetween(last[last.length - 1], first[0])) {
        regionChains.splice(regionChains.length - 1, 1)
        regionChains[0] = [...last, ...first]
      }
    }
    chains.push(...regionChains)
  }

  return chains
}

const CLOSE_EPSILON = 1e-6

function touches(previous: Pick<Wall, 'x2' | 'y2'>, next: Pick<Wall, 'x1' | 'y1'>): boolean {
  return Math.abs(previous.x2 - next.x1) < CLOSE_EPSILON && Math.abs(previous.y2 - next.y1) < CLOSE_EPSILON
}

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
    // A parede mais grossa da cadeia define a moldura (e o alinhamento, para o
    // contorno ficar centrado nela). A comparação é na ESCALA ATUAL: numa
    // cadeia que mistura degrau (px de tela) com muralha (px de mundo), quem é
    // a mais grossa depende do zoom.
    const widest = chain.reduce((best, wall) => (wallScreenWidth(wall, cameraScale) > wallScreenWidth(best, cameraScale) ? wall : best))
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

import type { Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { rotatePointAround, rotationTrig } from '../lib/roomRotation'
import { ehMovelRedondo, normalizarCorDoMovel, pontosDaElipse, tracosDoGlifo } from '../lib/mobilia'
import { parseHexColor } from '../lib/tokenColor'
import { WALL_COLOR } from './drawWalls'
import { alignToPixel, pixelGrid, strokeWidthInWorld, type PixelGrid } from './pixelAlign'

/**
 * OBJETOS COMO SILHUETA — o móvel do mestre na tela do JOGADOR.
 *
 * O jogador não tem a imagem do objeto (é um arquivo no disco do mestre, e o
 * recorte `lib/fogFilter.ts` apaga o caminho), então o cômodo chegava vazio:
 * a cama, o baú e a mesa simplesmente não existiam para ele. Agora cada objeto
 * que ele enxerga vira um retângulo CHAPADO no lugar dele, com o tamanho e a
 * rotação que o mestre deu. Minimapa do Resident Evil: chão chapado, móvel
 * chapado, parede linha fina — nada de imagem, sombra, hachura ou gradiente.
 *
 * Arquivo separado de `drawProps.ts` de propósito: aquele é o renderizador do
 * EDITOR (sprite, Tauri, aviso de imagem quebrada), e a página do jogador roda
 * num navegador comum, sem nada disso.
 *
 * O desenho tem duas metades, uma para cada tipo de chão:
 * - o PREENCHIMENTO é preto translúcido: escurece o chão que está embaixo, e o
 *   móvel sai sempre um tom abaixo do PRÓPRIO chão (marrom sobre marrom, verde
 *   sobre verde) sem o mestre escolher cor nenhuma. É ele que aparece num chão
 *   claro. Mais claro que a névoa do "já visto" (45% de preto no padrão do
 *   jogador), para não ler como pedaço fora da visão;
 * - o CONTORNO é o fio claro da parede, mais fraco que a parede interna e com
 *   1 px de tela (a parede padrão tem 2). É ele que aparece num chão escuro e
 *   que separa o móvel da névoa (a névoa não tem contorno). Subordinado à
 *   parede de propósito: estante encostada nela nunca pode ler como parede grossa.
 *
 * No chão padrão (#a8776a) o móvel sai #6d4d45 com o fio em volta — contraste
 * de ~2:1 com o chão e ~2,8:1 do fio contra o móvel. Discreto de propósito:
 * parede e porta continuam sendo o que o olho lê primeiro.
 *
 * O MÓVEL (objeto com `mobilia`) pode mudar as duas metades pelo painel: sem
 * "Preencher" o fundo some e fica só o fio com o glifo; "Cor" pinta o fundo
 * chapado e opaco nessa cor; "Cor da linha" pinta contorno e glifo, na mesma
 * espessura. Cor que não seja `#rrggbb`/`#rgb` vale como ausente (o arquivo e a
 * rede já filtram, mas o desenho não confia: `Color` do Pixi lança com string
 * torta e derrubaria o quadro). Objeto comum ignora esses campos.
 */
export const PROP_SILHOUETTE_FILL_COLOR = 0x000000
export const PROP_SILHOUETTE_FILL_ALPHA = 0.35
export const PROP_SILHOUETTE_EDGE_COLOR = WALL_COLOR
export const PROP_SILHOUETTE_EDGE_ALPHA = 0.5
/** Espessura do contorno em px de TELA, a mesma em qualquer zoom (como a parede). */
export const PROP_SILHOUETTE_EDGE_SCREEN_PX = 1
/** Cor escolhida pelo mestre sai chapada: opaca, sem a transparência do padrão. */
const PROP_OWN_COLOR_ALPHA = 1

/** O que a silhueta usa do objeto: a geometria, o tipo e a aparência do móvel, nunca a imagem. */
export type PropSilhouette = Pick<
  Prop,
  'x' | 'y' | 'width' | 'height' | 'rotation' | 'mobilia' | 'mobiliaPreenchido' | 'mobiliaCor' | 'mobiliaCorDaLinha'
>

/** Cor e opacidade de uma metade do desenho, no formato que `fill`/`stroke` recebem. */
interface SilhouettePaint {
  color: number
  alpha: number
}

/** `fill: null` = "Preencher" desligado: só o contorno e o glifo. */
interface SilhouetteStyle {
  fill: SilhouettePaint | null
  edge: SilhouettePaint
}

const DEFAULT_FILL: SilhouettePaint = { color: PROP_SILHOUETTE_FILL_COLOR, alpha: PROP_SILHOUETTE_FILL_ALPHA }
const DEFAULT_EDGE: SilhouettePaint = { color: PROP_SILHOUETTE_EDGE_COLOR, alpha: PROP_SILHOUETTE_EDGE_ALPHA }

/** A cor própria do móvel, ou `null` se ausente ou torta (vale o padrão). */
function ownPaint(value: unknown): SilhouettePaint | null {
  const color = parseHexColor(normalizarCorDoMovel(value))
  return color === null ? null : { color, alpha: PROP_OWN_COLOR_ALPHA }
}

/** Aparência de um objeto: a de sempre, ou a que o mestre deu ao móvel. */
function silhouetteStyle(prop: PropSilhouette): SilhouetteStyle {
  if (prop.mobilia === undefined) return { fill: DEFAULT_FILL, edge: DEFAULT_EDGE }
  return {
    fill: prop.mobiliaPreenchido === false ? null : (ownPaint(prop.mobiliaCor) ?? DEFAULT_FILL),
    edge: ownPaint(prop.mobiliaCorDaLinha) ?? DEFAULT_EDGE,
  }
}

/** Posição e tamanho finitos, tamanho positivo: o resto não tem o que pintar. */
function hasDrawableGeometry(prop: PropSilhouette): boolean {
  return (
    Number.isFinite(prop.x) &&
    Number.isFinite(prop.y) &&
    Number.isFinite(prop.width) &&
    Number.isFinite(prop.height) &&
    prop.width > 0 &&
    prop.height > 0
  )
}

/**
 * Cantos do retângulo girado em volta do centro, positivo = horário na tela: o
 * mesmo giro do sprite do editor (âncora no meio). `rotationTrig` é exato nos
 * quartos de volta — com `Math.cos(π/2)` (6e-17, não 0) os cantos da cama
 * girada 90° caíam em pixels vizinhos e o móvel entortava.
 *
 * Retângulo alinhado aos eixos encosta cada borda no pixel físico: sem isso o
 * contorno de 1 px cai entre dois pixels e vira 2 px cinza (`pixelAlign.ts`).
 * Girado em outro ângulo, a borda é diagonal e não há pixel a encostar.
 */
function silhouetteCorners(prop: PropSilhouette, grid: PixelGrid): number[] {
  const trig = rotationTrig(prop.rotation ?? 0)
  const center = { x: prop.x, y: prop.y }
  const hw = prop.width / 2
  const hh = prop.height / 2
  const axisAligned = trig.sin === 0 || trig.cos === 0
  const corners: number[] = []
  for (const [dx, dy] of [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ]) {
    const p = rotatePointAround({ x: prop.x + dx, y: prop.y + dy }, center, trig)
    corners.push(axisAligned ? alignToPixel(p.x, grid) : p.x, axisAligned ? alignToPixel(p.y, grid) : p.y)
  }
  return corners
}

/**
 * Móvel redondo (barril): a elipse inscrita no retângulo, girada com o objeto.
 * Curva não tem borda reta a encostar no pixel, então fica sem `alignToPixel`.
 */
function roundSilhouettePoints(prop: PropSilhouette): number[] {
  const trig = rotationTrig(prop.rotation ?? 0)
  const center = { x: prop.x, y: prop.y }
  const points: number[] = []
  for (const offset of pontosDaElipse(prop.width, prop.height)) {
    const p = rotatePointAround({ x: prop.x + offset.x, y: prop.y + offset.y }, center, trig)
    points.push(p.x, p.y)
  }
  return points
}

/**
 * MOBÍLIA DESENHADA: os traços do glifo do móvel (`lib/mobilia.ts`), girados
 * com o objeto, num traço só no mesmo fio fino do contorno (e na mesma cor,
 * `edge`) — o glifo nunca pesa mais que a borda do próprio móvel. Objeto comum
 * não tem glifo.
 */
function strokeFurnitureGlyph(graphics: Graphics, prop: PropSilhouette, edgeWidth: number, edge: SilhouettePaint): void {
  if (prop.mobilia === undefined) return
  const segments = tracosDoGlifo(prop.mobilia, prop.width, prop.height)
  if (segments.length === 0) return
  const trig = rotationTrig(prop.rotation ?? 0)
  const center = { x: prop.x, y: prop.y }
  for (const segment of segments) {
    const start = rotatePointAround({ x: prop.x + segment.x1, y: prop.y + segment.y1 }, center, trig)
    const end = rotatePointAround({ x: prop.x + segment.x2, y: prop.y + segment.y2 }, center, trig)
    graphics.moveTo(start.x, start.y).lineTo(end.x, end.y)
  }
  graphics.stroke({ width: edgeWidth, color: edge.color, alpha: edge.alpha, cap: 'butt' })
}

/**
 * Pinta a silhueta de cada objeto em `graphics` (limpa antes) e devolve quantas
 * pintou. Móvel da mobília desenhada ganha o glifo por cima. Objeto sem geometria desenhável (tamanho zero, número não finito de
 * um arquivo estragado) fica de fora em vez de virar borrão ou derrubar o quadro.
 */
export function drawPropSilhouettes(
  graphics: Graphics,
  props: readonly PropSilhouette[],
  cameraScale = 1,
  rendererResolution = 1,
): number {
  graphics.clear()
  const grid = pixelGrid(cameraScale, rendererResolution, PROP_SILHOUETTE_EDGE_SCREEN_PX)
  const edgeWidth = strokeWidthInWorld(grid)
  let drawn = 0
  for (const prop of props) {
    if (!hasDrawableGeometry(prop)) continue
    const style = silhouetteStyle(prop)
    const outline = ehMovelRedondo(prop.mobilia) ? roundSilhouettePoints(prop) : silhouetteCorners(prop, grid)
    graphics.poly(outline, true)
    if (style.fill !== null) graphics.fill(style.fill)
    graphics.stroke({ width: edgeWidth, color: style.edge.color, alpha: style.edge.alpha, join: 'miter' })
    strokeFurnitureGlyph(graphics, prop, edgeWidth, style.edge)
    drawn += 1
  }
  return drawn
}

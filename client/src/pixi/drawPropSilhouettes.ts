import type { Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { rotatePointAround, rotationTrig } from '../lib/roomRotation'
import {
  contornoDeLado,
  ehMovelRedondo,
  normalizarCorDoMovel,
  pontosDaElipse,
  tracosDoGlifo,
  vistaDoMovel,
} from '../lib/mobilia'
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
 *
 * Cadeira e baú com "Vista" de lado (`mobiliaVista: 'lado'`) trocam o
 * retângulo pelo PERFIL do móvel (`contornoDeLado`: a cadeira em L, o baú com a
 * tampa em arco) e o glifo pelo de lado, com o mesmo giro, as mesmas cores e o
 * mesmo fio. Nos outros tipos a vista não vale (`vistaDoMovel`).
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
  'x' | 'y' | 'width' | 'height' | 'rotation' | 'mobilia' | 'mobiliaPreenchido' | 'mobiliaCor' | 'mobiliaCorDaLinha' | 'mobiliaVista'
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

/** Menos pontos que isto não fecha área: o polígono vira risco ou ponto. */
const MIN_POLYGON_POINTS = 3

type Point = { x: number; y: number }

/** Cantos do retângulo do objeto, centrado na origem, no sentido horário a partir do canto de cima à esquerda. */
function rectangleOffsets(width: number, height: number): Point[] {
  const hw = width / 2
  const hh = height / 2
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ]
}

/**
 * Tira o ponto igual ao anterior e, no fim, o último enquanto for igual ao
 * primeiro (o polígono é fechado): o traço do Pixi (`buildLine`) divide pelo
 * tamanho de cada segmento, e segmento de tamanho zero vira NaN no quadro. De
 * longe o arco do baú de lado cai várias vezes no mesmo pixel.
 */
function withoutRepeatedNeighbours(points: readonly Point[]): Point[] {
  const kept: Point[] = []
  for (const p of points) {
    const last = kept.length === 0 ? null : kept[kept.length - 1]
    if (last === null || last.x !== p.x || last.y !== p.y) kept.push(p)
  }
  while (kept.length > 1 && kept[0].x === kept[kept.length - 1].x && kept[0].y === kept[kept.length - 1].y) kept.pop()
  return kept
}

function flatten(points: readonly Point[]): number[] {
  return points.flatMap((p) => [p.x, p.y])
}

/**
 * Polígono da silhueta girado em volta do centro, positivo = horário na tela:
 * o mesmo giro do sprite do editor (âncora no meio). `rotationTrig` é exato nos
 * quartos de volta — com `Math.cos(π/2)` (6e-17, não 0) os cantos da cama
 * girada 90° caíam em pixels vizinhos e o móvel entortava. O polígono é o
 * retângulo do objeto ou, no móvel de lado, o perfil (`contornoDeLado`).
 *
 * Alinhado aos eixos, cada vértice encosta no pixel físico: sem isso o contorno
 * de 1 px cai entre dois pixels e vira 2 px cinza (`pixelAlign.ts`). Girado em
 * outro ângulo, a borda é diagonal e não há pixel a encostar. O perfil de lado,
 * depois de encostar, perde os vértices que caíram no mesmo pixel; se de tão
 * pequeno sobrar menos que um triângulo, sai sem encostar (o retângulo segue
 * como sempre foi).
 */
function silhouettePolygon(prop: PropSilhouette, grid: PixelGrid): number[] {
  const trig = rotationTrig(prop.rotation ?? 0)
  const center = { x: prop.x, y: prop.y }
  const sideOutline = vistaDoMovel(prop) === 'lado' ? contornoDeLado(prop.mobilia, prop.width, prop.height) : null
  const rotated = (sideOutline ?? rectangleOffsets(prop.width, prop.height)).map((offset) =>
    rotatePointAround({ x: prop.x + offset.x, y: prop.y + offset.y }, center, trig),
  )
  const axisAligned = trig.sin === 0 || trig.cos === 0
  if (!axisAligned) return flatten(rotated)
  const aligned = rotated.map((p) => ({ x: alignToPixel(p.x, grid), y: alignToPixel(p.y, grid) }))
  if (sideOutline === null) return flatten(aligned)
  const distinct = withoutRepeatedNeighbours(aligned)
  return flatten(distinct.length >= MIN_POLYGON_POINTS ? distinct : rotated)
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
 * MOBÍLIA DESENHADA: os traços do glifo do móvel (`lib/mobilia.ts`, o de
 * frente ou o de lado conforme a vista), girados
 * com o objeto, num traço só no mesmo fio fino do contorno (e na mesma cor,
 * `edge`) — o glifo nunca pesa mais que a borda do próprio móvel. Objeto comum
 * não tem glifo.
 */
function strokeFurnitureGlyph(graphics: Graphics, prop: PropSilhouette, edgeWidth: number, edge: SilhouettePaint): void {
  if (prop.mobilia === undefined) return
  const segments = tracosDoGlifo(prop.mobilia, prop.width, prop.height, vistaDoMovel(prop))
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
    const outline = ehMovelRedondo(prop.mobilia) ? roundSilhouettePoints(prop) : silhouettePolygon(prop, grid)
    graphics.poly(outline, true)
    if (style.fill !== null) graphics.fill(style.fill)
    graphics.stroke({ width: edgeWidth, color: style.edge.color, alpha: style.edge.alpha, join: 'miter' })
    strokeFurnitureGlyph(graphics, prop, edgeWidth, style.edge)
    drawn += 1
  }
  return drawn
}

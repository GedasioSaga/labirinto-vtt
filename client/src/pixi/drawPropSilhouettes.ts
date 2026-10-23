import type { Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { rotatePointAround, rotationTrig } from '../lib/roomRotation'
import {
  contornoDeLado,
  contornoDoTapete,
  desenhoDoTapete,
  ehMovelRedondo,
  ehMovelVazado,
  emOrdemDeDesenho,
  formaDoTapete,
  normalizarCorDeTecido,
  normalizarCorDoMovel,
  pontosDaElipse,
  regioesDaCama,
  tracosDoGlifo,
  vistaDoMovel,
  voltaDaCerca,
  type RegiaoDoMovel,
} from '../lib/mobilia'
import { parseHexColor } from '../lib/tokenColor'
import { meioTermoLigado } from '../lib/estiloDoMapa'
import { WALL_COLOR } from './drawWalls'
import { alignToPixel, pixelGrid, strokeWidthInWorld, type PixelGrid } from './pixelAlign'
// Só o tipo: o Meio-Termo dos móveis (motor, materiais, tabelas de ruído) carrega sob demanda, com a chave ligada.
import type { RasterDosMoveis } from './rasterDosMoveis'

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
 * Os móveis com "Vista" de lado (`mobiliaVista: 'lado'`) trocam o
 * retângulo pelo PERFIL do móvel (`contornoDeLado`: a cadeira em L, o baú com a
 * tampa em arco, o aparador com o tampo sobrando) e o glifo pelo de lado, com o mesmo giro, as mesmas cores e o
 * mesmo fio. Nos outros tipos a vista não vale (`vistaDoMovel`).
 *
 * O TAPETE vai primeiro (`emOrdemDeDesenho`): fica no chão, por baixo de todo
 * objeto. Sem "Cor" o fundo dele escurece o chão menos que o dos outros
 * móveis (`RUG_FILL_ALPHA`), para o móvel posto em cima ainda sair um tom
 * abaixo; borda e medalhão (`desenhoDoTapete`) são uma camada a mais de preto
 * ou, com "Cor", a mesma cor mais escura. Essas áreas entram entre o fundo e o
 * fio, para o fio nunca ficar por baixo de uma cor.
 *
 * A CAMA pinta o travesseiro e o cobertor com a cor própria de cada um
 * (`regioesDaCama`), no mesmo lugar entre o fundo e o fio; a "Cor" fica na
 * madeira. Sem essas cores não há área nenhuma: a cama sai como sempre.
 */
export const PROP_SILHOUETTE_FILL_COLOR = 0x000000
export const PROP_SILHOUETTE_FILL_ALPHA = 0.35
export const PROP_SILHOUETTE_EDGE_COLOR = WALL_COLOR
export const PROP_SILHOUETTE_EDGE_ALPHA = 0.5
/** Espessura do contorno em px de TELA, a mesma em qualquer zoom (como a parede). */
export const PROP_SILHOUETTE_EDGE_SCREEN_PX = 1
/** Cor escolhida pelo mestre sai chapada: opaca, sem a transparência do padrão. */
const PROP_OWN_COLOR_ALPHA = 1
/** Fundo do tapete sem "Cor": mais claro que o dos outros móveis (0,35), o móvel em cima dele sai um tom abaixo. */
export const RUG_FILL_ALPHA = 0.2
/** Borda e medalhão do tapete sem "Cor": mais uma camada de preto por cima do fundo (0,2 + 0,22 dá ~0,38 do chão). */
export const RUG_DARK_ALPHA = 0.22
/** Borda e medalhão do tapete com "Cor": cada canal da cor x 0,70 (o mesmo matiz, mais perto do preto). */
const RUG_DARK_KEEP = 0.7

/** O que a silhueta usa do objeto: a geometria, o tipo e a aparência do móvel, nunca a imagem. */
export type PropSilhouette = Pick<
  Prop,
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'rotation'
  | 'mobilia'
  | 'mobiliaPreenchido'
  | 'mobiliaCor'
  | 'mobiliaCorDaLinha'
  | 'mobiliaVista'
  | 'mobiliaCurva'
  | 'mobiliaForma'
  | 'mobiliaCorDoTravesseiro'
  | 'mobiliaCorDoCobertor'
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
  /** Borda e medalhão do tapete: a "Cor" mais escura, ou mais uma camada de preto sem ela. */
  dark: SilhouettePaint
  /** Travesseiro e cobertor da cama com cor própria; `null` = pinta com a cama (sem área). */
  pillow: SilhouettePaint | null
  blanket: SilhouettePaint | null
}

const DEFAULT_FILL: SilhouettePaint = { color: PROP_SILHOUETTE_FILL_COLOR, alpha: PROP_SILHOUETTE_FILL_ALPHA }
const DEFAULT_EDGE: SilhouettePaint = { color: PROP_SILHOUETTE_EDGE_COLOR, alpha: PROP_SILHOUETTE_EDGE_ALPHA }
const RUG_DEFAULT_FILL: SilhouettePaint = { color: PROP_SILHOUETTE_FILL_COLOR, alpha: RUG_FILL_ALPHA }
const RUG_DEFAULT_DARK: SilhouettePaint = { color: PROP_SILHOUETTE_FILL_COLOR, alpha: RUG_DARK_ALPHA }

/** A cor própria do móvel, ou `null` se ausente ou torta (vale o padrão). */
function ownPaint(value: unknown): SilhouettePaint | null {
  const color = parseHexColor(normalizarCorDoMovel(value))
  return color === null ? null : { color, alpha: PROP_OWN_COLOR_ALPHA }
}

/** A cor com cada canal x `RUG_DARK_KEEP`: o tom escuro da borda e do medalhão do tapete. */
function darker(color: number): number {
  const channel = (shift: number): number => Math.round(((color >> shift) & 0xff) * RUG_DARK_KEEP)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/** Aparência de um objeto: a de sempre, ou a que o mestre deu ao móvel. */
function silhouetteStyle(prop: PropSilhouette): SilhouetteStyle {
  if (prop.mobilia === undefined) return { fill: DEFAULT_FILL, edge: DEFAULT_EDGE, dark: RUG_DEFAULT_DARK, pillow: null, blanket: null }
  const own = ownPaint(prop.mobiliaCor)
  const defaultFill = prop.mobilia === 'tapete' ? RUG_DEFAULT_FILL : DEFAULT_FILL
  return {
    fill: prop.mobiliaPreenchido === false ? null : (own ?? defaultFill),
    edge: ownPaint(prop.mobiliaCorDaLinha) ?? DEFAULT_EDGE,
    dark: own === null ? RUG_DEFAULT_DARK : { color: darker(own.color), alpha: PROP_OWN_COLOR_ALPHA },
    pillow: ownPaint(normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoTravesseiro)),
    blanket: ownPaint(normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoCobertor)),
  }
}

/** A tinta de cada área de cor própria; `null` = a área não tem cor própria e fica de fora. */
function areaPaint(tom: RegiaoDoMovel['tom'], style: SilhouetteStyle): SilhouettePaint | null {
  switch (tom) {
    case 'escuro':
      return style.dark
    case 'travesseiro':
      return style.pillow
    case 'cobertor':
      return style.blanket
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
 * outro ângulo, a borda é diagonal e não há pixel a encostar. O perfil de lado
 * (e o tapete, que tem contorno próprio), depois de encostar, perde os
 * vértices que caíram no mesmo pixel; se de tão pequeno sobrar menos que um
 * triângulo, sai sem encostar (o retângulo segue como sempre foi).
 */
function silhouettePolygon(prop: PropSilhouette, grid: PixelGrid): number[] {
  const own = ownOutline(prop)
  const rotated = placedPoints(prop, own ?? rectangleOffsets(prop.width, prop.height), null)
  if (!isAxisAligned(prop)) return flatten(rotated)
  const aligned = rotated.map((p) => ({ x: alignToPixel(p.x, grid), y: alignToPixel(p.y, grid) }))
  if (own === null) return flatten(aligned)
  const distinct = withoutRepeatedNeighbours(aligned)
  return flatten(distinct.length >= MIN_POLYGON_POINTS ? distinct : rotated)
}

/** Giro em quarto de volta exato: as bordas retas correm nos eixos da tela. */
function isAxisAligned(prop: PropSilhouette): boolean {
  const trig = rotationTrig(prop.rotation ?? 0)
  return trig.sin === 0 || trig.cos === 0
}

/**
 * Pontos do referencial do objeto (centro na origem, sem giro) girados com ele.
 * Com `grid` e alinhado aos eixos, cada vértice encosta no pixel físico; sem
 * `grid` (curva) ou girado em outro ângulo, devolve os pontos girados.
 */
function placedPoints(prop: PropSilhouette, offsets: readonly Point[], grid: PixelGrid | null): Point[] {
  const trig = rotationTrig(prop.rotation ?? 0)
  const center = { x: prop.x, y: prop.y }
  const rotated = offsets.map((offset) => rotatePointAround({ x: prop.x + offset.x, y: prop.y + offset.y }, center, trig))
  if (grid === null || !isAxisAligned(prop)) return rotated
  return rotated.map((p) => ({ x: alignToPixel(p.x, grid), y: alignToPixel(p.y, grid) }))
}

/** O contorno do móvel quando não é o retângulo do objeto: o perfil de lado ou o tapete. `null` = o retângulo. */
function ownOutline(prop: PropSilhouette): Point[] | null {
  const vista = vistaDoMovel(prop)
  if (vista === 'lado') return contornoDeLado(prop.mobilia, prop.width, prop.height, formaDoTapete(prop))
  if (prop.mobilia === 'tapete') return contornoDoTapete(formaDoTapete(prop), prop.width, prop.height, vista)
  return null
}

/** Silhueta curva (a elipse inscrita): o barril, a fogueira de cima e o tapete redondo de cima. */
function hasRoundSilhouette(prop: PropSilhouette): boolean {
  const vista = vistaDoMovel(prop)
  return ehMovelRedondo(prop.mobilia, vista) || (prop.mobilia === 'tapete' && vista === 'frente' && formaDoTapete(prop) === 'redondo')
}

/** As áreas de cor própria do móvel, no referencial dele: a borda e o medalhão do tapete, os tecidos da cama. */
function furnitureAreas(prop: PropSilhouette, style: SilhouetteStyle): RegiaoDoMovel[] {
  if (prop.mobilia === 'tapete') return desenhoDoTapete(formaDoTapete(prop), prop.width, prop.height, vistaDoMovel(prop)).regioes
  if (prop.mobilia === 'catre') return regioesDaCama(prop.width, prop.height, style.pillow !== null, style.blanket !== null)
  return []
}

/**
 * Pinta as áreas de cor própria por cima do fundo, cada uma alinhada ao pixel
 * como a silhueta (`grid: null` na silhueta curva). Devolve se pintou alguma:
 * aí o contorno precisa ser posto de novo para o fio.
 */
function fillFurnitureAreas(graphics: Graphics, prop: PropSilhouette, style: SilhouetteStyle, grid: PixelGrid | null): boolean {
  let painted = false
  for (const area of furnitureAreas(prop, style)) {
    const paint = areaPaint(area.tom, style)
    if (paint === null) continue
    graphics.poly(flatten(placedPoints(prop, area.pontos, grid)), true).fill(paint)
    painted = true
  }
  return painted
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
 * não tem glifo. A cerca curva (`mobiliaCurva`) sai pelo arco: mourões e fio
 * repartidos nele, iguais no editor e na tela do jogador.
 */
function strokeFurnitureGlyph(graphics: Graphics, prop: PropSilhouette, edgeWidth: number, edge: SilhouettePaint): void {
  if (prop.mobilia === undefined) return
  const segments = tracosDoGlifo(prop.mobilia, prop.width, prop.height, vistaDoMovel(prop), voltaDaCerca(prop), formaDoTapete(prop))
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

/** A silhueta de linhas de um objeto (o desenho de sempre): fundo, áreas de cor própria, contorno e glifo. */
function drawSilhouette(graphics: Graphics, prop: PropSilhouette, grid: PixelGrid, edgeWidth: number): void {
  const style = silhouetteStyle(prop)
  if (ehMovelVazado(prop.mobilia)) {
    // Cerca: sem caixa atrás, só mourões e fio; "Preencher" e "Cor" não têm onde pintar.
    strokeFurnitureGlyph(graphics, prop, edgeWidth, style.edge)
    return
  }
  // A fogueira é redonda só de cima: de lado vale o perfil das pedras.
  const round = hasRoundSilhouette(prop)
  const outline = round ? roundSilhouettePoints(prop) : silhouettePolygon(prop, grid)
  graphics.poly(outline, true)
  if (style.fill !== null) {
    graphics.fill(style.fill)
    // Áreas de cor própria entre o fundo e o fio; depois delas o contorno volta para o fio.
    if (fillFurnitureAreas(graphics, prop, style, round ? null : grid)) graphics.poly(outline, true)
  }
  graphics.stroke({ width: edgeWidth, color: style.edge.color, alpha: style.edge.alpha, join: 'miter' })
  strokeFurnitureGlyph(graphics, prop, edgeWidth, style.edge)
}

/** A imagem sai com a cor dela: sem tinta por cima e opaca (o alfa do último `fill` não vaza para a imagem). */
const IMAGE_TINT = 0xffffff
const IMAGE_ALPHA = 1

type ModuloDoRaster = typeof import('./rasterDosMoveis')

let moduloDoRaster: ModuloDoRaster | null = null
let carregandoORaster: Promise<ModuloDoRaster> | null = null
/** Quem se pintou antes do módulo chegar: repinta quando ele chega. */
const esperandoORaster = new Map<Graphics, () => void>()
/** Os `Graphics` que já avisam o raster quando são destruídos. */
const donosVigiados = new WeakSet<Graphics>()

/**
 * Carrega o Meio-Termo dos móveis (o raster, o motor, os materiais e as
 * tabelas de ruído) uma vez só. Com a chave desligada nada disso entra no
 * início do editor nem do jogador.
 */
export function carregarMoveisDoMeioTermo(): Promise<ModuloDoRaster> {
  carregandoORaster ??= import('./rasterDosMoveis').then((modulo) => {
    moduloDoRaster = modulo
    const repinturas = [...esperandoORaster.values()]
    esperandoORaster.clear()
    for (const repintar of repinturas) repintar()
    return modulo
  })
  return carregandoORaster
}

/**
 * O raster da sessão, se o módulo já chegou; senão pede o módulo, guarda a
 * repintura deste `Graphics` para quando ele chegar e devolve `null` (a
 * passada sai no desenho de linhas).
 */
function rasterParaPassada(graphics: Graphics, repintar: () => void): RasterDosMoveis | null {
  if (moduloDoRaster === null) {
    esperandoORaster.set(graphics, repintar)
    void carregarMoveisDoMeioTermo()
    return null
  }
  const modulo = moduloDoRaster
  if (!donosVigiados.has(graphics)) {
    donosVigiados.add(graphics)
    graphics.once('destroyed', () => modulo.rasterDosMoveis().soltarDono(graphics))
  }
  return modulo.rasterDosMoveis()
}

/**
 * MEIO-TERMO (chave de obra `meioTermoLigado()`): o móvel com textura, a
 * imagem pronta de `rasterDosMoveis.ts` colada com `graphics.texture` e girada
 * com o objeto por `setTransform` (a luz gira junto, sem gerar de novo).
 * Enquanto a imagem não fica pronta, cola a pronta de outro nível do mesmo
 * desenho ou, sem nenhuma, o desenho de linhas de sempre (provisório). Pronta
 * a imagem, o raster chama este `Graphics` para se repintar: o provisório SAI
 * (nos cantos chanfrados e no vazio do L da cadeira a imagem é transparente).
 * Devolve `false` se o tipo ainda não tem desenho com textura (fica o de linhas).
 */
function drawTexturedFurniture(
  graphics: Graphics,
  prop: PropSilhouette,
  raster: RasterDosMoveis,
  modulo: ModuloDoRaster,
  cameraScale: number,
  rendererResolution: number,
  grid: PixelGrid,
  edgeWidth: number,
): boolean {
  const imagem = raster.imagemParaDesenhar(prop, cameraScale, rendererResolution)
  if (imagem === null) return false
  const mostrar = imagem.mostrar
  if (mostrar === null) {
    drawSilhouette(graphics, prop, grid, edgeWidth)
    return true
  }
  raster.marcarColada(mostrar)
  const r = modulo.retanguloNoMundo(mostrar, prop.width, prop.height)
  const trig = rotationTrig(prop.rotation ?? 0)
  graphics
    .save()
    .setFillStyle({ color: IMAGE_TINT, alpha: IMAGE_ALPHA })
    .setTransform(trig.cos, trig.sin, -trig.sin, trig.cos, prop.x, prop.y)
    .texture(mostrar.textura, IMAGE_TINT, r.x, r.y, r.w, r.h)
    .restore()
  return true
}

/**
 * Pinta a silhueta de cada objeto em `graphics` (limpa antes) e devolve quantas
 * pintou. Móvel da mobília desenhada ganha o glifo por cima. Objeto sem geometria desenhável (tamanho zero, número não finito de
 * um arquivo estragado) fica de fora em vez de virar borrão ou derrubar o quadro.
 * Com o Meio-Termo ligado, os móveis que já têm textura saem como imagem
 * (`drawTexturedFurniture`) e este `Graphics` se repinta sozinho, com os
 * mesmos argumentos, quando uma imagem que ele pediu fica pronta (quem chamou
 * não precisa saber); desligado, nenhum caminho novo roda.
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
  const repintar = (): void => {
    if (!graphics.destroyed) drawPropSilhouettes(graphics, props, cameraScale, rendererResolution)
  }
  const raster = meioTermoLigado() ? rasterParaPassada(graphics, repintar) : null
  const modulo = moduloDoRaster
  raster?.abrirPassada(graphics, repintar)
  try {
    let drawn = 0
    // O tapete fica no chão: pintado antes, por baixo de todo objeto.
    for (const prop of emOrdemDeDesenho(props)) {
      if (!hasDrawableGeometry(prop)) continue
      if (raster === null || modulo === null || !drawTexturedFurniture(graphics, prop, raster, modulo, cameraScale, rendererResolution, grid, edgeWidth)) {
        drawSilhouette(graphics, prop, grid, edgeWidth)
      }
      drawn += 1
    }
    return drawn
  } finally {
    raster?.fecharPassada()
  }
}

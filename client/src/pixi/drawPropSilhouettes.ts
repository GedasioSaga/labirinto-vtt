import type { Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { rotatePointAround, rotationTrig } from '../lib/roomRotation'
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
 */
export const PROP_SILHOUETTE_FILL_COLOR = 0x000000
export const PROP_SILHOUETTE_FILL_ALPHA = 0.35
export const PROP_SILHOUETTE_EDGE_COLOR = WALL_COLOR
export const PROP_SILHOUETTE_EDGE_ALPHA = 0.5
/** Espessura do contorno em px de TELA, a mesma em qualquer zoom (como a parede). */
export const PROP_SILHOUETTE_EDGE_SCREEN_PX = 1

/** O que a silhueta usa do objeto: a geometria, nunca a imagem. */
export type PropSilhouette = Pick<Prop, 'x' | 'y' | 'width' | 'height' | 'rotation'>

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
 * Pinta a silhueta de cada objeto em `graphics` (limpa antes) e devolve quantas
 * pintou. Objeto sem geometria desenhável (tamanho zero, número não finito de
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
    graphics
      .poly(silhouetteCorners(prop, grid), true)
      .fill({ color: PROP_SILHOUETTE_FILL_COLOR, alpha: PROP_SILHOUETTE_FILL_ALPHA })
      .stroke({ width: edgeWidth, color: PROP_SILHOUETTE_EDGE_COLOR, alpha: PROP_SILHOUETTE_EDGE_ALPHA, join: 'miter' })
    drawn += 1
  }
  return drawn
}

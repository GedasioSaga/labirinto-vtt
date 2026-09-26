import type { Graphics } from 'pixi.js'
import type { Wall } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { selectionOutlineWidth } from './drawWalls'
import { alignToPixel, pixelGrid, strokeWidthInWorld } from './pixelAlign'

/**
 * Cor de porta destrancada — o mesmo laranja de sempre, para mapa salvo não
 * trocar de cor ao abrir. Trancada é vermelha.
 */
export const DOOR_COLOR = 0xd08c3a
export const DOOR_LOCKED_COLOR = 0xc0392b

/**
 * Visual "minimapa do Resident Evil" (15/09/2026): a porta é um retângulo
 * pequeno e chapado no vão, alinhado à parede. O comprimento acompanha o vão
 * (fração dele, em mundo); a espessura fica fixa na TELA, como a parede, para a
 * porta continuar legível de longe e não virar um bloco de perto.
 */
export const DOOR_LENGTH_RATIO = 0.6
export const DOOR_THICKNESS_SCREEN_PX = 5
/** Porta aberta: só o contorno do retângulo, nesta espessura de tela. */
export const DOOR_OPEN_OUTLINE_SCREEN_PX = 1.5

/**
 * PORTAS POR ATRAVESSAR (só na tela do jogador): ponto claro no meio da porta
 * cujo outro lado ainda está na névoa para ele. Raio em px de TELA, menor que
 * a meia espessura da porta, para caber dentro do retângulo em qualquer zoom:
 * marca discreta de minimapa, sem ícone nem halo.
 */
export const DOOR_TO_CROSS_COLOR = 0xf4ead8
export const DOOR_TO_CROSS_DOT_SCREEN_PX = 1.5

/**
 * Renderer da camada 'portas' — ver `lib/layers.ts:wallLayer`. Recebe a MESMA
 * lista de walls já filtrada por `visibleWalls` que `drawWalls.ts` recebe; o
 * loop ignora toda `wall.door === null`. A linha da parede com porta não é
 * desenhada (o vão é da porta), então o retângulo fica sozinho no vão.
 *
 * `door.kind` (normal, dupla, portão) continua no dado e no painel, mas todos
 * aparecem como o mesmo retângulo: no minimapa o que importa é o estado.
 *  - fechada: preenchido laranja;
 *  - trancada: preenchido vermelho (aberta + trancada também fica vermelha
 *    preenchida: o cadeado vale mais que a folha);
 *  - aberta: só contorno laranja.
 *
 * Porta de sala secreta não chega aqui para o jogador (fogFilter.ts corta a
 * parede) e o editor desenha igual às outras, como antes. PORTA SECRETA
 * (`door.secret`) também não chega ao jogador como porta (vira parede em
 * fogFilter.ts); no editor sai tracejada (`traceSecretDashes`).
 *
 * `toCross` (PORTAS POR ATRAVESSAR, só o jogador passa): ids das portas que
 * levam o ponto claro no meio. O editor não passa e desenha como sempre.
 */
export function drawDoors(
  graphics: Graphics,
  walls: Wall[],
  selectedWallId: string | null = null,
  cameraScale = 1,
  rendererResolution = 1,
  toCross: ReadonlySet<string> = NO_DOORS_TO_CROSS,
): void {
  graphics.clear()
  const dotRadius = DOOR_TO_CROSS_DOT_SCREEN_PX / (Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1)
  const thicknessPixel = pixelGrid(cameraScale, rendererResolution, DOOR_THICKNESS_SCREEN_PX)
  const thickness = strokeWidthInWorld(thicknessPixel)
  const outlineWidth = strokeWidthInWorld(pixelGrid(cameraScale, rendererResolution, DOOR_OPEN_OUTLINE_SCREEN_PX))
  const selectionWidth = selectionOutlineWidth(cameraScale)

  for (const wall of walls) {
    const door = wall.door
    if (!door) continue

    const dx = wall.x2 - wall.x1
    const dy = wall.y2 - wall.y1
    const length = Math.hypot(dx, dy)
    if (length === 0) continue

    // Centro no meio do pixel físico (mesma receita da parede): o retângulo de
    // uma porta horizontal/vertical fica com borda nítida em vez de meio pixel borrado.
    const cx = alignToPixel((wall.x1 + wall.x2) / 2, thicknessPixel)
    const cy = alignToPixel((wall.y1 + wall.y2) / 2, thicknessPixel)
    const ux = dx / length
    const uy = dy / length
    const halfLength = (length * DOOR_LENGTH_RATIO) / 2
    const filled = door.locked || !door.open
    const color = door.locked ? DOOR_LOCKED_COLOR : DOOR_COLOR

    // Seleção NÃO troca a cor: moldura em SELECTION_COLOR POR FORA do
    // retângulo (`SELECTION_OUTLINE_SCREEN_PX` de tela), mesma regra da parede.
    if (wall.id === selectedWallId) {
      traceDoorRect(graphics, cx, cy, ux, uy, halfLength + selectionWidth / 2, thickness / 2 + selectionWidth / 2)
      graphics.stroke({ width: selectionWidth, color: SELECTION_COLOR, join: 'miter' })
    }

    if (door.secret === true) {
      traceSecretDashes(graphics, cx, cy, ux, uy, halfLength, thickness / 2, color)
    } else if (filled) {
      traceDoorRect(graphics, cx, cy, ux, uy, halfLength, thickness / 2)
      graphics.fill({ color })
    } else {
      // Contorno por DENTRO do retângulo: a porta aberta ocupa a mesma caixa da fechada.
      traceDoorRect(graphics, cx, cy, ux, uy, halfLength - outlineWidth / 2, thickness / 2 - outlineWidth / 2)
      graphics.stroke({ width: outlineWidth, color, join: 'miter' })
    }

    if (door.opensFrom !== undefined) {
      const arrowLength = strokeWidthInWorld(pixelGrid(cameraScale, rendererResolution, ONE_SIDE_ARROW_SCREEN_PX))
      const gap = strokeWidthInWorld(pixelGrid(cameraScale, rendererResolution, ONE_SIDE_ARROW_GAP_SCREEN_PX))
      // Normal (-uy, ux) aponta para o lado 'right' (`lib/doorReach.ts:sideOfWall`).
      const sign = door.opensFrom === 'right' ? 1 : -1
      traceOneSideArrow(graphics, cx, cy, ux, uy, sign, thickness / 2 + gap, arrowLength, Math.min(halfLength, arrowLength * 0.7))
      graphics.fill({ color })
    }

    if (door.secret !== true && toCross.has(wall.id)) graphics.circle(cx, cy, dotRadius).fill({ color: DOOR_TO_CROSS_COLOR })
  }
}

const NO_DOORS_TO_CROSS: ReadonlySet<string> = new Set()

/**
 * PORTA DE UM LADO (`door.opensFrom`), só no editor — o jogador nunca recebe o
 * campo (`lib/fogFilter.ts`): um triângulo chapado no lado que abre, com a
 * ponta virada para a porta, na cor dela. Tamanho fixo na tela, como a espessura.
 */
export const ONE_SIDE_ARROW_SCREEN_PX = 8
export const ONE_SIDE_ARROW_GAP_SCREEN_PX = 3

function traceOneSideArrow(graphics: Graphics, cx: number, cy: number, ux: number, uy: number, sign: number, tipDistance: number, arrowLength: number, halfBase: number): void {
  const nx = -uy * sign
  const ny = ux * sign
  const tipX = cx + nx * tipDistance
  const tipY = cy + ny * tipDistance
  const baseX = cx + nx * (tipDistance + arrowLength)
  const baseY = cy + ny * (tipDistance + arrowLength)
  graphics.poly([tipX, tipY, baseX + ux * halfBase, baseY + uy * halfBase, baseX - ux * halfBase, baseY - uy * halfBase], true)
}

/**
 * PORTA SECRETA no editor: o mesmo retângulo, partido em `SECRET_DOOR_DASHES`
 * pedaços preenchidos com vão igual entre eles — "tracejada", para o mestre
 * saber que o jogador vê ali só a parede. A cor segue a regra de sempre
 * (trancada vermelha). Aberta também sai tracejada: enquanto secreta, ela é
 * parede para o jogador (`lib/collision.ts`), então "aberta" não tem cara própria.
 */
export const SECRET_DOOR_DASHES = 3

function traceSecretDashes(graphics: Graphics, cx: number, cy: number, ux: number, uy: number, halfLength: number, halfThickness: number, color: number): void {
  // n traços e n-1 vãos do mesmo tamanho cobrem o comprimento inteiro da porta.
  const piece = (2 * halfLength) / (2 * SECRET_DOOR_DASHES - 1)
  for (let i = 0; i < SECRET_DOOR_DASHES; i += 1) {
    const offset = -halfLength + piece * (2 * i) + piece / 2
    traceDoorRect(graphics, cx + ux * offset, cy + uy * offset, ux, uy, piece / 2, halfThickness)
    graphics.fill({ color })
  }
}

/** Retângulo girado com a parede, centrado em `(cx, cy)`: `u` é o sentido da parede. Só o path. */
function traceDoorRect(graphics: Graphics, cx: number, cy: number, ux: number, uy: number, halfLength: number, halfThickness: number): void {
  const px = -uy
  const py = ux
  const ax = ux * halfLength
  const ay = uy * halfLength
  const bx = px * halfThickness
  const by = py * halfThickness
  graphics.poly([cx - ax - bx, cy - ay - by, cx + ax - bx, cy + ay - by, cx + ax + bx, cy + ay + by, cx - ax + bx, cy - ay + by], true)
}

import type { Graphics } from 'pixi.js'
import { rotationToRadians } from '../lib/itemTransform'
import { OWNER_RING_COLOR, OWNER_RING_EDGE_WIDTH_PX, OWNER_RING_WIDTH_PX } from './ownerMarker'

/**
 * FRENTE DA FICHA na tela do jogador: um bico branco na borda do disco,
 * apontando para onde a ficha olha — é por ele que o jogador sabe para onde o
 * guarda está virado. A seta do minimapa do Resident Evil, presa à ficha: uma
 * forma chapada, sem sombra nem gradiente.
 *
 * Só existe frente quando o mestre deu uma (`Token.rotation` gravado, zero
 * inclusive, que é "para cima"). A ficha que ele nunca virou fica sem bico:
 * um bico para cima em toda ficha diria que todo mundo olha para o norte, e
 * isso ninguém decidiu.
 *
 * O bico é o mesmo branco do aro de dono (`ownerMarker.ts`) e do contorno da
 * ficha alheia, e nasce da borda deles: ficha e bico leem como UMA peça, uma
 * gota apontando. O fio escuro nos dois lados inclinados segura o branco num
 * chão claro, com a espessura do fio do aro. Tamanho em px de TELA, como o
 * aro: afastado, o bico continua legível; de perto, não vira um espinho.
 *
 * O fio é o QUASE-PRETO do nome da ficha, opaco, e não preto puro nem o preto
 * translúcido do aro: sobre o branco, os dois passam pelo cinza ~144, que as
 * jornadas leem como a cor de sinal #a1887f (ver `TOKEN_NAME_OUTLINE_COLOR` em
 * `pixi/constants.ts`). O bico guarda o par branco + 0x000030, medido longe
 * de toda cor de sinal: o nome da ficha trocou de par (tinta com um fio de
 * ciano e contorno preto) para a borda não ler como chão de outra cena, mas o
 * bico continua no MESMO branco do aro de dono.
 */
export const FACING_NIB_COLOR = OWNER_RING_COLOR
/** Quanto o bico passa da borda de onde nasce, em px de tela. */
export const FACING_NIB_LENGTH_PX = 6
/** Meia largura da base do bico, em px de tela. */
export const FACING_NIB_HALF_WIDTH_PX = 4.5
export const FACING_NIB_EDGE_COLOR = 0x000030
export const FACING_NIB_EDGE_ALPHA = 1
export const FACING_NIB_EDGE_WIDTH_PX = OWNER_RING_EDGE_WIDTH_PX
/** Folga entre a ponta do bico e o nome da ficha, em px de tela. */
export const FACING_LABEL_GAP_PX = 2
/** Em ficha minúscula, a base nunca passa desta fração do raio: o bico não engole o disco. */
const MAX_HALF_WIDTH_RATIO = 0.75

function validScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/**
 * Para onde a ficha olha, em radianos (0 = para cima, positivo = horário, o
 * mesmo giro do Pixi), ou `null` quando ela não tem frente. O pacote chega
 * cru da rede: rotação que não é número finito conta como ausente.
 */
export function tokenFacing(rotation: number | undefined): number | null {
  return typeof rotation === 'number' && Number.isFinite(rotation) ? rotationToRadians(rotation) : null
}

/** Círculo de onde o bico nasce, em px de mundo: a borda de fora do branco que já contorna a ficha. */
function nibBaseRadius(radius: number, scale: number, own: boolean): number {
  return own ? radius + OWNER_RING_WIDTH_PX / scale : radius
}

/** Até onde o bico chega, em px de mundo, contado do centro da ficha. */
export function facingNibReach(radius: number, scale: number, own: boolean): number {
  const s = validScale(scale)
  return nibBaseRadius(radius, s, own) + FACING_NIB_LENGTH_PX / s
}

/**
 * Onde começa o nome da ficha que tem frente, em px de mundo: depois do bico,
 * para qualquer lado que ele aponte. Constante na volta inteira de propósito:
 * o nome não pula quando o mestre vira a ficha.
 */
export function facingLabelOffset(radius: number, scale: number, own: boolean): number {
  return facingNibReach(radius, scale, own) + FACING_LABEL_GAP_PX / validScale(scale)
}

/**
 * Bico no espaço da ficha (centro em 0,0), apontando para CIMA: quem o vira é
 * `graphics.rotation`, então girar não redesenha nada. Os cantos da base ficam
 * SOBRE o círculo de onde ele nasce, e a base (uma corda desse círculo) cai
 * por dentro do branco: bico e aro emendam sem vão. O fio escuro só nos dois
 * lados inclinados — fechar o caminho riscaria a base por cima da ficha.
 */
export function drawFacingNib(g: Graphics, radius: number, scale: number, own: boolean): void {
  const s = validScale(scale)
  const base = nibBaseRadius(radius, s, own)
  const half = Math.min(FACING_NIB_HALF_WIDTH_PX / s, base * MAX_HALF_WIDTH_RATIO)
  const baseY = -Math.sqrt(base * base - half * half)
  const tipY = -(base + FACING_NIB_LENGTH_PX / s)
  g.clear()
  g.poly([-half, baseY, 0, tipY, half, baseY], true).fill({ color: FACING_NIB_COLOR, alpha: 1 })
  g.moveTo(-half, baseY)
    .lineTo(0, tipY)
    .lineTo(half, baseY)
    .stroke({ width: FACING_NIB_EDGE_WIDTH_PX / s, color: FACING_NIB_EDGE_COLOR, alpha: FACING_NIB_EDGE_ALPHA, join: 'miter' })
}

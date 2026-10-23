import type { Prop } from '../types/map'
import type { Point } from '../pixi/world'
import { aceitaCurva, CERCA_VOLTA_MAXIMA, comCurvaGravada, contornoDaCerca, cordaDaCerca, geometriaDaCerca, normalizarCurvaDaCerca, voltaDaCerca } from './mobilia'
import { clampStairCurve, CURVE_EPSILON_PX, curvaForTurnDegrees, stairArcPoint, turnDegreesForCurva, type StairArc } from './stairCurve'
import { curveTurnLabel } from './stairHandles'
import { rotatePointAround, rotationTrig } from './roomRotation'

/**
 * CERCA CURVA (pedido de 13/10/2026: "permita que dê para criar cercas curvas
 * que nem as escadas que dá para curvar"). Conta pura, sem Pixi: a alça
 * (`pixi/drawEditHandles.ts`), o clique e o cursor (`lib/handleHitArea.ts`,
 * `lib/hoverHitTest.ts`), o gesto (`pixi/cercaCurvaGesture.ts`), o clique no
 * corpo (`pixi/propInteraction.ts`), a borracha, a seleção por área e a névoa
 * leem daqui. O desenho do arco mora em `lib/mobilia.ts` (`geometriaDaCerca`).
 *
 * O idioma é o da escada curva (`lib/stairHandles.ts`): UMA alça no meio do
 * fio; puxar para o lado arqueia para ele, as duas pontas ficam; com a grade, a
 * volta encaixa de 15 em 15° (e perto do zero, endireita); até meia volta.
 *
 * A volta é guardada em GRAUS (`Prop.mobiliaCurva`), não em px de flecha:
 * esticar a cerca pelos cantos do objeto mantém a volta e a flecha cresce com
 * a corda — o mesmo que a escada faz quando muda de comprimento
 * (`withStairLength` escala a flecha para "a volta em graus não mudar").
 * Girar e mover a cerca levam o arco junto, sem conta nenhuma.
 */

/** Passo da grade na curva, em graus de volta — o da escada. */
const PASSO_DA_VOLTA_EM_GRAUS = 15
/**
 * Quanto o ponteiro pode ficar da corda, em px de TELA, e a cerca ainda
 * endireitar — mesmo SEM a grade: "Grudar Parede na grade" nasce desligado, e
 * acertar com o mouse a flecha de meio px de mundo da escada
 * (`CURVE_EPSILON_PX`) é sorte. Quem chama converte para px de mundo no zoom
 * do gesto (`pixi/cercaCurvaGesture.ts`).
 */
export const ENCAIXE_DA_RETA_PX_DE_TELA = 4

/** O que a cerca curva usa do objeto: lugar, tamanho, giro, tipo e volta. */
export type CercaNoMapa = Pick<Prop, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'mobilia' | 'mobiliaCurva'>

/** Pontos do referencial do objeto (centro na origem, sem giro) no mundo. */
function paraOMundo(prop: CercaNoMapa, locais: readonly Point[]): Point[] {
  const trig = rotationTrig(prop.rotation ?? 0)
  const centro = { x: prop.x, y: prop.y }
  return locais.map((p) => rotatePointAround({ x: prop.x + p.x, y: prop.y + p.y }, centro, trig))
}

/** Ponto do mundo no referencial do objeto: o giro desfeito em volta do centro. */
function paraOObjeto(prop: CercaNoMapa, ponto: Point): Point {
  const trig = rotationTrig(-(prop.rotation ?? 0))
  const centro = { x: prop.x, y: prop.y }
  const desgirado = rotatePointAround(ponto, centro, trig)
  return { x: desgirado.x - prop.x, y: desgirado.y - prop.y }
}

/** O arco que de fato aparece, com a volta dele: `null` fora da cerca, na reta e na volta pequena demais para se ver. */
function arcoVisivel(prop: CercaNoMapa): { volta: number; arco: StairArc } | null {
  const volta = voltaDaCerca(prop)
  if (volta === 0) return null
  const geometria = geometriaDaCerca(prop.width, prop.height, volta)
  return geometria === null || geometria.arco === null ? null : { volta, arco: geometria.arco }
}

/** A volta que de fato aparece (graus): 0 sem arco visível. */
function voltaVisivel(prop: CercaNoMapa): number {
  return arcoVisivel(prop)?.volta ?? 0
}

/**
 * A faixa da cerca CURVA no mundo (polígono fechado, girado com o objeto):
 * `null` na cerca reta e no objeto que não é cerca — esses seguem pelo
 * retângulo de sempre, sem mudar nada.
 */
export function contornoDaCercaCurva(prop: CercaNoMapa): Point[] | null {
  const volta = voltaVisivel(prop)
  if (volta === 0) return null
  return paraOMundo(prop, contornoDaCerca(prop.width, prop.height, volta))
}

/**
 * Onde a cerca curva está, para a névoa decidir se ela mora num lugar
 * escondido: as pontas, os quartos e o meio do arco (a escada curva amostra o
 * arco igual, `stairCenterlineSamples`). Vazio na reta e fora da cerca.
 */
export function amostrasDaCercaCurva(prop: CercaNoMapa): Point[] {
  const visivel = arcoVisivel(prop)
  if (visivel === null) return []
  return paraOMundo(
    prop,
    [0, 0.25, 0.5, 0.75, 1].map((t) => stairArcPoint(visivel.arco, t)),
  )
}

/**
 * A alça de curvar: o meio do fio — o centro do objeto na reta, o meio do arco
 * na curva (a uma flecha do meio da corda, na normal, como `stairMidpoint`).
 * Só a cerca de tamanho desenhável tem.
 */
export function alcaDaCurvaDaCerca(prop: CercaNoMapa): Point | null {
  // A sebe (MT5) curva como a cerca: a mesma alça no meio do arco.
  if (!aceitaCurva(prop.mobilia)) return null
  const corda = cordaDaCerca(prop.width, prop.height)
  if (corda === null) return null
  const volta = voltaVisivel(prop)
  const flecha = volta === 0 ? 0 : curvaForTurnDegrees(volta, corda.comprimento)
  const [alca] = paraOMundo(prop, [{ x: corda.normal.x * flecha, y: corda.normal.y * flecha }])
  return alca
}

export interface ArrastoDaCurvaDaCerca {
  /** A cerca como estava no COMEÇO do gesto: cada quadro parte dela, sem acumular erro. */
  prop: Prop
  pointer: Point
  /** Grade ligada para este gesto (Alt já invertido por quem chama). */
  snap: boolean
  /** Ponteiro a menos disto da corda (px de mundo) endireita a cerca. Sem valor, só a flecha invisível da escada. */
  encaixeDaReta?: number
}

/**
 * A cerca depois de puxar a alça de curvar até `pointer`. A flecha é o quanto
 * o ponteiro se afasta da corda, na normal (puxar para um lado curva para ele),
 * limitada a meia volta; a grade encaixa a volta de 15 em 15°. Ponteiro de
 * volta à corda (a menos de `encaixeDaReta`, com ou sem grade) endireita: o
 * campo sai. Ponta, tamanho e giro ficam. Mesma
 * referência quando nada muda ou quando o objeto não é cerca.
 */
export function arrastarCurvaDaCerca({ prop, pointer, snap, encaixeDaReta = CURVE_EPSILON_PX }: ArrastoDaCurvaDaCerca): Prop {
  if (!aceitaCurva(prop.mobilia)) return prop
  const corda = cordaDaCerca(prop.width, prop.height)
  if (corda === null) return prop
  const local = paraOObjeto(prop, pointer)
  const pedida = local.x * corda.normal.x + local.y * corda.normal.y
  // Largura zero na conta da escada: a cerca não tem degraus a apertar, só o limite de meia volta.
  const flecha = clampStairCurve(pedida, corda.comprimento, 0)
  // No limite, a volta é meia volta EXATA (a conta em ponto flutuante daria 179,999…).
  const noLimite = Math.abs(flecha) >= corda.comprimento / 2
  let graus = noLimite ? Math.sign(flecha) * CERCA_VOLTA_MAXIMA : turnDegreesForCurva(flecha, corda.comprimento)
  if (snap) graus = Math.round(graus / PASSO_DA_VOLTA_EM_GRAUS) * PASSO_DA_VOLTA_EM_GRAUS
  const reta = Math.abs(pedida) < encaixeDaReta || Math.abs(curvaForTurnDegrees(graus, corda.comprimento)) < CURVE_EPSILON_PX
  return comCurvaGravada(prop, reta ? undefined : normalizarCurvaDaCerca(prop.mobilia, graus))
}

/** O número junto do ponteiro durante o arrasto: "reta" ou "curva N°", a fala da escada. */
export function rotuloDaCurvaDaCerca(prop: CercaNoMapa): string {
  return curveTurnLabel(voltaVisivel(prop))
}

import type { Graphics } from 'pixi.js'
import type { PortaParaDesenho } from '../../portas/animacoesDePorta'
import { desenharBatente, desenharFolhaFechada } from '../../portas/animacoesDePorta'

/**
 * O que as cinco animações de porta do pacote dividem (o `_` no nome deixa o
 * arquivo fora do pacote: `scripts/pacote-animacoes.cjs` o embute em cada
 * módulo pelo import).
 */

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
/** Fração de `p` dentro de [a, b], presa entre 0 e 1. */
export const trecho = (p: number, a: number, b: number): number => clamp01((p - a) / (b - a))
/** Entrada e saída suaves (smoothstep): a fase começa e termina parada. */
export const suave = (x: number): number => x * x * (3 - 2 * x)
export const saidaQuad = (x: number): number => 1 - (1 - x) * (1 - x)

/** Zoom da câmera, com 1 no lugar de valor torto: tamanhos em px de TELA viram mundo por ele. */
export function escalaDa(porta: PortaParaDesenho): number {
  return Number.isFinite(porta.escala) && porta.escala > 0 ? porta.escala : 1
}

/**
 * Os extremos de toda animação, com os MESMOS ajudantes que desenham a porta
 * parada (`pixi/drawDoors.ts`): em 0 a folha fechada, e de 0 a 1 o batente por
 * baixo (em 1 só ele, a aberta). Devolve o progresso preso em [0, 1] quando
 * ainda falta desenhar a folha em movimento, ou `null` quando já acabou.
 */
export function comecarQuadro(g: Graphics, porta: PortaParaDesenho, progresso: number): number | null {
  const p = clamp01(progresso)
  if (p <= 0) {
    desenharFolhaFechada(g, porta)
    return null
  }
  desenharBatente(g, porta)
  return p >= 1 ? null : p
}

/**
 * Quantas peças cabem no vão a um passo de `passoPx` de TELA, entre `min` e
 * `max`: a grade e a cortina se leem em qualquer zoom sem virar centenas de
 * peças numa porta enorme de perto.
 */
export function quantasPecas(porta: PortaParaDesenho, passoPx: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round((2 * porta.meioComprimento * escalaDa(porta)) / passoPx)))
}

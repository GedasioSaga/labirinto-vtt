/**
 * RUÍDO SEM PERÍODO do Meio-Termo, lido pela POSIÇÃO no mundo (px), e não
 * por ladrilho: o chão não repete em lugar nenhum. Portado do protótipo
 * aprovado (`docs/design/vila-meio-termo/prototipo/meio.js:235-283`): ruído
 * de valor suave em 3 escalas (230, 80 e 27 px), que lá faz as manchas da
 * grama.
 *
 * O núcleo é só conta inteira (`hash` de `texturas/ruido.ts`, com
 * `Math.imul`) e as quatro operações de IEEE 754, sem seno nem cosseno: o
 * mesmo número em qualquer motor, então o teste pode fixar a digital. A grade
 * do hash não dá a volta (o índice inteiro vai até 2^31 casas da escala), e é
 * isso que tira o período.
 */
import { hash } from '../ruido'

export interface EscalaDoRuido {
  /** Tamanho da mancha, em px do mundo. */
  readonly lado: number
  readonly peso: number
}

/** As 3 escalas do protótipo; os pesos somam 1, então a soma fica em [-1, 1]. */
export const ESCALAS_DO_RUIDO: readonly EscalaDoRuido[] = [
  { lado: 230, peso: 0.5 },
  { lado: 80, peso: 0.32 },
  { lado: 27, peso: 0.18 },
]

/** A semente da primeira escala no protótipo (as seguintes são +1, +2). */
export const SEMENTE_DAS_MANCHAS = 811

/** Ruído de valor suave em 2 dimensões, em [-1, 1], com a grade inteira de `hash` (sem período). */
export function ruidoDeValor(x: number, y: number, semente: number): number {
  const i = Math.floor(x)
  const j = Math.floor(y)
  const fx = x - i
  const fy = y - j
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash(i, j, semente)
  const b = hash(i + 1, j, semente)
  const c = hash(i, j + 1, semente)
  const d = hash(i + 1, j + 1, semente)
  return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * 2 - 1
}

/**
 * O ruído do mundo no ponto (x, y) em px, em [-1, 1]: a soma das 3 escalas,
 * cada uma com a sua semente (`semente`, `semente + 1`, `semente + 2`). A
 * semente padrão dá as manchas da grama do protótipo; outra semente dá outro
 * campo independente (o deslocamento das texturas nas fatias seguintes).
 */
export function ruidoDoMundo(x: number, y: number, semente: number = SEMENTE_DAS_MANCHAS): number {
  let soma = 0
  for (let k = 0; k < ESCALAS_DO_RUIDO.length; k += 1) {
    const escala = ESCALAS_DO_RUIDO[k]
    soma += ruidoDeValor(x / escala.lado, y / escala.lado, semente + k) * escala.peso
  }
  return soma
}

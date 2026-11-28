import type { NoPiso } from '../types/map'

/**
 * O PISO DE UMA ENTIDADE, sem o mapa: ler e validar o campo `piso`. Mora fora
 * de `lib/pisos.ts` de propósito: aquele percorre o mapa inteiro e importa o
 * editor (`carry`, `tiposDoEditor`), que chega a Pixi, Tauri e zustand. A caixa
 * do carimbo, da água e do abismo só precisa ler o piso, e ela entra no
 * enquadramento de `pixi/world.ts`, de onde o código puro (batalha, nuvem) pega
 * o `Point`. `lib/pisos.ts` reexporta tudo daqui: quem já importava de lá não muda.
 */

/** Faixa de piso aceita do arquivo: um prédio de verdade cabe com folga, e número absurdo não. */
export const PISO_MIN = -99
export const PISO_MAX = 999

/** O piso da entidade: ausente é o térreo. */
export function pisoDe(item: NoPiso): number {
  return item.piso ?? 0
}

/** Valor que serve como piso: inteiro finito dentro da faixa. */
export function ehPiso(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= PISO_MIN && value <= PISO_MAX
}

/**
 * Leitura do arquivo: o `piso` de um item do relevo (passo de textura,
 * carimbo, risco de penhasco), só se é inteiro na faixa. Ausente, térreo ou
 * torto: nada (o item fica no térreo, como era antes do campo existir).
 */
export function pisoLido(valor: object): NoPiso {
  const piso = 'piso' in valor ? valor.piso : undefined
  return ehPiso(piso) && piso !== 0 ? { piso } : {}
}

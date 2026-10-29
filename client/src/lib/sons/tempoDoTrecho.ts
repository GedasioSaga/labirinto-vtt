/**
 * Os tempos do trecho de A até B como o mestre lê e digita: minutos,
 * segundos e décimos (`0:01,5`). O efeito curto mede menos de um segundo, por
 * isso o décimo; o `textoDoTempo` do YouTube (segundos inteiros) não serve.
 */

/** O passo das setas na faixa do trecho, e o menor trecho que toca. */
export const PASSO_DO_TRECHO_S = 0.1
/** Shift + seta: um segundo inteiro. */
export const PASSO_LARGO_DO_TRECHO_S = 1

const FORMA_DO_INSTANTE = /^(?:(\d{1,3}):)?(\d{1,6})(?:[.,](\d{1,3}))?$/

/** Arredonda ao décimo: o que a tela mostra é o que grava (0,30000000000000004 não vai ao `sons.json`). */
export function noDecimo(segundos: number): number {
  return Math.round(segundos * 10) / 10
}

/** `1.5` vira `0:01,5`; `75.25` vira `1:15,3`. */
export function textoDoInstante(segundos: number): string {
  const decimos = Math.max(0, Math.round(segundos * 10))
  const minutos = Math.floor(decimos / 600)
  const resto = decimos - minutos * 600
  const inteiros = Math.floor(resto / 10)
  return `${minutos}:${String(inteiros).padStart(2, '0')},${resto % 10}`
}

/**
 * Segundos do que o mestre digitou: `1:15,3`, `1:15.3`, `75,3` ou `75`.
 * `null` para o que não é tempo e para segundos de 60 em diante depois dos
 * minutos (`1:75`).
 */
export function segundosDoInstante(bruto: string): number | null {
  const texto = bruto.trim()
  const partes = FORMA_DO_INSTANTE.exec(texto)
  if (partes === null) return null
  const [, minutos, segundos, fracao] = partes
  const s = Number(segundos)
  if (minutos !== undefined && s >= 60) return null
  const total = (minutos === undefined ? 0 : Number(minutos) * 60) + s + (fracao === undefined ? 0 : Number(`0.${fracao}`))
  return Number.isFinite(total) ? noDecimo(total) : null
}

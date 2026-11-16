/**
 * QUAL JOGO DE ABRIR CADA MÓVEL USA: o host e os testes perguntam aqui, sem
 * carregar a arte nem o som. Só lógica pura, sem import.
 *
 * Jogo novo: entra em `JOGOS_PORTADOS`, e o tsc pede a linha dele em
 * `JOGOS_NA_TELA` (tela/jogos.ts).
 */

/** Os jogos de abrir que estão no app. */
export const JOGOS_PORTADOS = ['bau', 'caixa', 'barril'] as const

export type JogoDoObjeto = (typeof JOGOS_PORTADOS)[number]

/** Os móveis do mapa que se abrem com um jogo. */
export type MobiliaDeAbrir = 'bau' | 'caixa' | 'barril'

/** O jogo do móvel, ou null se o jogo dele não está no app. */
export function jogoDoObjetoDaMobilia(tipo: MobiliaDeAbrir): JogoDoObjeto | null {
  return JOGOS_PORTADOS.find((j) => j === tipo) ?? null
}

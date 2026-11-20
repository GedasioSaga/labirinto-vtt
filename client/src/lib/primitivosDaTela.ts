/*
 * Peças de tela sem CSS nem React, que o mestre e o jogador dividem. Moram
 * aqui, e não em `components/grimorio/comum.ts` (que as reexporta), para a
 * tela do jogador poder usá-las sem que o grafo de imports chegue ao Grimório:
 * a régua é `player/folhaSemGrimorio.test.ts`. O quadro do puzzle
 * (`puzzles/QuadroDoPuzzle.tsx`) é o primeiro que precisa disso.
 */

/** Junta as classes que valem, na ordem: `classes('gr-bt', ativo && 'gr-bt--p')`. */
export function classes(...partes: (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(' ')
}

/** Sem `matchMedia` (jsdom, WebView antiga) vale o movimento normal. */
export function movimentoReduzido(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

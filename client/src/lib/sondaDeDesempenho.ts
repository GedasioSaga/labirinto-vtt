/**
 * SONDA DE DESEMPENHO (harness `client/desempenho/`, 27/10/2026).
 *
 * O harness mede o app em BUILD DE PRODUÇÃO, onde os specs não alcançam a
 * store nem o Pixi por `import('/src/...')` (isso só existe no vite de
 * desenvolvimento). A sonda pendura no `window.__labSonda` o que a medida
 * precisa ler ou mexer: as stores do mestre e o `Application` do Pixi de cada
 * tela (para contar texturas e achar a ficha na tela).
 *
 * Ligada no desenvolvimento e no build feito com `VITE_LAB_SONDA=1`
 * (`scripts/medir-desempenho.cjs`). No build do produto a constante é `false`
 * e o empacotador apaga as chamadas: nada muda para o usuário.
 */

/** A sonda está ligada neste build? */
export const SONDA_LIGADA: boolean = import.meta.env.DEV || import.meta.env.VITE_LAB_SONDA === '1'

/** Pendura `valor` em `window.__labSonda[chave]` quando a sonda está ligada. */
export function registrarNaSonda(chave: string, valor: unknown): void {
  if (!SONDA_LIGADA || typeof window === 'undefined') return
  const alvo = window as unknown as { __labSonda?: Record<string, unknown> } // as: campo nosso pendurado no window (sem tipo no DOM)
  alvo.__labSonda ??= {}
  alvo.__labSonda[chave] = valor
}

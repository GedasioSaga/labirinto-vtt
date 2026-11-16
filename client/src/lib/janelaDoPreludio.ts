/**
 * EM QUE JANELA ESTE CÓDIGO RODA. O Prelúdio pode abrir numa segunda janela do
 * app (`desktop/src-tauri/src/janela_preludio.rs`), com a mesma base de código
 * da principal. Lá, o Rust põe a sessão em `window.__LB_PRELUDIO__`; no
 * navegador (Vite puro), a página `preludio.html` leva a sessão no endereço.
 *
 * Fica no pacote principal e não importa nada: o disco (`fsDaJanela.ts`) e a
 * exportação do quadro perguntam isto a cada chamada.
 */

/** O formato da sessão: o mesmo que o Rust aceita (`sessao_valida`). */
export const SESSAO_DA_JANELA_VALIDA = /^[A-Za-z0-9-]{8,64}$/

/** A página da janela do Prelúdio (`client/preludio.html`). */
export const PAGINA_DA_JANELA_DO_PRELUDIO = '/preludio.html'

/** A sessão desta janela do Prelúdio; `null` = esta não é a janela do Prelúdio (ou a sessão veio torta). */
export function sessaoDaJanelaDoPreludio(janela: Window | undefined = typeof window === 'undefined' ? undefined : window): string | null {
  if (janela === undefined) return null
  const doRust: unknown = Reflect.get(janela, '__LB_PRELUDIO__')
  const daPagina = janela.location.pathname.endsWith(PAGINA_DA_JANELA_DO_PRELUDIO) ? new URLSearchParams(janela.location.search).get('sessao') : null
  const valor = typeof doRust === 'string' ? doRust : daPagina
  return valor !== null && SESSAO_DA_JANELA_VALIDA.test(valor) ? valor : null
}

/** Este código roda na janela do Prelúdio? Lá o disco passa pelos comandos dela, e não pelo plugin `fs`. */
export function ehJanelaDoPreludio(janela?: Window): boolean {
  return sessaoDaJanelaDoPreludio(janela) !== null
}

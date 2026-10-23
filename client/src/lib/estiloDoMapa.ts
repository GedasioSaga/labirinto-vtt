/// <reference types="vite/client" />
/**
 * CHAVE DE OBRA do Meio-Termo (plano `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`,
 * seção 4). O estilo novo é construído em paralelo com as camadas, atrás
 * desta chave, e só liga de vez num commit único (fatia MT12), depois que a
 * fase 3 das camadas fechar: até lá o golden de pixels tem de dar igual.
 *
 * Liga por um de três caminhos:
 * - a constante `CHAVE_DE_OBRA_MEIO_TERMO` (false até o MT12);
 * - `?obra=meio-termo` na URL, SÓ no servidor de desenvolvimento (no build de
 *   produção `import.meta.env.DEV` é false e a URL nunca liga);
 * - o próprio teste, com `trocarObraNoTeste` (e `trocarObraNoTeste(false)`
 *   no `afterEach`).
 *
 * Só os renderers leem esta chave (`drawPropSilhouettes`, `drawTexturas`,
 * `relevoRaster`), nunca `PixiCanvas` nem `PlayerView`.
 */

/** Vira true no commit que liga o Meio-Termo para todo mundo (MT12). */
export const CHAVE_DE_OBRA_MEIO_TERMO: boolean = false

/** Parâmetro e valor da URL que ligam a obra no servidor de desenvolvimento. */
const PARAMETRO_DA_OBRA = 'obra'
const OBRA_MEIO_TERMO = 'meio-termo'

/** Sobe a cada mudança do desenho do Meio-Termo que precise jogar fora as imagens guardadas. */
const VERSAO_DO_MEIO_TERMO = 1

/** A URL pede a obra? Só vale no desenvolvimento e com o valor exato. */
export function obraPedidaNaUrl(desenvolvimento: boolean, search: string): boolean {
  if (!desenvolvimento) return false
  return new URLSearchParams(search).get(PARAMETRO_DA_OBRA) === OBRA_MEIO_TERMO
}

/** Lida uma vez só, na primeira pergunta: a URL não muda o estilo no meio da sessão. */
let pedidaNaUrl: boolean | undefined
let ligadaPeloTeste = false

function pedidaPelaUrl(): boolean {
  if (pedidaNaUrl === undefined) {
    // Fora do navegador (Node, worker sem `location`) não há URL para ler.
    const search = typeof location === 'undefined' ? '' : location.search
    pedidaNaUrl = obraPedidaNaUrl(import.meta.env.DEV, search)
  }
  return pedidaNaUrl
}

/** O Meio-Termo está ligado nesta sessão? */
export function meioTermoLigado(): boolean {
  return CHAVE_DE_OBRA_MEIO_TERMO || pedidaPelaUrl() || ligadaPeloTeste
}

/** Liga ou desliga a obra num teste. O `afterEach` chama `trocarObraNoTeste(false)`. */
export function trocarObraNoTeste(ligada: boolean): void {
  ligadaPeloTeste = ligada
}

/** Entra nas chaves de cache dos renderers: imagem do desenho de linhas nunca serve ao Meio-Termo, e vice-versa. */
export function versaoDoEstilo(): string {
  return meioTermoLigado() ? `meio-termo-${VERSAO_DO_MEIO_TERMO}` : 'linhas'
}

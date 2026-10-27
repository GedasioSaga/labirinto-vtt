/// <reference types="vite/client" />
/**
 * CHAVE DE OBRA do Meio-Termo (plano `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`,
 * seção 4). O estilo novo foi construído em paralelo com as camadas, atrás
 * desta chave, e ligou de vez na fatia MT12.
 *
 * Quem decide, do mais forte para o mais fraco:
 * - o próprio teste, com `trocarObraNoTeste(true | false)`: `false` FORÇA o
 *   desenho de linhas mesmo com a constante ligada (é assim que o teste do
 *   desenho antigo continua testando o desenho antigo); `trocarObraNoTeste()`
 *   (sem valor) volta ao padrão, e o `afterEach` chama assim;
 * - a URL, SÓ no servidor de desenvolvimento: `?obra=meio-termo` liga e
 *   `?obra=linhas` desliga (no build de produção `import.meta.env.DEV` é
 *   false e a URL nunca liga nem desliga nada);
 * - a constante `CHAVE_DE_OBRA_MEIO_TERMO`, o padrão do produto.
 *
 * Só os renderers e os painéis do Meio-Termo leem esta chave
 * (`drawPropSilhouettes`, `drawTexturas`, `relevoRaster`, `drawWalls`,
 * `telhadosRenderer`, `MobiliaControls`, `RoomControls`, `PropertiesPanel`),
 * nunca `PixiCanvas` nem `PlayerView`.
 */

/** O padrão do produto: o Meio-Termo para todo mundo (MT12). */
export const CHAVE_DE_OBRA_MEIO_TERMO: boolean = true

/** Parâmetro e valores da URL que ligam ou desligam a obra no servidor de desenvolvimento. */
const PARAMETRO_DA_OBRA = 'obra'
const OBRA_MEIO_TERMO = 'meio-termo'
const OBRA_LINHAS = 'linhas'

/** Sobe a cada mudança do desenho do Meio-Termo que precise jogar fora as imagens guardadas. */
const VERSAO_DO_MEIO_TERMO = 1

/**
 * O que a URL pede: `true` = Meio-Termo, `false` = desenho de linhas,
 * `undefined` = nada (vale o padrão). Só no desenvolvimento e com o valor exato.
 */
export function obraDaUrl(desenvolvimento: boolean, search: string): boolean | undefined {
  if (!desenvolvimento) return undefined
  const valor = new URLSearchParams(search).get(PARAMETRO_DA_OBRA)
  if (valor === OBRA_MEIO_TERMO) return true
  if (valor === OBRA_LINHAS) return false
  return undefined
}

/** Lida uma vez só, na primeira pergunta: a URL não muda o estilo no meio da sessão. */
let urlLida = false
let pedidaNaUrl: boolean | undefined
let forcadaPeloTeste: boolean | undefined

function pedidaPelaUrl(): boolean | undefined {
  if (!urlLida) {
    urlLida = true
    // Fora do navegador (Node, worker sem `location`) não há URL para ler.
    const search = typeof location === 'undefined' ? '' : location.search
    pedidaNaUrl = obraDaUrl(import.meta.env.DEV, search)
  }
  return pedidaNaUrl
}

/** O Meio-Termo está ligado nesta sessão? */
export function meioTermoLigado(): boolean {
  if (forcadaPeloTeste !== undefined) return forcadaPeloTeste
  return pedidaPelaUrl() ?? CHAVE_DE_OBRA_MEIO_TERMO
}

/**
 * Força a obra num teste: `true` liga, `false` desliga (vence a constante e a
 * URL), sem valor volta ao padrão. O `afterEach` chama `trocarObraNoTeste()`.
 */
export function trocarObraNoTeste(estado?: boolean): void {
  forcadaPeloTeste = estado
}

/** Entra nas chaves de cache dos renderers: imagem do desenho de linhas nunca serve ao Meio-Termo, e vice-versa. */
export function versaoDoEstilo(): string {
  return meioTermoLigado() ? `meio-termo-${VERSAO_DO_MEIO_TERMO}` : 'linhas'
}

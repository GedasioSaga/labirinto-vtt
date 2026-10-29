/// <reference types="vite/client" />
import type { MapData } from '../types/map'
import { abrirFonteDoDesenhado } from '../texturas/desenhado/fonte'

/**
 * ESTILO DO MAPA. Até 29/10/2026 o estilo era global: a CHAVE DE OBRA do
 * Meio-Termo (plano `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`,
 * seção 4), ligada de vez na fatia MT12. Com a integração do Desenhado
 * (plano de 29/10, seção 2) cada mapa escolhe o seu (`MapData.estiloVisual`):
 *
 * - **Atual** (ausente): o Meio-Termo, o desenho de hoje;
 * - **Simples**: o desenho de linhas, o mesmo que a chave de obra desligada dava;
 * - **Desenhado**: o pacote `godot/desenhado/`. Por cima do Atual: o que ainda
 *   não tem desenho Desenhado (ou cuja imagem não chegou) sai no Atual.
 *
 * Uma cena por janela: o editor (`PixiCanvas`, pela store) e a tela do jogador
 * (`PlayerView`, pelo recorte) chamam `definirEstiloDaCena` com o estilo do mapa
 * aberto, e os renderers e painéis perguntam aqui, sem receber o mapa.
 *
 * Quem decide se o Meio-Termo está ligado, do mais forte para o mais fraco:
 * - o próprio teste, com `trocarObraNoTeste(true | false)`: `false` FORÇA o
 *   desenho de linhas (é assim que o teste do desenho antigo continua testando
 *   o desenho antigo); `trocarObraNoTeste()` (sem valor) volta ao padrão, e o
 *   `afterEach` chama assim;
 * - a URL, SÓ no servidor de desenvolvimento: `?obra=meio-termo` liga e
 *   `?obra=linhas` desliga (no build de produção `import.meta.env.DEV` é
 *   false e a URL nunca liga nem desliga nada);
 * - o estilo da cena: Simples desliga; Atual e Desenhado ligam;
 * - a constante `CHAVE_DE_OBRA_MEIO_TERMO`: `false` desligaria em todo mapa.
 *
 * Só os renderers e os painéis do estilo leem `meioTermoLigado`
 * (`drawPropSilhouettes`, `drawTexturas`, `relevoRaster`, `drawWalls`,
 * `drawBarranco`, `telhadosRenderer`, `MobiliaControls`, `RoomControls`,
 * `PropertiesPanel`, `FloorStyleControls`, `FichaDoObjeto`, `vistaTresQuartos`).
 */

/** O Meio-Termo existe no produto (MT12); quem o liga ou desliga em cada mapa é o estilo da cena. */
export const CHAVE_DE_OBRA_MEIO_TERMO: boolean = true

/** Os três estilos que o mestre escolhe por mapa. */
export type EstiloVisual = 'atual' | NonNullable<MapData['estiloVisual']>

/** Parâmetro e valores da URL que ligam ou desligam a obra no servidor de desenvolvimento. */
const PARAMETRO_DA_OBRA = 'obra'
const OBRA_MEIO_TERMO = 'meio-termo'
const OBRA_LINHAS = 'linhas'

/** Sobe a cada mudança do desenho do Meio-Termo que precise jogar fora as imagens guardadas. */
const VERSAO_DO_MEIO_TERMO = 1
/** O `contrato` dos `textura.json` do pacote (CONTRATO.md seção 3): conta nova, imagens novas. */
const VERSAO_DO_CONTRATO_DESENHADO = 1

/** O estilo gravado no mapa: ausente (mapa de antes do campo, mapa novo) = Atual. */
export function estiloDoMapa(map: Pick<MapData, 'estiloVisual'>): EstiloVisual {
  return map.estiloVisual ?? 'atual'
}

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
/** O estilo do mapa aberto nesta janela; até alguém definir, o Atual (o que todo mapa de antes abre). */
let estiloDaCena: EstiloVisual = 'atual'

function pedidaPelaUrl(): boolean | undefined {
  if (!urlLida) {
    urlLida = true
    // Fora do navegador (Node, worker sem `location`) não há URL para ler.
    const search = typeof location === 'undefined' ? '' : location.search
    // O build da sonda de desempenho (`VITE_LAB_SONDA=1`) também lê a URL: é como o harness mede o desenho de linhas em produção.
    pedidaNaUrl = obraDaUrl(import.meta.env.DEV || import.meta.env.VITE_LAB_SONDA === '1', search)
  }
  return pedidaNaUrl
}

/**
 * O mapa aberto nesta janela passou a ter este estilo. Devolve `true` quando
 * mudou: quem chama repinta o que guarda imagem pronta (as chaves de cache
 * levam `versaoDoEstilo()`). O Desenhado já abre o canal das imagens (só a
 * lista de URLs; os PNG vêm quando cada renderer pedir).
 */
export function definirEstiloDaCena(estilo: EstiloVisual): boolean {
  if (estilo === estiloDaCena) return false
  estiloDaCena = estilo
  if (estilo === 'desenhado') {
    abrirFonteDoDesenhado().catch((erro: unknown) => {
      // Sem a lista, tudo sai no Atual (CONTRATO 10.8 item 4); a próxima troca tenta de novo.
      console.warn('[desenhado] a lista das imagens não carregou; fica o Atual', erro)
    })
  }
  return true
}

/** O estilo do mapa aberto nesta janela, como o mestre escolheu (a URL e o teste não entram). */
export function estiloAtivo(): EstiloVisual {
  return estiloDaCena
}

/** O Meio-Termo está ligado nesta cena? (Atual e Desenhado sim, Simples não; o teste e a URL vencem.) */
export function meioTermoLigado(): boolean {
  if (forcadaPeloTeste !== undefined) return forcadaPeloTeste
  return pedidaPelaUrl() ?? (CHAVE_DE_OBRA_MEIO_TERMO && estiloDaCena !== 'simples')
}

/**
 * O Desenhado está ligado nesta cena? Só por cima do Meio-Termo: a URL ou o
 * teste que forçam o desenho de linhas desligam o Desenhado junto.
 */
export function desenhadoLigado(): boolean {
  return estiloDaCena === 'desenhado' && meioTermoLigado()
}

/**
 * Força a obra num teste: `true` liga, `false` desliga (vence a constante, a
 * URL e o estilo da cena), sem valor volta ao padrão. O `afterEach` chama
 * `trocarObraNoTeste()`.
 */
export function trocarObraNoTeste(estado?: boolean): void {
  forcadaPeloTeste = estado
}

/**
 * Entra nas chaves de cache dos renderers: imagem de um estilo nunca serve a
 * outro. Trocar o estilo do mapa troca este texto, e o renderer pinta de novo.
 */
export function versaoDoEstilo(): string {
  if (!meioTermoLigado()) return 'linhas'
  return desenhadoLigado() ? `desenhado-${VERSAO_DO_CONTRATO_DESENHADO}` : `meio-termo-${VERSAO_DO_MEIO_TERMO}`
}

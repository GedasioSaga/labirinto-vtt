/**
 * LARGURA DA PÁGINA DO LIVRO DA MESA (onde mora a lista de Cenas): a borda de
 * fora da página arrasta, e a largura escolhida fica neste computador (é
 * conveniência de quem olha, não dado da aventura). O padrão é o de sempre,
 * `gr.larguraPagina` (theme.ts).
 *
 * Só contas aqui; quem lê o localStorage e mexe no CSS é `BordaDaPagina.tsx`.
 */

/** A largura de sempre, a mesma de `theme.gr.larguraPagina`: o clique duplo volta a ela. */
export const LARGURA_PADRAO = 262

/** Mais estreita que o padrão, as fichas e os campos do livro não cabem. */
export const LARGURA_MINIMA = LARGURA_PADRAO

/** Teto absoluto, mesmo em tela muito larga: a página é coluna de leitura, não segunda tela. */
export const LARGURA_MAXIMA = 520

/** Quanto do mapa sobra no mínimo entre os dois livros (o mapa é o que importa na mesa). */
const MAPA_MINIMO = 480

/** O que o resto da janela já toma: o livro do mestre à esquerda (326) e a lombada da mesa com a margem (64). */
const RESTO_DA_JANELA = 326 + 64

/** Um passo das setas; com Shift, quatro. */
export const PASSO_DO_TECLADO = 16

/** A chave do localStorage. */
export const CHAVE_DA_LARGURA = 'lb-livro-mesa-largura'

/** O teto nesta janela: nunca menos que o padrão, nunca mais que `LARGURA_MAXIMA`. */
export function larguraMaximaPara(larguraDaJanela: number): number {
  if (!Number.isFinite(larguraDaJanela)) return LARGURA_PADRAO
  return Math.max(LARGURA_MINIMA, Math.min(LARGURA_MAXIMA, Math.floor(larguraDaJanela - RESTO_DA_JANELA - MAPA_MINIMO)))
}

/** Prende a largura entre o mínimo e o teto desta janela, em pixel inteiro. */
export function prenderLargura(largura: number, larguraDaJanela: number): number {
  if (!Number.isFinite(largura)) return LARGURA_PADRAO
  return Math.round(Math.max(LARGURA_MINIMA, Math.min(larguraMaximaPara(larguraDaJanela), largura)))
}

/**
 * O que estava guardado, se for um número que faz sentido; lixo (texto, JSON
 * quebrado, negativo, infinito) volta ao padrão sem derrubar nada.
 */
export function lerLarguraGuardada(bruto: string | null): number {
  if (bruto === null) return LARGURA_PADRAO
  const numero = Number(bruto.trim())
  if (bruto.trim() === '' || !Number.isFinite(numero) || numero <= 0) return LARGURA_PADRAO
  return Math.round(Math.max(LARGURA_MINIMA, Math.min(LARGURA_MAXIMA, numero)))
}

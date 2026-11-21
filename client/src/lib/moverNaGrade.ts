/**
 * O CURSOR DE UMA GRADE pelo teclado, como no seletor de emoji (a escolha do
 * acervo no conteúdo do baú, 21/11/2026): `passo` de ±1 anda uma peça e para
 * nas pontas; `porLinha` anda linhas inteiras (`passo` múltiplo de `colunas`)
 * e não sai da grade — da primeira linha para cima, ou da última para baixo,
 * fica onde está. Na última linha incompleta, descer cai na última peça.
 * Grade vazia devolve 0.
 */
export function moverNaGrade(indice: number, passo: number, total: number, colunas: number, porLinha: boolean): number {
  if (total <= 0) return 0
  const atual = Math.max(0, Math.min(total - 1, indice))
  const proximo = atual + passo
  if (!porLinha) return Math.max(0, Math.min(total - 1, proximo))
  const largura = Math.max(1, Math.floor(colunas))
  const ultimaLinha = Math.floor((total - 1) / largura)
  if (proximo < 0 || Math.floor(proximo / largura) > ultimaLinha) return atual
  return Math.min(proximo, total - 1)
}

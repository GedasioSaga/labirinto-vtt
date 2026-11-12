/**
 * O CONTORNO DA PAREDE COM TEXTURA, em px do mundo a 64 px por casa (o fio no
 * tom escuro da própria cor, desenhado em `pixi/paredeEmPecas.ts`).
 *
 * Mora aqui, num módulo sem import nenhum, porque a conta pura do corpo da
 * parede (`lib/faixasDaParede.ts`, que a névoa do jogador usa via
 * `lib/fogFilter.ts`) também mede com ele. Importado de `pixi/paredeEmPecas.ts`,
 * fechava o ciclo `relevo -> ... -> fogFilter -> faixasDaParede ->
 * paredeEmPecas -> relevo`, e o `paredeEmPecas` lia `AJUSTE_DO_RELEVO` antes de
 * o `relevo` terminar de carregar (fase de testes da caça de 12/11/2026, B1).
 */
export const CONTORNO_PX = 1.25

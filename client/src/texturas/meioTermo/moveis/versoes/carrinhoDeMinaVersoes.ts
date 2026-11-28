/**
 * As versões do CARRINHO DE MINA (L04 do plano de arte por tema, 28/11/2026). A 1ª, o VAZIO, é o desenho do próprio
 * tipo (`montarCarrinhoDeMina`); aqui ficam as outras duas, do mesmo arquivo do tipo para a tina, a borda e as rodas
 * serem as mesmas: COM MINÉRIO (pedras de ferro até a borda) e COM OURO (a mesma carga com o veio e as pepitas).
 */
import type { VersoesDesenhadas } from '.'
import { montarCarrinhoDeMinaComMinerio, montarCarrinhoDeMinaComOuro } from '../carrinhoDeMina'

export const versoesDoCarrinhoDeMina: VersoesDesenhadas = {
  comMinerio: montarCarrinhoDeMinaComMinerio,
  comOuro: montarCarrinhoDeMinaComOuro,
}

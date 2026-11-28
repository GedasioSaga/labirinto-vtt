/**
 * As versões do TRILHO DE MINA (L04 do plano de arte por tema, 28/11/2026). A 1ª, o RETO, é o desenho do próprio tipo
 * (`montarTrilhoDeMina`, o que estica); aqui ficam as outras duas, do mesmo arquivo do tipo para os dormentes, os
 * trilhos e o leito serem os mesmos: a CURVA (um quarto de volta) e o BATENTE (o fim da linha).
 */
import type { VersoesDesenhadas } from '.'
import { montarTrilhoDeMinaBatente, montarTrilhoDeMinaCurva } from '../trilhoDeMina'

export const versoesDoTrilhoDeMina: VersoesDesenhadas = {
  curva: montarTrilhoDeMinaCurva,
  batente: montarTrilhoDeMinaBatente,
}

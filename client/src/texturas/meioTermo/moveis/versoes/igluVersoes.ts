/**
 * As versões do IGLU (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`). A 1ª,
 * INTEIRO, é o desenho do próprio tipo (`montarIglu`); aqui fica o EM RUÍNA, desenhado no mesmo arquivo do tipo para a
 * cúpula, as fiadas, os blocos e a saia de neve serem os mesmos: só a parede de trás de pé, em degraus, os blocos
 * tombados dentro e fora, o chão de dentro à mostra e o túnel sem teto.
 */
import type { VersoesDesenhadas } from '.'
import { montarIgluEmRuina } from '../iglu'

export const versoesDoIglu: VersoesDesenhadas = {
  emRuina: montarIgluEmRuina,
}

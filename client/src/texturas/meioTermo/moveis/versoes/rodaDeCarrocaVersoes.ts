/**
 * As versões da RODA DE CARROÇA (L07 do plano de arte por tema, 28/11/2026). A 1ª, ENCOSTADA, é o desenho do próprio
 * tipo (`montarRodaDeCarroca`); aqui fica a DEITADA, do mesmo arquivo do tipo para o aro, as cambotas, os raios e o
 * cubo serem os mesmos.
 */
import type { VersoesDesenhadas } from '.'
import { montarRodaDeCarrocaDeitada } from '../rodaDeCarroca'

export const versoesDoRodaDeCarroca: VersoesDesenhadas = {
  deitada: montarRodaDeCarrocaDeitada,
}

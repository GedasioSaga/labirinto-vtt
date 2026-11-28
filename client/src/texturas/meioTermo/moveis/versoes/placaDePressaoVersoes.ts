/**
 * As versões da PLACA DE PRESSÃO (L01 do plano de arte por tema, 28/11/2026). A 1ª, a QUADRADA, é o desenho do
 * próprio tipo (`montarPlacaDePressao`); aqui ficam as outras duas, desenhadas no mesmo arquivo do tipo para a placa,
 * a moldura e o sulco serem os mesmos: o LOSANGO (a placa de quina) e a AFUNDADA (a quadrada já pisada).
 */
import type { VersoesDesenhadas } from '.'
import { montarPlacaDePressaoAfundada, montarPlacaDePressaoLosango } from '../placaDePressao'

export const versoesDoPlacaDePressao: VersoesDesenhadas = {
  losango: montarPlacaDePressaoLosango,
  afundada: montarPlacaDePressaoAfundada,
}

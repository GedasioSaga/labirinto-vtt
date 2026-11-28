/**
 * As versões da ESCADA DE MÃO (L01 do plano de arte por tema, 28/11/2026). A 1ª, a ENCOSTADA, é o desenho do próprio
 * tipo (`montarEscadaDeMao`); aqui fica a DEITADA, a mesma escada largada no chão (desenhada no arquivo do tipo, para
 * os banzos, os degraus e as cavilhas serem os mesmos).
 */
import type { VersoesDesenhadas } from '.'
import { montarEscadaDeMaoDeitada } from '../escadaDeMao'

export const versoesDoEscadaDeMao: VersoesDesenhadas = {
  deitada: montarEscadaDeMaoDeitada,
}

/**
 * As versões da ESCORA DE MINA (L04 do plano de arte por tema, 28/11/2026). A 1ª, a INTEIRA, é o desenho do próprio
 * tipo (`montarEscoraDeMina`); aqui fica a QUEBRADA, do mesmo arquivo do tipo para os esteios, a trave e as tábuas do
 * forro serem os mesmos: a trave partida, o esteio torto, as tábuas caídas e o entulho do teto.
 */
import type { VersoesDesenhadas } from '.'
import { montarEscoraDeMinaQuebrada } from '../escoraDeMina'

export const versoesDoEscoraDeMina: VersoesDesenhadas = {
  quebrada: montarEscoraDeMinaQuebrada,
}

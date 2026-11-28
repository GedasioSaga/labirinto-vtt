/**
 * As versões da CORRENTE PENDURADA (L01 do plano de arte por tema, 28/11/2026). A 1ª, COM GANCHO, é o desenho do
 * próprio tipo (`montarCorrentePendurada`); aqui fica a COM GRILHÃO, a mesma corrente com a algema aberta dos grilhões
 * de parede na ponta (desenhada no arquivo do tipo, para a chapa, a argola e os elos serem os mesmos).
 */
import type { VersoesDesenhadas } from '.'
import { montarCorrentePenduradaComGrilhao } from '../correntePendurada'

export const versoesDoCorrentePendurada: VersoesDesenhadas = {
  comGrilhao: montarCorrentePenduradaComGrilhao,
}

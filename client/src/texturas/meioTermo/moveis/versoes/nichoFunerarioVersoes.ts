/**
 * As VERSÕES do nicho funerário (I0-a, 28/11/2026): a 1ª, Fechado, é o desenho de `MONTADORES`; o Aberto (a laje
 * partida e caída, o lóculo com os ossos) já estava desenhado desde o L05 de 24/11 (`../nichoFunerario.ts`) e só
 * faltava o caminho até o painel.
 */
import type { VersoesDesenhadas } from '.'
import { montarNichoFunerarioAberto } from '../nichoFunerario'

export const versoesDoNichoFunerario: VersoesDesenhadas = {
  aberto: montarNichoFunerarioAberto,
}

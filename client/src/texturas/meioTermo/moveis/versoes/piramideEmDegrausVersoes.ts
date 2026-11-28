/**
 * As VERSÕES da pirâmide em degraus (I0-a, 28/11/2026): a 1ª, Seca, é o desenho de `MONTADORES`; a Alagada (cada
 * degrau um tanque raso) já estava desenhada desde o L08 de 24/11 (`../piramideEmDegraus.ts`) e só faltava o caminho
 * até o painel.
 */
import type { VersoesDesenhadas } from '.'
import { montarPiramideEmDegrausAlagada } from '../piramideEmDegraus'

export const versoesDoPiramideEmDegraus: VersoesDesenhadas = {
  alagada: montarPiramideEmDegrausAlagada,
}

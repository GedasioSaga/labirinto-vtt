/**
 * As versões da PILHA DE MINÉRIO (L04 do plano de arte por tema, 28/11/2026). A 1ª, a de FERRO, é o desenho do próprio
 * tipo (`montarPilhaDeMinerio`); aqui ficam as outras duas, do mesmo arquivo do tipo para o monte, os pedaços e o
 * cascalho serem os mesmos: a de OURO (o veio e as pepitas do Monte de ouro) e a de CRISTAL (pontas de ametista).
 */
import type { VersoesDesenhadas } from '.'
import { montarPilhaDeMinerioDeCristal, montarPilhaDeMinerioDeOuro } from '../pilhaDeMinerio'

export const versoesDoPilhaDeMinerio: VersoesDesenhadas = {
  ouro: montarPilhaDeMinerioDeOuro,
  cristal: montarPilhaDeMinerioDeCristal,
}

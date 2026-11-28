/**
 * As VERSÕES do braseiro (lote L02 do plano de arte por tema, 28/11/2026): a 1ª, Laranja, é o desenho de `MONTADORES`
 * (o de hoje); Azul, Verde e Roxa são o mesmo desenho com o fogo parado no tom da chama da versão (`./brasaNoTom.ts`).
 * A chama animada, a fagulha e a luz saem do id da versão (`lib/mobilia/corDaChama.ts`): os ids são os da cor.
 */
import type { VersoesDesenhadas } from '.'
import { montarBraseiro } from '../braseiro'
import { comBrasaNoTom } from './brasaNoTom'

export const versoesDoBraseiro: VersoesDesenhadas = {
  azul: comBrasaNoTom(montarBraseiro, 'azul'),
  verde: comBrasaNoTom(montarBraseiro, 'verde'),
  roxa: comBrasaNoTom(montarBraseiro, 'roxa'),
}

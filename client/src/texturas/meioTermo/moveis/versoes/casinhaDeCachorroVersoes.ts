/**
 * As versões da CASINHA DE CACHORRO (L07 do plano de arte por tema, 28/11/2026). A 1ª, VAZIA, é o desenho do próprio
 * tipo (`montarCasinhaDeCachorro`); aqui fica a COM TIGELA, do mesmo arquivo do tipo para a casinha ser a mesma.
 */
import type { VersoesDesenhadas } from '.'
import { montarCasinhaDeCachorroComTigela } from '../casinhaDeCachorro'

export const versoesDoCasinhaDeCachorro: VersoesDesenhadas = {
  comTigela: montarCasinhaDeCachorroComTigela,
}

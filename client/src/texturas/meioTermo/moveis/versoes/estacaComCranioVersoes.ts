/**
 * As versões da ESTACA COM CRÂNIO (lote L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`).
 * A 1ª, UMA, é o desenho de `MONTADORES` (`montarEstacaComCranio`). A TRÊS fica aqui: as três estacas juntas na mesma
 * pegada. Desenhadas no arquivo do tipo, para a estaca, a corda e a caveira serem as mesmas nas duas.
 */
import type { VersoesDesenhadas } from '.'
import { montarEstacaComCranioTres } from '../estacaComCranio'

export const versoesDoEstacaComCranio: VersoesDesenhadas = {
  tres: montarEstacaComCranioTres,
}

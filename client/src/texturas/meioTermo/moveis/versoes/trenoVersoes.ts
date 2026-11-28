/**
 * As versões do TRENÓ (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`). A 1ª, DE
 * CARGA, é o desenho do próprio tipo (`montarTreno`); aqui fica o PEQUENO, desenhado no mesmo arquivo do tipo para os
 * patins, o estrado e a corda serem os mesmos: o trenó leve encostado atrás na pegada, a manta dobrada em cima e a
 * corda largada no chão até a frente.
 */
import type { VersoesDesenhadas } from '.'
import { montarTrenoPequeno } from '../treno'

export const versoesDoTreno: VersoesDesenhadas = {
  pequeno: montarTrenoPequeno,
}

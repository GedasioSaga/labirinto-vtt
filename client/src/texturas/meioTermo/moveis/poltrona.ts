/**
 * POLTRONA de cima com volume (móveis de casa, 28/10/2026): o par do sofá, o
 * mesmo estofado (`montarEstofado` de `sofa.ts`) com uma almofada só e os
 * braços mais largos, que numa casa leem como poltrona e não como sofá curto.
 * Materiais: `tecido` e `madeira`.
 */
import { montarEstofado } from './sofa'
import type { MontarMovel } from './contexto'

/** O braço da poltrona em fração da largura (o do sofá é 0,11). */
const LARGURA_DO_BRACO = 0.2

export const montarPoltrona: MontarMovel = (c, cena) => {
  montarEstofado(c, cena, LARGURA_DO_BRACO, 1)
}

/**
 * MESA QUADRADA de cima com volume (peça nova da MT4, 1 x 1 casa), irmã da
 * mesa retangular (`mesa.ts`): as mesmas peças e medidas por casa
 * (`mesaComPernas.ts`), com o veio próprio. Material: `madeira`.
 */
import type { MontarMovel } from './contexto'
import { montarMesaComPernas } from './mesaComPernas'

export const montarMesaQuadrada: MontarMovel = (c, cena) => montarMesaComPernas(c, cena, false, 60)

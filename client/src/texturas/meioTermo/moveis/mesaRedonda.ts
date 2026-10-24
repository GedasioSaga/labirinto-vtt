/**
 * MESA REDONDA de cima com volume (peça nova da MT4, 1,25 x 1,25 casa): o
 * tampo redondo de tábuas em faixas, com a borda clara e a espessura, as 4
 * pernas saindo pela borda nas diagonais e a sombra de baixo mais pesada que a
 * do tampo (`mesaComPernas.ts`). Sem a tira de borda com o veio dando a volta
 * (revisão da MT4: lia como o sulco da tampa de um barril). Material: `madeira`.
 */
import type { MontarMovel } from './contexto'
import { montarMesaComPernas } from './mesaComPernas'

export const montarMesaRedonda: MontarMovel = (c, cena) => montarMesaComPernas(c, cena, true, 70)

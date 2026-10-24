/**
 * MESA retangular de cima com volume (2 x 1 por padrão, estica para 3 x 1 sem
 * esticar o desenho): o tampo de tábuas com a borda clara e a espessura, as
 * pernas à mostra nas quinas e a sombra de baixo mais pesada que a do tampo
 * (`mesaComPernas.ts`). Até 24/10/2026 era o tampo entre duas travessas de
 * topo do protótipo (`objetos.js:1111-1141`), que lia como móvel, não como
 * mesa (o desenho de antes está em `mesasAntigas.testkit.ts`). Material: `madeira`.
 */
import type { MontarMovel } from './contexto'
import { montarMesaComPernas } from './mesaComPernas'

export const montarMesa: MontarMovel = (c, cena) => montarMesaComPernas(c, cena, false, 50)

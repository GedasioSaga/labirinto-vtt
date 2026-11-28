/**
 * As versões do CANO (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`). A 1ª, o
 * RETO, é o desenho do próprio tipo (`montarCano`); aqui ficam as outras três, desenhadas no mesmo arquivo do tipo
 * para o tubo, os flanges, a bolsa do barro e o desgaste serem os mesmos: o COTOVELO, a JUNÇÃO EM T e o cano COM
 * VÁLVULA (o volante de três raios em cima). O material (ferro, latão, cobre, inox ou barro) é o lugar `cano`.
 */
import type { VersoesDesenhadas } from '.'
import { montarCanoComValvula, montarCanoCotovelo, montarCanoJuncaoEmT } from '../cano'

export const versoesDoCano: VersoesDesenhadas = {
  cotovelo: montarCanoCotovelo,
  juncaoEmT: montarCanoJuncaoEmT,
  comValvula: montarCanoComValvula,
}

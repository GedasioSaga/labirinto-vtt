/**
 * As versões da COMPORTA (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`). A 1ª,
 * FECHADA, é o desenho do próprio tipo (`montarComporta`: a folha baixada e a água represada); aqui fica a ABERTA,
 * desenhada no mesmo arquivo do tipo para os pilares, a folha, o pórtico e o volante serem os mesmos: a folha
 * suspensa, a haste alta e a espuma da água que passa por baixo.
 */
import type { VersoesDesenhadas } from '.'
import { montarComportaAberta } from '../comporta'

export const versoesDoComporta: VersoesDesenhadas = {
  aberta: montarComportaAberta,
}

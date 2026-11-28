/**
 * As versões da LÂMINA PENDULAR (lote L02 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`).
 * A 1ª, PARADA, é o desenho de `MONTADORES` (`montarLaminaPendularParada`: a viga e a lâmina a prumo numa imagem só).
 * A BALANÇANDO é só a parte parada (a viga, a chapa, o eixo e o sulco no chão): o braço e a lâmina saem de
 * `montarLaminaPendularQueMexe`, desenhados pelo animador `oscilar` em volta do eixo (`ANIMACAO_DO_LAMINA_PENDULAR`).
 * Com "menos movimento" o animador desenha a peça que mexe a prumo, parada, e a imagem fica igual à da PARADA.
 */
import type { VersoesDesenhadas } from '.'
import { montarLaminaPendular } from '../laminaPendular'

export const versoesDoLaminaPendular: VersoesDesenhadas = {
  balancando: montarLaminaPendular,
}

/**
 * As versões da SAÍDA DE ESGOTO (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`).
 * A 1ª, SECA, é o desenho de `MONTADORES` (`montarSaidaDeEsgoto`: o leque de lodo seco embaixo da boca). A ESCORRENDO
 * é só a parte parada (o chão encharcado, a poça com a espuma e a enxurrada): o jorro sai de
 * `montarSaidaDeEsgotoQueMexe`, desenhado pelo animador `fioDeAgua` a partir da boca (`ANIMACAO_DO_SAIDA_DE_ESGOTO`).
 * Com "menos movimento" o animador desenha o jorro parado e a imagem fica igual à de
 * `montarSaidaDeEsgotoEscorrendoParada`, a da folha.
 */
import type { VersoesDesenhadas } from '.'
import { montarSaidaDeEsgotoEscorrendo } from '../saidaDeEsgoto'

export const versoesDoSaidaDeEsgoto: VersoesDesenhadas = {
  escorrendo: montarSaidaDeEsgotoEscorrendo,
}

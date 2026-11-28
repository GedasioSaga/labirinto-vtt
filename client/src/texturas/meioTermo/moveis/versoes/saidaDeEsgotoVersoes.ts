/**
 * As versões da SAÍDA DE ESGOTO (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`).
 * A 1ª, SECA, é o desenho de `MONTADORES` (`montarSaidaDeEsgoto`: o leque de lodo seco embaixo da boca). A ESCORRENDO
 * é a imagem com o jorro em repouso (`montarSaidaDeEsgotoEscorrendoParada`: o chão encharcado, a poça, a enxurrada e o
 * jorro de `montarSaidaDeEsgotoQueMexe`), a mesma da folha e a de "menos movimento". O integrador (28/11/2026) pôs o
 * jorro na imagem: o animador `fioDeAgua` (`pixi/fioDeAgua.ts`) corre POR CIMA dele, do pivô de
 * `ANIMACAO_DO_SAIDA_DE_ESGOTO`, e some com "menos movimento", sem a imagem ficar sem água.
 */
import type { VersoesDesenhadas } from '.'
import { montarSaidaDeEsgotoEscorrendoParada } from '../saidaDeEsgoto'

export const versoesDoSaidaDeEsgoto: VersoesDesenhadas = {
  escorrendo: montarSaidaDeEsgotoEscorrendoParada,
}

/**
 * As versões da FONTE DE PAREDE (lote L06 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`).
 * A 1ª, CORRENDO, é o desenho de `MONTADORES`: `montarFonteDeParedeCorrendo` (a pedra, a água e o fio numa imagem só)
 * enquanto o animador `fioDeAgua` não está ligado; ligado, `montarFonteDeParede` (sem o fio) mais
 * `montarFonteDeParedeQueMexe` no animador (`ANIMACAO_DO_FONTE_DE_PAREDE`). A SECA fica aqui: o cocho vazio e sem fio,
 * que não mexe. Desenhadas no arquivo do tipo, para a pedra e a bica serem as mesmas nas duas.
 */
import type { VersoesDesenhadas } from '.'
import { montarFonteDeParedeSeca } from '../fonteDeParede'

export const versoesDoFonteDeParede: VersoesDesenhadas = {
  seca: montarFonteDeParedeSeca,
}

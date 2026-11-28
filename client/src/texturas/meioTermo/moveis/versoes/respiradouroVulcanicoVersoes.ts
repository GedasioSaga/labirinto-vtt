/**
 * As versões do RESPIRADOURO VULCÂNICO (lote L09 do plano de arte por tema, 28/11/2026,
 * `docs/design/arte-temas/PLANO.md`). A 1ª, ATIVO, é o desenho de `MONTADORES` (`montarRespiradouroVulcanico`: a lava
 * acesa na garganta; o vapor é do animador `vapor`, `ANIMACAO_DO_RESPIRADOURO_VULCANICO`). O ADORMECIDO fica aqui: a
 * garganta tampada pela crosta fria, sem vapor. Desenhadas no arquivo do tipo, para a crosta e o cone serem os mesmos.
 */
import type { VersoesDesenhadas } from '.'
import { montarRespiradouroVulcanicoAdormecido } from '../respiradouroVulcanico'

export const versoesDoRespiradouroVulcanico: VersoesDesenhadas = {
  adormecido: montarRespiradouroVulcanicoAdormecido,
}

/**
 * As versões do BONECO DE NEVE (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`). A
 * 1ª, CLÁSSICO, é o desenho do próprio tipo (`montarBonecoDeNeve`); aqui fica o DERRETENDO, desenhado no mesmo arquivo
 * do tipo para as bolas, o carvão, o nariz, os galhos e o cachecol serem os mesmos: as bolas moles e baixas na poça, a
 * cartola caída no chão e um braço caído na água.
 */
import type { VersoesDesenhadas } from '.'
import { montarBonecoDeNeveDerretendo } from '../bonecoDeNeve'

export const versoesDoBonecoDeNeve: VersoesDesenhadas = {
  derretendo: montarBonecoDeNeveDerretendo,
}

import { create } from 'zustand'
import type { EscolhaDoMaterial } from '../texturas/meioTermo/barrancoPorChao'

/**
 * BARRANCO: o material dos PRÓXIMOS riscos e traços da Área alta (painel
 * "Material"). Preferência da ferramenta, fora do mapa e do desfazer, no molde
 * da `ferramentaDoAbismo`. Automático = o material sai do chão pintado no lado
 * alto (`lib/materialDoBarranco.ts`).
 */
interface FerramentaDoBarranco {
  material: EscolhaDoMaterial
  setMaterial: (material: EscolhaDoMaterial) => void
}

export const useFerramentaDoBarranco = create<FerramentaDoBarranco>((set) => ({
  material: 'automatico',
  setMaterial: (material) => set({ material }),
}))

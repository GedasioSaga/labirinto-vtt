import { create } from 'zustand'
import { BORDA_PADRAO, LARGURA_MAXIMA_EM_CASAS, LARGURA_MINIMA_EM_CASAS, LARGURA_PADRAO_EM_CASAS, MATERIAL_PADRAO, type TerrenoDaFerramenta } from '../lib/terrenoDoChao'

/**
 * O TERRENO NA MÃO da ferramenta Chão (pedido CHÃO E CAMINHO de 12/11/2026):
 * material, largura do caminho, borda e "Conta como Chão" da PRÓXIMA peça.
 * Preferência da ferramenta, fora do arquivo do mapa (como a cor do Caminho
 * de antes). Nasce como o protótipo aprovado: Calçamento, 2 casas, borda de
 * 60% e contando como Chão.
 */
interface TerrenoState extends TerrenoDaFerramenta {
  definirMaterial: (material: string | null) => void
  definirLargura: (larguraEmCasas: number) => void
  definirBorda: (borda: number) => void
  definirContaComoChao: (conta: boolean) => void
}

export const useTerrenoStore = create<TerrenoState>()((set) => ({
  material: MATERIAL_PADRAO,
  larguraEmCasas: LARGURA_PADRAO_EM_CASAS,
  borda: BORDA_PADRAO,
  contaComoChao: true,
  definirMaterial: (material) => set({ material }),
  definirLargura: (larguraEmCasas) =>
    set({ larguraEmCasas: Math.min(LARGURA_MAXIMA_EM_CASAS, Math.max(LARGURA_MINIMA_EM_CASAS, larguraEmCasas)) }),
  definirBorda: (borda) => set({ borda: Math.min(1, Math.max(0, borda)) }),
  definirContaComoChao: (contaComoChao) => set({ contaComoChao }),
}))

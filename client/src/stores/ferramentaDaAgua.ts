import { create } from 'zustand'
import type { CorProntaDaAgua, TipoDeAgua } from '../types/map'
import { AJUSTE_PADRAO, COR_PRONTA_DO_TIPO, LARGURA_DO_RIO, corProntaDaAgua } from '../lib/agua/dados'

/**
 * ÁGUA: o que o PRÓXIMO traço da ferramenta Água faz (tipo, cor, largura,
 * ajustes) e a água escolhida no mapa. Preferência da ferramenta, fora do
 * mapa e do desfazer, no molde do `pincelDaNeblina`.
 */
interface FerramentaDaAgua {
  tipo: TipoDeAgua
  cor: string
  /** `null` = cor livre. */
  corPronta: CorProntaDaAgua | null
  /** Casas, só rio. */
  largura: number
  velocidade: number
  ondas: number
  espuma: number
  /** A água escolhida (clique numa água com a ferramenta), ou `null`. */
  escolhida: string | null
  setTipo: (tipo: TipoDeAgua) => void
  setCor: (cor: string, corPronta: CorProntaDaAgua | null) => void
  setLargura: (largura: number) => void
  setAjuste: (qual: 'velocidade' | 'ondas' | 'espuma', valor: number) => void
  escolher: (id: string | null) => void
}

const limitar = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

export const useFerramentaDaAgua = create<FerramentaDaAgua>((set, get) => ({
  tipo: 'rio',
  cor: corProntaDaAgua('rio'),
  corPronta: 'rio',
  largura: LARGURA_DO_RIO.padrao,
  velocidade: AJUSTE_PADRAO.velocidade,
  ondas: AJUSTE_PADRAO.ondas,
  espuma: AJUSTE_PADRAO.espuma,
  escolhida: null,
  setTipo: (tipo) => {
    // A cor pronta acompanha o tipo enquanto o mestre não escolheu outra (o mar nasce azul de mar fundo).
    const { corPronta } = get()
    const automatica = corPronta === null ? null : COR_PRONTA_DO_TIPO[tipo]
    set(automatica === null || (corPronta !== 'rio' && corPronta !== 'mar') ? { tipo } : { tipo, corPronta: automatica, cor: corProntaDaAgua(automatica) })
  },
  setCor: (cor, corPronta) => set({ cor: cor.toLowerCase(), corPronta }),
  setLargura: (largura) => {
    if (Number.isFinite(largura)) set({ largura: limitar(Math.round(largura * 4) / 4, LARGURA_DO_RIO.min, LARGURA_DO_RIO.max) })
  },
  setAjuste: (qual, valor) => {
    if (!Number.isFinite(valor)) return
    const v = limitar(Math.round(valor), 0, 100)
    if (qual === 'velocidade') set({ velocidade: v })
    else if (qual === 'ondas') set({ ondas: v })
    else set({ espuma: v })
  },
  escolher: (id) => set({ escolhida: id }),
}))

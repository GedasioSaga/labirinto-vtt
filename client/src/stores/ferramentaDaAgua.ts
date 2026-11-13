import { create } from 'zustand'
import type { CorProntaDaAgua, TipoDeAgua } from '../types/map'
import { AJUSTE_PADRAO, COR_PRONTA_DO_TIPO, LARGURA_DO_RIO, corProntaDaAgua } from '../lib/agua/dados'

/**
 * ÁGUA: o que o PRÓXIMO traço da ferramenta Água faz (tipo, cor, largura,
 * ajustes, forma) e a água escolhida no mapa, com o jeito de mexer nela
 * (bolinhas ou um dos pincéis). Preferência da ferramenta, fora do mapa e do
 * desfazer, no molde do `pincelDaNeblina`.
 */

/** Como o lago e o mar nascem (pedido "MAR MAIS FÁCIL", 13/11/2026). O rio é sempre à mão. */
export type FormaDaAgua = 'mao' | 'retangulo' | 'pontos'

/** Com uma água escolhida: `null` = bolinhas no contorno; `agua` = Mais/Menos água; `areia` = Tirar/Pôr areia (só mar). */
export type PincelDaAgua = 'agua' | 'areia'
export type ModoDoPincelDeAgua = 'mais' | 'menos'
export type ModoDoPincelDeAreia = 'tirar' | 'por'

/** Diâmetro dos pincéis, em casas. */
export const TAMANHO_DO_PINCEL_DA_AGUA = { min: 0.5, max: 12, padrao: 2 } as const

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
  /** Lago e mar: à mão, retângulo ou ponto a ponto. */
  forma: FormaDaAgua
  /** A água escolhida (clique numa água com a ferramenta), ou `null`. */
  escolhida: string | null
  /** O pincel na mão com a água escolhida, ou `null` (bolinhas). Volta a `null` a cada escolha nova. */
  pincel: PincelDaAgua | null
  modoDaAgua: ModoDoPincelDeAgua
  modoDaAreia: ModoDoPincelDeAreia
  /** Diâmetro dos dois pincéis, em casas. */
  tamanho: number
  setTipo: (tipo: TipoDeAgua) => void
  setCor: (cor: string, corPronta: CorProntaDaAgua | null) => void
  setLargura: (largura: number) => void
  setAjuste: (qual: 'velocidade' | 'ondas' | 'espuma', valor: number) => void
  setForma: (forma: FormaDaAgua) => void
  escolher: (id: string | null) => void
  setPincel: (pincel: PincelDaAgua | null) => void
  setModoDaAgua: (modo: ModoDoPincelDeAgua) => void
  setModoDaAreia: (modo: ModoDoPincelDeAreia) => void
  setTamanho: (tamanho: number) => void
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
  forma: 'mao',
  escolhida: null,
  pincel: null,
  modoDaAgua: 'mais',
  modoDaAreia: 'tirar',
  tamanho: TAMANHO_DO_PINCEL_DA_AGUA.padrao,
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
  setForma: (forma) => set({ forma }),
  // Escolher outra água volta às bolinhas: o pincel de antes não pinta a água nova sem o mestre pedir.
  escolher: (id) => set(id === get().escolhida ? { escolhida: id } : { escolhida: id, pincel: null }),
  setPincel: (pincel) => set({ pincel }),
  setModoDaAgua: (modo) => set({ modoDaAgua: modo }),
  setModoDaAreia: (modo) => set({ modoDaAreia: modo }),
  setTamanho: (tamanho) => {
    if (Number.isFinite(tamanho)) set({ tamanho: limitar(Math.round(tamanho * 4) / 4, TAMANHO_DO_PINCEL_DA_AGUA.min, TAMANHO_DO_PINCEL_DA_AGUA.max) })
  },
}))

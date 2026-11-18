import { create } from 'zustand'
import type { BrilhoDoAbismo } from '../types/map'
import type { PincelDaArea } from '../lib/barranco'

/**
 * ABISMO: o jeito de desenhar (contornar a boca à mão ou cavar com o pincel),
 * a grossura do pincel, o brilho do PRÓXIMO abismo e o abismo escolhido no
 * mapa (clique num abismo contornado com a ferramenta). Preferência da
 * ferramenta, fora do mapa e do desfazer, no molde da `ferramentaDaAgua`.
 */

/** O brilho do painel: um dos do fundo ou nenhum. */
export type BrilhoEscolhido = BrilhoDoAbismo | 'nenhum'

/** Contornar: arrastar em volta da boca. Pincel: cavar quadrado por quadrado (`lib/abismoPintado.ts`). */
export type ModoDoAbismo = 'contornar' | 'pincel'

interface FerramentaDoAbismo {
  modo: ModoDoAbismo
  /** A grossura do pincel, as mesmas três da Área alta do barranco (`RAIO_DO_PINCEL_DA_AREA`). */
  pincel: PincelDaArea
  brilho: BrilhoEscolhido
  /** O abismo escolhido (clique num abismo contornado com a ferramenta), ou `null`. */
  escolhido: string | null
  /** Trocar para o Pincel solta o escolhido: no Pincel o brilho do painel é o do traço. */
  setModo: (modo: ModoDoAbismo) => void
  setPincel: (pincel: PincelDaArea) => void
  setBrilho: (brilho: BrilhoEscolhido) => void
  escolher: (id: string | null) => void
}

export const useFerramentaDoAbismo = create<FerramentaDoAbismo>((set) => ({
  modo: 'contornar',
  pincel: 'medio',
  brilho: 'nenhum',
  escolhido: null,
  setModo: (modo) => set(modo === 'pincel' ? { modo, escolhido: null } : { modo }),
  setPincel: (pincel) => set({ pincel }),
  setBrilho: (brilho) => set({ brilho }),
  escolher: (escolhido) => set({ escolhido }),
}))

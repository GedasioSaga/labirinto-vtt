import { create } from 'zustand'
import type { MedidaCompartilhada } from '../lib/batalha/ferramentasDoJogador'
import type { HostMedidaDoJogador } from '../net/hostSession'

/**
 * COMPARTILHAR COM O MESTRE (B6): a medida ao vivo de cada jogador, na tela do
 * mestre, desenhada pelo ticker do canvas (`PixiCanvas` →
 * `pixi/drawMedidasDosJogadores.ts`). Uma por jogador: a nova substitui.
 * Estado da sessão, não do mapa: não vai ao disco nem ao desfazer.
 */
export interface MedidaNaMesa {
  playerId: string
  name: string
  color: string
  mapId: string
  emBatalha: boolean
  medida: MedidaCompartilhada
}

interface MedidasDosJogadoresState {
  medidas: readonly MedidaNaMesa[]
  receive: (update: HostMedidaDoJogador) => void
  clear: () => void
}

export const useMedidasDosJogadoresStore = create<MedidasDosJogadoresState>()((set, get) => ({
  medidas: [],

  receive: (update) => {
    const outras = get().medidas.filter((m) => m.playerId !== update.playerId)
    if ('apagar' in update) {
      // Nada a apagar: não troca a referência (o ticker não redesenha à toa).
      if (outras.length !== get().medidas.length) set({ medidas: outras })
      return
    }
    const { playerId, name, color, mapId, emBatalha, medida } = update
    set({ medidas: [...outras, { playerId, name, color, mapId, emBatalha, medida }] })
  },

  clear: () => set({ medidas: [] }),
}))

import { create } from 'zustand'

/**
 * TINTA DO PERÍODO NO EDITOR (Luz L4b, decisão D5 do plano
 * `docs/planos/luz-dia-tarde-noite-2026-10-24.md`). O mestre vê a tinta da
 * tarde e da noite a 50% (`TINTA_NO_EDITOR`, `pixi/mapaDeLuz.ts`), para
 * enxergar o mapa todo. "Ver como jogador" põe a tinta cheia e só as luzes que
 * os jogadores veem. Começa DESLIGADO e nada é guardado: é olhar, não dado da
 * cena. Nunca vai ao jogador.
 */
interface TintaNoEditor {
  comoJogador: boolean
  setComoJogador: (comoJogador: boolean) => void
}

export const useTintaNoEditor = create<TintaNoEditor>((set) => ({
  comoJogador: false,
  setComoJogador: (comoJogador) => set({ comoJogador }),
}))

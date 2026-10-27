import { create } from 'zustand'
import type { Periodo } from '../types/map'

/**
 * TINTA DO PERÍODO NO EDITOR (Luz L4b, decisão D5 do plano
 * `docs/planos/luz-dia-tarde-noite-2026-10-24.md`). O mestre vê a tinta da
 * tarde e da noite a 50% (`TINTA_NO_EDITOR`, `pixi/mapaDeLuz.ts`), para
 * enxergar o mapa todo. "Ver como jogador" põe a tinta cheia e só as luzes que
 * os jogadores veem. Começa DESLIGADO e nada é guardado: é olhar, não dado da
 * cena. Nunca vai ao jogador.
 *
 * `previa` (Luz L4c, painel "Ambiente da cena"): o editor mostra a cena aberta
 * neste período, qualquer que seja o da sessão, para o mestre ajustar a noite
 * de dia. `null` = o período de verdade da cena. Só no editor; o painel a
 * desliga quando sai da tela.
 */
interface TintaNoEditor {
  comoJogador: boolean
  setComoJogador: (comoJogador: boolean) => void
  previa: Periodo | null
  setPrevia: (previa: Periodo | null) => void
}

export const useTintaNoEditor = create<TintaNoEditor>((set) => ({
  comoJogador: false,
  setComoJogador: (comoJogador) => set({ comoJogador }),
  previa: null,
  setPrevia: (previa) => set({ previa }),
}))

import { create } from 'zustand'

/**
 * MOSTRAR PAREDES TORTAS (pedido de 17/11/2026: "nunca sei quando uma parede ta
 * alinhada"): o interruptor do painel, ao lado dos de grade. Ligado, o canvas
 * marca de laranja as paredes de 1° a 5° fora da reta (`lib/alinhamento.ts` →
 * `paredesTortasDoPiso`) até o mestre desligar. É do editor e de sessão: não
 * vai ao arquivo do mapa nem ao jogador, e começa desligado.
 */
interface ParedesTortas {
  mostrar: boolean
  setMostrar: (mostrar: boolean) => void
}

export const useParedesTortas = create<ParedesTortas>((set) => ({
  mostrar: false,
  setMostrar: (mostrar) => set({ mostrar }),
}))

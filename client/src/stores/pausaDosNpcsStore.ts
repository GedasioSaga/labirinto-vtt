/// <reference types="vite/client" />
import { create } from 'zustand'

/**
 * PAUSA GERAL DOS NPCS — o mestre congela de uma vez quem anda sozinho (a
 * rotina andando e a patrulha andando) para narrar, e retoma de onde parou.
 * Só o interruptor mora aqui: cada relógio (`rotinaAndandoStore`,
 * `patrulhaAndandoStore`) assina este store, para enquanto ele está pausado e,
 * ao retomar, empurra as esperas pelo tempo pausado (`adiarEsperas`). Quem liga
 * o botão e o atalho é `stores/npcsAndando.ts`. Estado da sessão de jogo: não
 * vai ao arquivo nem ao jogador.
 */
interface PausaDosNpcsState {
  /** Desde quando está pausado (`Date.now()`); `null` = andando. */
  pausadaDesde: number | null
  pausar: () => void
  retomar: () => void
}

export const usePausaDosNpcsStore = create<PausaDosNpcsState>()((set, get) => ({
  pausadaDesde: null,
  pausar: () => {
    if (get().pausadaDesde === null) set({ pausadaDesde: Date.now() })
  },
  retomar: () => {
    if (get().pausadaDesde !== null) set({ pausadaDesde: null })
  },
}))

/**
 * O "agora" dos relógios dos NPCs: parado no instante da pausa enquanto ela
 * dura. Quem liga uma ficha durante a pausa grava a espera nesse instante, e o
 * retomar a empurra junto com as outras — ela sai andando ao retomar, sem
 * esperar de novo o tempo que a pausa já durou.
 */
export function agoraDosNpcs(): number {
  return usePausaDosNpcsStore.getState().pausadaDesde ?? Date.now()
}

/**
 * Assina as trocas da pausa para um relógio: `aoPausar` para ele, `aoRetomar`
 * recebe quanto tempo ficou pausado. Devolve o cancelamento.
 */
export function assinarPausa(aoPausar: () => void, aoRetomar: (pausadoMs: number) => void): () => void {
  return usePausaDosNpcsStore.subscribe((state, prev) => {
    if (state.pausadaDesde !== null && prev.pausadaDesde === null) aoPausar()
    if (state.pausadaDesde === null && prev.pausadaDesde !== null) aoRetomar(Math.max(0, Date.now() - prev.pausadaDesde))
  })
}

// Mesmo cuidado de `rotinaAndandoStore`: editado em `npm run dev`, o módulo novo
// nasce com o store zerado e quem o importa passa a usar o novo.
import.meta.hot?.accept(() => import.meta.hot?.invalidate())

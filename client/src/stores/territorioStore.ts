import { create } from 'zustand'

/**
 * FILTRO "QUEM MANDA AQUI": liga a cor das facções no editor do mestre. Não
 * vai ao mapa nem ao disco — é um modo da vista desta sessão, como o laser e
 * o seguir. Quem pinta é o canvas (`pixi/drawFaccoes.ts`).
 */
interface TerritorioState {
  filtroLigado: boolean
  setFiltroLigado: (ligado: boolean) => void
}

export const useTerritorioStore = create<TerritorioState>()((set) => ({
  filtroLigado: false,
  setFiltroLigado: (ligado) => set({ filtroLigado: ligado }),
}))

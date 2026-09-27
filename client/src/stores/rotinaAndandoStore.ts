/// <reference types="vite/client" />
import { create } from 'zustand'
import { darPassoDaRotina, desligarRotina, ligarRotina, PASSO_DA_ROTINA_MS, type RotinasAndando } from '../lib/rotinaAndando'
import { useAdventureStore } from './adventureStore'

/**
 * ROTINA ANDANDO no editor do mestre: quem está com a rotina ligada e o
 * relógio que dá um passo a cada `PASSO_DA_ROTINA_MS`. O relógio só corre com
 * alguém andando. É estado da sessão de jogo, como a iniciativa: não vai ao
 * arquivo nem ao jogador — ele recebe só a ficha no lugar novo, pelo mapa.
 * O passo em si é do agendador puro (`lib/rotinaAndando.ts`); aplicar é do
 * `useAdventureStore.moverFichasDaRotina`, com a mecânica do apito.
 */
interface RotinaAndandoState {
  andando: RotinasAndando
  /** Fichas que um jogador segura: ficam onde estão, com a rotina ligada. */
  fixas: ReadonlySet<string>
  ligar: (tokenId: string) => void
  desligar: (tokenId: string) => void
  setFixas: (fixas: ReadonlySet<string>) => void
  /** Um tique do relógio. */
  darPasso: () => void
  /** Desliga todas e para o relógio. */
  reset: () => void
}

let relogio: ReturnType<typeof setInterval> | null = null

/** O relógio corre enquanto houver ficha andando, e só então. */
function acertarRelogio(andando: RotinasAndando): void {
  if (andando.size > 0 && relogio === null) relogio = setInterval(() => useRotinaAndandoStore.getState().darPasso(), PASSO_DA_ROTINA_MS)
  if (andando.size === 0 && relogio !== null) {
    clearInterval(relogio)
    relogio = null
  }
}

function estadosDaAventura() {
  return useAdventureStore.getState().adventure?.estados ?? []
}

export const useRotinaAndandoStore = create<RotinaAndandoState>()((set, get) => {
  const trocar = (andando: RotinasAndando) => {
    if (andando !== get().andando) set({ andando })
    acertarRelogio(andando)
  }
  return {
    andando: new Map(),
    fixas: new Set(),
    ligar: (tokenId) => trocar(ligarRotina(get().andando, useAdventureStore.getState().cenasDaRotina(), tokenId, estadosDaAventura(), Date.now())),
    desligar: (tokenId) => trocar(desligarRotina(get().andando, tokenId)),
    setFixas: (fixas) => set({ fixas }),
    darPasso: () => {
      const { andando, fixas } = get()
      const cenas = useAdventureStore.getState().cenasDaRotina()
      const tique = darPassoDaRotina(cenas, andando, estadosDaAventura(), Date.now(), fixas)
      useAdventureStore.getState().moverFichasDaRotina(tique.movimentos)
      trocar(tique.andando)
    },
    reset: () => trocar(new Map()),
  }
})

// Em `npm run dev`, editar este módulo (ou o que ele importa) o troca por um novo,
// com o store zerado; sem isto o relógio do módulo velho seguia andando a ficha com
// o botão já dizendo "Andar sozinha". O Vite só roda o `dispose` de quem aceita a
// troca: o módulo aceita, para o relógio velho e repassa a troca a quem o importa,
// que passa a usar o store novo.
import.meta.hot?.accept(() => import.meta.hot?.invalidate())
import.meta.hot?.dispose(() => {
  if (relogio !== null) clearInterval(relogio)
  relogio = null
})

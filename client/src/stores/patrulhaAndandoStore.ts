/// <reference types="vite/client" />
import { create } from 'zustand'
import { adiarEsperas, darPassoDaPatrulha, desligarPatrulha, ligarPatrulha, moverPatrulhas, PASSO_DA_PATRULHA_MS, type PatrulhasAndando } from '../lib/patrulhaAndando'
import { subscribeToOpenings } from './adventureStore'
import { useMapStore } from './mapStore'
import { agoraDosNpcs, assinarPausa, usePausaDosNpcsStore } from './pausaDosNpcsStore'

/**
 * PATRULHA ANDANDO no editor do mestre: quem está com "Patrulhar sozinha"
 * ligado e o relógio que dá um passo a cada `PASSO_DA_PATRULHA_MS`. O relógio
 * só corre com alguém andando e sem a pausa geral dos NPCs. Estado da sessão
 * de jogo, como a rotina andando: não vai ao arquivo (o mapa reaberto volta
 * parado) nem ao jogador, que recebe só a ficha no lugar novo.
 *
 * O passo é do agendador puro (`lib/patrulhaAndando.ts`); aplicar é
 * `useMapStore.applyPlayerChange` sobre o mapa ABERTO — com ou sem aventura,
 * fora do Ctrl+Z (desfazer não devolve o guarda ao passo anterior) e pelo
 * mesmo caminho que leva a ficha ao jogador com deslize.
 */
interface PatrulhaAndandoState {
  andando: PatrulhasAndando
  /** Fichas que um jogador segura: ficam onde estão, com a patrulha ligada. */
  fixas: ReadonlySet<string>
  /** Fichas que o mestre arrasta agora no canvas: o arrasto manda, a patrulha espera. */
  arrastadas: ReadonlySet<string>
  ligar: (tokenId: string) => void
  desligar: (tokenId: string) => void
  setFixas: (fixas: ReadonlySet<string>) => void
  /** Começo (ids) e fim (vazio) do arrasto do mestre (`pixi/PixiCanvas.tsx`). */
  setArrastadas: (ids: ReadonlySet<string>) => void
  /** Um tique do relógio. */
  darPasso: () => void
  /** Desliga todas e para o relógio. */
  reset: () => void
}

let relogio: ReturnType<typeof setInterval> | null = null

/** O relógio corre enquanto houver ficha patrulhando e os NPCs não estiverem pausados, e só então. */
function acertarRelogio(andando: PatrulhasAndando): void {
  const correr = andando.size > 0 && usePausaDosNpcsStore.getState().pausadaDesde === null
  if (correr && relogio === null) relogio = setInterval(() => usePatrulhaAndandoStore.getState().darPasso(), PASSO_DA_PATRULHA_MS)
  if (!correr && relogio !== null) {
    clearInterval(relogio)
    relogio = null
  }
}

export const usePatrulhaAndandoStore = create<PatrulhaAndandoState>()((set, get) => {
  const trocar = (andando: PatrulhasAndando) => {
    if (andando !== get().andando) set({ andando })
    acertarRelogio(andando)
  }
  return {
    andando: new Map(),
    fixas: new Set(),
    arrastadas: new Set(),
    ligar: (tokenId) => trocar(ligarPatrulha(get().andando, useMapStore.getState().map, tokenId, agoraDosNpcs())),
    desligar: (tokenId) => trocar(desligarPatrulha(get().andando, tokenId)),
    setFixas: (fixas) => set({ fixas }),
    setArrastadas: (ids) => {
      // Todo fim de gesto do canvas chama com vazio: sem isto cada clique acordava quem assina.
      if (ids.size === 0 && get().arrastadas.size === 0) return
      set({ arrastadas: ids })
    },
    darPasso: () => {
      const { andando, fixas, arrastadas } = get()
      const paradas = arrastadas.size === 0 ? fixas : new Set([...fixas, ...arrastadas])
      const tique = darPassoDaPatrulha(useMapStore.getState().map, andando, Date.now(), paradas)
      if (tique.movimentos.length > 0) useMapStore.getState().applyPlayerChange((map) => moverPatrulhas(map, tique.movimentos))
      trocar(tique.andando)
    },
    reset: () => {
      // Um arrasto que não chegou ao fim (o canvas saiu no meio do gesto) não prende ninguém no mapa seguinte.
      if (get().arrastadas.size > 0) set({ arrastadas: new Set() })
      trocar(new Map())
    },
  }
})

// Toda abertura (outro mapa, solto ou de aventura) começa sem ninguém
// patrulhando: a patrulha ligada é da sessão que saiu. A troca de cena não
// passa por aqui: a ficha sai do mapa aberto e o próximo tique a desliga.
const pararAoAbrir = subscribeToOpenings(() => usePatrulhaAndandoStore.getState().reset())

// PAUSA GERAL: o mesmo acordo da rotina andando.
const seguirAPausa = assinarPausa(
  () => acertarRelogio(usePatrulhaAndandoStore.getState().andando),
  (pausadoMs) => {
    const andando = adiarEsperas(usePatrulhaAndandoStore.getState().andando, pausadoMs)
    if (andando !== usePatrulhaAndandoStore.getState().andando) usePatrulhaAndandoStore.setState({ andando })
    acertarRelogio(andando)
  },
)

// Em `npm run dev`, o mesmo cuidado de `rotinaAndandoStore`: o módulo trocado
// para o relógio velho, que senão seguia andando a ficha com o botão já
// dizendo "Patrulhar sozinha".
import.meta.hot?.accept(() => import.meta.hot?.invalidate())
import.meta.hot?.dispose(() => {
  pararAoAbrir()
  seguirAPausa()
  if (relogio !== null) clearInterval(relogio)
  relogio = null
})

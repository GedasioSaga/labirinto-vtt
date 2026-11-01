import { create } from 'zustand'
import { useBatalhaStore, type AjusteDaColocacao } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'

/**
 * INVOCAÇÃO F3: o "Colocar" do mestre entre a aba Batalha (a lista
 * Invocações) e o mapa (`App.tsx`), no molde da mira do mestre
 * (`miraDoMestre.ts`). A lista arma a colocação com os números já
 * conferidos; armada, o App passa `aoEscolherCasa` ao `PixiCanvas` (o clique
 * esquerdo escolhe a casa, já encaixada no centro) e o invocado nasce lá. Esc
 * ou "Cancelar" desarmam sem mudar nada.
 */

export interface ColocacaoArmada {
  sceneKey: string
  invocacaoId: string
  /** "Lobo": o texto do aviso sobre o mapa. */
  nome: string
  ajuste: AjusteDaColocacao
}

interface ColocacaoDoMestre {
  armada: ColocacaoArmada | null
  /** A última recusa (a pendência sumiu, número torto): a lista mostra perto do Colocar. */
  erro: { invocacaoId: string; texto: string } | null
  armar: (colocacao: ColocacaoArmada) => void
  desarmar: () => void
}

export const useColocacaoDoMestre = create<ColocacaoDoMestre>()((set) => ({
  armada: null,
  erro: null,
  armar: (colocacao) => set({ armada: colocacao, erro: null }),
  desarmar: () => set({ armada: null }),
}))

/** O porquê de a casa não servir: o store devolveu `null` (nada mudou). */
const NAO_NASCEU = 'Não nasceu: a invocação já foi posta ou cancelada, ou os números estão fora do limite.'

/**
 * O `aoEscolherCasa` do mapa do mestre (estável): o centro da casa clicada,
 * em px do mundo, no piso que ele está editando.
 */
export function escolherCasaDoMestre(ponto: { x: number; y: number }): void {
  const { armada } = useColocacaoDoMestre.getState()
  if (armada === null) return
  const piso = useMapStore.getState().pisoAtivo
  const onde = piso === 0 ? { x: ponto.x, y: ponto.y } : { x: ponto.x, y: ponto.y, piso }
  const tokenId = useBatalhaStore.getState().colocarInvocado(armada.sceneKey, armada.invocacaoId, onde, armada.ajuste)
  if (tokenId === null) {
    useColocacaoDoMestre.setState({ armada: null, erro: { invocacaoId: armada.invocacaoId, texto: NAO_NASCEU } })
    return
  }
  useColocacaoDoMestre.setState({ armada: null, erro: null })
}

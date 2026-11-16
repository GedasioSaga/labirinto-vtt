import { create } from 'zustand'
import type { LigaCena } from '../../lib/preparo/tipos'
import { useAdventureStore } from '../../stores/adventureStore'
import { useMapaNaMemoria } from '../mesa/catalogo'
import type { EstadoDaMesa } from './protocolo'

/**
 * A MESA VISTA DE DENTRO DO PRELÚDIO (P2): o que a janela principal contou pelo
 * fio, para as páginas do Prelúdio (a sessão, o verbete, o quadro) que ficam
 * fundo demais na árvore para receber por propriedade. Só a janela do Prelúdio
 * liga (`JanelaDoPreludio.tsx`); na tela do Prelúdio dentro da principal a loja
 * fica desligada e as páginas leem o mapa direto das lojas do editor.
 */

interface EstadoDaMesaNaJanela {
  /** Esta é a janela do Prelúdio, com fio para a mesa. */
  ligada: boolean
  /** A mesa respondeu há pouco. */
  viva: boolean
  estado: EstadoDaMesa | null
}

export const useMesaNaJanela = create<EstadoDaMesaNaJanela>()(() => ({
  ligada: false,
  viva: false,
  estado: null,
}))

/** A cena aberta na mesa agora, no formato do link; `null` = nenhum mapa (ou mapa novo, sem pasta). */
export interface CenaAberta {
  readonly alvo: LigaCena
  readonly nome: string
}

/** Na janela, pelo que a mesa contou; na tela de dentro da principal, pelas lojas do editor. */
export function useCenaAbertaNaMesa(): CenaAberta | null {
  const ligada = useMesaNaJanela((estado) => estado.ligada)
  const estado = useMesaNaJanela((mesa) => mesa.estado)
  const naMemoria = useMapaNaMemoria()
  const activeSceneId = useAdventureStore((aventura) => aventura.activeSceneId)
  const adventure = useAdventureStore((aventura) => aventura.adventure)
  if (ligada) {
    const mapa = estado?.mapa ?? null
    if (mapa === null || mapa.chave === null) return null
    const cena = estado?.cena ?? null
    return { alvo: { chave: mapa.chave, sceneId: cena?.id ?? '' }, nome: cena === null ? mapa.nome : `${mapa.nome} › ${cena.nome}` }
  }
  if (naMemoria === null) return null
  const cena = adventure === null ? undefined : adventure.scenes.find((uma) => uma.id === activeSceneId)
  if (adventure !== null && cena === undefined) return null
  return { alvo: { chave: naMemoria.chave, sceneId: cena?.id ?? '' }, nome: cena === undefined ? naMemoria.nome : `${naMemoria.nome} › ${cena.name}` }
}

/** O mesmo lugar: mesmo mapa e mesma cena (o pino não conta). */
export function mesmaCena(a: LigaCena, b: LigaCena): boolean {
  return a.chave === b.chave && a.sceneId === b.sceneId
}

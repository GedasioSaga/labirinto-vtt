import { create } from 'zustand'
import type { LigaCena } from '../../lib/preparo/tipos'
import { useAdventureStore } from '../../stores/adventureStore'
import { usePreludio } from '../estado/preludio'
import { useMapaNaMemoria } from '../mesa/catalogo'
import type { FioDoPreludio } from './fioDaJanela'
import type { AndamentoDoPor, EstadoDaMesa, ItemNaMesa, SecaoParaOMapa, TipoParaOMapa } from './protocolo'

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
  /** "Na mesa" (P3): os pinos ligados do mapa aberto na principal. */
  naMesa: readonly ItemNaMesa[]
  /** O "Pôr no mapa" em curso: pedido à mesa, ou esperando o clique do mestre. */
  pondo: PorNoMapaEmCurso | null
  /** Por que o último "Pôr no mapa" não aconteceu; `null` = nada a dizer. */
  avisoDoPor: string | null
}

export interface PorNoMapaEmCurso {
  readonly pedido: number
  readonly fonte: SecaoParaOMapa
  readonly kind: TipoParaOMapa
  /** `pedindo` = a mesa ainda confere a seção; `esperando` = a ferramenta Pino está na mão lá. */
  readonly andamento: 'pedindo' | 'esperando'
}

export const useMesaNaJanela = create<EstadoDaMesaNaJanela>()(() => ({
  ligada: false,
  viva: false,
  estado: null,
  naMesa: [],
  pondo: null,
  avisoDoPor: null,
}))

let fio: FioDoPreludio | null = null

/** Só a janela do Prelúdio liga (e desliga ao sair). */
export function definirFioDaMesa(novo: FioDoPreludio | null): void {
  fio = novo
  if (novo === null) useMesaNaJanela.setState({ ligada: false, viva: false, estado: null, naMesa: [], pondo: null, avisoDoPor: null })
}

const NAO_GRAVOU = 'O Prelúdio ainda não gravou esta seção. Tente de novo em instantes.'

/**
 * "PÔR NO MAPA" (P3): grava o que falta (a mesa lê a seção do disco) e pede à
 * mesa que espere o clique do mestre. Seção de segredo nem chega a pedir: o
 * botão fica desligado, e a mesa confere de novo do lado dela.
 */
export async function porNoMapa(fonte: SecaoParaOMapa, kind: TipoParaOMapa): Promise<void> {
  if (fio === null) return
  const anterior = useMesaNaJanela.getState().pondo
  if (anterior !== null) fio.cancelarPor(anterior.pedido)
  useMesaNaJanela.setState({ pondo: null, avisoDoPor: null })
  const gravou = await usePreludio.getState().salvarPendentes()
  if (fio === null) return
  if (!gravou) {
    useMesaNaJanela.setState({ avisoDoPor: NAO_GRAVOU })
    return
  }
  const pedido = fio.porNoMapa(fonte, kind)
  useMesaNaJanela.setState({ pondo: { pedido, fonte, kind, andamento: 'pedindo' } })
}

export function cancelarPorNoMapa(): void {
  const pondo = useMesaNaJanela.getState().pondo
  if (pondo === null) return
  fio?.cancelarPor(pondo.pedido)
  useMesaNaJanela.setState({ pondo: null })
}

/** O recado `pondo` da mesa. Pedido velho (outro "Pôr no mapa" já começou) não mexe em nada. */
export function aoPondo(pedido: number, andamento: AndamentoDoPor, motivo: string | null): void {
  const atual = useMesaNaJanela.getState().pondo
  if (atual === null || atual.pedido !== pedido) return
  if (andamento === 'esperando') useMesaNaJanela.setState({ pondo: { ...atual, andamento: 'esperando' } })
  else useMesaNaJanela.setState({ pondo: null, avisoDoPor: andamento === 'recusado' ? (motivo ?? 'A mesa não pôs esta seção no mapa.') : null })
}

/** "Mostrar no mapa": a mesa abre a cena e seleciona o pino, pela porta dos links do roteiro. */
export function mostrarNoMapa(item: ItemNaMesa): void {
  fio?.irAMesa({ chave: item.chave, sceneId: item.sceneId, pinoId: item.pinoId })
}

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

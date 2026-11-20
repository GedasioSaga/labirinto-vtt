import type { DocumentoNoMapa } from '../documentos/tipos'
import type { MapData } from '../types/map'
import type { Corner } from '../lib/objectTransform'
import type { Point } from './world'
import { pontoDoDesafio } from '../lib/desafios'
import { documentosDoMapa, papelComTamanho, papelMovido, tamanhoDoPapel } from '../documentos/noMapa'
import { findBoxCornerHandleAt } from '../lib/handleHitArea'
import { useMapStore } from '../stores/mapStore'
import { caixaDoPapel, tamanhoPeloCantoDoPapel } from './drawDocumentos'

/**
 * Gesto do PAPEL NO CHÃO no editor do mestre (pedido de 20/11/2026: "não
 * consigo mover o documento nem mudar o tamanho dele"), sem Pixi: o
 * PixiCanvas repassa os eventos do stage, no molde de `carimboAlcaGesture.ts`.
 *
 * - CORPO: o pointerdown só segura. Soltar dentro da folga é o TOQUE, que abre
 *   a ficha (quem chama abre); passar da folga é ARRASTO, que leva o papel e
 *   não abre nada. Cada quadro grava sem histórico (`mudarPapelNoMapaLive`) e
 *   o arrasto inteiro vira UM Ctrl+Z (`commitDragHistory(antes)`).
 * - CANTO: o chip do papel escolhido muda o `tamanho`, a partir do meio.
 *
 * Esc no meio (`cancelar`) devolve o papel como estava e não grava nada.
 */

type PapelStore = Pick<typeof useMapStore, 'getState'>

interface Aperto {
  id: string
  docId: string
  inicial: DocumentoNoMapa
  /** Do ponto pego ao meio do papel: ele não salta para debaixo do ponteiro. */
  pegada: Point
  /** Onde o botão desceu, em px de TELA: a folga do toque se mede aqui. */
  tela: Point
  moveu: boolean
  /** O mapa do pointerdown — o que o Ctrl+Z devolve. */
  antes: MapData
}

interface Alca {
  id: string
  inicial: DocumentoNoMapa
  centro: Point
  antes: MapData
}

export type SoltarDoPapel = { tipo: 'toque'; docId: string } | { tipo: 'arrasto' }

function papelPorId(map: MapData, id: string): DocumentoNoMapa | undefined {
  return documentosDoMapa(map).find((papel) => papel.id === id)
}

/** Foi e voltou ao mesmo lugar e tamanho: um Ctrl+Z que "não faz nada" é pior que nenhum. */
function mudou(antes: DocumentoNoMapa, depois: DocumentoNoMapa | undefined): boolean {
  return depois !== undefined && JSON.stringify(antes) !== JSON.stringify(depois)
}

export function createPapelNoMapaGesture(folgaDoToquePx: number, store: PapelStore = useMapStore) {
  let aperto: Aperto | null = null
  let alca: Alca | null = null

  const fechar = (antes: MapData, id: string, inicial: DocumentoNoMapa) => {
    if (mudou(inicial, papelPorId(store.getState().map, id))) store.getState().commitDragHistory(antes)
  }

  return {
    /** Pointerdown no corpo do papel `id`: segura, e ainda não move (pode ser o toque que abre a ficha). */
    apertar(id: string, ponto: Point, tela: Point): boolean {
      const map = store.getState().map
      const papel = papelPorId(map, id)
      const centro = papel === undefined ? null : pontoDoDesafio(papel, map.props)
      if (papel === undefined || centro === null) return false
      aperto = { id, docId: papel.docId, inicial: papel, pegada: { x: centro.x - ponto.x, y: centro.y - ponto.y }, tela, moveu: false, antes: map }
      return true
    },

    /** Pointermove com o papel seguro: dentro da folga ainda é toque; passou dela, o papel segue o ponteiro no piso `piso`. */
    mover(ponto: Point, tela: Point, piso: number): boolean {
      if (aperto === null) return false
      if (!aperto.moveu) {
        if (Math.hypot(tela.x - aperto.tela.x, tela.y - aperto.tela.y) < folgaDoToquePx) return true
        aperto.moveu = true
      }
      const { id, pegada } = aperto
      store.getState().mudarPapelNoMapaLive(id, (papel) => papelMovido(papel, ponto.x + pegada.x, ponto.y + pegada.y, piso))
      return true
    },

    /** Pointerup: o toque devolve o documento (quem chama abre a ficha); o arrasto vira um Ctrl+Z só. */
    soltar(): SoltarDoPapel | null {
      if (aperto === null) return null
      const { id, docId, inicial, moveu, antes } = aperto
      aperto = null
      if (!moveu) return { tipo: 'toque', docId }
      fechar(antes, id, inicial)
      return { tipo: 'arrasto' }
    },

    /** Pointerdown com o papel `id` escolhido: começa o arrasto do tamanho se o ponto cai num chip de canto. */
    comecarAlca(id: string, ponto: Point, grid: number, cameraScale: number): Corner | null {
      const map = store.getState().map
      const papel = papelPorId(map, id)
      const centro = papel === undefined ? null : pontoDoDesafio(papel, map.props)
      if (papel === undefined || centro === null) return null
      const canto = findBoxCornerHandleAt(caixaDoPapel({ x: centro.x, y: centro.y, tamanho: tamanhoDoPapel(papel) }, grid), ponto, cameraScale)
      if (canto === null) return null
      alca = { id, inicial: papel, centro: { x: centro.x, y: centro.y }, antes: map }
      return canto
    },

    /** Pointermove do chip: o canto vai até o ponteiro. Devolve a etiqueta junto ao ponteiro ("150%", a régua do "Tamanho" da ficha). */
    moverAlca(ponto: Point, grid: number): string | null {
      if (alca === null) return null
      const tamanho = tamanhoPeloCantoDoPapel(alca.centro, ponto, grid)
      store.getState().mudarPapelNoMapaLive(alca.id, (papel) => papelComTamanho(papel, tamanho))
      return `${Math.round(tamanho * 100)}%`
    },

    /** Pointerup do chip: um Ctrl+Z só; clique no chip sem mudar nada não vira passo. */
    soltarAlca(): boolean {
      if (alca === null) return false
      const { id, inicial, antes } = alca
      alca = null
      fechar(antes, id, inicial)
      return true
    },

    /** Esc no meio do gesto: o papel volta como estava e nada vai para o histórico. */
    cancelar(): boolean {
      const emCurso = aperto ?? alca
      aperto = null
      alca = null
      if (emCurso === null) return false
      const { inicial } = emCurso
      store.getState().mudarPapelNoMapaLive(inicial.id, () => inicial)
      return true
    },
  }
}

import type { MapData, Stair } from '../types/map'
import type { Point } from './world'
import { useMapStore } from '../stores/mapStore'
import { canInteractInLayer, stairLayer } from '../lib/layers'
import { findStairHandleAt } from '../lib/handleHitArea'
import { dragStairHandle, type StairHandleKind } from '../lib/stairHandles'

/**
 * Gesto das ALÇAS DA ESCADA (pedido de 10/10/2026), sem Pixi: o PixiCanvas
 * repassa os eventos do stage — mesmo molde de `roomRotateGesture.ts` — e a
 * conta fica em `lib/stairHandles.ts`, onde dá para testar sem navegador.
 *
 * Cada quadro parte da escada do COMEÇO do gesto (o erro não acumula) e grava
 * o desenho no mapa sem histórico (`setStairGeometryLive`); o arrasto inteiro
 * vira UM Ctrl+Z: `finish` fecha com `commitDragHistory(antes)`. Esc no meio
 * (`cancel`) devolve a escada como estava e não grava nada.
 */

type StairHandleStore = Pick<typeof useMapStore, 'getState'>

interface Arrasto {
  stairId: string
  handle: StairHandleKind
  /** O mapa do pointerdown — o que o Ctrl+Z devolve. */
  antes: MapData
  /** A escada do pointerdown: cada quadro parte dela. */
  inicial: Stair
  /** A escada como está agora no mapa. */
  atual: Stair
}

export interface StairHandleFeedback {
  stair: Stair
  handle: StairHandleKind
}

export function createStairHandleGesture(store: StairHandleStore = useMapStore) {
  let arrasto: Arrasto | null = null

  const gravar = (id: string, stair: Stair): void => {
    store.getState().setStairGeometryLive(id, { segments: stair.segments, stepWidth: stair.stepWidth, curva: stair.curva })
  }

  return {
    /**
     * Pointerdown com a escada `stairId` selecionada: começa o arrasto se o
     * ponto cai numa alça. Escada travada, ou na camada travada, não tem alça.
     */
    begin(stairId: string, ponto: Point, cameraScale: number): boolean {
      const map = store.getState().map
      const stair = map.stairs.find((s) => s.id === stairId)
      if (stair === undefined || !canInteractInLayer(stair, stairLayer(stair), map.lockedLayers)) return false
      const handle = findStairHandleAt(stair, ponto, cameraScale)
      if (handle === null) return false
      arrasto = { stairId, handle, antes: map, inicial: stair, atual: stair }
      return true
    },

    /** Pointermove: a alça vai até o ponteiro. `snap` = grade ligada para este quadro (Alt já invertido). */
    move(ponto: Point, snap: boolean): StairHandleFeedback | null {
      if (!arrasto) return null
      const grid = store.getState().map.grid
      const next = dragStairHandle({ stair: arrasto.inicial, handle: arrasto.handle, pointer: ponto, grid, snap })
      if (next !== arrasto.atual) gravar(arrasto.stairId, next)
      arrasto.atual = next
      return { stair: next, handle: arrasto.handle }
    },

    /** Pointerup (e pointerupoutside): o arrasto vira um Ctrl+Z só. Clique sem mudar nada não vira passo. */
    finish(): boolean {
      if (!arrasto) return false
      const { antes, inicial, atual } = arrasto
      arrasto = null
      if (atual !== inicial) store.getState().commitDragHistory(antes)
      return true
    },

    /** Esc no meio do arrasto: a escada volta como estava e nada vai para o histórico. */
    cancel(): boolean {
      if (!arrasto) return false
      const { stairId, inicial, atual } = arrasto
      arrasto = null
      if (atual !== inicial) gravar(stairId, inicial)
      return true
    },

    isActive(): boolean {
      return arrasto !== null
    },
  }
}

export type StairHandleGesture = ReturnType<typeof createStairHandleGesture>

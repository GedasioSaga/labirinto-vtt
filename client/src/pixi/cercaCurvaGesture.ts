import type { MapData, Prop } from '../types/map'
import type { Point } from './world'
import { useMapStore } from '../stores/mapStore'
import { canInteractInLayer, propLayer } from '../lib/layers'
import { isOnFenceCurveHandle, screenToWorldTolerance } from '../lib/handleHitArea'
import { arrastarCurvaDaCerca, ENCAIXE_DA_RETA_PX_DE_TELA } from '../lib/cercaCurva'

/**
 * Gesto da ALÇA DE CURVAR A CERCA (pedido de 13/10/2026), sem Pixi: o
 * PixiCanvas repassa os eventos do stage — mesmo molde de
 * `stairHandleGesture.ts` — e a conta fica em `lib/cercaCurva.ts`.
 *
 * Cada quadro parte da cerca do COMEÇO do gesto (o erro não acumula) e grava a
 * volta no mapa sem histórico (`setCurvaDaCercaLive`); o arrasto inteiro vira
 * UM Ctrl+Z: `finish` fecha com `commitDragHistory(antes)`. Esc no meio
 * (`cancel`) devolve a cerca como estava e não grava nada.
 */

type CercaCurvaStore = Pick<typeof useMapStore, 'getState'>

interface Arrasto {
  propId: string
  /** O mapa do pointerdown — o que o Ctrl+Z devolve. */
  antes: MapData
  /** A cerca do pointerdown: cada quadro parte dela. */
  inicial: Prop
  /** Quanto o ponteiro pode ficar da corda e a cerca endireitar, em px de mundo no zoom do pointerdown. */
  encaixeDaReta: number
  /** A cerca como está agora no mapa. */
  atual: Prop
}

export function createCercaCurvaGesture(store: CercaCurvaStore = useMapStore) {
  let arrasto: Arrasto | null = null

  const gravar = (id: string, prop: Prop): void => {
    store.getState().setCurvaDaCercaLive(id, prop.mobiliaCurva)
  }

  return {
    /**
     * Pointerdown com o objeto `propId` selecionado: começa o arrasto se ele é
     * uma cerca e o ponto cai na alça do meio do fio. Cerca travada, ou na
     * camada travada, não tem alça.
     */
    begin(propId: string, ponto: Point, cameraScale: number): boolean {
      const map = store.getState().map
      const prop = map.props.find((p) => p.id === propId)
      if (prop === undefined || prop.mobilia !== 'cerca' || !canInteractInLayer(prop, propLayer(prop), map.lockedLayers)) return false
      if (!isOnFenceCurveHandle(prop, ponto, cameraScale)) return false
      arrasto = { propId, antes: map, inicial: prop, encaixeDaReta: screenToWorldTolerance(ENCAIXE_DA_RETA_PX_DE_TELA, cameraScale), atual: prop }
      return true
    },

    /** Pointermove: a alça vai até o ponteiro. `snap` = grade ligada para este quadro (Alt já invertido). Devolve a cerca de agora, para o rótulo. */
    move(ponto: Point, snap: boolean): Prop | null {
      if (!arrasto) return null
      const next = arrastarCurvaDaCerca({ prop: arrasto.inicial, pointer: ponto, snap, encaixeDaReta: arrasto.encaixeDaReta })
      if (next !== arrasto.atual) gravar(arrasto.propId, next)
      arrasto.atual = next
      return next
    },

    /** Pointerup (e pointerupoutside): o arrasto vira um Ctrl+Z só. Clique sem mudar nada não vira passo. */
    finish(): boolean {
      if (!arrasto) return false
      const { antes, inicial, atual } = arrasto
      arrasto = null
      if (atual !== inicial) store.getState().commitDragHistory(antes)
      return true
    },

    /** Esc no meio do arrasto: a cerca volta como estava e nada vai para o histórico. */
    cancel(): boolean {
      if (!arrasto) return false
      const { propId, inicial, atual } = arrasto
      arrasto = null
      if (atual !== inicial) gravar(propId, inicial)
      return true
    },

    isActive(): boolean {
      return arrasto !== null
    },
  }
}

export type CercaCurvaGesture = ReturnType<typeof createCercaCurvaGesture>

import type { MapData, Wall } from '../types/map'
import type { Point } from './world'
import { useMapStore } from '../stores/mapStore'
import { canInteract } from '../lib/itemTransform'
import { canInteractInLayer, wallLayer } from '../lib/layers'
import { findDoorEndHandleAt } from '../lib/handleHitArea'

/**
 * Gesto da ALÇA DE PONTA DA PORTA (pedido de 12/11/2026: "uma vez que eu coloco
 * uma porta eu não consigo tirar ou expandir"), sem Pixi: o PixiCanvas repassa
 * os eventos do stage — mesmo molde de `cercaCurvaGesture.ts` — e a conta fica
 * em `lib/mapFactory.ts` (`resizeDoorEnd`).
 *
 * A ponta pega anda ao longo da parede e a outra fica parada; cada quadro grava
 * no mapa sem histórico (`resizeDoorEndLive`), e o arrasto inteiro vira UM
 * Ctrl+Z: `finish` fecha com `commitDragHistory(antes)`. Esc no meio
 * (`cancel`) devolve as paredes de antes e não grava nada.
 */

type DoorEndStore = Pick<typeof useMapStore, 'getState'>

interface Arrasto {
  wallId: string
  ponta: 0 | 1
  /** O mapa do pointerdown — o que o Ctrl+Z e o Esc devolvem. */
  antes: MapData
}

/** Parede em pé ou deitada: o encaixe é o da grade do mapa, como nas outras alças. */
function paredeReta(wall: Wall): boolean {
  return wall.x1 === wall.x2 || wall.y1 === wall.y2
}

export function createDoorEndGesture(store: DoorEndStore = useMapStore) {
  let arrasto: Arrasto | null = null

  return {
    /**
     * Pointerdown com a porta `wallId` selecionada: começa o arrasto se o ponto
     * cai no chip de uma das pontas. Porta travada, ou na camada travada, não
     * tem alça.
     */
    begin(wallId: string, ponto: Point, cameraScale: number): boolean {
      const map = store.getState().map
      const wall = map.walls.find((w) => w.id === wallId)
      if (wall === undefined || wall.door === null || !canInteract(wall) || !canInteractInLayer(wall, wallLayer(wall), map.lockedLayers)) return false
      const ponta = findDoorEndHandleAt(wall, ponto, cameraScale)
      if (ponta === null) return false
      arrasto = { wallId, ponta, antes: map }
      return true
    },

    /**
     * Pointermove: a ponta vai até o ponteiro, ao longo da parede. `grade`: o
     * lado da casa com o encaixe ligado neste quadro (Alt já invertido), ou
     * `null` livre. Na parede reta a ponta cai na linha da grade; na inclinada,
     * a largura anda em casas inteiras a partir da ponta parada.
     */
    move(ponto: Point, grade: number | null): void {
      if (!arrasto) return
      const { map, resizeDoorEndLive } = store.getState()
      const wall = map.walls.find((w) => w.id === arrasto?.wallId)
      if (wall === undefined) return
      if (grade === null || !(grade > 0)) {
        resizeDoorEndLive(arrasto.wallId, arrasto.ponta, ponto.x, ponto.y)
      } else if (paredeReta(wall)) {
        resizeDoorEndLive(arrasto.wallId, arrasto.ponta, Math.round(ponto.x / grade) * grade, Math.round(ponto.y / grade) * grade)
      } else {
        resizeDoorEndLive(arrasto.wallId, arrasto.ponta, ponto.x, ponto.y, grade)
      }
    },

    /** Pointerup (e pointerupoutside): o arrasto vira um Ctrl+Z só. Clique sem mudar nada não vira passo. */
    finish(): boolean {
      if (!arrasto) return false
      const { antes } = arrasto
      arrasto = null
      if (store.getState().map.walls !== antes.walls) store.getState().commitDragHistory(antes)
      return true
    },

    /** Esc no meio do arrasto: as paredes voltam como estavam e nada vai para o histórico. */
    cancel(): boolean {
      if (!arrasto) return false
      const { antes } = arrasto
      arrasto = null
      store.getState().restoreWallsLive(antes)
      return true
    },

    isActive(): boolean {
      return arrasto !== null
    },
  }
}

export type DoorEndGesture = ReturnType<typeof createDoorEndGesture>

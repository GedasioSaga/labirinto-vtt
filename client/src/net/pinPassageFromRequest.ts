import * as mapFactory from '../lib/mapFactory'
import { isExitPassage, setExitPassage, type ExitPassagePatch } from '../lib/pinTravel'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import type { Pin, PinPassage } from '../types/map'

/**
 * O que muda no pino: sem `exitId`, o modo do pino (a principal); com ele,
 * só aquela saída extra (`setExitPassage`). Pino que sumiu, modo que uma
 * saída não pode ter, ou saída que não é deste pino: nada muda.
 */
function passagePatch(pin: Pin | undefined, passagem: PinPassage, exitId: string | undefined): ExitPassagePatch {
  if (exitId === undefined) return { passagem }
  if (pin === undefined || !isExitPassage(passagem)) return {}
  return setExitPassage(pin, exitId, passagem)
}

/**
 * "Passar para pede" do pedido pelo pino (ou saída) trancado: o pino muda de
 * modo na cena dele (de fundo quando o jogador estava lá), como o painel
 * faria — é passo do Ctrl+Z do mestre. MODO POR SAÍDA: com `exitId`, só
 * aquela saída extra passa a pedir; o modo do pino fica.
 */
export function setPinPassageFromRequest(pinId: string, passagem: PinPassage, sceneId?: string, exitId?: string): void {
  if (sceneId !== undefined) {
    useAdventureStore.getState().updateBackgroundScene(sceneId, (map) =>
      mapFactory.updatePin(map, pinId, passagePatch(map.pins.find((p) => p.id === pinId), passagem, exitId)),
    )
    return
  }
  useMapStore.getState().updatePin(pinId, passagePatch(useMapStore.getState().map.pins.find((p) => p.id === pinId), passagem, exitId))
}

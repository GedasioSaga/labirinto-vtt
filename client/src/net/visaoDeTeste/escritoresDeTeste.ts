import { applyItemChange } from '../../lib/items'
import type { HostBridgeDeps } from '../hostBridge'
import type { HostWorld } from '../hostSession'
import { createPlayerChanges } from '../playerChanges'
import { destinoDaCamada, type CamadaDeTeste } from './camadaDeTeste'

/**
 * VISÃO DE JOGADOR — os escritores da ponte de teste. São TODOS os retornos
 * com que a ponte grava o que o jogador fez, cada um gravando na camada de
 * teste (`camadaDeTeste.ts`) e nunca nas stores do editor.
 *
 * O tipo é a lista fechada: `Required` faz faltar um deles virar erro de
 * compilação. Sem um escritor opcional, a ponte RECUA para outro (a caravana
 * sem `applyCaravanMoves` cai em `applyMove`, o salto do veículo sem
 * `applyVehicleHop` também): por isso cada um vem aqui, explícito, e não por
 * acaso do recuo.
 *
 * O que fica de fora de propósito nesta entrega (a ponte de teste não recebe,
 * e a própria ponte recusa ao jogador): passar para outra cena
 * (`applyTransfer`), o "Destrancar e abrir" do mestre (`unlockAndOpenDoor`),
 * esconder-se (`hideToken`), "Passar para pede" (`setPinPassage`) e a cabine
 * de transporte (`applyCabine`, `applyChamadaDeCabine`).
 */
export type EscritoresDeTeste = Required<
  Pick<
    HostBridgeDeps,
    | 'applyMove'
    | 'applyVehicleHop'
    | 'applyCaravanMoves'
    | 'applyDoor'
    | 'applyItems'
    | 'applyTokenEdit'
    | 'applyLock'
    | 'applyMark'
    | 'removeMark'
    | 'applyPiso'
    | 'applyVehicle'
  >
>

/** `mundoBase`: o mundo vivo do editor, sem a camada. */
export function criarEscritoresDeTeste(camada: CamadaDeTeste, mundoBase: () => HostWorld): EscritoresDeTeste {
  const destino = destinoDaCamada(camada, mundoBase)
  const mudancas = createPlayerChanges(destino)
  return {
    ...mudancas,
    // CARAVANA: cada seguidor anda como um passo dele, na cena do mapa-mundi onde está.
    applyCaravanMoves: (moves) => {
      for (const { tokenId, x, y, sceneId } of moves) mudancas.applyMove(tokenId, x, y, sceneId)
    },
    // ITEM PEGÁVEL: o pino sai e as mochilas mudam só no teste (a mesma conta do jogo de verdade).
    applyItems: (change) => destino.aplicar(change.sceneId, (map) => applyItemChange(map, change)),
  }
}

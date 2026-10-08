import { applyItemChange } from '../../lib/items'
import * as mapFactory from '../../lib/mapFactory'
import { chegadaDaTravessia, planoDaTravessia, saidaDaTravessia, type NovoId, type SceneHistory } from '../../lib/travessiaDaFicha'
import type { MapData } from '../../types/map'
import type { HostBridgeDeps } from '../hostBridge'
import type { HostScene, HostWorld } from '../hostSession'
import { comPassagemDoPino } from '../pinPassageFromRequest'
import { createPlayerChanges, type MapTransform } from '../playerChanges'
import { destinoDaCamada, type CamadaDeTeste } from './camadaDeTeste'

/**
 * VISÃO DE JOGADOR — os escritores da ponte de teste. São TODOS os retornos
 * com que a ponte grava o que o jogador fez e o que o mestre respondeu aos
 * pedidos do teste, cada um gravando na camada de teste (`camadaDeTeste.ts`) e
 * nunca nas stores do editor.
 *
 * O tipo é a lista fechada: `Required` faz faltar um deles virar erro de
 * compilação. Sem um escritor opcional, a ponte RECUA para outro (a caravana
 * sem `applyCaravanMoves` cai em `applyMove`, o salto do veículo sem
 * `applyVehicleHop` também) ou recusa o pedido ao jogador (passagem, porta
 * trancada, esconder-se): por isso cada um vem aqui, explícito, e não por
 * acaso do recuo.
 *
 * O que fica de fora de propósito (a ponte de teste não recebe, e a própria
 * ponte recusa ao jogador): a cabine de transporte (`applyCabine`,
 * `applyChamadaDeCabine`).
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
    | 'applyTransfer'
    | 'unlockAndOpenDoor'
    | 'hideToken'
    | 'setPinPassage'
    | 'applyPersonagem'
  >
>

/**
 * Id novo do teste para quem chega e já tem id ocupado no destino (cena
 * copiada): o MESMO a cada leitura, porque a camada reaplica a travessia toda
 * vez que a ponte lê o mundo. O sorteio do jogo de verdade daria à ficha que
 * já estava lá um id diferente a cada snapshot.
 */
const idDoTeste: NovoId = (idAntigo) => `${idAntigo}~teste`

/** A travessia sobre um mapa só: a camada não tem desfazer. */
const semDesfazer = (map: MapData): SceneHistory => ({ map, past: [], future: [] })

/** A cena `sceneId` do mundo; `null` = fora do mundo servido (saiu do cache, foi apagada). */
function cenaDoMundo(mundo: HostWorld, sceneId: string): HostScene | null {
  return [mundo.open, ...mundo.background].find((cena) => cena.sceneId === sceneId) ?? null
}

/** "Destrancar e abrir" do mestre (e a chave da mochila): o cadeado sai e a porta abre. */
function destrancarEAbrir(wallId: string): MapTransform {
  return (map) => {
    const door = map.walls.find((w) => w.id === wallId)?.door
    if (door === undefined || door === null || (door.open && !door.locked)) return map
    return mapFactory.setWallDoor(map, wallId, { ...door, open: true, locked: false })
  }
}

/** "Deixar" do pedido de esconder-se: liga "Oculto para jogadores" na ficha. */
function esconder(tokenId: string): MapTransform {
  return (map) => mapFactory.setItemSecret(map, 'token', tokenId, true)
}

/** `mundoBase`: o mundo vivo do editor, sem a camada. */
export function criarEscritoresDeTeste(camada: CamadaDeTeste, mundoBase: () => HostWorld): EscritoresDeTeste {
  const destino = destinoDaCamada(camada, mundoBase)
  const mudancas = createPlayerChanges(destino)
  return {
    // FICHA DE PERSONAGEM (`applyPersonagem`) vem daqui também: o personagem e a ligação ficam na camada.
    ...mudancas,
    // CARAVANA: cada seguidor anda como um passo dele, na cena do mapa-mundi onde está.
    applyCaravanMoves: (moves) => {
      for (const { tokenId, x, y, sceneId } of moves) mudancas.applyMove(tokenId, x, y, sceneId)
    },
    // ITEM PEGÁVEL: o pino sai e as mochilas mudam só no teste (a mesma conta do jogo de verdade).
    applyItems: (change) => destino.aplicar(change.sceneId, (map) => applyItemChange(map, change)),
    /*
     * "Deixar ir" e passagem livre: a ficha troca de cena SÓ no teste, pela
     * mesma conta da travessia de verdade (`lib/travessiaDaFicha.ts`). Quem
     * chega onde é decidido AGORA, no mundo como o teste o vê; a camada guarda
     * os dois lados, cada um na cena dele (sai da origem, chega no destino), e
     * a ficha fica no destino como chegou, como no jogo de verdade, mesmo que
     * o mestre mexa nela depois na origem. Sem diário, sem som de passagem e
     * sem a troca de id fora do mapa (iniciativa, seleção do editor): isso é
     * da mesa de verdade.
     */
    applyTransfer: ({ tokenId, fromSceneId, toSceneId, x, y, piso, hold }) => {
      if (fromSceneId === toSceneId) return false
      const mundo = camada.aplicarNoMundo(mundoBase())
      const origem = cenaDoMundo(mundo, fromSceneId)
      const chegada = cenaDoMundo(mundo, toSceneId)
      if (origem === null || chegada === null) return false
      const plano = planoDaTravessia(origem.map, chegada.map, { tokenId, x, y, piso, hold })
      if (plano === null) return false
      camada.registrar(origem.map.id, (map) => saidaDaTravessia(semDesfazer(map), plano).map)
      camada.registrar(chegada.map.id, (map) => chegadaDaTravessia(semDesfazer(map), plano, idDoTeste).history.map)
      return true
    },
    // As respostas do mestre aos pedidos do teste: mudam só a camada, na cena do pedido.
    unlockAndOpenDoor: (wallId, sceneId) => destino.aplicar(sceneId, destrancarEAbrir(wallId)),
    hideToken: (tokenId, sceneId) => destino.aplicar(sceneId, esconder(tokenId)),
    setPinPassage: (pinId, passagem, sceneId, exitId) => destino.aplicar(sceneId, (map) => comPassagemDoPino(map, pinId, passagem, exitId)),
  }
}

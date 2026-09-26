import { imposedMovement } from '../lib/conveyors'
import type { OwnerVisionRadii } from '../lib/imposedOccupancy'
import { levarFichaPara } from './levarFicha'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/**
 * UM AVANÇAR do movimento imposto, de ponta a ponta no lado do mestre — o
 * botão "Avançar esteiras" e o "Próximo apito" da Agenda chamam o mesmo.
 *
 * 1. Esteiras e cabines DESTA cena (`useMapStore.advanceConveyors`, um passo
 *    do Ctrl+Z do mestre).
 * 2. Cabines ao PAR (`lib/cabins.ts`): quem ficou parado no pino de viagem com
 *    cabine troca de cena. A ficha de jogador vai pelo "Mandar para…" da
 *    sessão (só ele avisa o jogador, e o jogador recebe só `scene.changed`); a
 *    ficha sem dono, pelo "Levar para…" (`levarFichaPara`). Os dois ficam fora
 *    do desfazer, como toda travessia.
 *
 * Quem vai ao par é decidido ANTES do passo 1, com o chão de antes: o
 * Avançar conta onde cada ficha estava quando o mestre apertou.
 */

/** Como a cabine alcança a sessão do host. */
export interface CabinPassengers {
  /** O jogador dono da ficha na sala; `null` = ficha sem dono (NPC) ou sala fechada. */
  ownerOf(tokenId: string): string | null
  /** "Mandar para…" com a ficha exata (`hostBridge.sendPlayer`). `false` = não levou. */
  sendPlayer(playerId: string, sceneId: string, pinId: string, tokenId: string): boolean
}

/** O aviso quando a cabine não conseguiu levar alguém ao par (cena fora do ar, par apagado, jogador fora da sala). */
export function cabinFailureText(count: number): string {
  return count === 1 ? 'A cabine não levou 1 ficha ao par: a outra cena não está aberta ou o par sumiu.' : `A cabine não levou ${count} fichas ao par: a outra cena não está aberta ou o par sumiu.`
}

/** O Avançar. Devolve quantas fichas a cabine NÃO conseguiu levar ao par (0 = tudo certo). */
export function avancarMovimentoImposto(radii: OwnerVisionRadii, passengers: CabinPassengers): number {
  const { transfers } = imposedMovement(useMapStore.getState().map, radii)
  useMapStore.getState().advanceConveyors(radii)
  let falhas = 0
  for (const transfer of transfers) {
    const owner = passengers.ownerOf(transfer.tokenId)
    const levou =
      owner === null
        ? levarFichaPara(transfer.tokenId, transfer.sceneId, transfer.pinId)
        : passengers.sendPlayer(owner, transfer.sceneId, transfer.pinId, transfer.tokenId)
    if (!levou) falhas += 1
  }
  if (falhas > 0) useToastStore.getState().push('error', cabinFailureText(falhas))
  return falhas
}

/** O dono de cada ficha pelos jogadores da sala (`PlayerInfo.tokenIds`). */
export function ownerFromPlayers(players: readonly { playerId: string; tokenIds: readonly string[] }[]): (tokenId: string) => string | null {
  return (tokenId) => players.find((player) => player.tokenIds.includes(tokenId))?.playerId ?? null
}

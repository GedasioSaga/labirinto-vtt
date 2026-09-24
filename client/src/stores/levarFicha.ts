import { partyDestinations, type TokenCarryWiring } from '../lib/party'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import { useAdventureStore, type CarriedToken } from './adventureStore'
import { useToastStore } from './toastStore'

/**
 * "LEVAR PARA…" DA FICHA SEM DONO: o gesto inteiro do painel da ficha — a
 * travessia (`adventureStore.carryToken`) e o aviso "Zumbi foi para Térreo",
 * com "Ir lá". O jogador não recebe nada daqui: quem está na cena de destino
 * vê a ficha chegar pelo snapshot de sempre (com a névoa dele), e quem ficou
 * na origem só a vê sumir — nenhum nome de cena sai para a mesa. A ficha de
 * jogador que vai A BORDO (veículo) recebe o `scene.changed` do mestre no
 * broadcast seguinte (`hostSession.broadcast`), antes do mapa novo.
 */

/** O texto do aviso. Ficha sem nome não pode abrir o aviso em branco. */
export function carriedTokenText(carried: CarriedToken): string {
  const name = carried.tokenName.trim()
  return `${name === '' ? 'A ficha' : name} foi para ${carried.sceneName}`
}

/** Leva a ficha e avisa o mestre. `false` = não deu, e nada mudou. */
export function levarFichaPara(tokenId: string, toSceneId: string, pinId: string | null): boolean {
  const carried = useAdventureStore.getState().carryToken(tokenId, toSceneId, pinId)
  if (carried === null) return false
  useToastStore.getState().push('info', carriedTokenText(carried), undefined, {
    actions: [{ label: 'Ir lá', run: () => void useAdventureStore.getState().goToPoint(carried.sceneId, { x: carried.x, y: carried.y }) }],
  })
  return true
}

/**
 * O que o App passa ao painel da ficha (`tokenCarry`): as mesmas cenas e
 * chegadas do "Mandar para…" do Grupo, menos a aberta (onde a ficha já está);
 * as fichas com dono na sala, que trocam de cena pelo "Mandar para…" (só ele
 * avisa o jogador e a sessão); e o gesto de levar.
 */
export function ligacaoLevarFicha(world: HostWorld, players: readonly PlayerInfo[]): TokenCarryWiring {
  const aberta = world.open.sceneId
  return {
    destinations: partyDestinations(world).filter((destination) => destination.sceneId !== aberta),
    ownedTokenIds: new Set(players.flatMap((player) => player.tokenIds)),
    onCarry: levarFichaPara,
  }
}

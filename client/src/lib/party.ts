import type { HostScene, HostWorld, PlayerInfo } from '../net/hostSession'
import type { Token } from '../types/map'
import { pinSummary } from './pins'
import { tokenFillColor } from './tokenColor'

/**
 * O PAINEL GRUPO (aba Jogo): uma linha por jogador, com a cor da ficha, onde
 * ele está e para onde o mestre pode mandá-lo. Lógica pura: lê o que a ponte
 * já sabe (`PlayerInfo`) e o mundo que o host serve (`HostWorld`), nunca a
 * store — o painel e o teste montam o mesmo dado.
 */

/** A ficha pela qual o mestre acha o jogador no mapa. */
export interface PartyToken {
  id: string
  /** `#rrggbb` do disco da ficha: a bolinha da linha é a peça que ele vê no mapa. */
  color: string
  x: number
  y: number
}

export interface PartyMember {
  playerId: string
  name: string
  connected: boolean
  /** Cena da aventura onde ele está; `null` no mapa solto ou sem ficha em cena. */
  sceneId: string | null
  sceneName: string | null
  /** `null` = sem ficha em cena nenhuma: não há onde ir nem o que mandar. */
  token: PartyToken | null
  /** Um pedido de passagem dele espera o mestre agora. */
  travelPending: boolean
}

/** Um ponto de chegada do "Mandar para…": um pino de viagem da cena de destino. */
export interface PartyArrival {
  pinId: string
  label: string
}

/** Uma cena para onde o mestre pode mandar alguém. */
export interface PartyDestination {
  sceneId: string
  name: string
  arrivals: PartyArrival[]
}

/** Nome da chegada que ninguém pode confundir com um pino. */
export const PARTY_CENTER_LABEL = 'Centro da cena'

function allScenes(world: HostWorld): HostScene[] {
  return [world.open, ...world.background]
}

/** `0x3cff00` -> `#3cff00`, a forma que o CSS lê. */
function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * A ficha do jogador NA CENA em que a sessão o vê (a mesma de `sceneName`):
 * com duas fichas em cenas diferentes, é a desta cena que o "Ir lá" procura.
 * Mapa solto: a cena aberta, que é a única.
 */
function tokenOf(player: PlayerInfo, world: HostWorld): Token | null {
  const scene = player.sceneId === undefined ? (world.open.sceneId === null ? world.open : undefined) : allScenes(world).find((s) => s.sceneId === player.sceneId)
  if (scene === undefined) return null
  for (const id of player.tokenIds) {
    const token = scene.map.tokens.find((t) => t.id === id)
    if (token !== undefined) return token
  }
  return null
}

/** As linhas do Grupo, na ordem de chegada que a ponte já dá. */
export function partyMembers(players: PlayerInfo[], world: HostWorld): PartyMember[] {
  return players.map((player) => {
    const token = player.status === 'playing' ? tokenOf(player, world) : null
    return {
      playerId: player.playerId,
      name: player.name,
      connected: player.connected,
      sceneId: player.sceneId ?? null,
      sceneName: player.sceneName ?? null,
      token: token === null ? null : { id: token.id, color: cssColor(tokenFillColor(token)), x: token.x, y: token.y },
      travelPending: player.travelPending === true,
    }
  })
}

/**
 * As cenas do "Mandar para…": só aventura (mapa solto não tem para onde
 * mandar) e só as que abriram — o mundo do host já deixa de fora a cena cujo
 * arquivo falhou. As chegadas são os pinos de VIAGEM de cada uma, com o nome
 * que o mestre lê no painel do pino.
 */
export function partyDestinations(world: HostWorld): PartyDestination[] {
  const destinations: PartyDestination[] = []
  for (const scene of allScenes(world)) {
    if (scene.sceneId === null) continue
    const arrivals = scene.map.pins
      .filter((pin) => pin.kind === 'viagem')
      .map((pin) => {
        const description = pin.description.trim()
        return { pinId: pin.id, label: description === '' ? pinSummary(pin) : description }
      })
    destinations.push({ sceneId: scene.sceneId, name: scene.name, arrivals })
  }
  return destinations
}

/**
 * O "Levar para…" da ficha sem dono, como o painel da ficha o recebe. Mora
 * aqui, junto de `PartyDestination`, para o painel e a store falarem do mesmo
 * dado sem um importar o outro.
 */
export interface TokenCarryWiring {
  /** As cenas que abriram, menos a aberta. */
  destinations: PartyDestination[]
  /** Fichas com dono na sala: essas vão pelo "Mandar para…" do Grupo. */
  ownedTokenIds: ReadonlySet<string>
  onCarry(tokenId: string, sceneId: string, pinId: string | null): boolean
}

/** Status da linha em uma palavra: é o que o mestre lê de relance. */
export function partyPresenceLabel(member: PartyMember): string {
  return member.connected ? 'online' : 'fora'
}

/** Uma bolinha da lista Cenas: quem está na cena, na cor da ficha dele. */
export interface ScenePerson {
  playerId: string
  name: string
  /** `#rrggbb`, a mesma cor da linha do Grupo e do disco no mapa. */
  color: string
}

/** O que a linha de UMA cena da lista Cenas mostra além do nome. */
export interface ScenePeople {
  people: ScenePerson[]
  /** Pedidos de passagem esperando o mestre, feitos por quem está nesta cena. */
  pendingRequests: number
}

/**
 * Quem está em cada cena e quantos pedidos esperam lá, por id de cena. Monta
 * a partir das MESMAS linhas do Grupo (`partyMembers`): uma fonte só, e o
 * mestre nunca lê um jogador numa cena pelo Grupo e em outra pela lista.
 *
 * Só conta quem está CONECTADO: jogador que caiu deixa a ficha no mapa, mas
 * não está à mesa. E só com cena de aventura (`sceneId`): no mapa solto a
 * sessão não dá cena a ninguém, e a lista fica sem bolinha e sem selo.
 * A bolinha pede a ficha na cena (é dela que vem a cor); o pedido não — quem
 * pede já está em cena, e o selo não pode sumir por falta de cor.
 */
export function peopleByScene(members: PartyMember[]): Map<string, ScenePeople> {
  const byScene = new Map<string, ScenePeople>()
  for (const member of members) {
    if (!member.connected || member.sceneId === null) continue
    let entry = byScene.get(member.sceneId)
    if (entry === undefined) {
      entry = { people: [], pendingRequests: 0 }
      byScene.set(member.sceneId, entry)
    }
    if (member.token !== null) entry.people.push({ playerId: member.playerId, name: member.name, color: member.token.color })
    if (member.travelPending) entry.pendingRequests += 1
  }
  return byScene
}

/** "1 pedido" / "3 pedidos": o selo que o mestre lê de relance na linha da cena. */
export function pendingRequestsLabel(count: number): string {
  return count === 1 ? '1 pedido' : `${count} pedidos`
}

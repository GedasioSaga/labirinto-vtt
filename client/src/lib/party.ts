import type { HostScene, HostWorld, PlayerInfo } from '../net/hostSession'
import type { Token } from '../types/map'
import { pinSummary } from './pins'
import { roomsAt } from './roomNesting'
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
  /** Quando a conexão dele caiu (relógio do mestre). Ausente enquanto está online, ou sem esse registro. */
  offlineSince?: number
  /** Cena da aventura onde ele está; `null` no mapa solto ou sem ficha em cena. */
  sceneId: string | null
  sceneName: string | null
  /** `null` = sem ficha em cena nenhuma: não há onde ir nem o que mandar. */
  token: PartyToken | null
  /** Um pedido de passagem dele espera o mestre agora. */
  travelPending: boolean
  /**
   * Fichas dele que ficaram em OUTRA cena (a Faísca esquecida na Vila): o
   * aviso da linha e o "Trazer". Ausente = nenhuma, ou ele não está em cena
   * de aventura. Só o mestre lê: nunca vai pela rede.
   */
  awayTokens?: PartyAwayToken[]
}

/** Uma ficha do jogador que está em outra cena que não a dele. */
export interface PartyAwayToken {
  tokenId: string
  /** O nome da ficha como o mestre deu; pode ser vazio (`awayTokenLabel` cuida). */
  name: string
  sceneId: string
  sceneName: string
}

/** O nome com que o aviso chama a ficha: ficha sem nome não some do aviso. */
export function awayTokenName(name: string): string {
  const trimmed = name.trim()
  return trimmed === '' ? 'Uma ficha' : trimmed
}

/** "Faísca ficou em outra cena": o aviso na linha do dono. */
export function awayTokenLabel(name: string): string {
  return `${awayTokenName(name)} ficou em outra cena`
}

/**
 * As fichas de `player` que estão numa cena da aventura diferente da dele,
 * na ordem em que o mestre as deu. Só com ele jogando numa cena de aventura:
 * no mapa solto e na espera não há "outra cena".
 */
function awayTokensOf(player: PlayerInfo, world: HostWorld): PartyAwayToken[] {
  if (player.status !== 'playing' || player.sceneId === undefined) return []
  const away: PartyAwayToken[] = []
  for (const tokenId of player.tokenIds) {
    for (const scene of allScenes(world)) {
      if (scene.sceneId === null || scene.sceneId === player.sceneId) continue
      const token = scene.map.tokens.find((t) => t.id === tokenId)
      if (token !== undefined) away.push({ tokenId, name: token.name, sceneId: scene.sceneId, sceneName: scene.name })
    }
  }
  return away
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
    const member: PartyMember = {
      playerId: player.playerId,
      name: player.name,
      connected: player.connected,
      sceneId: player.sceneId ?? null,
      sceneName: player.sceneName ?? null,
      token: token === null ? null : { id: token.id, color: cssColor(tokenFillColor(token)), x: token.x, y: token.y },
      travelPending: player.travelPending === true,
    }
    if (!player.connected && player.disconnectedAt !== undefined) member.offlineSince = player.disconnectedAt
    const away = awayTokensOf(player, world)
    if (away.length > 0) member.awayTokens = away
    return member
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

const SECOND_MS = 1_000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS

/**
 * Há quanto tempo, curto: "0:10" no primeiro minuto (o mestre acompanha se
 * a pessoa volta já), depois "2 min" e "1 h" — segundos deixam de importar.
 */
export function offlineForLabel(elapsedMs: number): string {
  const ms = Math.max(0, elapsedMs)
  if (ms < MINUTE_MS) return `0:${String(Math.floor(ms / SECOND_MS)).padStart(2, '0')}`
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)} min`
  return `${Math.floor(ms / HOUR_MS)} h`
}

/**
 * Status da linha em poucas palavras: é o que o mestre lê de relance. Quem
 * caiu diz há quanto tempo ("fora há 0:10"), para o mestre saber se espera ou
 * segue a cena. `now` é o relógio do mestre, o mesmo que marcou a queda.
 */
export function partyPresenceLabel(member: PartyMember, now: number = Date.now()): string {
  if (member.connected) return 'online'
  if (member.offlineSince === undefined) return 'fora'
  return `fora há ${offlineForLabel(now - member.offlineSince)}`
}

/** Uma bolinha da lista Cenas: quem está na cena, na cor da ficha dele. */
export interface ScenePerson {
  playerId: string
  name: string
  /** `#rrggbb`, a mesma cor da linha do Grupo e do disco no mapa. */
  color: string
  /**
   * As Salas onde a ficha dele está, da mais interna para a de fora: os
   * atalhos "Quem está em: <sala>" do recado. Ausente = montado sem o mundo.
   * Só o mestre lê: nunca vai pela rede.
   */
  rooms?: SceneRoom[]
}

/** Uma Sala do mapa da cena, pelo nome que o mestre deu. */
export interface SceneRoom {
  id: string
  name: string
}

/** Sala sem nome ainda vira atalho: o mestre precisa conseguir escolher quem está lá. */
export const UNNAMED_ROOM_LABEL = 'Sala sem nome'

/** As Salas da ficha do membro, no mapa da cena dele. */
function roomsOfMember(member: PartyMember, world: HostWorld): SceneRoom[] {
  const scene = allScenes(world).find((s) => s.sceneId === member.sceneId)
  if (scene === undefined || member.token === null) return []
  return roomsAt(scene.map.regions, member.token).map((region) => {
    // `roomsAt` só devolve Sala; o `?? ''` é para o tipo, que não sabe disso.
    const name = (region.room?.name ?? '').trim()
    return { id: region.id, name: name === '' ? UNNAMED_ROOM_LABEL : name }
  })
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
 *
 * Com `world`, cada bolinha leva as Salas onde a ficha está (`rooms`).
 */
export function peopleByScene(members: PartyMember[], world?: HostWorld): Map<string, ScenePeople> {
  const byScene = new Map<string, ScenePeople>()
  for (const member of members) {
    if (!member.connected || member.sceneId === null) continue
    let entry = byScene.get(member.sceneId)
    if (entry === undefined) {
      entry = { people: [], pendingRequests: 0 }
      byScene.set(member.sceneId, entry)
    }
    if (member.token !== null) {
      const person: ScenePerson = { playerId: member.playerId, name: member.name, color: member.token.color }
      if (world !== undefined) person.rooms = roomsOfMember(member, world)
      entry.people.push(person)
    }
    if (member.travelPending) entry.pendingRequests += 1
  }
  return byScene
}

/** "1 pedido" / "3 pedidos": o selo que o mestre lê de relance na linha da cena. */
export function pendingRequestsLabel(count: number): string {
  return count === 1 ? '1 pedido' : `${count} pedidos`
}

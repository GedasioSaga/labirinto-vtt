import type { AppliedItems, HostScene, HostWorld, PlayerInfo } from '../net/hostSession'
import type { CarriedItem, Pin, Token } from '../types/map'
import { sceneTrail, type SceneEntry } from './adventure'
import { carriedItemsOf, dropItemChange, giveNewItemChange, removeItemChange, type ItemChange } from './items'
import { visibleTokens } from './layers'
import { pinSummary } from './pins'
import { cleanExitLabel, travelDestinationOf } from './pinTravel'
import { roomsAt } from './roomNesting'
import type { DestinationMark } from './signals'
import { tokenFillColor } from './tokenColor'
import { entourageNear } from './travelTogether'

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
  /** O que as fichas dele carregam, em qualquer cena aberta (ITEM PEGÁVEL). */
  mochila: PartyItem[]
  /** MARCA "VAMOS PARA CÁ" dele, em px de mundo da cena `sceneId`. Ausente = não marcou. */
  destination?: { x: number; y: number }
  /**
   * Fichas dele que ficaram em OUTRA cena (a Faísca esquecida na Vila): o
   * aviso da linha e o "Trazer". Ausente = nenhuma, ou ele não está em cena
   * de aventura. Só o mestre lê: nunca vai pela rede.
   */
  awayTokens?: PartyAwayToken[]
  /**
   * MONTARIA E FAMILIAR: as outras fichas dele no tabuleiro, na cena de
   * `token`, a até 2 casas dela (a regra de `entourageNear`). O "Reunir o
   * grupo aqui" as leva junto. Ausente = nenhuma.
   */
  entourageIds?: string[]
  /** VOLTO JÁ: saiu da mesa por um instante, de propósito. Ausente no resto do tempo. */
  away?: true
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

/** Um item da mochila no Grupo: com a ficha e a cena onde ele está, para o mestre agir nele. */
export interface PartyItem extends CarriedItem {
  tokenId: string
  /** Cena da ficha; `null` no mapa solto. */
  sceneId: string | null
}

/** O que o mestre faz com a mochila no Grupo: tirar um item, devolvê-lo ao chão, ou dar um novo. */
export type PartyItemAction = { kind: 'tirar'; item: PartyItem } | { kind: 'devolver'; item: PartyItem } | { kind: 'dar'; member: PartyMember; nome: string }

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
  /**
   * CENAS EM PASTAS: os nomes das cenas de fora, da mais de fora para a mais
   * de dentro — o caminho em cinza da busca. Ausente ou vazio = primeiro
   * nível. Só a lista do mestre lê: nunca vai para o jogador.
   */
  trail?: readonly string[]
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
function tokenOf(player: PlayerInfo, world: HostWorld): { token: Token; scene: HostScene } | null {
  const scene = player.sceneId === undefined ? (world.open.sceneId === null ? world.open : undefined) : allScenes(world).find((s) => s.sceneId === player.sceneId)
  if (scene === undefined) return null
  for (const id of player.tokenIds) {
    const token = scene.map.tokens.find((t) => t.id === id)
    if (token !== undefined) return { token, scene }
  }
  return null
}

/**
 * A mochila do jogador: o que carregam TODAS as fichas dele, em todas as
 * cenas que o host serve — a ficha que ficou noutra cena continua com o que
 * pegou. Cada ficha conta uma vez, mesmo que apareça em duas cenas.
 */
function backpackOf(player: PlayerInfo, world: HostWorld): PartyItem[] {
  const seen = new Set<string>()
  const items: PartyItem[] = []
  for (const scene of allScenes(world)) {
    for (const token of scene.map.tokens) {
      if (!player.tokenIds.includes(token.id) || seen.has(token.id)) continue
      seen.add(token.id)
      items.push(...carriedItemsOf(token).map((item) => ({ ...item, tokenId: token.id, sceneId: scene.sceneId })))
    }
  }
  return items
}

/** A cena de um id do Grupo: `null` é o mapa solto, que só existe como a cena aberta. */
function sceneById(world: HostWorld, sceneId: string | null): HostScene | undefined {
  if (sceneId === null) return world.open.sceneId === null ? world.open : undefined
  return allScenes(world).find((scene) => scene.sceneId === sceneId)
}

/**
 * A mudança que uma ação de mochila do mestre grava, já na cena certa: sem
 * `sceneId` quando é a cena aberta (o editor grava), com ele quando é de
 * fundo. `null` quando não há o que fazer — a ficha saiu da cena, o item já
 * não está com ela, o nome dado é vazio. `freshId`: id para o item novo do
 * "Dar", ou para o pino devolvido quando o id do item já é de outro pino.
 */
export function partyItemChange(world: HostWorld, action: PartyItemAction, freshId: string): AppliedItems | null {
  const sceneId = action.kind === 'dar' ? action.member.sceneId : action.item.sceneId
  const tokenId = action.kind === 'dar' ? action.member.token?.id : action.item.tokenId
  const scene = sceneById(world, sceneId)
  const token = tokenId === undefined ? undefined : scene?.map.tokens.find((t) => t.id === tokenId)
  if (scene === undefined || token === undefined) return null
  let change: ItemChange | null
  if (action.kind === 'dar') change = giveNewItemChange(token, action.nome, freshId)
  else if (action.kind === 'tirar') change = removeItemChange(token, action.item.id)
  else change = dropItemChange(scene.map, token, action.item.id, freshId)
  if (change === null) return null
  return scene === world.open || scene.sceneId === null ? change : { ...change, sceneId: scene.sceneId }
}

/**
 * As outras fichas de `player` que andam com `lead`: as dele que estão no
 * tabuleiro da mesma cena (fora camada oculta e o que o mestre escondeu, como
 * na sessão) e a até 2 casas.
 */
function entourageOf(player: PlayerInfo, lead: Token, scene: HostScene): string[] {
  const owned = new Set(player.tokenIds)
  const map = scene.map
  const own = visibleTokens(map.tokens, map.hiddenLayers).filter((t) => t.hidden !== true && owned.has(t.id))
  return entourageNear(lead, own, map.grid).map((t) => t.id)
}

/** As linhas do Grupo, na ordem de chegada que a ponte já dá. */
export function partyMembers(players: PlayerInfo[], world: HostWorld): PartyMember[] {
  return players.map((player) => {
    const found = player.status === 'playing' ? tokenOf(player, world) : null
    const token = found === null ? null : found.token
    const member: PartyMember = {
      playerId: player.playerId,
      name: player.name,
      connected: player.connected,
      sceneId: player.sceneId ?? null,
      sceneName: player.sceneName ?? null,
      token: token === null ? null : { id: token.id, color: cssColor(tokenFillColor(token)), x: token.x, y: token.y },
      travelPending: player.travelPending === true,
      mochila: backpackOf(player, world),
    }
    if (!player.connected && player.disconnectedAt !== undefined) member.offlineSince = player.disconnectedAt
    if (player.destination !== undefined) member.destination = { x: player.destination.x, y: player.destination.y }
    const away = awayTokensOf(player, world)
    if (away.length > 0) member.awayTokens = away
    const entourage = found === null ? [] : entourageOf(player, found.token, found.scene)
    if (entourage.length > 0) member.entourageIds = entourage
    if (player.away === true) member.away = true
    return member
  })
}

/** Teto do rótulo da chegada: uma linha do select estreito da aba Jogo. */
const ARRIVAL_LABEL_MAX_LENGTH = 40

/** Fim de frase seguido de espaço: "Escada de pedra. Os degraus…" corta no ponto. */
const SENTENCE_END = /[.!?]\s/

/**
 * O nome CURTO do pino, como o mestre o reconhece numa lista: o nome que ele
 * deu à passagem (`rotulo`); sem ele, a primeira frase da primeira linha do
 * cartão — o cartão é o parágrafo que o JOGADOR lê, comprido demais para um
 * select —; sem descrição, o resumo de sempre ("Pino de viagem").
 */
function shortArrivalLabel(pin: Pin): string {
  const rotulo = cleanExitLabel(pin.rotulo)
  if (rotulo !== '') return clipLabel(rotulo)
  const firstLine = pin.description.trim().split('\n')[0]?.trim() ?? ''
  if (firstLine === '') return pinSummary(pin)
  const sentenceEnd = firstLine.search(SENTENCE_END)
  return clipLabel(sentenceEnd > 0 ? firstLine.slice(0, sentenceEnd) : firstLine)
}

/** Corta no teto, na última palavra inteira, e marca o corte com reticências. */
function clipLabel(text: string): string {
  if (text.length <= ARRIVAL_LABEL_MAX_LENGTH) return text
  const room = text.slice(0, ARRIVAL_LABEL_MAX_LENGTH - 1)
  const lastSpace = room.lastIndexOf(' ')
  return `${(lastSpace > 0 ? room.slice(0, lastSpace) : room).trimEnd()}…`
}

/** Chave de comparação: "Porta" e "porta " são o mesmo texto para quem lê. */
function labelKey(label: string): string {
  return label.trim().toLocaleLowerCase()
}

function countLabels(labels: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const label of labels) counts.set(labelKey(label), (counts.get(labelKey(label)) ?? 0) + 1)
  return counts
}

interface ArrivalDraft {
  pinId: string
  label: string
  /** Nome da cena para onde o pino leva; `null` sem ligação ou com a cena fora do mundo. */
  leadsTo: string | null
}

/**
 * Nenhum texto se repete no select da Chegada (nem o "Centro da cena", que
 * mora nele). Repetido ganha primeiro a cena para onde o pino leva — na torre,
 * "Escada — para Andar 3" e "Escada — para Andar 1" —; o que AINDA repete
 * (sem ligação, ou as duas levam à mesma cena) é numerado na ordem do mapa.
 */
function distinctArrivals(drafts: readonly ArrivalDraft[]): PartyArrival[] {
  const baseCounts = countLabels(drafts.map((draft) => draft.label))
  const labels = drafts.map((draft) => ((baseCounts.get(labelKey(draft.label)) ?? 0) > 1 && draft.leadsTo !== null ? `${draft.label} — para ${draft.leadsTo}` : draft.label))
  const counts = countLabels(labels)
  const used = new Set<string>([labelKey(PARTY_CENTER_LABEL)])
  const lastNumber = new Map<string, number>()
  return drafts.map((draft, index) => {
    const label = labels[index] ?? draft.label
    const key = labelKey(label)
    if (counts.get(key) === 1 && !used.has(key)) {
      used.add(key)
      return { pinId: draft.pinId, label }
    }
    let number = (lastNumber.get(key) ?? 0) + 1
    while (used.has(labelKey(`${label} (${number})`))) number += 1
    lastNumber.set(key, number)
    const numbered = `${label} (${number})`
    used.add(labelKey(numbered))
    return { pinId: draft.pinId, label: numbered }
  })
}

/**
 * As marcas "vamos para cá" que o canvas do MESTRE desenha: só as da cena
 * aberta no editor (`openSceneId`; `null` = mapa solto). A de quem está em
 * cena de fundo tem coordenadas de outro mapa — desenhada aqui, cairia num
 * lugar que não existe; o mestre a acha pelo "Ver" do Grupo.
 */
export function masterDestinationMarks(players: PlayerInfo[], openSceneId: string | null): DestinationMark[] {
  const marks: DestinationMark[] = []
  for (const player of players) {
    if (player.destination === undefined || (player.sceneId ?? null) !== openSceneId) continue
    marks.push({ x: player.destination.x, y: player.destination.y, from: player.name, color: player.destination.color, mine: false })
  }
  return marks
}

/**
 * As cenas do "Mandar para…": só aventura (mapa solto não tem para onde
 * mandar) e só as que abriram — o mundo do host já deixa de fora a cena cujo
 * arquivo falhou. As chegadas são os pinos de VIAGEM de cada uma, pelo nome
 * curto do pino e sem texto repetido dentro da mesma cena. `sceneList` é a
 * lista da aventura: dela sai o caminho de cada cena (`trail`); sem ela,
 * todas ficam sem caminho.
 */
export function partyDestinations(world: HostWorld, sceneList: readonly SceneEntry[] = []): PartyDestination[] {
  const scenes = allScenes(world)
  const sceneNames = new Map<string, string>()
  for (const scene of scenes) if (scene.sceneId !== null) sceneNames.set(scene.sceneId, scene.name)
  const destinations: PartyDestination[] = []
  for (const scene of scenes) {
    if (scene.sceneId === null) continue
    const drafts = scene.map.pins
      .filter((pin) => pin.kind === 'viagem')
      .map((pin) => {
        const destino = travelDestinationOf(pin)
        return { pinId: pin.id, label: shortArrivalLabel(pin), leadsTo: destino === null ? null : (sceneNames.get(destino.sceneId) ?? null) }
      })
    const trail = sceneTrail(sceneList, scene.sceneId)
    destinations.push({ sceneId: scene.sceneId, name: scene.name, arrivals: distinctArrivals(drafts), ...(trail.length > 0 ? { trail } : {}) })
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
 * VOLTO JÁ no mapa do mestre: as fichas que levam o selo de ausente. São as
 * de quem avisou que saiu da mesa, conectado ou não (a queda durante a
 * ausência não tira o selo: a ficha continua travada esperando a volta).
 */
export function awayTokenIds(players: readonly PlayerInfo[]): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const player of players) {
    if (player.away !== true) continue
    for (const tokenId of player.tokenIds) ids.add(tokenId)
  }
  return ids
}

/**
 * Status da linha em poucas palavras: é o que o mestre lê de relance. Quem
 * caiu diz há quanto tempo ("fora há 0:10"), para o mestre saber se espera ou
 * segue a cena. `now` é o relógio do mestre, o mesmo que marcou a queda.
 */
export function partyPresenceLabel(member: Pick<PartyMember, 'connected' | 'offlineSince' | 'away'>, now: number = Date.now()): string {
  // Volto já vem antes da conexão: é o que diz ao mestre que ele saiu de propósito, e não caiu.
  if (member.away === true) return 'volto já'
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
    // Quem está no Volto já e caiu continua à mesa: a ficha e o pedido dele esperam a volta.
    if ((!member.connected && member.away !== true) || member.sceneId === null) continue
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

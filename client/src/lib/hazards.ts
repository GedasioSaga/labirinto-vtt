import type { Hazard, HazardKind, MapData, Region, RegionPoint, Wall } from '../types/map'
import { isDoorPassable } from './collision'
import { pointInRing, signedArea } from './floorContour'
import { mapaDoPiso, pisoDe } from './pisos'

/**
 * ZONA DE PERIGO — regra pura, sem DOM, sem Pixi, sem store. O mestre pinta
 * SALAS com um perigo (fogo, fumaça, vapor, água); "Avançar um passo" leva o
 * perigo às salas do outro lado de cada porta ABERTA; a ficha de jogador que
 * entra é avisada uma vez; a fumaça encurta a visão de quem está dentro.
 *
 * A unidade é a SALA (`Region` com `room`), não a célula: o que o mestre narra
 * numa catástrofe é "o fogo pegou a biblioteca", e é a porta aberta que deixa
 * o fogo passar. Chão sem sala (corredor de peças soltas) não pega perigo.
 */

/** Os perigos, na ordem do painel. */
export const HAZARD_KINDS: readonly HazardKind[] = ['fogo', 'fumaca', 'vapor', 'agua']

/** O nome que a pessoa lê no painel. */
export const HAZARD_LABELS: Record<HazardKind, string> = {
  fogo: 'Fogo',
  fumaca: 'Fumaça',
  vapor: 'Vapor',
  agua: 'Água',
}

/**
 * Cor chapada do perigo, pintada translúcida por cima do chão — estilo
 * minimapa: sem textura, sem brilho, sem hachura.
 */
export const HAZARD_COLORS: Record<HazardKind, number> = {
  fogo: 0xe0572a,
  fumaca: 0x8f8f8f,
  vapor: 0xd6e6ec,
  agua: 0x3f7fbf,
}

/** Opacidade do preenchimento: lê-se o perigo e ainda se lê o chão embaixo. */
export const HAZARD_FILL_ALPHA = 0.35

/** Até onde enxerga quem está dentro da fumaça (ou do vapor), em QUADRADOS da grade. */
export const SMOKE_VISION_CELLS = 2

/**
 * Os perigos que TAPAM A VISTA: quem está dentro enxerga só
 * `SMOKE_VISION_CELLS` quadrados, e quem está fora não vê quem está lá dentro
 * (`lib/fogFilter.ts`). Fogo e água se veem de longe.
 */
const OBSCURING: Record<HazardKind, boolean> = {
  fogo: false,
  fumaca: true,
  vapor: true,
  agua: false,
}

export function obscuresVision(kind: HazardKind): boolean {
  return OBSCURING[kind]
}

/** O que o painel do mestre explica sobre o perigo, quando ele faz algo além de marcar a sala. */
export function hazardEffectHint(kind: HazardKind): string | null {
  return obscuresVision(kind) ? `Quem está dentro enxerga só ${SMOKE_VISION_CELLS} casas e some para quem está fora.` : null
}

/** Quanto tempo o aviso "Você entrou no fogo" fica na tela do jogador. */
export const HAZARD_NOTICE_TTL_MS = 5000

/** "entrou no fogo", "entrou na fumaça" — o complemento que o mestre lê. */
const ENTRY_PHRASE: Record<HazardKind, string> = {
  fogo: 'no fogo',
  fumaca: 'na fumaça',
  vapor: 'no vapor',
  agua: 'na água',
}

/** O que o jogador lê quando a ficha dele entra no perigo. */
const PLAYER_NOTICE: Record<HazardKind, string> = {
  fogo: 'Você entrou no fogo!',
  fumaca: 'Você entrou na fumaça: mal dá para enxergar.',
  vapor: 'Você entrou no vapor: mal dá para enxergar.',
  agua: 'Você entrou na água!',
}

export function hazardNoticeText(kind: HazardKind): string {
  return PLAYER_NOTICE[kind]
}

/** Linha do aviso do mestre: "Ana entrou no fogo" (e a cena, quando não é a aberta). */
export function hazardEntryLine(playerName: string, kind: HazardKind, sceneName?: string): string {
  const line = `${playerName} entrou ${ENTRY_PHRASE[kind]}`
  return sceneName === undefined ? line : `${line} — ${sceneName}`
}

export function isHazardKind(value: unknown): value is HazardKind {
  return HAZARD_KINDS.some((kind) => kind === value)
}

/**
 * As zonas do mapa. O campo é opcional de propósito (mapa sem perigo não
 * carrega `[]`), então ausência é o caso comum, não defeito.
 */
export function hazardsOf(map: Pick<MapData, 'hazards'>): readonly Hazard[] {
  return map.hazards ?? []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Uma zona lida do disco, ou `null` se a forma não fecha. Sala repetida sai. */
function readHazard(raw: unknown): Hazard | null {
  if (!isRecord(raw)) return null
  const { id, kind, roomIds } = raw
  if (typeof id !== 'string' || id === '' || !isHazardKind(kind) || !Array.isArray(roomIds)) return null
  const rooms = [...new Set(roomIds.filter((r): r is string => typeof r === 'string' && r !== ''))]
  return rooms.length === 0 ? null : { id, kind, roomIds: rooms }
}

/**
 * `MapData.hazards` como veio do disco (cru). Zona fora da forma sai sozinha;
 * lista que sobra vazia é AUSÊNCIA — o mapa não ganha campo que não tinha.
 */
export function readHazards(raw: unknown): Hazard[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const hazards = raw.map(readHazard).filter((h): h is Hazard => h !== null)
  return hazards.length === 0 ? undefined : hazards
}

/** O mapa com exatamente estas zonas; nenhuma APAGA o campo. */
function withHazards(map: MapData, hazards: readonly Hazard[]): MapData {
  const { hazards: _antigas, ...semPerigo } = map
  return hazards.length === 0 ? semPerigo : { ...semPerigo, hazards: [...hazards] }
}

function roomById(map: MapData, id: string): Region | null {
  const region = map.regions.find((r) => r.id === id)
  return region !== undefined && region.room !== undefined && region.points.length >= 3 ? region : null
}

/** A zona que toma esta sala (uma sala tem no máximo uma). */
export function hazardOfRoom(map: MapData, roomId: string): Hazard | null {
  return hazardsOf(map).find((h) => h.roomIds.includes(roomId)) ?? null
}

/**
 * O mestre pinta a sala com um perigo, troca o perigo dela ou limpa (`null`).
 * Mesmo perigo já no mapa: a sala entra NESSA zona, que avança inteira no
 * botão. Sala que já era de outra zona sai de lá; zona que fica sem sala some.
 * Id que não é Sala devolve o MESMO mapa — sem entrada de histórico à toa.
 */
export function setRoomHazard(map: MapData, roomId: string, kind: HazardKind | null, newId: () => string): MapData {
  if (roomById(map, roomId) === null) return map
  const current = hazardOfRoom(map, roomId)
  if ((current?.kind ?? null) === kind) return map
  const without = hazardsOf(map)
    .map((h) => (h.roomIds.includes(roomId) ? { ...h, roomIds: h.roomIds.filter((id) => id !== roomId) } : h))
    .filter((h) => h.roomIds.length > 0)
  if (kind === null) return withHazards(map, without)
  const target = without.find((h) => h.kind === kind)
  if (target === undefined) return withHazards(map, [...without, { id: newId(), kind, roomIds: [roomId] }])
  return withHazards(
    map,
    without.map((h) => (h === target ? { ...h, roomIds: [...h.roomIds, roomId] } : h)),
  )
}

/** Salas da zona que ainda existem no mapa (sala apagada deixa de pegar fogo). */
export function hazardRooms(map: MapData, hazard: Hazard): Region[] {
  return hazard.roomIds.map((id) => roomById(map, id)).filter((r): r is Region => r !== null)
}

/**
 * A sala MAIS DE DENTRO que contém o ponto: o quarto, e não a casa inteira que
 * o contém. É a sala do outro lado da porta que o perigo toma.
 */
function innermostRoomAt(map: MapData, point: RegionPoint): Region | null {
  let best: Region | null = null
  let bestArea = Infinity
  for (const region of map.regions) {
    if (region.room === undefined || region.points.length < 3 || !pointInRing(point, region.points)) continue
    const area = Math.abs(signedArea(region.points))
    if (area < bestArea) {
      best = region
      bestArea = area
    }
  }
  return best
}

/**
 * Um ponto de cada lado da porta, a meia célula do meio dela: longe o bastante
 * para sair do traço da parede, perto o bastante para cair na sala vizinha.
 */
function doorSides(wall: Wall, distance: number): [RegionPoint, RegionPoint] | null {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const length = Math.hypot(dx, dy)
  if (!(length > 0)) return null
  const nx = (-dy / length) * distance
  const ny = (dx / length) * distance
  const mx = (wall.x1 + wall.x2) / 2
  const my = (wall.y1 + wall.y2) / 2
  return [
    { x: mx + nx, y: my + ny },
    { x: mx - nx, y: my - ny },
  ]
}

/** Piso da distância do lado da porta, em px de mundo, para grade muito miúda. */
const DOOR_SIDE_MIN = 4

/**
 * UM PASSO: cada sala do outro lado de uma porta ABERTA (e destrancada — a
 * mesma regra da visão e da colisão, `isDoorPassable`) de uma sala tomada
 * entra na zona. Conta a zona como estava ANTES do passo, então o perigo
 * nunca atravessa duas portas num clique. Nada muda (sem porta aberta, zona
 * que não existe): devolve o MESMO mapa.
 */
export function advanceHazard(map: MapData, hazardId: string): MapData {
  const hazard = hazardsOf(map).find((h) => h.id === hazardId)
  if (hazard === undefined) return map
  const rings = hazardRooms(map, hazard).map((r) => r.points)
  const covered = (p: RegionPoint): boolean => rings.some((ring) => pointInRing(p, ring))
  const taken = new Set(hazard.roomIds)
  const added: string[] = []
  const distance = Math.max(map.grid / 2, DOOR_SIDE_MIN)
  for (const wall of map.walls) {
    if (!isDoorPassable(wall.door)) continue
    const sides = doorSides(wall, distance)
    if (sides === null) continue
    const [a, b] = sides
    const inA = covered(a)
    const inB = covered(b)
    if (inA === inB) continue
    const next = innermostRoomAt(map, inA ? b : a)
    if (next === null || taken.has(next.id)) continue
    taken.add(next.id)
    added.push(next.id)
  }
  if (added.length === 0) return map
  // A sala nova sai de qualquer outra zona: uma sala tem um perigo só, e o que avança toma o lugar.
  const addedSet = new Set(added)
  const next = hazardsOf(map).flatMap((h): Hazard[] => {
    if (h.id === hazardId) return [{ ...h, roomIds: [...h.roomIds, ...added] }]
    const roomIds = h.roomIds.filter((id) => !addedSet.has(id))
    return roomIds.length === 0 ? [] : [{ ...h, roomIds }]
  })
  return withHazards(map, next)
}

/** O que o painel da Sala mostra: o perigo dela, o tamanho da zona e se o próximo passo muda algo. */
export interface RoomHazardState {
  kind: HazardKind | null
  hazardId: string | null
  roomCount: number
  canAdvance: boolean
}

export function roomHazardState(map: MapData, roomId: string): RoomHazardState {
  const hazard = hazardOfRoom(map, roomId)
  if (hazard === null) return { kind: null, hazardId: null, roomCount: 0, canAdvance: false }
  return {
    kind: hazard.kind,
    hazardId: hazard.id,
    roomCount: hazardRooms(map, hazard).length,
    canAdvance: advanceHazard(map, hazard.id) !== map,
  }
}

/** Tudo que o MESTRE vê pintado: cada sala tomada, com o perigo dela. */
export function hazardAreas(map: MapData): PlayerHazard[] {
  return hazardsOf(map).flatMap((h) => hazardRooms(map, h).map((r) => ({ kind: h.kind, points: r.points })))
}

/** Zonas que cobrem o ponto (fogo e fumaça podem se sobrepor por sub-sala). */
export function hazardsAt(map: MapData, point: RegionPoint): Hazard[] {
  return hazardsOf(map).filter((h) => hazardRooms(map, h).some((r) => pointInRing(point, r.points)))
}

/**
 * Raio de visão de quem está no ponto: dentro da fumaça ou do vapor, no máximo
 * `SMOKE_VISION_CELLS` quadrados; fora, o raio de sempre. Nunca aumenta.
 */
export function visionRadiusAt(map: MapData, point: RegionPoint, radius: number): number {
  if (hazardsOf(map).length === 0) return radius
  const inSmoke = hazardsAt(map, point).some((h) => obscuresVision(h.kind))
  return inSmoke ? Math.min(radius, map.grid * SMOKE_VISION_CELLS) : radius
}

/**
 * Os polígonos das salas tomadas por fumaça ou vapor (`obscuresVision`): o
 * VÉU. Quem está dentro de um só é visto por quem está dentro do mesmo.
 */
export function obscuringRoomRings(map: MapData): RegionPoint[][] {
  return hazardsOf(map)
    .filter((h) => obscuresVision(h.kind))
    .flatMap((h) => hazardRooms(map, h).map((r) => r.points))
}

/** Ficha dentro de zona: quem, em qual zona, de que perigo. */
export interface HazardEntry {
  tokenId: string
  hazardId: string
  kind: HazardKind
}

/**
 * Onde cada ficha da lista está agora: uma entrada por (ficha, zona), com a
 * chave pronta para comparar com a leitura anterior. Só as fichas da lista —
 * NPC no fogo não avisa ninguém.
 */
export function hazardPresence(map: MapData, tokenIds: readonly string[]): Map<string, HazardEntry> {
  const presence = new Map<string, HazardEntry>()
  if (hazardsOf(map).length === 0 || tokenIds.length === 0) return presence
  const wanted = new Set(tokenIds)
  for (const token of map.tokens) {
    if (!wanted.has(token.id)) continue
    // PISOS: só a sala do piso da ficha conta — a sala em chamas do andar de cima não queima quem passa embaixo.
    for (const hazard of hazardsAt(mapaDoPiso(map, pisoDe(token)), { x: token.x, y: token.y })) {
      presence.set(`${token.id}\n${hazard.id}`, { tokenId: token.id, hazardId: hazard.id, kind: hazard.kind })
    }
  }
  return presence
}

/**
 * Quem ENTROU entre duas leituras: está agora e não estava antes. Andar para
 * dentro e o perigo avançar sobre a ficha parada contam igual. Sem leitura
 * anterior, tudo que está dentro conta como entrada.
 */
export function newHazardEntries(before: ReadonlyMap<string, HazardEntry> | undefined, after: ReadonlyMap<string, HazardEntry>): HazardEntry[] {
  return [...after].filter(([key]) => before === undefined || !before.has(key)).map(([, entry]) => entry)
}

/**
 * O perigo como o JOGADOR o recebe: só o tipo e o polígono da sala tomada.
 * Sem id de zona, sem id de sala — nada que ele não possa ver desenhado.
 */
export interface PlayerHazard {
  kind: HazardKind
  points: RegionPoint[]
}

function isPoint(value: unknown): value is RegionPoint {
  return isRecord(value) && typeof value.x === 'number' && Number.isFinite(value.x) && typeof value.y === 'number' && Number.isFinite(value.y)
}

/** Teto de polígonos por snapshot: o mestre é confiável, mas a tela não desenha lixo sem fim. */
export const MAX_PLAYER_HAZARDS = 500
/** Teto de vértices por polígono, pelo mesmo motivo. */
export const MAX_HAZARD_POINTS = 1000

/**
 * Valida `snapshot.hazards` no cliente do jogador. Forma errada (tipo que não
 * existe, ponto que não é número) devolve `null`, e quem chama descarta a
 * mensagem inteira — mesma regra dos outros campos aditivos do snapshot.
 */
export function parsePlayerHazards(raw: unknown): PlayerHazard[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PLAYER_HAZARDS) return null
  const out: PlayerHazard[] = []
  for (const item of raw) {
    if (!isRecord(item) || !isHazardKind(item.kind)) return null
    const points = item.points
    if (!Array.isArray(points) || points.length > MAX_HAZARD_POINTS || !points.every(isPoint)) return null
    out.push({ kind: item.kind, points: points.map((p) => ({ x: p.x, y: p.y })) })
  }
  return out
}

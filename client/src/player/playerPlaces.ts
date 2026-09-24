import type { FloorPiece, MapData, Pin, RegionPoint } from '../types/map'
import { forEachExploredRun, type Exploration } from '../lib/exploration'
import { clueTitleFrom } from '../lib/clues'
import { pinSummary } from '../lib/pins'
import { NAME_MAX_LENGTH } from '../net/protocol'
import type { StorageLike } from './playerConnection'

/**
 * LUGARES — a parte pura da aba do painel do jogador: o desenho que a tela
 * guarda de cada lugar por onde ele passou, a ordem da primeira visita, o nome
 * que ELE deu e o rótulo de cada ponto conhecido da cena.
 *
 * O desenho sai só do recorte que o jogador JÁ recebeu (`lib/fogFilter.ts`), e
 * só com o que uma miniatura em estilo minimapa precisa: chão, polígono das
 * salas e paredes (a porta marcada). Ficha, pino, texto e nome ficam de fora
 * — a miniatura de um lugar de onde ele saiu não pode guardar a posição de
 * quem ficou lá, e o nome do lugar é o dele, nunca o do mestre.
 */

/** Uma parede do desenho: segmento em px de mundo; `door` desenha o retângulo da porta. */
export interface SketchWall {
  x1: number
  y1: number
  x2: number
  y2: number
  door: boolean
}

export interface PlaceSketch {
  /** Tamanho do mapa em px de mundo. */
  width: number
  height: number
  floor: FloorPiece[]
  /** Cor do chão chapado: a do mapa. */
  floorColor: string
  /** Polígonos de Sala e Área preenchidas, na cor do mestre, sem nome nem texto. */
  rooms: SketchRoom[]
  walls: SketchWall[]
}

export interface SketchRoom {
  points: RegionPoint[]
  color: string
}

export interface VisitedPlace {
  /** Id do HOST para a memória deste jogador naquela cena (`snapshot.place`). */
  id: string
  /** Ordem da primeira visita (1, 2, 3…): é o "Lugar N" enquanto ele não dá nome. */
  number: number
  sketch: PlaceSketch
  /** O que ele já explorou lá, do último snapshot daquele lugar. `null` = mestre antigo, sem memória. */
  explored: Exploration | null
  /**
   * Zonas ocultas ativas no último snapshot daquele lugar (`snapshot.concealed`).
   * A tela principal as cobre de preto; a miniatura também precisa cobrir, porque
   * a célula explorada antes de a zona ligar continua no `explored` e a Sala que
   * cruza a borda da zona chega inteira no recorte.
   */
  concealed: RegionPoint[][]
}

/** Chave do `localStorage` com os nomes dados pelo jogador, por jogador e por lugar. */
export const PLACE_NAMES_KEY = 'labirinto.jogador.lugares'

/** Quantos jogadores (salas do mestre) o armazenamento lembra; passou, sai o mais antigo. */
const PLACE_NAMES_MAX_PLAYERS = 8

const FALLBACK_FLOOR_COLOR = '#a8776a'

/** O desenho do lugar a partir do recorte recebido. Nunca leva ficha, pino, nome nem texto. */
export function placeSketch(map: MapData): PlaceSketch {
  const regions = Array.isArray(map.regions) ? map.regions : []
  const walls = Array.isArray(map.walls) ? map.walls : []
  return {
    width: map.width * map.grid,
    height: map.height * map.grid,
    floor: map.floor.filter((piece) => piece.hidden !== true),
    floorColor: typeof map.floorStyle.fillColor === 'string' ? map.floorStyle.fillColor : FALLBACK_FLOOR_COLOR,
    rooms: regions
      .filter((region) => region.filled !== false && region.points.length >= 3)
      .map((region) => ({ points: region.points.map((p) => ({ x: p.x, y: p.y })), color: region.fillColor })),
    walls: walls.map((wall) => ({ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2, door: wall.door !== null })),
  }
}

/**
 * Guarda (ou atualiza) o lugar `id` com o recorte de agora. Lugar novo entra no
 * fim com o número seguinte ao maior já dado — número nunca se repete, então
 * "Lugar 3" continua sendo o mesmo lugar depois que outro sai da lista. Lugar
 * conhecido fica no mesmo lugar da lista, com o mesmo número.
 *
 * `concealed`: as zonas ocultas ativas do mesmo snapshot; a miniatura as pinta
 * de preto por cima de tudo, como a tela principal.
 *
 * `remembered`: os ids que o host ainda guarda (`snapshot.places`). Presente,
 * o que não está nela sai — o mestre mandou esquecer. Ausente, nada sai.
 */
export function rememberPlace(
  places: readonly VisitedPlace[],
  id: string,
  map: MapData,
  explored: Exploration | undefined,
  concealed: readonly (readonly RegionPoint[])[],
  remembered: readonly string[] | undefined,
): VisitedPlace[] {
  const keep = remembered === undefined ? null : new Set([...remembered, id])
  const kept = keep === null ? [...places] : places.filter((place) => keep.has(place.id))
  const fresh = {
    sketch: placeSketch(map),
    explored: explored ?? null,
    concealed: concealed.filter((ring) => ring.length >= 3).map((ring) => ring.map((p) => ({ x: p.x, y: p.y }))),
  }
  const index = kept.findIndex((place) => place.id === id)
  const previous = index < 0 ? undefined : kept[index]
  if (previous !== undefined) {
    kept[index] = { ...previous, ...fresh }
    return kept
  }
  const highest = places.reduce((max, place) => Math.max(max, place.number), 0)
  return [...kept, { id, number: highest + 1, ...fresh }]
}

/** Rótulo do lugar: o nome que o jogador deu ou, sem nome, "Lugar N". */
export function placeLabel(place: Pick<VisitedPlace, 'id' | 'number'>, names: Readonly<Record<string, string>>): string {
  return names[place.id] ?? `Lugar ${place.number}`
}

/** Nome do lugar no teto do nome do personagem, sem espaço nas pontas e sem meia letra no fim. */
function cleanPlaceName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= NAME_MAX_LENGTH) return trimmed
  const cut = trimmed.slice(0, NAME_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  return (last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut).trimEnd()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** O armazenamento inteiro: por jogador, os nomes por lugar. Torto ou bloqueado vale vazio. */
function readAll(storage: StorageLike | null): Record<string, Record<string, string>> {
  let raw: string | null = null
  try {
    raw = storage?.getItem(PLACE_NAMES_KEY) ?? null
  } catch {
    return {}
  }
  if (raw === null) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Record<string, Record<string, string>> = {}
  for (const [playerId, names] of Object.entries(parsed)) {
    if (!isRecord(names)) continue
    const clean: Record<string, string> = {}
    for (const [placeId, name] of Object.entries(names)) {
      if (typeof name !== 'string') continue
      const cleaned = cleanPlaceName(name)
      if (cleaned !== '') clean[placeId] = cleaned
    }
    all[playerId] = clean
  }
  return all
}

/**
 * Os nomes que ESTE jogador deu, por id de lugar. Por jogador porque o id do
 * lugar é um contador do host: outra sala do mestre (outro id de jogador)
 * começaria de "l1" de novo e herdaria o nome de um lugar que não é o mesmo.
 */
export function loadPlaceNames(storage: StorageLike | null, playerId: string): Record<string, string> {
  return { ...(readAll(storage)[playerId] ?? {}) }
}

/**
 * Grava (ou apaga, com nome vazio) o nome de um lugar. Armazenamento cheio ou
 * bloqueado não derruba a partida: o nome vale só nesta tela.
 */
export function savePlaceName(storage: StorageLike | null, playerId: string, placeId: string, name: string): void {
  const all = readAll(storage)
  const mine = { ...(all[playerId] ?? {}) }
  const cleaned = cleanPlaceName(name)
  if (cleaned === '') delete mine[placeId]
  else mine[placeId] = cleaned
  // O jogador de agora vai para o fim: é o mais recente, o último a sair no teto.
  delete all[playerId]
  all[playerId] = mine
  const players = Object.keys(all)
  for (const old of players.slice(0, Math.max(0, players.length - PLACE_NAMES_MAX_PLAYERS))) delete all[old]
  try {
    storage?.setItem(PLACE_NAMES_KEY, JSON.stringify(all))
  } catch {
    // Sem persistência: o nome vale só nesta aba.
  }
}

/** Rótulo do ponto na lista: a primeira linha da descrição; sem ela, o que o pino é. */
export function pinLabel(pin: Pin): string {
  return clueTitleFrom(pinSummary(pin), pinSummary({ ...pin, description: '' }))
}

export interface ExploredOutline {
  /** Caminho SVG dos trechos explorados, em px de mundo. Vazio = nada explorado. */
  path: string
  /** Caixa que abraça só o explorado; `null` = nada explorado. */
  box: { x: number; y: number; width: number; height: number } | null
}

/**
 * O recorte da miniatura: um retângulo por trecho contínuo de células
 * exploradas de cada linha. É a mesma grade que a névoa do jogador usa, então
 * a miniatura mostra exatamente o que ele já viu, e nada fora disso.
 */
export function exploredOutline(explored: Exploration): ExploredOutline {
  const { cell } = explored
  const parts: string[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  forEachExploredRun(explored, (row, colStart, colEnd) => {
    const x = colStart * cell
    const y = row * cell
    const width = (colEnd - colStart) * cell
    parts.push(`M${x} ${y}h${width}v${cell}h${-width}z`)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + cell)
  })
  if (parts.length === 0) return { path: '', box: null }
  return { path: parts.join(''), box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } }
}

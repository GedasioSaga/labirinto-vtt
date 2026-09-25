import type { MapData, Region } from '../types/map'
import type { Bounds, Point } from '../pixi/world'
import { SCENE_TRAIL_SEPARATOR } from './adventure'
import { mapObjectKey, mapObjectOf, normalizeForSearch, roomEntry, type MapObjectEntry } from './mapObjects'

/**
 * BUSCA DO MESTRE nas OUTRAS cenas da aventura — puro: sem DOM, sem store.
 * Numa torre de 99 cenas, achar a "Escada de Incêndio Oeste · B12" era abrir
 * cena por cena e ler placa no canvas; aqui a busca do Ctrl+K ("Objetos do
 * mapa") também procura nas cenas de fundo.
 *
 * Só o que o mestre procura pelo nome para IR ou MANDAR alguém: Sala, Pino e
 * Ficha. Porta e texto ficam na lista da cena aberta, onde já estão.
 *
 * Cada achado leva o caminho de onde mora: as pastas e o nome da cena e as
 * salas que o contêm, da mais de fora para a mais de dentro ("Andar 9 ›
 * Blocos › Bloco B"). Duas "Cozinha" em casas diferentes não se confundem.
 *
 * É busca do MESTRE: nada daqui vai ao jogador, por isso a sala secreta e o
 * pino oculto aparecem, como na lista da cena aberta.
 */

/** Uma cena onde a busca procura: o id, o caminho (pastas de fora + nome dela) e o mapa. */
export interface SceneSearchSource {
  sceneId: string
  path: readonly string[]
  map: MapData
}

export type AdventureHitKind = 'room' | 'pin' | 'token'

/** Um achado numa outra cena. */
export interface AdventureHit {
  /** `cena|tipo:id` — único entre todas as cenas; é a `key` da linha. */
  key: string
  sceneId: string
  /** `tipo:id` da lista Objetos do mapa (`mapObjectKey`): o que o "Ir lá" seleciona ao chegar. */
  objectKey: string
  kind: AdventureHitKind
  id: string
  name: string
  /** Onde mora, já com o separador: "Andar 9 › Blocos › Bloco B". */
  path: string
  /** `#rrggbb` da marca da linha: o chão da sala ou o disco da ficha. */
  color: string | null
  /** Pino de viagem: a marca é a cabeça escura dele. */
  travel: boolean
  focus: Point
  bounds: Bounds
}

export interface AdventureSearch {
  /** Os primeiros achados, na ordem da lista. */
  hits: AdventureHit[]
  /** Quantos há ao todo: com mais que `hits`, a lista diz que falta. */
  total: number
}

/** Linhas de outras cenas que a lista desenha de uma vez: com a torre inteira, "cozinha" acha centenas. */
export const ADVENTURE_SEARCH_LIMIT = 50

const COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

interface IndexedItem {
  entry: MapObjectEntry
  kind: AdventureHitKind
  /** Salas que contêm este item, da mais de fora para a mais de dentro. */
  rooms: string[]
  nameKey: string
  roomsKey: string
}

/**
 * Índice de cada mapa, guardado pela identidade dele: a cena de fundo que não
 * mudou não é indexada de novo a cada tecla — só a que um jogador mexeu.
 */
const INDEX_CACHE = new WeakMap<MapData, IndexedItem[]>()

/** Os nomes das salas de fora de `region`, da mais de fora para a de dentro. Ciclo no `parentId` para no primeiro repetido. */
function outerRoomNames(byId: ReadonlyMap<string, Region>, region: Region): string[] {
  const names: string[] = []
  const seen = new Set<string>([region.id])
  let parentId = region.parentId
  while (parentId !== undefined && !seen.has(parentId)) {
    const parent = byId.get(parentId)
    if (parent === undefined || parent.room === undefined) break
    seen.add(parent.id)
    names.unshift(parent.room.name.trim() || 'Sala sem nome')
    parentId = parent.parentId
  }
  return names
}

function indexed(entry: MapObjectEntry, kind: AdventureHitKind, rooms: string[]): IndexedItem {
  return { entry, kind, rooms, nameKey: normalizeForSearch(entry.name), roomsKey: normalizeForSearch(rooms.join(' ')) }
}

function indexOf(map: MapData): IndexedItem[] {
  const cached = INDEX_CACHE.get(map)
  if (cached !== undefined) return cached
  const byId = new Map(map.regions.map((region) => [region.id, region]))
  const items: IndexedItem[] = []
  for (const region of map.regions) {
    const entry = roomEntry(map, region)
    if (entry !== null) items.push(indexed(entry, 'room', outerRoomNames(byId, region)))
  }
  for (const pin of map.pins) {
    const entry = mapObjectOf(map, mapObjectKey('pin', pin.id))
    if (entry !== null) items.push(indexed(entry, 'pin', []))
  }
  for (const token of map.tokens) {
    const entry = mapObjectOf(map, mapObjectKey('token', token.id))
    if (entry !== null) items.push(indexed(entry, 'token', []))
  }
  INDEX_CACHE.set(map, items)
  return items
}

interface Match {
  source: SceneSearchSource
  item: IndexedItem
  /** 0 = o nome começa com o que foi digitado; 1 = só contém. */
  rank: number
  /** O caminho montado, só quando alguém precisou dele (desempate ou linha da lista). */
  path?: string
}

function pathOf(match: Match): string {
  if (match.path === undefined) match.path = [...match.source.path, ...match.item.rooms].join(SCENE_TRAIL_SEPARATOR)
  return match.path
}

function compareMatches(a: Match, b: Match): number {
  return a.rank - b.rank || COLLATOR.compare(a.item.entry.name, b.item.entry.name) || COLLATOR.compare(pathOf(a), pathOf(b)) || a.item.entry.key.localeCompare(b.item.entry.key)
}

/**
 * Guarda em `top` (em ordem) só os `limit` primeiros. Uma letra na torre
 * inteira acha dezenas de milhares: ordenar tudo a cada tecla custava mais
 * que a própria busca, e a lista só mostra os primeiros.
 */
function keepBest(top: Match[], match: Match, limit: number): void {
  const worst = top[top.length - 1]
  if (top.length >= limit) {
    if (worst === undefined || compareMatches(match, worst) >= 0) return
    top.pop()
  }
  let low = 0
  let high = top.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (compareMatches(top[middle], match) <= 0) low = middle + 1
    else high = middle
  }
  top.splice(low, 0, match)
}

function toHit(match: Match): AdventureHit {
  const { entry, kind } = match.item
  return {
    key: `${match.source.sceneId}|${entry.key}`,
    sceneId: match.source.sceneId,
    objectKey: entry.key,
    kind,
    id: entry.id,
    name: entry.name,
    path: pathOf(match),
    color: entry.color,
    travel: entry.travel,
    focus: entry.focus,
    bounds: entry.bounds,
  }
}

/**
 * Procura `query` nas cenas `sources`. Cada palavra digitada precisa aparecer
 * no nome, no caminho das salas de fora ou no da cena ("cozinha viuva" acha a
 * Cozinha da Casa da Viúva), e ao menos UMA no próprio nome — senão "bloco"
 * listaria tudo o que mora no Bloco B. Busca vazia não acha nada: sem algo
 * digitado a lista é só a da cena aberta.
 */
export function searchAdventure(sources: readonly SceneSearchSource[], query: string, limit = ADVENTURE_SEARCH_LIMIT): AdventureSearch {
  const words = normalizeForSearch(query).split(/\s+/).filter((word) => word !== '')
  if (words.length === 0) return { hits: [], total: 0 }
  const typed = words.join(' ')
  const top: Match[] = []
  let total = 0
  for (const source of sources) {
    const sceneKey = normalizeForSearch(source.path.join(' '))
    for (const item of indexOf(source.map)) {
      if (!words.some((word) => item.nameKey.includes(word))) continue
      const everyWord = words.every((word) => item.nameKey.includes(word) || item.roomsKey.includes(word) || sceneKey.includes(word))
      if (!everyWord) continue
      total += 1
      keepBest(top, { source, item, rank: item.nameKey.startsWith(typed) ? 0 : 1 }, limit)
    }
  }
  return { hits: top.map(toHit), total }
}

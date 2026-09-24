import type { DoorKind, Drawing, LayerId, MapData, Pin, Region, Token, Wall } from '../types/map'
import type { Bounds, Point } from '../pixi/world'
import { drawingLayer, isLayerLocked, isLayerVisible, pinLayer, regionLayer, tokenLayer, wallLayer } from './layers'
import { canInteract } from './itemTransform'
import { isEditableTarget, type ShortcutEvent } from './keymap'
import { pointsBoundingBox, tokenBoundingBox } from './objectTransform'
import { PIN_HEAD_RADIUS, PIN_HEIGHT, pinSummary } from './pins'
import { pinFocusPoint } from './pinTravel'
import { isPointInPolygon } from './selectionHitTest'
import { selectionSingle, type SelectionSet } from './selectionModel'
import { parseHexColor, tokenFillColor } from './tokenColor'

/**
 * LISTA DE OBJETOS DO MAPA — o que a seção "Objetos do mapa" mostra, puro:
 * sem DOM, sem store, sem Pixi. Com 30 salas, achar a "Cripta" era rolar o
 * mapa no olho; aqui cada objeto da CENA ABERTA vira uma linha com o nome, o
 * ponto que a câmera centraliza e a caixa que precisa caber na tela.
 *
 * Só o que tem nome para o mestre procurar: Sala (a Região com `room`),
 * Porta (a parede com `door`), Pino, Token e Texto. Parede sem porta, região
 * comum e desenho que não é texto ficariam na lista como dezenas de linhas
 * iguais e sem nome.
 *
 * É lista do MESTRE: nada daqui vai ao jogador (a tela dele nem monta a
 * seção), por isso o nome da sala secreta e o pino oculto aparecem.
 */

export type MapObjectKind = 'room' | 'door' | 'pin' | 'token' | 'text'

export interface MapObjectEntry {
  /** `tipo:id` — único na lista; marca a linha do objeto selecionado. */
  key: string
  kind: MapObjectKind
  id: string
  /** O que a linha mostra e o que a busca procura primeiro. */
  name: string
  /** O que distingue linhas de mesmo nome: as salas de uma porta. Vazio = nada. */
  detail: string
  /**
   * Por que o clique leva até lá mas NÃO seleciona — a mesma regra do clique
   * no mapa (camada travada ou oculta, parede travada, pino oculto no
   * editor). `null` = seleciona.
   */
  blockedReason: string | null
  /** `#rrggbb` da marca da linha: o chão da sala ou o disco do token. */
  color: string | null
  /** Pino de viagem: a marca é a cabeça escura dele, como no mapa. */
  travel: boolean
  /** Ponto do mundo que vai ao meio da área livre do canvas. */
  focus: Point
  /** Caixa do objeto no mundo: a câmera afasta se ela não couber. */
  bounds: Bounds
}

/** Grupos da lista, na ordem da tela, com o nome que o resto do app já usa. */
export const MAP_OBJECT_GROUPS: readonly { kind: MapObjectKind; label: string }[] = [
  { kind: 'room', label: 'Salas' },
  { kind: 'door', label: 'Portas' },
  { kind: 'pin', label: 'Pinos' },
  { kind: 'token', label: 'Tokens' },
  { kind: 'text', label: 'Textos' },
]

const GROUP_ORDER: Record<MapObjectKind, number> = { room: 0, door: 1, pin: 2, token: 3, text: 4 }

/** Mesmo nome do tipo que o painel "Tipo de porta" mostra. */
const DOOR_NAMES: Record<DoorKind, string> = { normal: 'Porta', double: 'Porta dupla', gate: 'Portão' }

/** Linha da lista é uma linha só: texto longo do pino ou do rótulo vira isto, com reticências. */
const MAX_NAME_CHARS = 60
/** Largura média de um caractere e altura de linha do rótulo, em fração do tamanho da fonte (só para a caixa do texto). */
const TEXT_CHAR_WIDTH_EM = 0.6
const TEXT_LINE_HEIGHT_EM = 1.25
/** Porta a até esta fração de célula do contorno de uma sala é porta DELA. */
const DOOR_ROOM_TOLERANCE_CELLS = 0.25

const COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

export function mapObjectKey(kind: MapObjectKind, id: string): string {
  return `${kind}:${id}`
}

/** Primeira linha com texto, cortada em `MAX_NAME_CHARS` com reticências. */
function oneLine(text: string): string {
  const first = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== '') ?? ''
  return first.length > MAX_NAME_CHARS ? `${first.slice(0, MAX_NAME_CHARS - 1).trimEnd()}…` : first
}

function hexOf(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`
}

function centerOf(bounds: Bounds): Point {
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
}

/** Mesma regra de camada do clique no mapa (`findSelectableAt` + `clickSelectMap`). */
function layerBlock(map: MapData, layer: LayerId): string | null {
  if (!isLayerVisible(map.hiddenLayers, layer)) return 'camada oculta'
  if (isLayerLocked(map.lockedLayers, layer)) return 'camada travada'
  return null
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** A porta está no contorno (ou dentro) desta sala? */
function roomHasDoorAt(region: Region, point: Point, tolerance: number): boolean {
  const box = pointsBoundingBox(region.points)
  if (box === null) return false
  if (point.x < box.minX - tolerance || point.x > box.maxX + tolerance || point.y < box.minY - tolerance || point.y > box.maxY + tolerance) return false
  if (isPointInPolygon(point, region.points)) return true
  return region.points.some((a, i) => distanceToSegment(point, a, region.points[(i + 1) % region.points.length]) <= tolerance)
}

/** As salas da porta, por nome, em ordem alfabética: "Adega e Corredor". */
function doorRooms(map: MapData, wall: Wall): string {
  const middle = { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 }
  const tolerance = map.grid * DOOR_ROOM_TOLERANCE_CELLS
  const names = new Set<string>()
  for (const region of map.regions) {
    const name = region.room?.name.trim() ?? ''
    if (name === '') continue
    if (region.id === wall.regionId || roomHasDoorAt(region, middle, tolerance)) names.add(name)
  }
  return [...names].sort(COLLATOR.compare).join(' e ')
}

/** A linha de uma Sala (`null` para região comum ou sem ponto). Exportada para a busca em todas as cenas (`lib/buscaNaAventura.ts`). */
export function roomEntry(map: MapData, region: Region): MapObjectEntry | null {
  if (region.room === undefined) return null
  const box = pointsBoundingBox(region.points)
  if (box === null) return null
  const parsed = parseHexColor(region.fillColor)
  return {
    key: mapObjectKey('room', region.id),
    kind: 'room',
    id: region.id,
    name: region.room.name.trim() || 'Sala sem nome',
    detail: '',
    // Sala TRAVADA continua clicável no mapa: é pelo painel dela que se destrava.
    blockedReason: layerBlock(map, regionLayer(region)),
    color: parsed === null ? null : hexOf(parsed),
    travel: false,
    focus: centerOf(box),
    bounds: box,
  }
}

function doorEntry(map: MapData, wall: Wall): MapObjectEntry | null {
  if (wall.door === null) return null
  const bounds = { minX: Math.min(wall.x1, wall.x2), minY: Math.min(wall.y1, wall.y2), maxX: Math.max(wall.x1, wall.x2), maxY: Math.max(wall.y1, wall.y2) }
  return {
    key: mapObjectKey('door', wall.id),
    kind: 'door',
    id: wall.id,
    name: DOOR_NAMES[wall.door.kind] ?? 'Porta',
    detail: doorRooms(map, wall),
    // Parede travada sai do clique do mapa (`hitTestMap`): aqui também.
    blockedReason: layerBlock(map, wallLayer(wall)) ?? (canInteract(wall) ? null : 'parede travada'),
    color: null,
    travel: false,
    focus: centerOf(bounds),
    bounds,
  }
}

function pinEntry(map: MapData, pin: Pin): MapObjectEntry {
  return {
    key: mapObjectKey('pin', pin.id),
    kind: 'pin',
    id: pin.id,
    // Pino não tem outro nome: a descrição, ou o resumo que o painel já usa.
    name: oneLine(pinSummary(pin)),
    detail: '',
    blockedReason: layerBlock(map, pinLayer(pin)) ?? (pin.hidden ? 'oculto no editor' : null),
    color: null,
    travel: pin.kind === 'viagem',
    focus: pinFocusPoint(pin),
    bounds: { minX: pin.x - PIN_HEAD_RADIUS, minY: pin.y - PIN_HEIGHT, maxX: pin.x + PIN_HEAD_RADIUS, maxY: pin.y },
  }
}

function tokenEntry(map: MapData, token: Token): MapObjectEntry {
  return {
    key: mapObjectKey('token', token.id),
    kind: 'token',
    id: token.id,
    name: token.name.trim() || 'Token sem nome',
    detail: '',
    // Token travado ou oculto no editor continua clicável no mapa; só a camada tira.
    blockedReason: layerBlock(map, tokenLayer(token)),
    color: hexOf(tokenFillColor(token)),
    travel: false,
    focus: { x: token.x, y: token.y },
    bounds: tokenBoundingBox(token, map.grid),
  }
}

function textEntry(map: MapData, drawing: Drawing): MapObjectEntry | null {
  if (drawing.kind !== 'text') return null
  const lines = drawing.text.split(/\r?\n/)
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 1)
  const bounds = {
    minX: drawing.x,
    minY: drawing.y,
    maxX: drawing.x + longest * drawing.fontSize * TEXT_CHAR_WIDTH_EM,
    maxY: drawing.y + lines.length * drawing.fontSize * TEXT_LINE_HEIGHT_EM,
  }
  return {
    key: mapObjectKey('text', drawing.id),
    kind: 'text',
    id: drawing.id,
    name: oneLine(drawing.text) || 'Texto vazio',
    detail: '',
    blockedReason: layerBlock(map, drawingLayer(drawing)),
    color: null,
    travel: false,
    focus: centerOf(bounds),
    bounds,
  }
}

function byGroupThenName(a: MapObjectEntry, b: MapObjectEntry): number {
  return GROUP_ORDER[a.kind] - GROUP_ORDER[b.kind] || COLLATOR.compare(a.name, b.name) || COLLATOR.compare(a.detail, b.detail) || a.id.localeCompare(b.id)
}

/** Os objetos da cena aberta, na ordem da lista: por grupo, e em ordem alfabética dentro dele. */
export function mapObjectsOf(map: MapData): MapObjectEntry[] {
  const entries: MapObjectEntry[] = []
  for (const region of map.regions) {
    const entry = roomEntry(map, region)
    if (entry !== null) entries.push(entry)
  }
  for (const wall of map.walls) {
    const entry = doorEntry(map, wall)
    if (entry !== null) entries.push(entry)
  }
  for (const pin of map.pins) entries.push(pinEntry(map, pin))
  for (const token of map.tokens) entries.push(tokenEntry(map, token))
  for (const drawing of map.drawings) {
    const entry = textEntry(map, drawing)
    if (entry !== null) entries.push(entry)
  }
  return entries.sort(byGroupThenName)
}

/**
 * A linha de UM objeto, montada do mapa de agora — `null` se ele saiu do mapa
 * (ou nunca foi objeto da lista). É o que o clique usa: a lista pode ter sido
 * desenhada antes de o token andar.
 */
export function mapObjectOf(map: MapData, key: string): MapObjectEntry | null {
  const cut = key.indexOf(':')
  if (cut < 0) return null
  const kind = key.slice(0, cut)
  const id = key.slice(cut + 1)
  switch (kind) {
    case 'room': {
      const region = map.regions.find((r) => r.id === id)
      return region ? roomEntry(map, region) : null
    }
    case 'door': {
      const wall = map.walls.find((w) => w.id === id)
      return wall ? doorEntry(map, wall) : null
    }
    case 'pin': {
      const pin = map.pins.find((p) => p.id === id)
      return pin ? pinEntry(map, pin) : null
    }
    case 'token': {
      const token = map.tokens.find((t) => t.id === id)
      return token ? tokenEntry(map, token) : null
    }
    case 'text': {
      const drawing = map.drawings.find((d) => d.id === id)
      return drawing ? textEntry(map, drawing) : null
    }
    default:
      return null
  }
}

/** Minúsculas e sem acento: "Salão" e "salao" são a mesma busca. */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * A busca da lista: cada palavra digitada precisa aparecer no nome ou no
 * complemento, sem diferença de maiúscula nem de acento ("crip" acha a
 * Cripta e a porta dela). Busca vazia devolve a lista inteira.
 */
export function filterMapObjects(objects: readonly MapObjectEntry[], query: string): readonly MapObjectEntry[] {
  const words = normalizeForSearch(query).split(/\s+/).filter((word) => word !== '')
  if (words.length === 0) return objects
  return objects.filter((entry) => {
    const haystack = normalizeForSearch(`${entry.name} ${entry.detail}`)
    return words.every((word) => haystack.includes(word))
  })
}

/**
 * A linha que fica marcada: a do objeto selecionado no editor (um só), ou a
 * do pino aberto no painel. `null` quando o selecionado não está na lista.
 */
export function currentObjectKey(map: MapData, selection: SelectionSet, selectedPinId: string | null): string | null {
  if (selectedPinId !== null) return map.pins.some((pin) => pin.id === selectedPinId) ? mapObjectKey('pin', selectedPinId) : null
  const single = selectionSingle(selection)
  if (single === null) return null
  switch (single.kind) {
    case 'region':
      return map.regions.find((r) => r.id === single.id)?.room !== undefined ? mapObjectKey('room', single.id) : null
    case 'wall':
      return map.walls.find((w) => w.id === single.id)?.door ? mapObjectKey('door', single.id) : null
    case 'token':
      return map.tokens.some((t) => t.id === single.id) ? mapObjectKey('token', single.id) : null
    case 'drawing':
      return map.drawings.find((d) => d.id === single.id)?.kind === 'text' ? mapObjectKey('text', single.id) : null
    default:
      return null
  }
}

/**
 * Ctrl+K (Cmd+K no Mac): abre "Objetos do mapa" com o cursor na busca — o
 * atalho de busca que os apps de hoje ensinaram. Com o foco num campo de
 * texto o Ctrl+K fica com o campo, como o Ctrl+S e o Ctrl+O (App.tsx).
 */
export function isFindObjectShortcut(evt: ShortcutEvent): boolean {
  if (!(evt.ctrlKey || evt.metaKey) || evt.shiftKey || evt.altKey) return false
  if (evt.key.toLowerCase() !== 'k') return false
  return !isEditableTarget(evt.targetTagName, evt.targetInputType, evt.targetContentEditable)
}

import { cacheDoRecorte } from '../lib/cacheDoRecorte'
import type { ExploredWire } from '../lib/exploration'
import type { MapData, RegionPoint, Token } from '../types/map'

/**
 * SÓ O QUE MUDOU na tela do jogador. O host guarda, por conexão, a última tela
 * que mandou; no broadcast seguinte manda só a diferença (`patch`, em
 * `protocol.ts`), e o jogador a aplica em cima da última tela que recebeu.
 *
 * O grão é o que pesa: as fichas carregam a foto embutida (`imageData`,
 * centenas de KB), então ficha muda campo a campo — o passo manda `x`/`y`, não
 * a foto. O resto do mapa muda por campo de topo inteiro (paredes, chão...):
 * é texto pequeno e muda pouco durante o jogo.
 *
 * Função pura dos dois lados: `diffView` no host, `applyMapPatch` no jogador.
 * `applyMapPatch(prev, diffMap(prev, next))` é igual a `next` no JSON — é o
 * que os testes cobram, e é o que deixa o patch no lugar do snapshot.
 */

/** Ficha que mudou: só os campos novos (`set`), ou a ficha inteira quando ela é nova ou perdeu campo. */
export type TokenChange = { id: string; set: Partial<Token> } | { id: string; token: Token }

export interface TokenListPatch {
  change: TokenChange[]
  remove: string[]
  /**
   * Ordem final dos ids. Só vem quando aplicar (tira as removidas, troca no
   * lugar, novas no fim) não dá a ordem do mestre — a ordem é a de desenho.
   */
  order?: string[]
}

/** Item de uma lista com id (parede, desenho, sala...): vai inteiro quando é novo ou mudou. */
export type ListItem = { id: string } & Record<string, unknown>

/**
 * Lista com id que mudou ITEM A ITEM (F9 da otimização 200x200): a ficha do
 * jogador anda e uma parede nova entra na visão; antes ia a lista inteira de
 * paredes (dezenas de KB no mapa 200x200), agora vai a parede.
 */
export interface ItemListPatch {
  change: ListItem[]
  remove: string[]
  /** Ordem final dos ids, só quando aplicar (tira, troca no lugar, novos no fim) não dá a ordem. */
  order?: string[]
}

export interface MapPatch {
  /** Campos de topo que mudaram, inteiros. `tokens` nunca vem aqui (vem em `tokens`). */
  set: Partial<MapData>
  tokens?: TokenListPatch
  /** Listas com id que mudaram item a item (o campo não vem em `set`). */
  items?: Record<string, ItemListPatch>
}

/** Troca de um trecho do texto anterior: `[de, até (exclusivo), texto novo]`. */
export type StringEdit = [number, number, string]

/**
 * O EXPLORADO que mudou pouco (F9): o base64 do bitset e dos contornos tem o
 * mesmo tamanho ou só cresce no fim, então vão só os trechos que mudaram. O
 * jogador aplica em cima do último explorado que recebeu (`applyExploredEdits`).
 */
export interface ExploredEdits {
  bits: StringEdit[]
  rings: StringEdit[]
  ringsFar?: StringEdit[]
}

/** O que o jogador tem na tela: o snapshot sem `type` e `rev`. */
export interface PlayerViewContent {
  map: MapData
  vision: RegionPoint[][]
  explored: ExploredWire
  ownTokens: string[]
  concealed: RegionPoint[][]
}

/** Só os pedaços da tela que mudaram; tudo ausente = a tela é a mesma. */
export interface ViewPatch {
  map?: MapPatch
  vision?: RegionPoint[][]
  explored?: ExploredWire
  /** No lugar de `explored`, quando só um pedaço mudou. Os dois nunca vêm juntos. */
  exploredEdits?: ExploredEdits
  ownTokens?: string[]
  concealed?: RegionPoint[][]
}

/**
 * Igualdade de valor do que viaja em JSON. Mesma referência sai de graça (o
 * host devolve o MESMO array quando os itens de um campo não mudaram, ver
 * `reuseUnchanged`). O resto anda pela estrutura e pára na primeira
 * diferença, sem montar o texto dos dois lados: com o mapa 200x200 eram
 * ~170 KB de JSON.stringify por passo de ficha.
 *
 * Mesma regra do JSON: campo `undefined` é campo ausente, e número que o JSON
 * vira `null` (NaN, Infinity) é igual a `null`. A ordem das chaves não conta
 * (o JSON contava: só mandava um patch a mais, nunca a menos).
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return !Number.isFinite(a) && !Number.isFinite(b)
  if (typeof a === 'number' && !Number.isFinite(a)) return b === null
  if (typeof b === 'number' && !Number.isFinite(b)) return a === null
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
      // No array, `undefined` vira `null` no JSON.
      const x: unknown = a[i] === undefined ? null : a[i]
      const y: unknown = b[i] === undefined ? null : b[i]
      if (!sameValue(x, y)) return false
    }
    return true
  }
  if (Array.isArray(b)) return false
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  let count = 0
  for (const key in left) {
    if (left[key] === undefined) continue
    count += 1
    if (!sameValue(left[key], right[key])) return false
  }
  for (const key in right) if (right[key] !== undefined) count -= 1
  return count === 0
}

/**
 * A tela de agora com os campos do mapa que não mudaram trocados pelo array
 * da tela ANTERIOR (mesmos itens, mesma ordem, por referência). O patch
 * seguinte resolve esses campos por identidade em `sameValue`. Não muda o
 * conteúdo: só troca array por outro com os mesmos itens.
 */
export function reuseUnchanged(prev: PlayerViewContent, next: PlayerViewContent): PlayerViewContent {
  if (!cacheDoRecorte.ligado || prev.map === next.map) return next
  const before = prev.map as unknown as Record<string, unknown>
  const after = next.map as unknown as Record<string, unknown>
  let map: Record<string, unknown> | null = null
  for (const key in after) {
    const old = before[key]
    const now = after[key]
    if (old === now || !Array.isArray(old) || !Array.isArray(now) || old.length !== now.length) continue
    let same = true
    for (let i = 0; i < now.length; i += 1) {
      if (old[i] !== now[i]) {
        same = false
        break
      }
    }
    if (!same) continue
    map ??= { ...after }
    map[key] = old
  }
  return map === null ? next : { ...next, map: map as unknown as MapData }
}

/**
 * Os campos de `next` que diferem de `prev`. `null` quando um campo que
 * `prev` tinha sumiu de `next`: JSON não tem "apagar campo", e o patch não
 * saberia dizer isso.
 */
function changedFields<T extends object>(prev: T, next: T, skip: ReadonlySet<string>): Partial<T> | null {
  for (const key in prev) {
    if (!skip.has(key) && prev[key] !== undefined && next[key] === undefined) return null
  }
  const set: Partial<T> = {}
  for (const key in next) {
    if (skip.has(key) || next[key] === undefined || sameValue(prev[key], next[key])) continue
    set[key] = next[key]
  }
  return set
}

function uniqueIds(tokens: readonly Token[]): Map<string, Token> | null {
  const byId = new Map<string, Token>()
  for (const token of tokens) {
    if (byId.has(token.id)) return null
    byId.set(token.id, token)
  }
  return byId
}

const NO_SKIP: ReadonlySet<string> = new Set()
const TOKENS_SKIP: ReadonlySet<string> = new Set(['tokens'])

/** Aplica as fichas sem olhar a `order`: tira as removidas, troca no lugar, novas no fim. */
function applyTokenChanges(prev: readonly Token[], patch: TokenListPatch): Token[] | null {
  const removed = new Set(patch.remove)
  const changes = new Map(patch.change.map((change) => [change.id, change]))
  const result: Token[] = []
  for (const token of prev) {
    if (removed.has(token.id)) continue
    const change = changes.get(token.id)
    if (change === undefined) {
      result.push(token)
      continue
    }
    changes.delete(token.id)
    result.push('token' in change ? change.token : { ...token, ...change.set })
  }
  for (const change of changes.values()) {
    // Só campos de uma ficha que o jogador não tem: patch de outra tela.
    if (!('token' in change)) return null
    result.push(change.token)
  }
  return result
}

function sameOrder(tokens: readonly Token[], ids: readonly string[]): boolean {
  return tokens.length === ids.length && tokens.every((token, i) => token.id === ids[i])
}

/** Diferença das fichas; `undefined` = iguais; `null` = id repetido (vai inteiro). */
function diffTokens(prev: readonly Token[], next: readonly Token[]): TokenListPatch | undefined | null {
  const before = uniqueIds(prev)
  const after = uniqueIds(next)
  if (before === null || after === null) return null
  const change: TokenChange[] = []
  for (const token of next) {
    const old = before.get(token.id)
    if (old === undefined) {
      change.push({ id: token.id, token })
      continue
    }
    if (old === token) continue
    const set = changedFields(old, token, NO_SKIP)
    if (set === null) change.push({ id: token.id, token })
    else if (Object.keys(set).length > 0) change.push({ id: token.id, set })
  }
  const remove = prev.filter((token) => !after.has(token.id)).map((token) => token.id)
  const patch: TokenListPatch = { change, remove }
  const applied = applyTokenChanges(prev, patch)
  const order = next.map((token) => token.id)
  if (applied === null || !sameOrder(applied, order)) patch.order = order
  if (change.length === 0 && remove.length === 0 && patch.order === undefined) return undefined
  return patch
}


/** Ids únicos e string em todos os itens? Só então a lista pode ir item a item. */
function itemsById(list: readonly unknown[]): Map<string, ListItem> | null {
  const byId = new Map<string, ListItem>()
  for (const item of list) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return null
    const id = (item as { id?: unknown }).id
    if (typeof id !== 'string' || byId.has(id)) return null
    byId.set(id, item as ListItem)
  }
  return byId
}

/** Aplica sem olhar a `order`: tira os removidos, troca no lugar, novos no fim. */
function applyItemChanges(prev: readonly ListItem[], patch: ItemListPatch): ListItem[] {
  const removed = new Set(patch.remove)
  const changes = new Map(patch.change.map((item) => [item.id, item]))
  const result: ListItem[] = []
  for (const item of prev) {
    if (removed.has(item.id)) continue
    const change = changes.get(item.id)
    if (change === undefined) {
      result.push(item)
      continue
    }
    changes.delete(item.id)
    result.push(change)
  }
  for (const item of changes.values()) result.push(item)
  return result
}

function inOrder(list: readonly ListItem[], order: readonly string[]): ListItem[] | null {
  const byId = itemsById(list)
  if (byId === null || byId.size !== order.length) return null
  const ordered: ListItem[] = []
  for (const id of order) {
    const item = byId.get(id)
    if (item === undefined) return null
    ordered.push(item)
  }
  return ordered
}

/**
 * A lista item a item, ou `null` quando não vale: item sem id, id repetido,
 * ou mudou mais da metade (aí a lista inteira em `set` sai do mesmo tamanho).
 */
function diffItems(prev: readonly unknown[], next: readonly unknown[]): ItemListPatch | null {
  const before = itemsById(prev)
  const after = itemsById(next)
  if (before === null || after === null) return null
  const change: ListItem[] = []
  for (const item of after.values()) {
    const old = before.get(item.id)
    if (old === item || (old !== undefined && sameValue(old, item))) continue
    change.push(item)
    if (change.length * 2 > after.size) return null
  }
  const remove = [...before.keys()].filter((id) => !after.has(id))
  if ((change.length + remove.length) * 2 > Math.max(1, after.size)) return null
  const patch: ItemListPatch = { change, remove }
  const applied = applyItemChanges([...before.values()], patch)
  const order = [...after.keys()]
  if (applied.length !== order.length || applied.some((item, i) => item.id !== order[i])) patch.order = order
  return patch
}

/** Diferença do mapa. `null` = não cabe num patch (campo de topo sumiu): mande o mapa inteiro. */
export function diffMap(prev: MapData, next: MapData): MapPatch | null {
  if (prev === next) return { set: {} }
  const tokens = diffTokens(prev.tokens, next.tokens)
  const set = changedFields(prev, next, tokens === null ? NO_SKIP : TOKENS_SKIP)
  if (set === null) return null
  const patch: MapPatch = tokens === null || tokens === undefined ? { set } : { set, tokens }
  // Lista com id que mudou pouco vai item a item, e sai do `set`.
  const before = prev as unknown as Record<string, unknown>
  const fields = set as Record<string, unknown>
  for (const key of Object.keys(fields)) {
    const old = before[key]
    const now = fields[key]
    if (!Array.isArray(old) || !Array.isArray(now) || now.length === 0) continue
    const items = diffItems(old, now)
    if (items === null) continue
    patch.items ??= {}
    patch.items[key] = items
    delete fields[key]
  }
  return patch
}

export function isEmptyMapPatch(patch: MapPatch): boolean {
  return patch.tokens === undefined && patch.items === undefined && Object.keys(patch.set).length === 0
}

/**
 * Aplica o patch em cima do mapa que o jogador tem. `null` = o patch não é
 * deste mapa (campos de uma ficha que não existe aqui): a tela pede a inteira.
 * O que não mudou mantém a MESMA referência — a camada que não mudou nem
 * redesenha.
 */
export function applyMapPatch(prev: MapData, patch: MapPatch): MapData | null {
  const merged: MapData = { ...prev, ...patch.set }
  if (patch.items !== undefined) {
    const from = prev as unknown as Record<string, unknown>
    const into = merged as unknown as Record<string, unknown>
    for (const [key, items] of Object.entries(patch.items)) {
      const old = from[key]
      if (!Array.isArray(old) || itemsById(old) === null) return null
      const changed = applyItemChanges(old as ListItem[], items)
      const final = items.order === undefined ? changed : inOrder(changed, items.order)
      if (final === null) return null
      into[key] = final
    }
  }
  if (patch.tokens === undefined) return merged
  const changed = applyTokenChanges(prev.tokens, patch.tokens)
  if (changed === null) return null
  const { order } = patch.tokens
  if (order === undefined) return { ...merged, tokens: changed }
  const byId = uniqueIds(changed)
  if (byId === null || byId.size !== order.length) return null
  const ordered: Token[] = []
  for (const id of order) {
    const token = byId.get(id)
    if (token === undefined) return null
    ordered.push(token)
  }
  return { ...merged, tokens: ordered }
}

/** Bloco do base64 (4 letras = 3 bytes): a diferença anda de bloco em bloco. */
const BASE64_BLOCK = 4
/** Trechos mudados separados por menos que isto (em letras) viram um só: cada trecho custa ~16 letras de cabeçalho. */
const EDIT_MERGE_GAP = 32
/** Cabeçalho de um trecho no JSON (`[123456,123460,"..."],`), para estimar o tamanho. */
const EDIT_HEADER = 16

/** Os trechos de `prev` a trocar para virar `next`. Mesmo tamanho: bloco a bloco; tamanho outro: começo e fim comuns. */
export function stringEdits(prev: string, next: string): StringEdit[] {
  if (prev === next) return []
  if (prev.length === next.length) {
    const edits: StringEdit[] = []
    let start = -1
    let lastDiffEnd = -1
    for (let at = 0; at < next.length; at += BASE64_BLOCK) {
      const end = Math.min(next.length, at + BASE64_BLOCK)
      let differs = false
      for (let i = at; i < end; i += 1) {
        if (prev.charCodeAt(i) !== next.charCodeAt(i)) {
          differs = true
          break
        }
      }
      if (!differs) continue
      if (start >= 0 && at - lastDiffEnd > EDIT_MERGE_GAP) {
        edits.push([start, lastDiffEnd, next.slice(start, lastDiffEnd)])
        start = -1
      }
      if (start < 0) start = at
      lastDiffEnd = end
    }
    if (start >= 0) edits.push([start, lastDiffEnd, next.slice(start, lastDiffEnd)])
    return edits
  }
  const shorter = Math.min(prev.length, next.length)
  let head = 0
  while (head < shorter && prev.charCodeAt(head) === next.charCodeAt(head)) head += 1
  head -= head % BASE64_BLOCK
  let tail = 0
  while (tail < shorter - head && prev.charCodeAt(prev.length - 1 - tail) === next.charCodeAt(next.length - 1 - tail)) tail += 1
  return [[head, prev.length - tail, next.slice(head, next.length - tail)]]
}

/** Aplica os trechos (em ordem, sem se sobrepor). `null` = os trechos não são deste texto. */
export function applyStringEdits(prev: string, edits: readonly StringEdit[]): string | null {
  const parts: string[] = []
  let at = 0
  for (const edit of edits) {
    if (!Array.isArray(edit) || edit.length !== 3) return null
    const [from, to, text] = edit
    if (!Number.isInteger(from) || !Number.isInteger(to) || typeof text !== 'string' || from < at || to < from || to > prev.length) return null
    parts.push(prev.slice(at, from), text)
    at = to
  }
  parts.push(prev.slice(at))
  return parts.join('')
}

function editsLength(edits: readonly StringEdit[]): number {
  let total = 0
  for (const [, , text] of edits) total += text.length + EDIT_HEADER
  return total
}

/** O explorado como trechos, ou `null` quando não cabe (outra grade, campo que apareceu ou sumiu, ou mudou demais). */
export function diffExplored(prev: ExploredWire, next: ExploredWire): ExploredEdits | null {
  if (prev.cell !== next.cell || prev.cols !== next.cols || prev.rows !== next.rows) return null
  if ((prev.ringsFar === undefined) !== (next.ringsFar === undefined)) return null
  const edits: ExploredEdits = { bits: stringEdits(prev.bits, next.bits), rings: stringEdits(prev.rings, next.rings) }
  if (prev.ringsFar !== undefined && next.ringsFar !== undefined) edits.ringsFar = stringEdits(prev.ringsFar, next.ringsFar)
  const full = next.bits.length + next.rings.length + (next.ringsFar?.length ?? 0)
  const size = editsLength(edits.bits) + editsLength(edits.rings) + editsLength(edits.ringsFar ?? [])
  return size * 2 > full ? null : edits
}

/** O explorado novo a partir do último que o jogador tem. `null` = não encaixa: a tela pede a inteira. */
export function applyExploredEdits(prev: ExploredWire, edits: ExploredEdits): ExploredWire | null {
  if (!Array.isArray(edits.bits) || !Array.isArray(edits.rings)) return null
  const bits = applyStringEdits(prev.bits, edits.bits)
  const rings = applyStringEdits(prev.rings, edits.rings)
  if (bits === null || rings === null) return null
  const wire: ExploredWire = { cell: prev.cell, cols: prev.cols, rows: prev.rows, bits, rings }
  if (prev.ringsFar === undefined) return edits.ringsFar === undefined ? wire : null
  if (!Array.isArray(edits.ringsFar)) return null
  const far = applyStringEdits(prev.ringsFar, edits.ringsFar)
  if (far === null) return null
  wire.ringsFar = far
  return wire
}

/**
 * O que mudou de uma tela para a outra. `null` = não cabe num patch: mande o
 * snapshot inteiro. Patch sem nenhum campo = a tela é a mesma.
 */
export function diffView(prev: PlayerViewContent, next: PlayerViewContent): ViewPatch | null {
  const map = diffMap(prev.map, next.map)
  if (map === null) return null
  const patch: ViewPatch = {}
  if (!isEmptyMapPatch(map)) patch.map = map
  if (!sameValue(prev.vision, next.vision)) patch.vision = next.vision
  if (!sameValue(prev.explored, next.explored)) {
    const edits = diffExplored(prev.explored, next.explored)
    if (edits === null) patch.explored = next.explored
    else patch.exploredEdits = edits
  }
  if (!sameValue(prev.ownTokens, next.ownTokens)) patch.ownTokens = next.ownTokens
  if (!sameValue(prev.concealed, next.concealed)) patch.concealed = next.concealed
  return patch
}

/**
 * A tela do jogador depois do patch (o mesmo que `playerConnection.applyPatch`
 * faz com cada pedaço). `null` = o patch não encaixa nesta tela.
 */
export function applyViewPatch(prev: PlayerViewContent, patch: ViewPatch): PlayerViewContent | null {
  const map = patch.map === undefined ? prev.map : applyMapPatch(prev.map, patch.map)
  if (map === null) return null
  let explored = patch.explored ?? prev.explored
  if (patch.exploredEdits !== undefined) {
    const edited = applyExploredEdits(prev.explored, patch.exploredEdits)
    if (edited === null) return null
    explored = edited
  }
  return { map, vision: patch.vision ?? prev.vision, explored, ownTokens: patch.ownTokens ?? prev.ownTokens, concealed: patch.concealed ?? prev.concealed }
}

export function isEmptyViewPatch(patch: ViewPatch): boolean {
  return (
    patch.map === undefined &&
    patch.vision === undefined &&
    patch.explored === undefined &&
    patch.exploredEdits === undefined &&
    patch.ownTokens === undefined &&
    patch.concealed === undefined
  )
}

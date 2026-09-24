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

export interface MapPatch {
  /** Campos de topo que mudaram, inteiros. `tokens` nunca vem aqui (vem em `tokens`). */
  set: Partial<MapData>
  tokens?: TokenListPatch
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
  ownTokens?: string[]
  concealed?: RegionPoint[][]
}

/** Igualdade de valor do que viaja em JSON. Mesma referência sai de graça. */
function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
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

/** Diferença do mapa. `null` = não cabe num patch (campo de topo sumiu): mande o mapa inteiro. */
export function diffMap(prev: MapData, next: MapData): MapPatch | null {
  if (prev === next) return { set: {} }
  const tokens = diffTokens(prev.tokens, next.tokens)
  const set = changedFields(prev, next, tokens === null ? NO_SKIP : TOKENS_SKIP)
  if (set === null) return null
  return tokens === null || tokens === undefined ? { set } : { set, tokens }
}

export function isEmptyMapPatch(patch: MapPatch): boolean {
  return patch.tokens === undefined && Object.keys(patch.set).length === 0
}

/**
 * Aplica o patch em cima do mapa que o jogador tem. `null` = o patch não é
 * deste mapa (campos de uma ficha que não existe aqui): a tela pede a inteira.
 * O que não mudou mantém a MESMA referência — a camada que não mudou nem
 * redesenha.
 */
export function applyMapPatch(prev: MapData, patch: MapPatch): MapData | null {
  const merged: MapData = { ...prev, ...patch.set }
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
  if (!sameValue(prev.explored, next.explored)) patch.explored = next.explored
  if (!sameValue(prev.ownTokens, next.ownTokens)) patch.ownTokens = next.ownTokens
  if (!sameValue(prev.concealed, next.concealed)) patch.concealed = next.concealed
  return patch
}

export function isEmptyViewPatch(patch: ViewPatch): boolean {
  return patch.map === undefined && patch.vision === undefined && patch.explored === undefined && patch.ownTokens === undefined && patch.concealed === undefined
}

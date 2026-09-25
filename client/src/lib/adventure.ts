import type { MapData } from '../types/map'

/**
 * AVENTURA: várias cenas (mapas) numa pasta só. Cada cena continua sendo um
 * `map.json` como sempre; o que junta as cenas é o `adventure.json` na pasta
 * da aventura, com o caminho de cada cena RELATIVO a essa pasta — para a
 * pasta inteira poder ir para outra máquina e abrir igual.
 *
 * Mapa solto (sem `adventure.json` ao lado) continua abrindo como sempre; a
 * aventura nasce quando o mestre cria a segunda cena.
 */

export const ADVENTURE_FILE = 'adventure.json'
export const ADVENTURE_VERSION = 1

export interface SceneEntry {
  id: string
  /** Nome do MESTRE: nunca vai ao jogador. */
  name: string
  /** Caminho do `map.json` da cena, relativo à pasta da aventura, sempre com `/`. */
  file: string
  /**
   * CENAS EM PASTAS: a cena "de fora" desta (região > cidade > bairro > casa).
   * Ausente = primeiro nível — é assim que toda aventura antiga abre. Só
   * organiza a lista do mestre: nada disto vai para o jogador.
   */
  parentId?: string
  /**
   * NOME PARA OS JOGADORES ("1º andar"), opcional. Presente, é o selo "Onde
   * estou" de quem está nesta cena; ausente, o jogador não recebe nome nenhum.
   * Nunca fica vazio: vazio sai do objeto (`cleanPublicSceneName`).
   */
  publicName?: string
   * "Planta conhecida por todos": todo jogador que chega à cena recebe a
   * planta (sem interior de teto nem zona oculta). Ausente = desligada — cena
   * de aventura antiga abre igual, sem migração. Fica no `adventure.json`, e
   * não no `map.json`, porque o mapa é o que vai (recortado) ao jogador.
   */
  planKnownByAll?: true
}

export interface Adventure {
  version: number
  id: string
  name: string
  startSceneId: string
  scenes: SceneEntry[]
}

/** Nome de cena vazio vira este, em vez de uma entrada sem nome na lista. */
export const UNNAMED_SCENE = 'Cena sem nome'

/** Onde mora o `map.json` de uma cena nova, relativo à pasta da aventura. */
export function sceneFileFor(sceneId: string): string {
  return `scenes/${sceneId}/map.json`
}

export function newSceneId(): string {
  return `scene_${crypto.randomUUID()}`
}

export function cleanSceneName(raw: string): string {
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : UNNAMED_SCENE
}

/** Teto do nome para os jogadores, em unidades UTF-16 (o `maxLength` do campo do mestre conta igual). */
export const SCENE_PUBLIC_NAME_MAX_LENGTH = 60

/**
 * O nome para os jogadores como ele é guardado e enviado: sem espaço nas
 * pontas e cortado no teto sem deixar meia letra (um emoji partido viraria um
 * losango de erro no selo). Vazio = a cena não tem nome para o jogador.
 */
export function cleanPublicSceneName(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined
  if (trimmed.length <= SCENE_PUBLIC_NAME_MAX_LENGTH) return trimmed
  const cut = trimmed.slice(0, SCENE_PUBLIC_NAME_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  const whole = last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
  return whole.trimEnd()
}

/** A entrada com o nome público trocado; `undefined` tira o campo (não guarda `publicName: ''`). */
export function withPublicSceneName(entry: SceneEntry, raw: string): SceneEntry {
  const { publicName: _old, ...rest } = entry
  const publicName = cleanPublicSceneName(raw)
  return publicName === undefined ? rest : { ...rest, publicName }
}

/**
 * `file` vem de um `adventure.json` que pode ter sido editado à mão ou vindo
 * de outra máquina: só caminho relativo, sem `..`, sem letra de unidade e sem
 * barra no começo. O resto seria ler (e depois GRAVAR) fora da pasta da
 * aventura.
 */
export function isSafeRelativeFile(file: string): boolean {
  if (file.length === 0) return false
  if (/^[\\/]/.test(file)) return false
  if (/^[A-Za-z]:/.test(file)) return false
  const segments = file.split(/[\\/]/)
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

/** Segmentos de um caminho relativo já validado, para montar com `join` do SO. */
export function fileSegments(file: string): string[] {
  return file.split(/[\\/]/)
}

/** Último pedaço de um caminho, aceitando `/` e `\`. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sceneEntryOrNull(value: unknown): SceneEntry | null {
  if (!isRecord(value)) return null
  const { id, name, file, parentId, publicName, planKnownByAll } = value
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof file !== 'string') return null
  const entry: SceneEntry = { id, name: typeof name === 'string' ? name : UNNAMED_SCENE, file }
  // Só `true` liga: qualquer outra coisa vinda do disco é desligada.
  if (planKnownByAll === true) entry.planKnownByAll = true
  // Nome público de outro tipo (arquivo editado à mão) cai calado: a cena só fica sem ele.
  const named = typeof publicName === 'string' ? withPublicSceneName(entry, publicName) : entry
  return withParent(named, typeof parentId === 'string' && parentId.length > 0 ? parentId : null)
}

/**
 * A mesma cena dentro de `parentId`; `null` tira o campo (primeiro nível grava
 * como cena de aventura antiga). O resto da entrada (o nome público) fica.
 */
function withParent(entry: SceneEntry, parentId: string | null): SceneEntry {
  const { parentId: _old, ...bare } = entry
  return parentId === null ? bare : { ...bare, parentId }
}

/**
 * Pai que não é cena da aventura, que é a própria cena, ou que fecha um ciclo
 * (A dentro de B, B dentro de A — só num arquivo editado à mão) sai: a cena
 * volta ao primeiro nível em vez de sumir da lista. Do ciclo, cai só o elo que
 * o fecha, subindo a partir da primeira cena da lista que o alcança.
 */
function sanitizeSceneParents(scenes: SceneEntry[]): SceneEntry[] {
  const ids = new Set(scenes.map((scene) => scene.id))
  const parentOf = new Map<string, string>()
  for (const scene of scenes) {
    if (scene.parentId !== undefined && scene.parentId !== scene.id && ids.has(scene.parentId)) parentOf.set(scene.id, scene.parentId)
  }
  const settled = new Set<string>()
  for (const scene of scenes) {
    const path: string[] = []
    const onPath = new Set<string>()
    let current: string | undefined = scene.id
    while (current !== undefined && !settled.has(current)) {
      if (onPath.has(current)) {
        parentOf.delete(path[path.length - 1])
        break
      }
      onPath.add(current)
      path.push(current)
      current = parentOf.get(current)
    }
    for (const id of path) settled.add(id)
  }
  return scenes.map((scene) => withParent(scene, parentOf.get(scene.id) ?? null))
}

/**
 * Lê o `adventure.json`. JSON quebrado ou sem cena nenhuma LANÇA (quem chama
 * cai para "abrir o mapa solto"); cena malformada sai da lista e cena com
 * caminho perigoso FICA (vira "indisponível" ao carregar), para regravar a
 * aventura não apagar a entrada que o mestre talvez queira consertar.
 */
export function parseAdventure(json: string): Adventure {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    throw new Error(`adventure.json inválido: JSON malformado (${error instanceof Error ? error.message : String(error)})`)
  }
  if (!isRecord(parsed)) throw new Error('adventure.json inválido: não é um objeto')

  const seen = new Set<string>()
  const scenes: SceneEntry[] = []
  for (const raw of Array.isArray(parsed.scenes) ? parsed.scenes : []) {
    const entry = sceneEntryOrNull(raw)
    if (entry === null || seen.has(entry.id)) continue
    seen.add(entry.id)
    scenes.push(entry)
  }
  if (scenes.length === 0) throw new Error('adventure.json inválido: nenhuma cena')

  const startSceneId = typeof parsed.startSceneId === 'string' && seen.has(parsed.startSceneId) ? parsed.startSceneId : scenes[0].id
  return {
    version: typeof parsed.version === 'number' ? parsed.version : ADVENTURE_VERSION,
    id: typeof parsed.id === 'string' && parsed.id.length > 0 ? parsed.id : `adv_${crypto.randomUUID()}`,
    name: typeof parsed.name === 'string' ? parsed.name : scenes[0].name,
    startSceneId,
    scenes: sanitizeSceneParents(scenes),
  }
}

export function serializeAdventure(adventure: Adventure): string {
  return JSON.stringify(adventure, null, 2)
}

// ───────────────────────────────────────────────────────────────────────────
// Cenas em pastas: a árvore que a lista Cenas mostra
// ───────────────────────────────────────────────────────────────────────────

/** O mínimo de uma cena para montar a árvore: o id e a cena de fora (ausente ou `null` = primeiro nível). */
export interface SceneNest {
  id: string
  parentId?: string | null
}

/** Uma linha da árvore, na ordem em que a lista Cenas a mostra. */
export interface SceneTreeRow<T extends SceneNest> {
  entry: T
  /** 0 = primeiro nível. */
  depth: number
  /** A cena de fora como a árvore a usa: pai que não está na lista conta como primeiro nível. */
  parentId: string | null
  /** As de dentro, na ordem da lista. */
  childIds: string[]
}

/** Separador do caminho que a lista mostra em cinza: "Costa Norte › Porto Cinza". */
export const SCENE_TRAIL_SEPARATOR = ' › '

/**
 * A lista em profundidade: cada cena seguida das de dentro dela, as irmãs na
 * ordem da lista. Por isso uma pasta e tudo o que ela tem dentro são sempre
 * linhas seguidas. Pai que não está na lista vira primeiro nível, e cena presa
 * num ciclo aparece uma vez, no primeiro nível — ninguém some.
 */
export function sceneTree<T extends SceneNest>(entries: readonly T[]): SceneTreeRow<T>[] {
  const ids = new Set(entries.map((entry) => entry.id))
  const parentOf = (entry: T): string | null => {
    const parent = entry.parentId ?? null
    return parent !== null && parent !== entry.id && ids.has(parent) ? parent : null
  }
  const children = new Map<string | null, T[]>()
  for (const entry of entries) {
    const key = parentOf(entry)
    const siblings = children.get(key)
    if (siblings === undefined) children.set(key, [entry])
    else siblings.push(entry)
  }
  const rows: SceneTreeRow<T>[] = []
  const visited = new Set<string>()
  const visit = (entry: T, depth: number, parentId: string | null) => {
    visited.add(entry.id)
    const row: SceneTreeRow<T> = { entry, depth, parentId, childIds: [] }
    rows.push(row)
    for (const child of children.get(entry.id) ?? []) {
      if (visited.has(child.id)) continue
      row.childIds.push(child.id)
      visit(child, depth + 1, entry.id)
    }
  }
  for (const entry of children.get(null) ?? []) visit(entry, 0, null)
  for (const entry of entries) if (!visited.has(entry.id)) visit(entry, 0, null)
  return rows
}

/** As cenas de fora de `sceneId`, da mais de fora para a mais de dentro (sem ela). */
export function sceneAncestorIds<T extends SceneNest>(entries: readonly T[], sceneId: string): string[] {
  const rows = sceneTree(entries)
  const byId = new Map(rows.map((row) => [row.entry.id, row]))
  const chain: string[] = []
  let parent = byId.get(sceneId)?.parentId ?? null
  while (parent !== null) {
    chain.unshift(parent)
    parent = byId.get(parent)?.parentId ?? null
  }
  return chain
}

/** `sceneId` e todas as cenas dentro dela, em qualquer profundidade. */
export function sceneSubtreeIds<T extends SceneNest>(entries: readonly T[], sceneId: string): Set<string> {
  const rows = sceneTree(entries)
  const start = rows.findIndex((row) => row.entry.id === sceneId)
  const ids = new Set<string>()
  if (start < 0) return ids
  ids.add(sceneId)
  for (let i = start + 1; i < rows.length && rows[i].depth > rows[start].depth; i += 1) ids.add(rows[i].entry.id)
  return ids
}

/** Os nomes das cenas de fora de `sceneId`, da mais de fora para a mais de dentro: o caminho em cinza do filtro. */
export function sceneTrail<T extends SceneNest & { name: string }>(entries: readonly T[], sceneId: string): string[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  return sceneAncestorIds(entries, sceneId).map((id) => byId.get(id)?.name ?? '')
}

/**
 * Dá para pôr `sceneId` dentro de `parentId` (`null` = primeiro nível)? Não
 * dentro dela mesma, nem de uma cena que já está dentro dela — a pasta ficaria
 * dentro de si e as duas sumiriam da árvore.
 */
export function canNestScene<T extends SceneNest>(entries: readonly T[], sceneId: string, parentId: string | null): boolean {
  if (!entries.some((entry) => entry.id === sceneId)) return false
  if (parentId === null) return true
  if (!entries.some((entry) => entry.id === parentId)) return false
  return !sceneSubtreeIds(entries, sceneId).has(parentId)
}

/**
 * A lista com `sceneId` dentro de `parentId` (`null` = primeiro nível), e o que
 * estava dentro dela vai junto. A cena passa para o FIM da lista: vira a última
 * de dentro da pasta nova. `null` quando não dá (ver `canNestScene`) ou quando
 * ela já está lá — não há o que gravar.
 */
export function nestScene(scenes: readonly SceneEntry[], sceneId: string, parentId: string | null): SceneEntry[] | null {
  const entry = scenes.find((scene) => scene.id === sceneId)
  if (entry === undefined || !canNestScene(scenes, sceneId, parentId)) return null
  if ((entry.parentId ?? null) === parentId) return null
  return [...scenes.filter((scene) => scene.id !== sceneId), withParent(entry, parentId)]
}

/**
 * As irmãs de `sceneId` — as cenas com a mesma cena de fora, ela inclusa —
 * na ordem em que a lista Cenas as mostra. Vazio quando ela não está na lista.
 */
export function sceneSiblingIds<T extends SceneNest>(entries: readonly T[], sceneId: string): string[] {
  const rows = sceneTree(entries)
  const row = rows.find((candidate) => candidate.entry.id === sceneId)
  if (row === undefined) return []
  return rows.filter((candidate) => candidate.parentId === row.parentId).map((candidate) => candidate.entry.id)
}

/**
 * "Subir" (`-1`) e "Descer" (`1`): `sceneId` troca de lugar com a irmã de cima
 * ou de baixo (`sceneSiblingIds`). Entre irmãs a árvore segue a ordem da
 * lista, então trocar as duas de posição na lista troca as duas na árvore — e
 * o que cada uma tem dentro vai junto, porque a árvore pendura as de dentro
 * pelo `parentId`, não pela posição. `null` na ponta da pasta.
 */
export function shiftSceneAmongSiblings(scenes: readonly SceneEntry[], sceneId: string, delta: -1 | 1): SceneEntry[] | null {
  const siblings = sceneSiblingIds(scenes, sceneId)
  const at = siblings.indexOf(sceneId)
  const neighborAt = at + delta
  if (at < 0 || neighborAt < 0 || neighborAt >= siblings.length) return null
  const from = scenes.findIndex((scene) => scene.id === sceneId)
  const to = scenes.findIndex((scene) => scene.id === siblings[neighborAt])
  const next = [...scenes]
  next[from] = scenes[to]
  next[to] = scenes[from]
  return next
}

/** Quantas cenas estão DIRETO dentro de `sceneId`: as que sobem um nível se ela for apagada. */
export function sceneChildCount<T extends SceneNest>(entries: readonly T[], sceneId: string): number {
  return sceneTree(entries).find((row) => row.entry.id === sceneId)?.childIds.length ?? 0
}

/**
 * A lista sem `sceneId`. As cenas de dentro dela não somem nem ficam com pai
 * pendurado: sobem um nível (vão para a cena de fora dela, ou para o primeiro
 * nível) e entram no LUGAR dela, na ordem em que estavam. As de dentro delas
 * continuam onde estavam. Cena que não está na lista: a mesma lista.
 */
export function removeSceneKeepingInside(scenes: readonly SceneEntry[], sceneId: string): SceneEntry[] {
  const row = sceneTree(scenes).find((candidate) => candidate.entry.id === sceneId)
  if (row === undefined) return [...scenes]
  const inside = new Set(row.childIds)
  const lifted = scenes.filter((scene) => inside.has(scene.id)).map((scene) => withParent(scene, row.parentId))
  const at = scenes.slice(0, scenes.findIndex((scene) => scene.id === sceneId)).filter((scene) => !inside.has(scene.id)).length
  const rest = scenes.filter((scene) => scene.id !== sceneId && !inside.has(scene.id))
  return [...rest.slice(0, at), ...lifted, ...rest.slice(at)]
}

/** Caminhos de portal antigo (`Prop.linkedMapPath`) que o mapa ainda carrega, sem repetição. */
export function legacyPortalPaths(map: MapData): string[] {
  const paths: string[] = []
  for (const prop of map.props) {
    const path = prop.linkedMapPath
    if (typeof path === 'string' && path.length > 0 && !paths.includes(path)) paths.push(path)
  }
  return paths
}

/**
 * O mesmo mapa com `linkedMapPath` zerado nos props que apontavam para um dos
 * `paths` — ou o MESMO objeto quando nenhum apontava.
 */
export function clearLegacyPortals(map: MapData, paths: readonly string[]): MapData {
  const clears = (target: string | null) => target !== null && paths.includes(target)
  if (!map.props.some((prop) => clears(prop.linkedMapPath))) return map
  return { ...map, props: map.props.map((prop) => (clears(prop.linkedMapPath) ? { ...prop, linkedMapPath: null } : prop)) }
}

/** Compara caminhos do jeito que o Windows compara: barra tanto faz, maiúscula também. */
export function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return norm(a) === norm(b)
}

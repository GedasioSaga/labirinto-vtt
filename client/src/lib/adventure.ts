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
  name: string
  /** Caminho do `map.json` da cena, relativo à pasta da aventura, sempre com `/`. */
  file: string
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
  const { id, name, file } = value
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof file !== 'string') return null
  return { id, name: typeof name === 'string' ? name : UNNAMED_SCENE, file }
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
    scenes,
  }
}

export function serializeAdventure(adventure: Adventure): string {
  return JSON.stringify(adventure, null, 2)
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

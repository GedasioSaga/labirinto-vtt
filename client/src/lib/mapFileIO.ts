import { writeTextFile, mkdir, exists, readTextFile } from '@tauri-apps/plugin-fs'
import { save, open } from '@tauri-apps/plugin-dialog'
import { appDataDir, join, dirname } from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/core'
import type { MapData } from '../types/map'
import { serializeMap, deserializeMap } from './mapFile'

export async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true })
  }
}

export async function defaultMapsDir(): Promise<string> {
  const base = await appDataDir()
  return join(base, 'maps')
}

function normalizePathSegments(path: string): string {
  const stack: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      stack.pop()
      continue
    }
    stack.push(segment)
  }
  return stack.join('/')
}

/**
 * Garante que `resolvedPath` fica dentro de `root` mesmo depois de resolver
 * segmentos `..`/`.` — proteção contra path traversal quando o path é montado
 * a partir de conteúdo não confiável (ex.: `map.id` vindo de um `map.json`
 * externo). Uma checagem ingênua de `startsWith` sem resolver `..` primeiro
 * não pega esse ataque, porque `"<root>/../../x"` já começa literalmente com
 * `"<root>/"`.
 */
export function assertPathWithinRoot(resolvedPath: string, root: string): void {
  const normalizedRoot = normalizePathSegments(root.replace(/\\/g, '/'))
  const normalizedPath = normalizePathSegments(resolvedPath.replace(/\\/g, '/'))
  const isWithinRoot = normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
  if (!isWithinRoot) {
    throw new Error(`Caminho de mapa inválido: "${resolvedPath}" está fora da pasta de mapas esperada.`)
  }
}

export async function mapDirFor(mapId: string): Promise<string> {
  const base = await defaultMapsDir()
  const mapDir = await join(base, mapId)
  assertPathWithinRoot(mapDir, base)
  return mapDir
}

export async function saveMapToAppData(map: MapData): Promise<string> {
  const mapDir = await mapDirFor(map.id)
  await ensureDir(mapDir)
  const filePath = await join(mapDir, 'map.json')
  await writeTextFile(filePath, serializeMap(map))
  return filePath
}

export async function loadMapFromDisk(path: string): Promise<MapData> {
  const dir = await dirname(path)
  await invoke('grant_fs_access', { path: dir })
  const content = await readTextFile(path)
  return deserializeMap(content)
}

export async function pickMapJsonToOpen(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Mapa Labirinto', extensions: ['json'] }],
  })
  return typeof selected === 'string' ? selected : null
}

export async function pickExportDestination(defaultName: string): Promise<string | null> {
  const selected = await save({ defaultPath: `${defaultName}.json` })
  return selected ?? null
}

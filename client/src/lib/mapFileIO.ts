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

export async function mapDirFor(mapId: string): Promise<string> {
  return join(await defaultMapsDir(), mapId)
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

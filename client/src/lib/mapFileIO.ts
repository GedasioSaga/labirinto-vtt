import { writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs'
import { save, open } from '@tauri-apps/plugin-dialog'
import { appDataDir, join } from '@tauri-apps/api/path'
import type { MapData } from '../types/map'
import { serializeMap } from './mapFile'

export async function defaultMapsDir(): Promise<string> {
  const base = await appDataDir()
  return join(base, 'maps')
}

export async function mapDirFor(mapId: string): Promise<string> {
  return join(await defaultMapsDir(), mapId)
}

export async function saveMapToAppData(map: MapData): Promise<string> {
  const mapDir = await mapDirFor(map.id)
  if (!(await exists(mapDir))) {
    await mkdir(mapDir, { recursive: true })
  }
  const filePath = await join(mapDir, 'map.json')
  await writeTextFile(filePath, serializeMap(map))
  return filePath
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

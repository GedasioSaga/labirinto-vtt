import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { copyFile, mkdir, exists, readDir, writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import type { MapData } from '../types/map'
import { serializeMap, deserializeMap } from './mapFile'

export async function pickExportFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false, title: 'Escolher pasta de destino' })
  return typeof selected === 'string' ? selected : null
}

export async function pickImportFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false, title: 'Escolher pasta do mapa a importar' })
  return typeof selected === 'string' ? selected : null
}

export async function exportMapFolder(map: MapData, sourceMapDir: string, destDir: string): Promise<void> {
  await invoke('grant_fs_access', { path: destDir })
  await invoke('grant_fs_access', { path: sourceMapDir })

  if (!(await exists(destDir))) {
    await mkdir(destDir, { recursive: true })
  }

  await writeTextFile(await join(destDir, 'map.json'), serializeMap(map))

  if (await exists(sourceMapDir)) {
    const entries = await readDir(sourceMapDir)
    for (const entry of entries) {
      if (!entry.name || entry.name === 'map.json') continue
      await copyFile(await join(sourceMapDir, entry.name), await join(destDir, entry.name))
    }
  }
}

export async function importMapFolder(sourceDir: string, appDataMapsDir: string): Promise<string> {
  await invoke('grant_fs_access', { path: sourceDir })

  const mapJsonPath = await join(sourceDir, 'map.json')
  const content = await readTextFile(mapJsonPath)
  const map = deserializeMap(content)

  const destDir = await join(appDataMapsDir, map.id)
  await invoke('grant_fs_access', { path: destDir })
  if (!(await exists(destDir))) {
    await mkdir(destDir, { recursive: true })
  }

  const entries = await readDir(sourceDir)
  for (const entry of entries) {
    if (!entry.name) continue
    await copyFile(await join(sourceDir, entry.name), await join(destDir, entry.name))
  }

  return map.id
}

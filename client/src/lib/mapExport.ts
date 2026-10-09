import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { copyFile, exists, readDir, readTextFile, type DirEntry } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import type { MapData } from '../types/map'
import { serializeMap, deserializeMap } from './mapFile'
import { ensureDir, assertPathWithinRoot, copyDirRecursive, rebaseMapImagePaths, writeTextFileSafely } from './mapFileIO'
import { levarMidiaDoMapaSolto } from './midiaDaPasta'

export async function pickExportFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false, title: 'Escolher pasta de destino' })
  return typeof selected === 'string' ? selected : null
}

export async function pickImportFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false, title: 'Escolher pasta do mapa a importar' })
  return typeof selected === 'string' ? selected : null
}

/**
 * Copia a pasta do mapa para `destDir` (pendrive, nuvem, pasta compartilhada).
 *
 * O `map.json` gravado no destino é o mapa com os caminhos de imagem
 * REAPONTADOS para `destDir`: as imagens sempre foram copiadas junto, mas o
 * arquivo continuava apontando para a pasta da máquina de origem, então o mapa
 * compartilhado abria sem fundo e sem token do outro lado. Quem reimporta a
 * pasta cai em `importMapFolder`, que reaponta de novo para a pasta local.
 */
export async function exportMapFolder(map: MapData, sourceMapDir: string, destDir: string): Promise<void> {
  await invoke('grant_fs_access', { path: destDir })
  await invoke('grant_fs_access', { path: sourceMapDir })

  await ensureDir(destDir)

  const destMapJsonPath = await join(destDir, 'map.json')
  await writeTextFileSafely(destMapJsonPath, serializeMap(rebaseMapImagePaths(map, sourceMapDir, destDir)))

  if (await exists(sourceMapDir)) {
    const entries = await readDir(sourceMapDir)
    for (const entry of entries) {
      if (!entry.name || entry.name === 'map.json') continue
      await copyEntry(entry, sourceMapDir, destDir)
    }
  }
  // A mídia das mochilas vai na pasta irmã do `map.json` exportado, mesmo a que
  // a pasta de origem ainda não tinha (mapa não salvo depois de ganhar o item).
  await levarMidiaDoMapaSolto(destMapJsonPath, map)
}

/**
 * Uma entrada da pasta do mapa: subpasta (a mídia do mapa, `lib/midiaDaPasta.ts`)
 * vai inteira — `copyFile` numa pasta falha e derrubava a exportação inteira.
 */
async function copyEntry(entry: DirEntry, fromDir: string, toDir: string): Promise<void> {
  const from = await join(fromDir, entry.name)
  const to = await join(toDir, entry.name)
  if (entry.isDirectory) await copyDirRecursive(from, to)
  else await copyFile(from, to)
}

export async function importMapFolder(sourceDir: string, appDataMapsDir: string): Promise<string> {
  await invoke('grant_fs_access', { path: sourceDir })

  const mapJsonPath = await join(sourceDir, 'map.json')
  const content = await readTextFile(mapJsonPath)
  const map = deserializeMap(content)

  const destDir = await join(appDataMapsDir, map.id)
  assertPathWithinRoot(destDir, appDataMapsDir)
  await invoke('grant_fs_access', { path: destDir })
  await ensureDir(destDir)

  const entries = await readDir(sourceDir)
  for (const entry of entries) {
    if (!entry.name) continue
    // A pasta irmã da mídia vem junto; quem a traz para `<appData>/midia` é a abertura (`openMapFileFirst`).
    await copyEntry(entry, sourceDir, destDir)
  }

  // O `map.json` copiado acima ainda aponta para a pasta de onde veio (o
  // pendrive, a pasta do amigo). Reapontar para a pasta local é o que faz o
  // mapa importado abrir COM fundo e COM token; nada a reescrever quando as
  // imagens já são relativas ou moram fora da pasta do mapa.
  const rebased = rebaseMapImagePaths(map, sourceDir, destDir)
  if (rebased !== map) {
    await writeTextFileSafely(await join(destDir, 'map.json'), serializeMap(rebased))
  }

  return map.id
}

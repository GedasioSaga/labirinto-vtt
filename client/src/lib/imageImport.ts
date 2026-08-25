import { open } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import { dirname, join } from '@tauri-apps/api/path'
import { computeResampleDimensions } from './imageResample'
import { ensureDir } from './mapFileIO'

export const MAX_BACKGROUND_SIDE = 4096

export async function pickBackgroundImage(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  })
  return typeof selected === 'string' ? selected : null
}

export async function importBackgroundImage(sourcePath: string, mapDir: string): Promise<string> {
  const sourceDir = await dirname(sourcePath)
  await invoke('grant_fs_access', { path: sourceDir })
  await invoke('grant_fs_access', { path: mapDir })

  const bytes = await readFile(sourcePath)
  const blob = new Blob([bytes])
  const bitmap = await createImageBitmap(blob)

  const { width, height, needsResample } = computeResampleDimensions(bitmap.width, bitmap.height, MAX_BACKGROUND_SIDE)

  await ensureDir(mapDir)

  const originalExt = sourcePath.split('.').pop() ?? 'png'
  const originalDest = await join(mapDir, `background_original.${originalExt}`)
  await writeFile(originalDest, bytes)

  if (!needsResample) {
    return originalDest
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D não disponível')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const resampledBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao gerar WebP'))),
      'image/webp',
      0.92,
    )
  })
  const resampledBytes = new Uint8Array(await resampledBlob.arrayBuffer())
  const resampledDest = await join(mapDir, 'background.webp')
  await writeFile(resampledDest, resampledBytes)
  return resampledDest
}

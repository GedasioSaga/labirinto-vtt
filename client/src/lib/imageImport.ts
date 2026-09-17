import { open } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { dirname, join } from '@tauri-apps/api/path'
import { computeResampleDimensions } from './imageResample'
import { ensureDir } from './mapFileIO'
import { buildTokenPhotoData } from './tokenPhoto'

export const MAX_BACKGROUND_SIDE = 4096
export const MAX_PROP_SIDE = 1024

/**
 * Razão, em português, de por que não dá para escolher uma imagem quando a
 * tela não está rodando dentro do aplicativo. Exportada para quem monta o
 * aviso reaproveitar a mesma redação (e para o teste conferir que ela fala de
 * falha, não de detalhe técnico).
 */
export const IMAGE_PICKER_UNAVAILABLE_MESSAGE =
  'escolher imagem só funciona no aplicativo instalado do Labirinto — no navegador a página não tem acesso aos arquivos do computador'

/**
 * Falha esperada (não é bug): o seletor de arquivo do sistema não existe fora
 * do aplicativo. Tem classe própria para quem chama poder distinguir isto de
 * um erro de leitura/gravação de verdade sem comparar string de mensagem.
 */
export class ImagePickerUnavailableError extends Error {
  constructor() {
    super(IMAGE_PICKER_UNAVAILABLE_MESSAGE)
    this.name = 'ImagePickerUnavailableError'
  }
}

export async function pickImageFile(): Promise<string | null> {
  // Mesmo guarda que o projeto já usa para código que só existe dentro do
  // webview do Tauri (App.tsx:380 e :549). Sem ele, `open()` vai direto em
  // `window.__TAURI_INTERNALS__.invoke` e estoura "Cannot read properties of
  // undefined (reading 'invoke')" — mensagem que não diz nada a quem usa.
  //
  // Lança em vez de devolver `null` DE PROPÓSITO: `null` aqui já significa
  // "a pessoa cancelou o diálogo", e cancelar não é falha; quem chama precisa
  // conseguir separar os dois casos para só avisar no segundo.
  if (!isTauri()) throw new ImagePickerUnavailableError()

  const selected = await open({
    multiple: false,
    filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  })
  return typeof selected === 'string' ? selected : null
}

export async function pickBackgroundImage(): Promise<string | null> {
  return pickImageFile()
}

interface ImportedImage {
  destPath: string
  width: number
  height: number
}

async function importImageAsset(sourcePath: string, mapDir: string, baseName: string, maxSide: number): Promise<ImportedImage> {
  const sourceDir = await dirname(sourcePath)
  await invoke('grant_fs_access', { path: sourceDir })
  await invoke('grant_fs_access', { path: mapDir })

  const bytes = await readFile(sourcePath)
  const blob = new Blob([bytes])
  const bitmap = await createImageBitmap(blob)

  const { width, height, needsResample } = computeResampleDimensions(bitmap.width, bitmap.height, maxSide)

  await ensureDir(mapDir)

  const originalExt = sourcePath.split('.').pop() ?? 'png'
  const originalDest = await join(mapDir, `${baseName}_original.${originalExt}`)
  await writeFile(originalDest, bytes)

  if (!needsResample) {
    return { destPath: originalDest, width: bitmap.width, height: bitmap.height }
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
  const resampledDest = await join(mapDir, `${baseName}.webp`)
  await writeFile(resampledDest, resampledBytes)
  return { destPath: resampledDest, width, height }
}

export async function importBackgroundImage(sourcePath: string, mapDir: string): Promise<string> {
  const result = await importImageAsset(sourcePath, mapDir, 'background', MAX_BACKGROUND_SIDE)
  return result.destPath
}

export async function importPropImage(sourcePath: string, mapDir: string, propId: string): Promise<ImportedImage> {
  return importImageAsset(sourcePath, mapDir, `prop_${propId}`, MAX_PROP_SIDE)
}

/** Mesmo pipeline e mesmo teto de reamostragem de importPropImage (MAX_PROP_SIDE,
 *  1024px) — token com imagem não precisa de resolução maior que uma peça. */
export async function importTokenImage(sourcePath: string, mapDir: string, tokenId: string): Promise<ImportedImage> {
  return importImageAsset(sourcePath, mapDir, `token_${tokenId}`, MAX_PROP_SIDE)
}

/**
 * Cópia pequena e auto-contida da MESMA foto, para o token do mestre poder
 * aparecer na tela do jogador. O arquivo de `importTokenImage` fica no disco
 * do mestre e nunca sai de lá (lib/fogFilter.ts); é esta referência que viaja.
 *
 * Chamar DEPOIS de `importTokenImage`: é ele que concede o acesso de leitura à
 * pasta de origem (`grant_fs_access`).
 */
export async function buildTokenSharedPhoto(sourcePath: string): Promise<string> {
  const bytes = await readFile(sourcePath)
  return buildTokenPhotoData(new Blob([bytes]))
}

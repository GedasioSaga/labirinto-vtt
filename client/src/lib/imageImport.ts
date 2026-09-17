import { open } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { dirname, join } from '@tauri-apps/api/path'
import { computeResampleDimensions } from './imageResample'
import { ensureDir } from './mapFileIO'

export const MAX_BACKGROUND_SIDE = 4096
export const MAX_PROP_SIDE = 1024
/**
 * Imagem do cartão do ponto de interesse. Menor que a da Peça de propósito: ela
 * viaja EMBUTIDA no mapa (data URL) e o mapa inteiro é reenviado ao jogador a
 * cada snapshot — 640px em WebP cabe num cartão de celular sem engordar a rede
 * a cada movimento de token.
 */
export const MAX_PIN_SIDE = 640
/** Qualidade do WebP do cartão: acima disto o arquivo cresce sem o olho ganhar. */
const PIN_IMAGE_QUALITY = 0.8

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

/** Blob → `data:image/...;base64,...`, que é a forma que o cartão do pino guarda. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler a imagem escolhida'))
    reader.onload = () => {
      // `readAsDataURL` sempre produz string; o tipo do DOM abre para
      // ArrayBuffer por causa dos outros modos de leitura.
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Falha ao converter a imagem escolhida'))
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Imagem do cartão do ponto de interesse, EMBUTIDA: devolve uma data URL, não
 * um caminho de arquivo. É essa a razão de este importador ser diferente dos
 * outros — o cartão precisa aparecer na tela do jogador, e caminho do disco do
 * mestre nunca sai pela rede (`lib/fogFilter.ts`). Nada é gravado na pasta do
 * mapa: a imagem vive dentro do `map.json`, junto do pino.
 */
export async function importPinImage(sourcePath: string): Promise<string> {
  const sourceDir = await dirname(sourcePath)
  await invoke('grant_fs_access', { path: sourceDir })

  const bytes = await readFile(sourcePath)
  const bitmap = await createImageBitmap(new Blob([bytes]))
  const { width, height } = computeResampleDimensions(bitmap.width, bitmap.height, MAX_PIN_SIDE)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D não disponível')
  ctx.drawImage(bitmap, 0, 0, width, height)

  // Sempre reencodado, mesmo sem reduzir de tamanho: um PNG de 2 MB viraria 2,7 MB
  // em base64 dentro de cada snapshot, e o cartão não precisa dessa fidelidade.
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao gerar WebP'))),
      'image/webp',
      PIN_IMAGE_QUALITY,
    )
  })
  return blobToDataUrl(blob)
}

/** Mesmo pipeline e mesmo teto de reamostragem de importPropImage (MAX_PROP_SIDE,
 *  1024px) — token com imagem não precisa de resolução maior que uma peça. */
export async function importTokenImage(sourcePath: string, mapDir: string, tokenId: string): Promise<ImportedImage> {
  return importImageAsset(sourcePath, mapDir, `token_${tokenId}`, MAX_PROP_SIDE)
}

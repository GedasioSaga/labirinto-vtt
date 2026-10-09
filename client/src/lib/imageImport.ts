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
  const bytes = await readFile(sourcePath)
  return importImageBytes(bytes, sourcePath.split('.').pop() ?? 'png', mapDir, baseName, maxSide)
}

/**
 * O miolo de `importImageAsset`, com os bytes já na mão (de um arquivo lido
 * do disco, ou de uma imagem colada/solta): grava o original e, se passa do
 * teto, a versão reamostrada em WebP, na pasta do mapa.
 */
async function importImageBytes(bytes: Uint8Array, originalExt: string, mapDir: string, baseName: string, maxSide: number): Promise<ImportedImage> {
  await invoke('grant_fs_access', { path: mapDir })

  const blob = new Blob([bytes])
  const bitmap = await createImageBitmap(blob)

  const { width, height, needsResample } = computeResampleDimensions(bitmap.width, bitmap.height, maxSide)

  await ensureDir(mapDir)

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
  return pinImageFromBlob(new Blob([bytes]))
}

/**
 * Mesmo resultado de `importPinImage`, a partir da imagem já em memória: a que
 * o mestre COLA (Ctrl+V) ou SOLTA arrastando no painel do pino. Não há caminho
 * de disco nem pasta para liberar — o navegador já entregou os bytes.
 */
export async function pinImageFromBlob(source: Blob): Promise<string> {
  return blobToDataUrl(await pinSizedWebp(source))
}

/**
 * A imagem no tamanho do cartão do pino: até `MAX_PIN_SIDE` e SEMPRE
 * reencodada em WebP, mesmo sem reduzir de tamanho — um PNG de 2 MB viraria
 * 2,7 MB em base64 dentro de cada snapshot, e o cartão não precisa dessa
 * fidelidade. Serve também à imagem do item do acervo (`lib/imagemDoItem.ts`),
 * que a entrega 5 põe no mapa como pino.
 */
export async function pinSizedWebp(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  const { width, height } = computeResampleDimensions(bitmap.width, bitmap.height, MAX_PIN_SIDE)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D não disponível')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao gerar WebP'))),
      'image/webp',
      PIN_IMAGE_QUALITY,
    )
  })
}

/** Mesmo pipeline e mesmo teto de reamostragem de importPropImage (MAX_PROP_SIDE,
 *  1024px) — token com imagem não precisa de resolução maior que uma peça. */
export async function importTokenImage(sourcePath: string, mapDir: string, tokenId: string): Promise<ImportedImage> {
  return importImageAsset(sourcePath, mapDir, `token_${tokenId}`, MAX_PROP_SIDE)
}

/**
 * Extensão do original de uma imagem colada ou solta, pelo tipo que o
 * navegador deu: as mesmas que o "Trocar imagem..." aceita no diálogo
 * (`pickImageFile`). Outro tipo (SVG, BMP, HEIC…) = `null`.
 */
const EXTENSAO_DO_TIPO: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

export const TOKEN_IMAGE_TYPE_MESSAGE = 'essa imagem não é PNG, JPG, WebP nem GIF — os formatos que o token aceita'

/**
 * Teto, em bytes, da imagem colada ou solta no token. O original é gravado
 * inteiro na pasta do mapa (como o do diálogo), e um arrasto errado não pode
 * despejar um arquivo gigante lá. O diálogo não tem teto porque a pessoa
 * escolheu o arquivo pelo nome; aqui pode ter vindo qualquer coisa.
 */
export const MAX_TOKEN_IMAGE_BYTES = 25 * 1024 * 1024

export const TOKEN_IMAGE_SIZE_MESSAGE = `essa imagem passa de ${MAX_TOKEN_IMAGE_BYTES / (1024 * 1024)} MB`

/**
 * Mesmo resultado de `importTokenImage`, a partir da imagem já em memória: a
 * que o mestre COLA (Ctrl+V) ou SOLTA arrastando em "Imagem do token". Mesmo
 * arquivo na pasta do mapa (`token_<id>_original.<ext>`, e a versão WebP
 * reamostrada quando passa de `MAX_PROP_SIDE`). Recusa tipo fora da lista do
 * diálogo e imagem acima de `MAX_TOKEN_IMAGE_BYTES`.
 */
export async function importTokenImageFromBlob(source: Blob, mapDir: string, tokenId: string): Promise<ImportedImage> {
  const ext = EXTENSAO_DO_TIPO[source.type]
  if (ext === undefined) throw new Error(TOKEN_IMAGE_TYPE_MESSAGE)
  if (source.size > MAX_TOKEN_IMAGE_BYTES) throw new Error(TOKEN_IMAGE_SIZE_MESSAGE)
  const bytes = new Uint8Array(await source.arrayBuffer())
  return importImageBytes(bytes, ext, mapDir, `token_${tokenId}`, MAX_PROP_SIDE)
}

/** A cópia que viaja ao jogador (`buildTokenSharedPhoto`), da imagem colada ou solta. */
export async function buildTokenSharedPhotoFromBlob(source: Blob): Promise<string> {
  return buildTokenPhotoData(source)
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

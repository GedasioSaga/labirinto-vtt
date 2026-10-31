import { exists, readFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { bytesDaDataUrl, idDaRef } from '../midia'
import { pastaDaMidia } from '../midiaNoDisco'
import { TIPOS_DA_IMAGEM, type ImagemDaIa, type TipoDaImagem } from './portaDaIa'

/**
 * OS RETRATOS QUE VÃO À IA (M4, decisão D9): só das fichas na conversa, no
 * máximo 4, reduzidos a 512 px no lado maior antes de sair. O retrato da
 * ficha é referência de mídia (`midia:<id>`, lida da pasta da mídia pelo
 * plugin-fs) ou a embutida antiga (`data:image/...`). Sem `fetch` e sem URL
 * de fora: os bytes saem do disco do mestre e voltam como base64.
 */

/** O lado maior do retrato que sai (decisão D9). */
export const RETRATO_DA_IA_LADO_MAX = 512
const QUALIDADE = 0.85
/** WebP guarda a transparência e pesa pouco; se a webview não souber, o canvas devolve PNG. */
const TIPO_PREFERIDO: TipoDaImagem = 'image/webp'

async function bytesDoRetrato(retrato: string): Promise<Uint8Array | null> {
  const embutida = bytesDaDataUrl(retrato)
  if (embutida !== null) return embutida
  const id = idDaRef(retrato)
  if (id === null) return null
  const caminho = await join(await pastaDaMidia(), id)
  if (!(await exists(caminho))) return null
  return readFile(caminho)
}

function ehTipoDaImagem(tipo: string): tipo is TipoDaImagem {
  return TIPOS_DA_IMAGEM.some((aceito) => aceito === tipo)
}

function blobDoCanvas(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolver) => canvas.toBlob(resolver, TIPO_PREFERIDO, QUALIDADE))
}

function base64DoBlob(blob: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader()
    leitor.onload = () => {
      const url = typeof leitor.result === 'string' ? leitor.result : ''
      const virgula = url.indexOf(',')
      if (virgula < 0) rejeitar(new Error('o retrato não virou base64'))
      else resolver(url.slice(virgula + 1))
    }
    leitor.onerror = () => rejeitar(leitor.error ?? new Error('o retrato não virou base64'))
    leitor.readAsDataURL(blob)
  })
}

/** O tamanho reduzido: o lado maior cabe em `RETRATO_DA_IA_LADO_MAX`, nunca aumenta. */
export function tamanhoReduzido(largura: number, altura: number): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)
  if (maior <= RETRATO_DA_IA_LADO_MAX || maior <= 0) return { largura: Math.max(1, largura), altura: Math.max(1, altura) }
  const escala = RETRATO_DA_IA_LADO_MAX / maior
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) }
}

/**
 * O retrato pronto para a IA. `null` quando não há o que mandar: sem retrato,
 * arquivo que sumiu da pasta, imagem que a webview não decodifica. Nunca
 * lança: retrato faltando não impede a pergunta.
 */
export async function retratoParaIa(retrato: string | null): Promise<ImagemDaIa | null> {
  if (retrato === null) return null
  try {
    const bytes = await bytesDoRetrato(retrato)
    if (bytes === null) return null
    const imagem = await createImageBitmap(new Blob([bytes]))
    const { largura, altura } = tamanhoReduzido(imagem.width, imagem.height)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const contexto = canvas.getContext('2d')
    if (contexto === null) {
      imagem.close()
      return null
    }
    contexto.imageSmoothingQuality = 'high'
    contexto.drawImage(imagem, 0, 0, largura, altura)
    imagem.close()
    const blob = await blobDoCanvas(canvas)
    if (blob === null || !ehTipoDaImagem(blob.type)) return null
    return { mimeType: blob.type, base64: await base64DoBlob(blob) }
  } catch {
    return null
  }
}

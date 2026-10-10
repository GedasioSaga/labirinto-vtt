import { readFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import { dirname } from '@tauri-apps/api/path'
import { MAX_TOKEN_IMAGE_BYTES, pickImageFile, TOKEN_IMAGE_SIZE_MESSAGE } from './imageImport'
import { ehImagemDeCarimboImportado, IMAGEM_DO_CARIMBO_MAX_CHARS, nomeDoCarimbo } from './carimbos'

/**
 * IMPORTAR CARIMBO: a imagem do mestre (uma árvore, um castelo, um farol, de
 * preferência PNG com fundo transparente) vira um objeto da ferramenta
 * Carimbos (`MapData.carimbosImportados`), pelos mesmos três caminhos da
 * textura importada (colar, soltar arrastando, ou escolher no computador).
 *
 * O mesmo cuidado de tamanho das imagens do app (`imageImport.ts`):
 * - tipo e tamanho conferidos ANTES de decodificar;
 * - a margem transparente é cortada (senão o objeto sai pequeno no meio do
 *   quadro e o clique não cai no pé dele);
 * - reduzida para o lado maior com `LADO_DO_IMPORTADO` px, SEM recortar e sem
 *   perder a transparência — o objeto é a silhueta; a sombra sai dela
 *   (`carimbos/arte.ts`). Em WebP; o navegador que não grava WebP grava PNG.
 */

export const LADO_DO_IMPORTADO = 256
const TIPOS_ACEITOS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const QUALIDADES = [0.9, 0.8, 0.65]
/** Pixel com menos que isto de opacidade conta como fundo (o halo do recorte do mestre). */
const ALFA_DO_FUNDO = 10

export const CARIMBO_NAO_E_IMAGEM = 'essa imagem não é PNG, JPG, WebP nem GIF — os formatos que o carimbo aceita'
export const CARIMBO_PESADO_DEMAIS = 'essa imagem ficou pesada demais para virar carimbo — escolha outra'
export const CARIMBO_NAO_ABRIU = 'não deu para abrir essa imagem'
export const CARIMBO_VAZIO = 'essa imagem é toda transparente — não há o que carimbar'

/** O nome que o carimbo ganha: o do arquivo sem a extensão ("farol.png" → "farol"). */
export function nomeDoArquivoDoCarimbo(arquivo: string): string {
  const base = arquivo.split(/[/\\]/).pop() ?? ''
  const ponto = base.lastIndexOf('.')
  return nomeDoCarimbo(ponto > 0 ? base.slice(0, ponto) : base)
}

export interface Caixa {
  x: number
  y: number
  largura: number
  altura: number
}

/** A caixa do que não é fundo transparente, ou `null` quando a imagem é toda transparente. */
export function caixaDoConteudo(alfas: ArrayLike<number>, largura: number, altura: number, passo = 4): Caixa | null {
  let minX = largura
  let minY = altura
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (alfas[(y * largura + x) * passo + (passo - 1)] < ALFA_DO_FUNDO) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, largura: maxX - minX + 1, altura: maxY - minY + 1 }
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader()
    leitor.onload = () => (typeof leitor.result === 'string' ? resolver(leitor.result) : rejeitar(new Error(CARIMBO_NAO_ABRIU)))
    leitor.onerror = () => rejeitar(new Error(CARIMBO_NAO_ABRIU))
    leitor.readAsDataURL(blob)
  })
}

function tela(largura: number, altura: number): { tela: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const t = document.createElement('canvas')
  t.width = largura
  t.height = altura
  const g = t.getContext('2d', { willReadFrequently: true })
  if (g === null) throw new Error('Canvas 2D não disponível')
  return { tela: t, g }
}

function webp(t: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolver, rejeitar) => {
    t.toBlob((blob) => (blob === null ? rejeitar(new Error(CARIMBO_NAO_ABRIU)) : resolver(blob)), 'image/webp', qualidade)
  })
}

/**
 * A imagem (colada, solta ou lida do disco) → a imagem embutida do carimbo
 * (`data:image/webp;base64,...`). Lança com a frase pronta para o aviso.
 */
export async function imagemDoCarimbo(fonte: Blob): Promise<string> {
  if (!TIPOS_ACEITOS.has(fonte.type)) throw new Error(CARIMBO_NAO_E_IMAGEM)
  if (fonte.size > MAX_TOKEN_IMAGE_BYTES) throw new Error(TOKEN_IMAGE_SIZE_MESSAGE)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(fonte)
  } catch {
    throw new Error(CARIMBO_NAO_ABRIU)
  }
  // Primeiro numa tela de até o dobro do lado final (ler os pixels de uma foto
  // enorme inteira custaria caro só para achar a margem).
  const previa = Math.min(1, (LADO_DO_IMPORTADO * 2) / Math.max(bitmap.width, bitmap.height))
  const larguraPrevia = Math.max(1, Math.round(bitmap.width * previa))
  const alturaPrevia = Math.max(1, Math.round(bitmap.height * previa))
  const inteira = tela(larguraPrevia, alturaPrevia)
  inteira.g.drawImage(bitmap, 0, 0, larguraPrevia, alturaPrevia)
  bitmap.close()
  const caixa = caixaDoConteudo(inteira.g.getImageData(0, 0, larguraPrevia, alturaPrevia).data, larguraPrevia, alturaPrevia)
  if (caixa === null) throw new Error(CARIMBO_VAZIO)
  const escala = Math.min(1, LADO_DO_IMPORTADO / Math.max(caixa.largura, caixa.altura))
  const final = tela(Math.max(1, Math.round(caixa.largura * escala)), Math.max(1, Math.round(caixa.altura * escala)))
  final.g.imageSmoothingQuality = 'high'
  final.g.drawImage(inteira.tela, caixa.x, caixa.y, caixa.largura, caixa.altura, 0, 0, final.tela.width, final.tela.height)
  for (const qualidade of QUALIDADES) {
    const dataUrl = await blobParaDataUrl(await webp(final.tela, qualidade))
    if (dataUrl.length <= IMAGEM_DO_CARIMBO_MAX_CHARS && ehImagemDeCarimboImportado(dataUrl)) return dataUrl
  }
  throw new Error(CARIMBO_PESADO_DEMAIS)
}

/** "Escolher imagem…" no app instalado: `null` quando o mestre cancela. Fora do app, `pickImageFile` lança o aviso dele. */
export async function escolherImagemDeCarimbo(): Promise<{ nome: string; imagem: string } | null> {
  const arquivo = await pickImageFile()
  if (arquivo === null) return null
  // A pasta escolhida no diálogo é liberada para leitura, como no "Escolher imagem…" do token.
  await invoke('grant_fs_access', { path: await dirname(arquivo) })
  const bytes = await readFile(arquivo)
  const extensao = arquivo.slice(arquivo.lastIndexOf('.') + 1).toLowerCase()
  const tipo = extensao === 'jpg' || extensao === 'jpeg' ? 'image/jpeg' : `image/${extensao}`
  return { nome: nomeDoArquivoDoCarimbo(arquivo), imagem: await imagemDoCarimbo(new Blob([bytes.slice().buffer], { type: tipo })) }
}

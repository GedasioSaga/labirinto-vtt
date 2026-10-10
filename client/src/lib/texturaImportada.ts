import { readFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import { dirname } from '@tauri-apps/api/path'
import { MAX_TOKEN_IMAGE_BYTES, pickImageFile, TOKEN_IMAGE_SIZE_MESSAGE } from './imageImport'
import { ehImagemDeTexturaImportada, IMAGEM_IMPORTADA_MAX_CHARS, nomeDaTextura } from './texturas'

/**
 * IMPORTAR TEXTURA: a imagem do mestre vira um ladrilho que se repete no mapa
 * (`MapData.texturasImportadas`), pelos mesmos três caminhos da imagem do
 * pino (colar, soltar arrastando, ou escolher no computador).
 *
 * O mesmo cuidado de tamanho das imagens do app (`imageImport.ts`):
 * - tipo e tamanho conferidos ANTES de decodificar;
 * - recortada no quadrado do meio e reduzida a `LADO_DA_IMPORTADA` px (lado
 *   em potência de 2: a placa de vídeo repete e reduz sozinha), sempre em
 *   WebP — o ladrilho viaja embutido no mapa para a mesa, como a imagem do pino;
 * - EMENDA: foto não repete sem costura. O ladrilho sai da foto deslocada
 *   meio lado (cuja borda casa com a do outro lado por construção) com a foto
 *   inteira por cima, esfumada até sumir na borda. A borda do ladrilho é a da
 *   cópia deslocada, então não há risco reto onde um ladrilho encosta no outro.
 */

export const LADO_DA_IMPORTADA = 256
const TIPOS_ACEITOS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
/** Qualidades tentadas até o ladrilho caber no teto do mapa. */
const QUALIDADES = [0.86, 0.75, 0.6]

export const TEXTURA_NAO_E_IMAGEM = 'essa imagem não é PNG, JPG, WebP nem GIF — os formatos que a textura aceita'
export const TEXTURA_PESADA_DEMAIS = 'essa imagem ficou pesada demais para virar textura — escolha outra'
export const TEXTURA_NAO_ABRIU = 'não deu para abrir essa imagem'

/** O nome que a textura ganha: o do arquivo sem a extensão ("musgo.png" → "musgo"). */
export function nomeDoArquivo(arquivo: string): string {
  const base = arquivo.split(/[/\\]/).pop() ?? ''
  const ponto = base.lastIndexOf('.')
  return nomeDaTextura(ponto > 0 ? base.slice(0, ponto) : base)
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader()
    leitor.onload = () => (typeof leitor.result === 'string' ? resolver(leitor.result) : rejeitar(new Error(TEXTURA_NAO_ABRIU)))
    leitor.onerror = () => rejeitar(new Error(TEXTURA_NAO_ABRIU))
    leitor.readAsDataURL(blob)
  })
}

function tela(lado: number): { tela: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const t = document.createElement('canvas')
  t.width = lado
  t.height = lado
  const g = t.getContext('2d')
  if (g === null) throw new Error('Canvas 2D não disponível')
  return { tela: t, g }
}

/** Degradê de borda: transparente na ponta, cheio do 28% ao 72%. */
function degradeDaBorda(g: CanvasRenderingContext2D, x1: number, y1: number): CanvasGradient {
  const d = g.createLinearGradient(0, 0, x1, y1)
  d.addColorStop(0, 'rgba(255,255,255,0)')
  d.addColorStop(0.28, 'rgba(255,255,255,1)')
  d.addColorStop(0.72, 'rgba(255,255,255,1)')
  d.addColorStop(1, 'rgba(255,255,255,0)')
  return d
}

/** O ladrilho sem emenda da imagem (já no tamanho final). */
function ladrilhoSemEmenda(fonte: CanvasImageSource, sx: number, sy: number, lado: number): HTMLCanvasElement {
  const L = LADO_DA_IMPORTADA
  const meio = L / 2
  const foto = tela(L)
  foto.g.drawImage(fonte, sx, sy, lado, lado, 0, 0, L, L)
  // A cópia deslocada meio lado nas duas direções (os quatro quadrantes trocados).
  const final = tela(L)
  for (const [dx, dy] of [
    [0, 0],
    [-L, 0],
    [0, -L],
    [-L, -L],
  ]) {
    final.g.drawImage(foto.tela, meio + dx, meio + dy)
  }
  // A foto por cima, esfumada até sumir nas quatro bordas.
  const mascara = tela(L)
  mascara.g.fillStyle = degradeDaBorda(mascara.g, L, 0)
  mascara.g.fillRect(0, 0, L, L)
  mascara.g.globalCompositeOperation = 'destination-in'
  mascara.g.fillStyle = degradeDaBorda(mascara.g, 0, L)
  mascara.g.fillRect(0, 0, L, L)
  foto.g.globalCompositeOperation = 'destination-in'
  foto.g.drawImage(mascara.tela, 0, 0)
  final.g.drawImage(foto.tela, 0, 0)
  return final.tela
}

function webp(t: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolver, rejeitar) => {
    t.toBlob((blob) => (blob === null ? rejeitar(new Error(TEXTURA_NAO_ABRIU)) : resolver(blob)), 'image/webp', qualidade)
  })
}

/**
 * A imagem (colada, solta ou lida do disco) → o ladrilho embutido
 * (`data:image/webp;base64,...`). Lança com a frase pronta para o aviso.
 */
export async function ladrilhoDaImagem(fonte: Blob): Promise<string> {
  if (!TIPOS_ACEITOS.has(fonte.type)) throw new Error(TEXTURA_NAO_E_IMAGEM)
  if (fonte.size > MAX_TOKEN_IMAGE_BYTES) throw new Error(TOKEN_IMAGE_SIZE_MESSAGE)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(fonte)
  } catch {
    throw new Error(TEXTURA_NAO_ABRIU)
  }
  // O quadrado do meio: a textura é quadrada, e esticar a foto deformaria o desenho dela.
  const lado = Math.min(bitmap.width, bitmap.height)
  const ladrilho = ladrilhoSemEmenda(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado)
  bitmap.close()
  for (const qualidade of QUALIDADES) {
    const dataUrl = await blobParaDataUrl(await webp(ladrilho, qualidade))
    if (dataUrl.length <= IMAGEM_IMPORTADA_MAX_CHARS && ehImagemDeTexturaImportada(dataUrl)) return dataUrl
  }
  throw new Error(TEXTURA_PESADA_DEMAIS)
}

/** "Escolher imagem…" no app instalado: `null` quando o mestre cancela. Fora do app, `pickImageFile` lança o aviso dele. */
export async function escolherImagemDeTextura(): Promise<{ nome: string; imagem: string } | null> {
  const arquivo = await pickImageFile()
  if (arquivo === null) return null
  // A pasta escolhida no diálogo é liberada para leitura, como no "Escolher imagem…" do token.
  await invoke('grant_fs_access', { path: await dirname(arquivo) })
  const bytes = await readFile(arquivo)
  const extensao = arquivo.slice(arquivo.lastIndexOf('.') + 1).toLowerCase()
  const tipo = extensao === 'jpg' || extensao === 'jpeg' ? 'image/jpeg' : `image/${extensao}`
  return { nome: nomeDoArquivo(arquivo), imagem: await ladrilhoDaImagem(new Blob([bytes.slice().buffer], { type: tipo })) }
}

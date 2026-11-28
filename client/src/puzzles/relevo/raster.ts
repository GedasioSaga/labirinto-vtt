/**
 * O PAINEL EM RELEVO EM BITMAP (28/11): só para o PNG do item de cada placa
 * (`pngDaPlaca`). O SVG do painel (`arte.ts`), com os filtros de luz do metal,
 * é desenhado num canvas UMA vez por cena e metal nesta página; cada placa sai
 * recortada pelo contorno dela, com sombra e bisel, num quadrado transparente.
 * O quadro e as placas postas NÃO passam por aqui: mostram o SVG num `<img>`
 * (`miniatura.ts`), que o navegador desenha fora da linha principal.
 *
 * Só no navegador (canvas). As falhas vêm com a frase pronta.
 */
import type { CenaDoRelevo, MetalDoRelevo } from '../tipos'
import { ALTURA_DO_PAINEL, LARGURA_DO_PAINEL, svgDoPainel } from './arte'
import { AREA, caixaDe, type Ponto } from './placas'

export const FALHA_AO_DESENHAR_O_PAINEL = 'Não foi possível desenhar o painel em relevo.'

/** O lado do PNG da placa: o mesmo das peças desenhadas (`LADO_DO_PNG_DA_PECA`). */
export const LADO_DO_PNG_DA_PLACA = 256

function chaveDoPainel(cena: CenaDoRelevo | null, metal: MetalDoRelevo): string {
  return `${cena ?? 'moldura'}:${metal}`
}

function novoCanvas(largura: number, altura: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error(FALHA_AO_DESENHAR_O_PAINEL)
  return { canvas, ctx }
}

function emBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob === null ? reject(new Error(FALHA_AO_DESENHAR_O_PAINEL)) : resolve(blob)), 'image/png')
  })
}

const canvases = new Map<string, Promise<HTMLCanvasElement>>()

/** O painel desenhado (parede, moldura e, com cena, o relevo), 1600 x 1000. Guardado por cena e metal. */
export function canvasDoPainel(cena: CenaDoRelevo | null, metal: MetalDoRelevo): Promise<HTMLCanvasElement> {
  const chave = chaveDoPainel(cena, metal)
  const pronto = canvases.get(chave)
  if (pronto !== undefined) return pronto
  const promessa = (async () => {
    const url = URL.createObjectURL(new Blob([svgDoPainel(cena, metal)], { type: 'image/svg+xml' }))
    try {
      const imagem = new Image()
      imagem.src = url
      await imagem.decode()
      const { canvas, ctx } = novoCanvas(LARGURA_DO_PAINEL, ALTURA_DO_PAINEL)
      ctx.drawImage(imagem, 0, 0, LARGURA_DO_PAINEL, ALTURA_DO_PAINEL)
      return canvas
    } catch {
      throw new Error(FALHA_AO_DESENHAR_O_PAINEL)
    } finally {
      URL.revokeObjectURL(url)
    }
  })()
  canvases.set(chave, promessa)
  // Falhou: a próxima abertura tenta de novo.
  promessa.catch(() => canvases.delete(chave))
  return promessa
}

/** A imagem do mestre na área do relevo, cobrindo-a como o `object-fit: cover` do quadro (centrada). */
export function desenharImagemNaArea(ctx: CanvasRenderingContext2D, imagem: CanvasImageSource & { width: number; height: number }): void {
  const escala = Math.max(AREA.largura / imagem.width, AREA.altura / imagem.height)
  const largura = imagem.width * escala
  const altura = imagem.height * escala
  ctx.save()
  ctx.beginPath()
  ctx.rect(AREA.x, AREA.y, AREA.largura, AREA.altura)
  ctx.clip()
  ctx.drawImage(imagem, AREA.x + (AREA.largura - largura) / 2, AREA.y + (AREA.altura - altura) / 2, largura, altura)
  ctx.restore()
}

/** O painel com a imagem do mestre na área (para recortar as placas da imagem própria). */
export async function canvasComImagem(metal: MetalDoRelevo, imagem: ImageBitmap): Promise<HTMLCanvasElement> {
  const moldura = await canvasDoPainel(null, metal)
  const { canvas, ctx } = novoCanvas(LARGURA_DO_PAINEL, ALTURA_DO_PAINEL)
  ctx.drawImage(moldura, 0, 0)
  desenharImagemNaArea(ctx, imagem)
  return canvas
}

function caminho(poligono: readonly Ponto[], ponto: (p: Ponto) => [number, number]): Path2D {
  const path = new Path2D()
  poligono.forEach((p, i) => {
    const [x, y] = ponto(p)
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  })
  path.closePath()
  return path
}

/**
 * O PNG da placa: o pedaço do painel dentro do contorno, centrado num
 * quadrado transparente, com a sombra embaixo e o bisel (a luz vem de cima à
 * esquerda: as arestas viradas para ela clareiam, as outras escurecem).
 */
export async function pngDaPlaca(painel: HTMLCanvasElement, poligono: readonly Ponto[], lado: number = LADO_DO_PNG_DA_PLACA): Promise<Uint8Array> {
  const caixa = caixaDe(poligono)
  const margem = lado * 0.09
  const escala = (lado - 2 * margem) / Math.max(caixa.largura, caixa.altura)
  const ox = (lado - caixa.largura * escala) / 2
  const oy = (lado - caixa.altura * escala) / 2
  const ponto = (p: Ponto): [number, number] => [ox + (p.x - caixa.x) * escala, oy + (p.y - caixa.y) * escala]
  const { canvas, ctx } = novoCanvas(lado, lado)
  const contorno = caminho(poligono, ponto)

  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = lado * 0.035
  ctx.shadowOffsetX = lado * 0.01
  ctx.shadowOffsetY = lado * 0.02
  ctx.fillStyle = '#1b150f'
  ctx.fill(contorno)
  ctx.restore()

  ctx.save()
  ctx.clip(contorno)
  ctx.drawImage(painel, caixa.x, caixa.y, caixa.largura, caixa.altura, ox, oy, caixa.largura * escala, caixa.altura * escala)
  // O bisel por dentro: cada aresta, pelo lado para onde ela vira (o dobro da largura, metade cortada pelo contorno).
  ctx.lineWidth = lado * 0.022
  ctx.lineCap = 'round'
  for (let i = 0; i < poligono.length; i += 1) {
    const a = poligono[i]
    const b = poligono[(i + 1) % poligono.length]
    if (a === undefined || b === undefined) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const tamanho = Math.hypot(dx, dy) || 1
    // A normal para fora (sentido do relógio, y para baixo) contra a luz de cima à esquerda.
    const deFrente = (dy / tamanho) * -Math.SQRT1_2 + (-dx / tamanho) * -Math.SQRT1_2
    ctx.strokeStyle = deFrente > 0 ? `rgba(255, 236, 200, ${(0.25 + 0.3 * deFrente).toFixed(2)})` : `rgba(12, 8, 4, ${(0.35 - 0.35 * deFrente).toFixed(2)})`
    const [ax, ay] = ponto(a)
    const [bx, by] = ponto(b)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }
  ctx.restore()

  ctx.lineWidth = Math.max(1, lado * 0.006)
  ctx.strokeStyle = 'rgba(10, 6, 3, 0.75)'
  ctx.stroke(contorno)
  return new Uint8Array(await (await emBlob(canvas)).arrayBuffer())
}

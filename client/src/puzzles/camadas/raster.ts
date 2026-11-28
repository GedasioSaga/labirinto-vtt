/**
 * A LÂMINA EM BITMAP (28/11): só para o PNG do item de cada lâmina (a mochila,
 * o acervo e o mapa mostram a imagem do item). A mesa NÃO passa por aqui: ela
 * mostra o SVG num `<img>`, que o navegador desenha fora da linha principal.
 *
 * A lâmina sai contra a luz (um cartão claro, como se o jogador a erguesse
 * para olhar), no giro com que ela vai pousar na mesa: o que a mochila mostra
 * é o que a mesa vai mostrar. Só no navegador (canvas). As falhas vêm com a
 * frase pronta.
 */
import type { CamadasDoPuzzle, MarcaDaLamina } from '../tipos'
import { caminhoDosCacos, urlDaFigura, urlDaPele } from './arte'
import { cacosDoCorte, cantoDaMarca, corteDas, girosAoPousar, marcasDas, repartir } from './camadas'

export const FALHA_AO_DESENHAR_A_LAMINA = 'Não foi possível desenhar a lâmina.'

/** O lado do PNG da lâmina: o mesmo das peças desenhadas (`LADO_DO_PNG_DA_PECA`). */
export const LADO_DO_PNG_DA_LAMINA = 256

/** Uma imagem que o canvas desenha e da qual sabe o tamanho. */
export type FiguraEmBitmap = CanvasImageSource & { width: number; height: number }

async function imagemDe(url: string): Promise<HTMLImageElement> {
  const imagem = new Image()
  imagem.src = url
  await imagem.decode()
  return imagem
}

/**
 * O quadro onde a lâmina é desenhada. O `OffscreenCanvas` codifica o PNG fora da
 * linha principal (o `toBlob` do canvas comum travou ~240 ms por lâmina no Edge).
 */
function novaTela(lado: number): { ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D; emPng: () => Promise<Blob> } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const tela = new OffscreenCanvas(lado, lado)
    const ctx = tela.getContext('2d')
    if (ctx === null) throw new Error(FALHA_AO_DESENHAR_A_LAMINA)
    return { ctx, emPng: () => tela.convertToBlob({ type: 'image/png' }) }
  }
  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error(FALHA_AO_DESENHAR_A_LAMINA)
  return {
    ctx,
    emPng: () =>
      new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob === null ? reject(new Error(FALHA_AO_DESENHAR_A_LAMINA)) : resolve(blob)), 'image/png')
      }),
  }
}

/** A figura de fábrica (ou o código) em bitmap; a imagem do mestre quem chama carrega. */
export async function figuraDeFabrica(camadas: CamadasDoPuzzle): Promise<FiguraEmBitmap | null> {
  const url = urlDaFigura(camadas.figura, camadas.codigo)
  if (url === null) return null
  try {
    return await imagemDe(url)
  } catch {
    throw new Error(FALHA_AO_DESENHAR_A_LAMINA)
  }
}

/**
 * O PNG da lâmina de marca `marca` num puzzle de `quantas` lâminas: a figura
 * recortada pelos cacos dela (cobrindo o quadrado, como o `slice` da mesa) e a
 * pele do material por cima, sobre o cartão de luz, no giro de quando pousa.
 */
export async function pngDaLamina(camadas: CamadasDoPuzzle, quantas: number, marca: MarcaDaLamina, figura: FiguraEmBitmap | null, lado: number = LADO_DO_PNG_DA_LAMINA): Promise<Uint8Array> {
  const marcas = marcasDas(camadas, quantas)
  const k = marcas.indexOf(marca)
  if (k === -1) throw new Error(FALHA_AO_DESENHAR_A_LAMINA)
  const corte = corteDas(camadas)
  const cacos = cacosDoCorte(corte)
  const { cacos: deCada, manchas } = repartir(camadas, quantas)
  const giro = girosAoPousar(camadas, quantas)[k] ?? 0
  const meus = deCada[k] ?? []
  const pele = await imagemDe(urlDaPele({ material: camadas.material, cacos, meus, manchas: manchas[k] ?? [], marca, canto: cantoDaMarca(corte, marca) })).catch(() => {
    throw new Error(FALHA_AO_DESENHAR_A_LAMINA)
  })
  // Desenhar um SVG no canvas é síncrono (~70 ms por lâmina): cada lâmina na sua tarefa,
  // senão as que decodificam juntas viram uma tarefa longa só.
  await new Promise<void>((pronto) => window.setTimeout(pronto, 0))

  const { ctx, emPng } = novaTela(lado)
  const margem = lado * 0.07
  const escala = (lado - 2 * margem) / 100

  // O cartão de luz, com a sombra embaixo.
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
  ctx.shadowBlur = lado * 0.04
  ctx.shadowOffsetY = lado * 0.018
  const luz = ctx.createRadialGradient(lado / 2, lado / 2, lado * 0.05, lado / 2, lado / 2, lado * 0.62)
  luz.addColorStop(0, '#fffaee')
  luz.addColorStop(1, '#e6d2a2')
  ctx.fillStyle = luz
  ctx.fillRect(margem, margem, lado - 2 * margem, lado - 2 * margem)
  ctx.restore()

  // A lâmina, girada em volta do meio como na mesa.
  ctx.save()
  ctx.translate(lado / 2, lado / 2)
  ctx.rotate((giro * Math.PI) / 2)
  ctx.translate(-lado / 2, -lado / 2)
  ctx.translate(margem, margem)
  ctx.scale(escala, escala)
  if (figura !== null && figura.width > 0 && figura.height > 0) {
    ctx.save()
    ctx.clip(new Path2D(caminhoDosCacos(cacos, meus)))
    const cobre = Math.max(100 / figura.width, 100 / figura.height)
    const largura = figura.width * cobre
    const altura = figura.height * cobre
    ctx.drawImage(figura, (100 - largura) / 2, (100 - altura) / 2, largura, altura)
    ctx.restore()
  }
  ctx.drawImage(pele, 0, 0, 100, 100)
  ctx.restore()

  return new Uint8Array(await (await emPng()).arrayBuffer())
}

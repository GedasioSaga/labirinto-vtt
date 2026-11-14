import { BufferImageSource, Rectangle, Texture } from 'pixi.js'
import type { TipoDeAura } from '../../lib/auras'
import { corDaRampa, formaDaAura, passosDaRampa, PINCEIS_DA_AURA, rampaDaVolta, type FormaDaAura } from './pinceisDaAura'

/**
 * AURA DA FICHA — o atlas: UMA textura por aura, como na página de prova
 * (`assarAtlas` de `pagina.js`). Cada linha é um pincel (uma forma), cada
 * coluna um passo da rampa de cor, com 1 px de folga em volta de cada célula
 * para o filtro linear não puxar a vizinha. A cor de um item do quadro escolhe
 * a coluna (`colunaDaCor`): nada de `tint`, a cor já está no pixel.
 *
 * Dois usos, o mesmo desenho: o Pixi (mapa do mestre e do jogador) lê os
 * pixels prontos (`texturasDaAura`), e a miniatura do menu pinta em canvas 2D
 * (`canvasDoAtlas`), exatamente como a página.
 */

/** Uma linha do atlas: a forma, quantos passos de rampa e onde ela fica. */
export interface LinhaDoAtlas {
  forma: FormaDaAura
  passos: number
  volta: boolean
  /** Topo da linha no atlas (a célula começa 1 px abaixo). */
  y: number
}

interface PlantaDoAtlas {
  largura: number
  altura: number
  linhas: LinhaDoAtlas[]
}

const plantas = new Map<TipoDeAura, PlantaDoAtlas>()

/** Onde cada pincel fica no atlas da aura (o mesmo arranjo da página). */
export function plantaDoAtlas(tipo: TipoDeAura): PlantaDoAtlas {
  const pronta = plantas.get(tipo)
  if (pronta !== undefined) return pronta
  const linhas: LinhaDoAtlas[] = []
  let largura = 0
  let altura = 0
  for (const [nomeDaForma, nomeDaRampa] of PINCEIS_DA_AURA[tipo]) {
    const forma = formaDaAura(nomeDaForma)
    const passos = passosDaRampa(nomeDaRampa)
    linhas.push({ forma, passos, volta: rampaDaVolta(nomeDaRampa), y: altura })
    largura = Math.max(largura, passos * (forma.w + 2))
    altura += forma.h + 2
  }
  const planta = { largura, altura, linhas }
  plantas.set(tipo, planta)
  return planta
}

/** A coluna da rampa para a cor `cor` (0 a 1) do item: a mesma conta de `pintarCamada` da página. */
export function colunaDaCor(linha: LinhaDoAtlas, cor: number): number {
  if (linha.volta) {
    const col = Math.round(cor * linha.passos) % linha.passos
    return col < 0 ? col + linha.passos : col
  }
  return Math.min(linha.passos - 1, Math.max(0, Math.round(cor * (linha.passos - 1))))
}

/** O ponto da rampa que a coluna `c` pinta. */
function pontoDaColuna(linha: LinhaDoAtlas, c: number): number {
  if (linha.volta) return c / linha.passos
  return linha.passos > 1 ? c / (linha.passos - 1) : 0
}

/**
 * Os pixels do atlas, RGBA de 8 bits. `premultiplicado` = a cor já vezes o
 * alfa (o que a textura do Pixi espera, como a bolha de `particulasDoMapa`);
 * sem, é o que `putImageData` quer (a página pinta assim).
 */
function pixelsDoAtlas(tipo: TipoDeAura, premultiplicado: boolean): Uint8ClampedArray {
  const planta = plantaDoAtlas(tipo)
  const pixels = new Uint8ClampedArray(planta.largura * planta.altura * 4)
  PINCEIS_DA_AURA[tipo].forEach(([, nomeDaRampa], indice) => {
    const linha = planta.linhas[indice]
    const { forma } = linha
    for (let c = 0; c < linha.passos; c += 1) {
      const rgb = corDaRampa(nomeDaRampa, pontoDaColuna(linha, c))
      const x0 = c * (forma.w + 2) + 1
      const y0 = linha.y + 1
      for (let y = 0; y < forma.h; y += 1) {
        for (let x = 0; x < forma.w; x += 1) {
          const i = y * forma.w + x
          const l = forma.lum[i]
          const a = forma.alfa[i]
          const k = premultiplicado ? l * a : l
          const p = ((y0 + y) * planta.largura + x0 + x) * 4
          pixels[p] = Math.round(rgb[0] * k * 255)
          pixels[p + 1] = Math.round(rgb[1] * k * 255)
          pixels[p + 2] = Math.round(rgb[2] * k * 255)
          pixels[p + 3] = Math.round(a * 255)
        }
      }
    }
  })
  return pixels
}

const canvases = new Map<TipoDeAura, HTMLCanvasElement | null>()

/** O atlas da aura num canvas (miniatura do menu). `null` = ambiente sem canvas 2D. */
export function canvasDoAtlas(tipo: TipoDeAura): HTMLCanvasElement | null {
  if (canvases.has(tipo)) return canvases.get(tipo) ?? null
  const planta = plantaDoAtlas(tipo)
  const canvas = document.createElement('canvas')
  canvas.width = planta.largura
  canvas.height = planta.altura
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    canvases.set(tipo, null)
    return null
  }
  const imagem = ctx.createImageData(planta.largura, planta.altura)
  imagem.data.set(pixelsDoAtlas(tipo, false))
  ctx.putImageData(imagem, 0, 0)
  canvases.set(tipo, canvas)
  return canvas
}

/** As texturas da aura no Pixi: `quadros[pincel][coluna]`, todas recortes da MESMA fonte. */
export interface TexturasDaAura {
  quadros: Texture[][]
}

const texturas = new Map<TipoDeAura, TexturasDaAura>()

/**
 * Uma fonte por aura, para a sessão inteira (são 9, pequenas: a maior, a
 * multicolorida, tem 2352 x 184 px). Criadas na primeira ficha que mostra a
 * aura e nunca destruídas: o mestre e o jogador trocam de cena e voltam a elas.
 */
export function texturasDaAura(tipo: TipoDeAura): TexturasDaAura {
  const prontas = texturas.get(tipo)
  if (prontas !== undefined) return prontas
  const planta = plantaDoAtlas(tipo)
  const source = new BufferImageSource({
    resource: new Uint8Array(pixelsDoAtlas(tipo, true).buffer),
    width: planta.largura,
    height: planta.altura,
    format: 'rgba8unorm',
    alphaMode: 'premultiplied-alpha',
    scaleMode: 'linear',
  })
  const quadros = planta.linhas.map((linha) => {
    const lista: Texture[] = []
    for (let c = 0; c < linha.passos; c += 1) {
      lista.push(new Texture({ source, frame: new Rectangle(c * (linha.forma.w + 2) + 1, linha.y + 1, linha.forma.w, linha.forma.h) }))
    }
    return lista
  })
  const novas = { quadros }
  texturas.set(tipo, novas)
  return novas
}

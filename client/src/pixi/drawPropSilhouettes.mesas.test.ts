import { afterEach, describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { TIPOS_NO_CATALOGO } from '../lib/mobilia/pecasNovas'
import { PARTES_DO_MENU_DE_OBJETO } from '../lib/toolVariants'
import { G } from '../texturas/meioTermo/moveis/contexto'
import { geometriaDaMesa } from '../texturas/meioTermo/moveis/mesaComPernas'
import { contextoDaMesa } from '../texturas/meioTermo/moveis/mesasAntigas.testkit'
import { carregarMoveisDoMeioTermo, drawPropSilhouettes } from './drawPropSilhouettes'
import { chaveDoMovel, RasterDosMoveis, trocarRasterNoTeste, type ImagemDoMovel } from './rasterDosMoveis'

/**
 * As MESAS novas (pedido de 24/10/2026) e a chave de obra: a mesa antiga
 * (`mesa`, um dos 11 de antes) só muda de desenho com a chave LIGADA; sem ela
 * continua no desenho de linhas. A mesa quadrada e a redonda (peças novas da
 * MT4) saem sempre em imagem. O catálogo e o menu do Objeto não mudam: as
 * três mesas juntas, na mesma ordem.
 */

const CARVALHO = '#8b6b47'

function mesa(mobilia: 'mesa' | 'mesaQuadrada' | 'mesaRedonda', casasW: number, casasH: number): Prop {
  return { id: `m-${mobilia}`, src: '', x: 200, y: 200, width: casasW * 50, height: casasH * 50, linkedMapPath: null, mobilia, mobiliaCor: CARVALHO }
}

function acoes(g: Graphics): string[] {
  return g.context.instructions.map((i) => i.action)
}

function rasterComFila(): { raster: RasterDosMoveis; rodar: () => void } {
  const fatias: (() => void)[] = []
  const raster = new RasterDosMoveis({ agendar: (fatia) => fatias.push(fatia) })
  trocarRasterNoTeste(raster)
  return {
    raster,
    rodar: () => {
      while (fatias.length > 0) fatias.shift()?.()
    },
  }
}

/** Alfa (0..255) da imagem pronta no ponto (px do protótipo, em volta do centro do móvel). */
function alfaNoPonto(im: ImagemDoMovel, x: number, y: number): number {
  const { x0, y0, W } = im.limites
  const i = Math.floor((x - x0) * im.S)
  const j = Math.floor((y - y0) * im.S)
  const bytes = im.textura.source.resource
  if (!(bytes instanceof Uint8ClampedArray)) throw new Error('imagem sem bytes')
  return bytes[(j * W + i) * 4 + 3]
}

afterEach(() => {
  trocarObraNoTeste(false)
  trocarRasterNoTeste(null)
})

describe('mesas e a chave de obra do Meio-Termo', () => {
  it('chave DESLIGADA: a mesa antiga continua no desenho de linhas (nenhuma imagem pedida); a quadrada e a redonda saem em imagem', async () => {
    await carregarMoveisDoMeioTermo()
    const { raster, rodar } = rasterComFila()
    const g = new Graphics()
    drawPropSilhouettes(g, [mesa('mesa', 2, 1)], 1, 1)
    rodar()
    expect(acoes(g)).not.toContain('texture')
    expect(raster.geradas).toBe(0)
    for (const nova of [mesa('mesaQuadrada', 1, 1), mesa('mesaRedonda', 1.25, 1.25)]) {
      const outra = new Graphics()
      drawPropSilhouettes(outra, [nova], 1, 1)
      rodar()
      expect(acoes(outra), nova.mobilia).toEqual(['texture'])
    }
  })

  it('chave LIGADA: a mesa antiga sai na imagem nova, com o chão sombreado logo acima do tampo (antes, o tampo cobria a pegada inteira)', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { raster, rodar } = rasterComFila()
    const g = new Graphics()
    const prop = mesa('mesa', 2, 1)
    drawPropSilhouettes(g, [prop], 1, 1)
    rodar()
    expect(acoes(g)).toEqual(['texture'])
    const chave = chaveDoMovel(prop, 1, 1)
    if (chave === null) throw new Error('mesa sem chave')
    const im = raster.imagemDoMovel(prop, 1, 1)
    if (im === null || !im.pronta) throw new Error('mesa sem imagem pronta')
    const geo = geometriaDaMesa(contextoDaMesa(chave.desenho), false)
    // Logo acima do tampo, no meio: sombra de baixo (chão escuro), não peça.
    const acima = alfaNoPonto(im, 0, geo.tampo[1] - 0.7)
    expect(acima).toBeGreaterThan(8)
    expect(acima).toBeLessThan(128)
    // A perna de cima à esquerda, fora do tampo: peça opaca.
    expect(alfaNoPonto(im, -G + 1.5, -G / 2 + 1.5)).toBeGreaterThanOrEqual(242)
  })
})

describe('catálogo e menu do Objeto: as três mesas, sem mudar ordem nem id', () => {
  it('no catálogo, a mesa e logo depois a quadrada e a redonda; no menu, as três em "Dentro de casa"', () => {
    const i = TIPOS_NO_CATALOGO.indexOf('mesa')
    expect(TIPOS_NO_CATALOGO.slice(i, i + 3)).toEqual(['mesa', 'mesaQuadrada', 'mesaRedonda'])
    const dentro = PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Dentro de casa')
    expect(dentro?.tipos).toEqual(['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'mesaQuadrada', 'mesaRedonda', 'armario', 'aparador', 'tapete', 'tapeteLongo'])
  })
})

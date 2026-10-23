import { afterEach, describe, expect, it, vi } from 'vitest'
import { Graphics, type Texture } from 'pixi.js'
import type { Prop } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { G } from '../texturas/meioTermo/moveis/contexto'
import { carregarMoveisDoMeioTermo, drawPropSilhouettes } from './drawPropSilhouettes'
import { RasterDosMoveis, trocarRasterNoTeste, type ImagemDoMovel } from './rasterDosMoveis'

/**
 * Com a chave de obra do Meio-Termo, o móvel com textura sai como IMAGEM
 * (`rasterDosMoveis.ts`): o desenho de linhas fica só enquanto ela não está
 * pronta; pronta, o `Graphics` se repinta sozinho e o provisório SAI (a chave
 * de repintura do jogador não muda). O giro gira a imagem sem gerar outra.
 * Desligada, nenhum caminho novo roda.
 */

type Instruction = Graphics['context']['instructions'][number]

function barril(extra: Partial<Prop> = {}): Prop {
  return { id: 'b', src: '', x: 100, y: 100, width: 35, height: 35, linkedMapPath: null, mobilia: 'barril', mobiliaCor: '#8b6b47', ...extra }
}

function acoes(g: Graphics): string[] {
  return g.context.instructions.map((i) => i.action)
}

function imagem(g: Graphics): Extract<Instruction, { action: 'texture' }> {
  const achada = g.context.instructions.find((i): i is Extract<Instruction, { action: 'texture' }> => i.action === 'texture')
  if (achada === undefined) throw new Error('sem imagem')
  return achada
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

/**
 * A chave de repintura dos objetos do JOGADOR, copiada de
 * `player/PlayerView.tsx` (`redrawPropsLayer`): se ela não muda, o jogador não
 * repinta. A imagem que fica pronta não pode mudá-la; mudar um objeto, sim.
 */
function chaveDeRepinturaDoJogador(props: readonly Prop[], scale: number, res: number, grid: number): string {
  return JSON.stringify([props, scale, res, grid])
}

/** Alfa (0..255) da imagem no ponto (px do protótipo, em volta do centro do móvel). */
function alfaNoPonto(im: ImagemDoMovel, x: number, y: number): number {
  const { x0, y0, W } = im.limites
  const i = Math.floor((x - x0) * im.S)
  const j = Math.floor((y - y0) * im.S)
  const bytes = im.textura.source.resource
  if (!(bytes instanceof Uint8ClampedArray)) throw new Error('imagem sem bytes')
  return bytes[(j * W + i) * 4 + 3]
}

/** Os números da matriz sem o -0 (o giro de 180 dá seno -0). */
function matriz(i: Extract<Instruction, { action: 'texture' }>): number[] {
  const m = i.data.transform
  return [m.a, m.b, m.c, m.d, m.tx, m.ty].map((v) => Math.round(v * 1e9) / 1e9 + 0)
}

afterEach(() => {
  trocarObraNoTeste(false)
  trocarRasterNoTeste(null)
  vi.restoreAllMocks()
})

describe('drawPropSilhouettes com o Meio-Termo ligado', () => {
  it('antes do módulo do Meio-Termo chegar, sai o desenho de linhas; ele chegando, o Graphics se repinta e pede a imagem', async () => {
    trocarObraNoTeste(true)
    const { raster } = rasterComFila()
    const g = new Graphics()
    drawPropSilhouettes(g, [barril()], 1, 1)
    expect(acoes(g)).toContain('fill')
    expect(raster.geradas).toBe(0)
    await carregarMoveisDoMeioTermo()
    expect(raster.geradas).toBe(1)
  })

  it('o provisório de linhas SAI quando a imagem fica pronta: o Graphics se repinta sozinho, sem mudar a chave do jogador', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { raster, rodar } = rasterComFila()
    const g = new Graphics()
    const props = [barril()]
    const chaveAntes = chaveDeRepinturaDoJogador(props, 1, 1, 50)

    expect(drawPropSilhouettes(g, props, 1, 1)).toBe(1)
    // Enquanto não fica pronta: só o desenho de linhas, nenhuma imagem transparente colada por cima.
    expect(acoes(g)).toContain('fill')
    expect(acoes(g)).not.toContain('texture')

    rodar()
    // Pronta: só a imagem, nada do provisório (caixa, contorno, glifo).
    expect(acoes(g)).toEqual(['texture'])
    const textura: Texture = imagem(g).data.image
    const bytes = textura.source.resource
    expect(bytes instanceof Uint8ClampedArray && bytes.some((b) => b > 0)).toBe(true)
    expect(imagem(g).data.alpha).toBe(1)
    expect(raster.geradas).toBe(1)
    // A chave real do jogador: a imagem pronta não a muda (nada no objeto foi tocado); mudar o objeto muda.
    expect(chaveDeRepinturaDoJogador(props, 1, 1, 50)).toBe(chaveAntes)
    expect(chaveDeRepinturaDoJogador([barril({ mobiliaCor: '#5f4532' })], 1, 1, 50)).not.toBe(chaveAntes)

    // Repintado de novo pelo dono: a mesma imagem, sem gerar outra.
    drawPropSilhouettes(g, props, 1, 1)
    expect(acoes(g)).toEqual(['texture'])
    expect(imagem(g).data.image).toBe(textura)
    expect(raster.geradas).toBe(1)
  })

  it('no canto chanfrado da caixa e no vazio do L da cadeira de lado não fica pixel do provisório', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { raster, rodar } = rasterComFila()
    const caixa = barril({ mobilia: 'caixa', width: 40, height: 40, mobiliaCor: '#a3875f' })
    const cadeira = barril({ mobilia: 'cadeira', width: 25, height: 37.5, mobiliaVista: 'lado' })
    /** Alfa de peça: a sombra no chão mais forte fica em 0,34 x 255 = 87. Opaco: o critério das provas (242). */
    const ALFA_DE_PECA = 128
    const ALFA_OPACO = 242
    for (const prop of [caixa, cadeira]) {
      const g = new Graphics()
      // Câmera a 3x: nível 3, o pixel da imagem mais fino que o chanfro.
      drawPropSilhouettes(g, [prop], 3, 1)
      expect(acoes(g)).toContain('fill')
      rodar()
      // Nenhuma instrução do provisório (caixa cheia, contorno, glifo) sobra no Graphics.
      expect(acoes(g)).toEqual(['texture'])
      const im = raster.imagemDoMovel(prop, 3, 1)
      if (im === null) throw new Error('sem imagem')
      const hw = (im.casasW * G) / 2
      const hh = (im.casasH * G) / 2
      // Ali a imagem deixa o chão aparecer: um provisório por baixo apareceria junto (a caixa chapada e o traço).
      // No canto chanfrado, o pixel não é opaco (só a borda suavizada e a sombra de contato); no vazio do L, nem peça é.
      if (prop.mobilia === 'caixa') expect(alfaNoPonto(im, -hw + 0.01, -hh + 0.01), 'canto da caixa').toBeLessThan(ALFA_OPACO)
      else expect(alfaNoPonto(im, hw - 3, -hh + 3), 'vazio do L').toBeLessThan(ALFA_DE_PECA)
    }
  })

  it('o giro de 90, 180 e 270 gira a imagem (setTransform) com a mesma textura, sem gerar outra', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { raster, rodar } = rasterComFila()
    const g = new Graphics()
    drawPropSilhouettes(g, [barril()], 1, 1)
    rodar()
    const reta = imagem(g)
    const esperado: Record<number, number[]> = { 90: [0, 1, -1, 0, 100, 100], 180: [-1, 0, 0, -1, 100, 100], 270: [0, -1, 1, 0, 100, 100] }
    for (const rotation of [90, 180, 270]) {
      drawPropSilhouettes(g, [barril({ rotation })], 1, 1)
      const girada = imagem(g)
      expect(girada.data.image).toBe(reta.data.image)
      expect(matriz(girada), `${rotation}°`).toEqual(esperado[rotation])
      // A imagem é posta pelo centro: a pegada fica em volta de (100, 100) depois do giro.
      expect(girada.data.dx).toBeLessThan(-17.5 + 1)
      expect(girada.data.dx + girada.data.dw).toBeGreaterThan(17.5)
    }
    expect(raster.geradas).toBe(1)
  })

  it('móvel não quadrado que reusa a imagem de um quase igual: estica x e y cada um pelo seu fator', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { raster, rodar } = rasterComFila()
    const cama = (height: number): Prop => barril({ mobilia: 'catre', width: 50, height, mobiliaCor: '#8b6b47' })
    const g = new Graphics()
    // 2,02 casas: desenhada com esta pegada; a de 1,96 casa cai na mesma chave (2,0) e estica.
    drawPropSilhouettes(g, [cama(101)], 1, 1)
    rodar()
    drawPropSilhouettes(g, [cama(98)], 1, 1)
    expect(raster.geradas).toBe(1)
    const im = raster.imagemDoMovel(cama(98), 1, 1)
    if (im === null) throw new Error('sem imagem')
    const colada = imagem(g)
    const kx = colada.data.dw / (im.limites.W / im.S)
    const ky = colada.data.dh / (im.limites.H / im.S)
    expect(kx).toBeCloseTo(50 / (1 * G), 9)
    expect(ky).toBeCloseTo(98 / (2.02 * G), 9)
    expect(Math.abs(kx - ky)).toBeGreaterThan(0.01)
    // A pegada desenhada (-hh..hh do protótipo) cai exatamente na altura do objeto.
    const topo = colada.data.dy + (-(im.casasH * G) / 2 - im.limites.y0) * ky
    expect(topo).toBeCloseTo(-49, 9)
  })

  it('tipo ainda sem textura (cerca, tapete) segue no desenho de linhas', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    rasterComFila()
    const g = new Graphics()
    drawPropSilhouettes(g, [barril({ mobilia: 'tapete', width: 150, height: 100 }), barril({ mobilia: 'cerca', width: 100, height: 12 })], 1, 1)
    expect(acoes(g)).not.toContain('texture')
  })
})

describe('drawPropSilhouettes com o Meio-Termo desligado', () => {
  it('nenhum caminho novo roda: nada de imagem pedida nem colada', () => {
    const { raster } = rasterComFila()
    const pedir = vi.spyOn(raster, 'imagemParaDesenhar')
    const g = new Graphics()
    drawPropSilhouettes(g, [barril(), barril({ mobilia: 'catre', width: 50, height: 100 })], 1, 1)
    expect(pedir).not.toHaveBeenCalled()
    expect(acoes(g)).not.toContain('texture')
    expect(raster.geradas).toBe(0)
  })
})

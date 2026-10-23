import { afterEach, describe, expect, it, vi } from 'vitest'
import { Graphics, type Texture } from 'pixi.js'
import type { Prop } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { drawPropSilhouettes } from './drawPropSilhouettes'
import { RasterDosMoveis, trocarRasterNoTeste } from './rasterDosMoveis'

/**
 * Com a chave de obra do Meio-Termo, o móvel com textura sai como IMAGEM
 * (`rasterDosMoveis.ts`): o desenho de linhas vai por baixo até ela ficar
 * pronta, a troca acontece nos bytes da mesma textura (sem repintar o
 * `Graphics`, então o jogador não muda a chave de repintura) e o giro gira a
 * imagem sem gerar outra. Desligada, nenhum caminho novo roda.
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

afterEach(() => {
  trocarObraNoTeste(false)
  trocarRasterNoTeste(null)
  vi.restoreAllMocks()
})

describe('drawPropSilhouettes com o Meio-Termo ligado', () => {
  it('pinta o desenho de linhas primeiro e a imagem por cima; pronta, a imagem troca os bytes sem repintar', () => {
    trocarObraNoTeste(true)
    const { raster, rodar } = rasterComFila()
    const g = new Graphics()
    const props = [barril()]
    const chaveDoJogador = JSON.stringify([props, 1, 1, 50])

    expect(drawPropSilhouettes(g, props, 1, 1)).toBe(1)
    const antes = acoes(g)
    expect(antes.indexOf('fill')).toBeGreaterThanOrEqual(0)
    expect(antes.lastIndexOf('texture')).toBeGreaterThan(antes.indexOf('fill'))
    const textura: Texture = imagem(g).data.image
    expect(imagem(g).data.alpha).toBe(1)
    const bytes = textura.source.resource
    expect(bytes instanceof Uint8ClampedArray && bytes.every((b) => b === 0)).toBe(true)

    let subidas = 0
    textura.source.on('update', () => (subidas += 1))
    const instrucoes = [...g.context.instructions]
    rodar()
    expect(subidas).toBe(1)
    expect(bytes instanceof Uint8ClampedArray && bytes.some((b) => b > 0)).toBe(true)
    // Nada a repintar: as mesmas instruções e a mesma entrada (a chave de repintura do jogador não muda).
    expect(g.context.instructions).toEqual(instrucoes)
    expect(JSON.stringify([props, 1, 1, 50])).toBe(chaveDoJogador)

    // Repintado depois de pronta: só a imagem, sem o placeholder, e sem gerar de novo.
    drawPropSilhouettes(g, props, 1, 1)
    expect(acoes(g)).toEqual(['texture'])
    expect(imagem(g).data.image).toBe(textura)
    expect(raster.geradas).toBe(1)
  })

  it('o giro gira a imagem (setTransform) com a mesma textura, sem gerar outra', () => {
    trocarObraNoTeste(true)
    const { raster, rodar } = rasterComFila()
    const g = new Graphics()
    drawPropSilhouettes(g, [barril()], 1, 1)
    rodar()
    const reta = imagem(g)
    drawPropSilhouettes(g, [barril({ rotation: 90 })], 1, 1)
    const girada = imagem(g)
    expect(girada.data.image).toBe(reta.data.image)
    expect(raster.geradas).toBe(1)
    const m = girada.data.transform
    expect([m.a, m.b, m.c, m.d, m.tx, m.ty]).toEqual([0, 1, -1, 0, 100, 100])
    // A imagem é posta pelo centro: a pegada fica em volta de (100, 100) depois do giro.
    expect(girada.data.dx).toBeLessThan(-17.5 + 1)
    expect(girada.data.dx + girada.data.dw).toBeGreaterThan(17.5)
  })

  it('tipo ainda sem textura (cerca, tapete) segue no desenho de linhas', () => {
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
    const pedir = vi.spyOn(raster, 'imagemDoMovel')
    const g = new Graphics()
    drawPropSilhouettes(g, [barril(), barril({ mobilia: 'catre', width: 50, height: 100 })], 1, 1)
    expect(pedir).not.toHaveBeenCalled()
    expect(acoes(g)).not.toContain('texture')
    expect(raster.geradas).toBe(0)
  })
})

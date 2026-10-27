import { afterEach, describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { deslocamentoDaChama, DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS } from '../lib/mobilia/vistaTresQuartos'
import { carregarMoveisDoMeioTermo, drawPropSilhouettes } from './drawPropSilhouettes'
import { RasterDosMoveis, trocarRasterNoTeste } from './rasterDosMoveis'

/**
 * MT12: com o Meio-Termo ligado, o móvel de antes que pediu a versão EM
 * LINHAS (`mobiliaDesenho: 'linhas'`) sai no desenho de linhas de sempre,
 * sem pedir imagem; o mesmo móvel sem o pedido sai em imagem. A peça nova
 * ignora o pedido (sai sempre com textura).
 */

function movel(extra: Partial<Prop> = {}): Prop {
  return { id: 'm', src: '', x: 100, y: 100, width: 35, height: 35, linkedMapPath: null, mobilia: 'barril', mobiliaCor: '#8b6b47', ...extra }
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

afterEach(() => {
  trocarObraNoTeste()
  trocarRasterNoTeste(null)
})

describe('drawPropSilhouettes: a versão em linhas com o Meio-Termo ligado', () => {
  it('o barril em linhas não pede imagem e fica no desenho de linhas; o mesmo barril sem o pedido sai em imagem', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { raster, rodar } = rasterComFila()

    const emLinhas = new Graphics()
    drawPropSilhouettes(emLinhas, [movel({ mobiliaDesenho: 'linhas' })], 1, 1)
    rodar()
    drawPropSilhouettes(emLinhas, [movel({ mobiliaDesenho: 'linhas' })], 1, 1)
    expect(acoes(emLinhas)).toContain('fill')
    expect(acoes(emLinhas)).not.toContain('texture')
    expect(raster.geradas).toBe(0)

    const comTextura = new Graphics()
    drawPropSilhouettes(comTextura, [movel()], 1, 1)
    rodar()
    expect(acoes(comTextura)).toEqual(['texture'])
    expect(raster.geradas).toBe(1)
  })

  it('na mesma lista, só o que pediu linhas fica em linhas', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { rodar } = rasterComFila()
    const g = new Graphics()
    const props = [movel({ id: 'a' }), movel({ id: 'b', x: 300, mobiliaDesenho: 'linhas' })]
    drawPropSilhouettes(g, props, 1, 1)
    rodar()
    expect(acoes(g).filter((a) => a === 'texture')).toHaveLength(1)
    expect(acoes(g)).toContain('fill')
  })

  it('a peça nova ignora o pedido de linhas (arquivo forjado): sai em imagem', async () => {
    await carregarMoveisDoMeioTermo()
    trocarObraNoTeste(true)
    const { rodar } = rasterComFila()
    const g = new Graphics()
    const vaso = movel({ mobilia: 'vaso', width: 25, height: 25, mobiliaCor: '#b06a48', mobiliaDesenho: 'linhas' })
    drawPropSilhouettes(g, [vaso], 1, 1)
    rodar()
    expect(acoes(g)).toEqual(['texture'])
  })
})

describe('deslocamentoDaChama: a fogueira em linhas não sobe a chama na 3/4', () => {
  it('com a obra e a 3/4, só a fogueira com textura desloca', () => {
    trocarObraNoTeste(true)
    const fogueira = movel({ mobilia: 'fogueira' })
    expect(deslocamentoDaChama(fogueira, 'tres-quartos')).toBe(DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS)
    expect(deslocamentoDaChama({ ...fogueira, mobiliaDesenho: 'linhas' }, 'tres-quartos')).toBe(0)
  })
})

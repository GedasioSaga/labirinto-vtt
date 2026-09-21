import { describe, expect, it } from 'vitest'
import { Color, Graphics } from 'pixi.js'
import {
  DEFAULT_PATH_WIDTH_CELLS,
  MAX_PATH_WIDTH_CELLS,
  MIN_PATH_WIDTH_CELLS,
  buildPathDrawing,
  clampPathWidthCells,
  isValidPathDraft,
} from './drawingFactory'
import { eraseFromDrawing } from './eraseGeometry'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { relevantPropertyGroups } from './toolProperties'
import { findDrawingAt } from './selectionHitTest'
import { drawDrawings } from '../pixi/drawDrawings'
import type { Drawing } from '../types/map'

/** Cores de dois caminhos diferentes — "terra" e "pedra". */
const COR_DA_TERRA = '#8a6a45'
const COR_DA_PEDRA = '#6d7076'
const GRADE = 64

function strokes(g: Graphics) {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

describe('Caminho — a cor é DAQUELE caminho, não do mapa', () => {
  it('dois caminhos traçados com cores diferentes guardam cada um a sua', () => {
    const terra = buildPathDrawing('a', [{ x: 0, y: 0 }, { x: 200, y: 0 }], COR_DA_TERRA, 1, GRADE)
    const pedra = buildPathDrawing('b', [{ x: 0, y: 300 }, { x: 200, y: 300 }], COR_DA_PEDRA, 1, GRADE)

    expect(terra.color).toBe(COR_DA_TERRA)
    expect(pedra.color).toBe(COR_DA_PEDRA)
    // CONTROLE: se a cor viesse de um lugar só (como "Cor do chão"), as duas
    // seriam iguais e esta linha ficaria vermelha.
    expect(terra.color).not.toBe(pedra.color)
  })

  it('a tela pinta os dois ao mesmo tempo, cada um na cor dele', () => {
    const terra = buildPathDrawing('a', [{ x: 0, y: 0 }, { x: 200, y: 0 }], COR_DA_TERRA, 1, GRADE)
    const pedra = buildPathDrawing('b', [{ x: 0, y: 300 }, { x: 200, y: 300 }], COR_DA_PEDRA, 1, GRADE)

    const g = new Graphics()
    drawDrawings(g, [terra, pedra], null)

    const cores = strokes(g).map((s) => s.data.style.color)
    expect(cores).toContain(new Color(COR_DA_TERRA).toNumber())
    expect(cores).toContain(new Color(COR_DA_PEDRA).toNumber())
    // Nenhum traço a mais: um caminho não repinta o outro nem deixa contorno
    // por baixo quando ninguém está selecionado.
    expect(cores).toHaveLength(2)
  })

  it('a largura sai em px de mundo, congelada pela grade do momento — e a grade mudar depois não reescreve o caminho', () => {
    const caminho = buildPathDrawing('a', [{ x: 0, y: 0 }, { x: 200, y: 0 }], COR_DA_TERRA, 2, GRADE)
    expect(caminho.kind).toBe('path')
    if (caminho.kind !== 'path') throw new Error('kind errado')
    expect(caminho.width).toBe(2 * GRADE)

    // Mesma entrada, outra grade: só o caminho NOVO muda de grossura.
    const outro = buildPathDrawing('b', [{ x: 0, y: 0 }, { x: 200, y: 0 }], COR_DA_TERRA, 2, 32)
    if (outro.kind !== 'path') throw new Error('kind errado')
    expect(outro.width).toBe(64)
    expect(caminho.width).toBe(128)
  })

  it('seleção é contorno POR FORA: a cor escolhida continua na tela', () => {
    const caminho = buildPathDrawing('a', [{ x: 0, y: 0 }, { x: 200, y: 0 }], COR_DA_PEDRA, 1, GRADE)
    const g = new Graphics()
    drawDrawings(g, [caminho], 'a')

    const traços = strokes(g)
    const daCor = traços.filter((s) => s.data.style.color === new Color(COR_DA_PEDRA).toNumber())
    expect(daCor).toHaveLength(1)
    // O contorno vem ANTES (por baixo) e é mais largo que a faixa real.
    expect(traços.indexOf(daCor[0])).toBe(traços.length - 1)
    expect(traços[0].data.style.width).toBeGreaterThan(daCor[0].data.style.width)
  })
})

describe('Caminho — largura e rascunho', () => {
  it('um ponto só não é caminho; dois já são', () => {
    expect(isValidPathDraft([{ x: 0, y: 0 }])).toBe(false)
    expect(isValidPathDraft([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(true)
  })

  it('largura fora da faixa é presa nas pontas, e lixo cai no padrão', () => {
    expect(clampPathWidthCells(0)).toBe(MIN_PATH_WIDTH_CELLS)
    expect(clampPathWidthCells(99)).toBe(MAX_PATH_WIDTH_CELLS)
    expect(clampPathWidthCells(Number.NaN)).toBe(DEFAULT_PATH_WIDTH_CELLS)
    // CONTROLE: valor legítimo passa intacto — senão o clamp estaria comendo tudo.
    expect(clampPathWidthCells(2)).toBe(2)
  })
})

describe('Caminho — vive no mapa como as outras coisas', () => {
  it('o painel oferece a cor do PRÓXIMO caminho só com a ferramenta Caminho na mão', () => {
    expect(relevantPropertyGroups('path').has('pathStyle')).toBe(true)
    // CONTROLE: com outra ferramenta a seção não aparece — senão o teste
    // passaria com um grupo que está sempre ligado.
    expect(relevantPropertyGroups('floor').has('pathStyle')).toBe(false)
    expect(relevantPropertyGroups('select').has('pathStyle')).toBe(false)
  })

  it('clicar em cima da faixa seleciona o caminho, inclusive longe da linha do meio', () => {
    const caminho = buildPathDrawing('a', [{ x: 0, y: 0 }, { x: 200, y: 0 }], COR_DA_TERRA, 1, GRADE)
    const drawings: Drawing[] = [caminho]

    // 24 px acima do eixo: dentro de uma faixa de 64 px (meia largura = 32).
    expect(findDrawingAt(drawings, { x: 100, y: 24 })?.id).toBe('a')
    // CONTROLE: bem fora da faixa não seleciona nada.
    expect(findDrawingAt(drawings, { x: 100, y: 400 })).toBeNull()
  })

  it('a borracha corta a trilha em dois pedaços, cada um com a cor original', () => {
    const caminho = buildPathDrawing('a', [{ x: 0, y: 0 }, { x: 400, y: 0 }], COR_DA_PEDRA, 0.5, GRADE)
    const pedaços = eraseFromDrawing(caminho, { x: 200, y: 0 }, 30)

    expect(pedaços).toHaveLength(2)
    for (const pedaço of pedaços) {
      expect(pedaço.kind).toBe('path')
      expect(pedaço.color).toBe(COR_DA_PEDRA)
    }
    // CONTROLE: longe da trilha a borracha devolve o MESMO caminho, inteiro.
    expect(eraseFromDrawing(caminho, { x: 200, y: 500 }, 30)).toEqual([caminho])
  })
})

describe('Caminho — salvar e abrir', () => {
  it('o caminho volta do arquivo com a cor e a largura dele', () => {
    const caminho = buildPathDrawing('a', [{ x: 10, y: 20 }, { x: 210, y: 20 }], COR_DA_PEDRA, 1.5, GRADE)
    const mapa = { ...createEmptyMap('m1', 'Mapa', 1000, 800, GRADE), drawings: [caminho] }

    const devolta = deserializeMap(serializeMap(mapa))
    expect(devolta.drawings).toEqual([caminho])
  })

  it('mapa SEM nenhum caminho abre exatamente igual — o kind novo não inventa campo', () => {
    const mapa = createEmptyMap('m1', 'Mapa', 1000, 800, GRADE)
    const devolta = deserializeMap(serializeMap(mapa))
    expect(devolta.drawings).toEqual([])
    expect(devolta).toEqual(mapa)
  })
})

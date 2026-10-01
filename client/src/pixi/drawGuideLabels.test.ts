import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text, type FillInstruction } from 'pixi.js'
import { SMART_GUIDE_LABEL_COLOR } from './constants'
import { GUIDE_LABEL_FONT_SCREEN_PX, GUIDE_LABEL_POOL_SIZE, createGuideLabelPool, type GuideLabel } from './drawGuideLabels'

/** Cada rótulo do pool é um Container com a pílula (Graphics) e o texto. */
function rotulos(parent: Container): Container[] {
  return parent.children.filter((c): c is Container => c instanceof Container)
}

function visiveis(parent: Container): Container[] {
  return rotulos(parent).filter((r) => r.visible)
}

function textoDe(rotulo: Container): Text {
  const texto = rotulo.children.find((c): c is Text => c instanceof Text)
  if (texto === undefined) throw new Error('rótulo sem Text')
  return texto
}

function placaDe(rotulo: Container): Graphics {
  const placa = rotulo.children.find((c): c is Graphics => c instanceof Graphics)
  if (placa === undefined) throw new Error('rótulo sem pílula')
  return placa
}

function rotulo(x: number, y: number, text: string): GuideLabel {
  return { at: { x, y }, text }
}

describe('createGuideLabelPool — o número do vão, numa pílula magenta', () => {
  it('nasce com o pool inteiro já no container e escondido (nada de criar Text no meio do arrasto)', () => {
    const parent = new Container()
    createGuideLabelPool(parent)
    expect(rotulos(parent)).toHaveLength(GUIDE_LABEL_POOL_SIZE)
    expect(visiveis(parent)).toHaveLength(0)
  })

  it('um rótulo por vão, no meio dele, com tamanho constante na tela (escala 1/zoom)', () => {
    const parent = new Container()
    const pool = createGuideLabelPool(parent)
    pool.show([rotulo(125, 20, '1,5 m')], 2, 1)
    const [primeiro, ...resto] = visiveis(parent)
    expect(resto).toHaveLength(0)
    expect(primeiro.position.x).toBe(125)
    expect(primeiro.position.y).toBe(20)
    expect(primeiro.scale.x).toBeCloseTo(0.5)
    expect(primeiro.scale.y).toBeCloseTo(0.5)
    expect(textoDe(primeiro).text).toBe('1,5 m')
  })

  it('pílula magenta escura com texto branco de 11 px, centrado na pílula', () => {
    const parent = new Container()
    const pool = createGuideLabelPool(parent)
    pool.show([rotulo(0, 0, '3,0 m')], 1, 1)
    const [primeiro] = visiveis(parent)
    const texto = textoDe(primeiro)
    expect(texto.style.fill).toBe(0xffffff)
    expect(texto.style.fontSize).toBe(GUIDE_LABEL_FONT_SCREEN_PX)
    expect(texto.anchor.x).toBe(0.5)
    expect(texto.anchor.y).toBe(0.5)
    const preenchimentos = placaDe(primeiro).context.instructions.filter((i): i is FillInstruction => i.action === 'fill')
    expect(preenchimentos).toHaveLength(1)
    expect(preenchimentos[0]?.data.style.color).toBe(SMART_GUIDE_LABEL_COLOR)
    // A pílula envolve o texto e é centrada no ponto do rótulo.
    const caixa = placaDe(primeiro).getLocalBounds()
    expect(caixa.minX + caixa.maxX).toBeCloseTo(0)
    expect(caixa.minY + caixa.maxY).toBeCloseTo(0)
    expect(caixa.maxY - caixa.minY).toBeGreaterThan(GUIDE_LABEL_FONT_SCREEN_PX)
  })

  it('mostrar 3 e depois 1: as sobras do pool ficam escondidas', () => {
    const parent = new Container()
    const pool = createGuideLabelPool(parent)
    pool.show([rotulo(0, 0, '1,5 m'), rotulo(50, 0, '1,5 m'), rotulo(100, 0, '3,0 m')], 1, 1)
    expect(visiveis(parent)).toHaveLength(3)
    pool.show([rotulo(0, 0, '1,5 m')], 1, 1)
    expect(visiveis(parent)).toHaveLength(1)
    expect(rotulos(parent)).toHaveLength(GUIDE_LABEL_POOL_SIZE)
  })

  it('o mesmo texto não é reatribuído: rasterizar de novo e refazer a pílula a cada pointermove custaria', () => {
    const parent = new Container()
    const pool = createGuideLabelPool(parent)
    pool.show([rotulo(0, 0, '1,5 m')], 1, 1)
    const texto = textoDe(rotulos(parent)[0])
    const atribuicoes = vi.spyOn(texto, 'text', 'set')
    pool.show([rotulo(10, 0, '1,5 m')], 1, 1)
    expect(atribuicoes).not.toHaveBeenCalled()
    pool.show([rotulo(10, 0, '3,0 m')], 1, 1)
    expect(atribuicoes).toHaveBeenCalledTimes(1)
  })

  it('nunca mais que o pool: com 10 vãos, só os primeiros ganham número', () => {
    const parent = new Container()
    const pool = createGuideLabelPool(parent)
    pool.show(
      Array.from({ length: 10 }, (_, i) => rotulo(i * 40, 0, `${i} m`)),
      1,
      1,
    )
    expect(visiveis(parent)).toHaveLength(GUIDE_LABEL_POOL_SIZE)
    expect(visiveis(parent).map((r) => textoDe(r).text)).toEqual(Array.from({ length: GUIDE_LABEL_POOL_SIZE }, (_, i) => `${i} m`))
  })

  it('hide esconde todos', () => {
    const parent = new Container()
    const pool = createGuideLabelPool(parent)
    pool.show([rotulo(0, 0, '1,5 m'), rotulo(50, 0, '1,5 m')], 1, 1)
    pool.hide()
    expect(visiveis(parent)).toHaveLength(0)
  })

  it('o texto rasteriza na resolução do renderer: na tela ele nunca é esticado pelo zoom', () => {
    const parent = new Container()
    const pool = createGuideLabelPool(parent)
    pool.show([rotulo(0, 0, '1,5 m')], 4, 2)
    expect(textoDe(visiveis(parent)[0]).resolution).toBe(2)
    expect(textoDe(visiveis(parent)[0]).roundPixels).toBe(true)
  })

  it('zoom que não serve (zero, NaN) não estoura a escala: fica 1', () => {
    const parent = new Container()
    const pool = createGuideLabelPool(parent)
    for (const escala of [0, Number.NaN]) {
      pool.show([rotulo(0, 0, '1,5 m')], escala, 1)
      expect(visiveis(parent)[0]?.scale.x).toBe(1)
    }
  })
})

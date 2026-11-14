import type { Renderer } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { multiplySemTamparOFundo } from './multiplySemTamparOFundo'

// As constantes do WebGL que o blend usa (valores reais da especificação).
const GL = { ZERO: 0, ONE: 1, DST_COLOR: 0x0306, ONE_MINUS_SRC_ALPHA: 0x0303 }
const MULTIPLY_DO_PIXI = [GL.DST_COLOR, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA]

function rendererDeMentira() {
  const state = { blendModesMap: { multiply: [...MULTIPLY_DO_PIXI], normal: [GL.ONE, GL.ONE_MINUS_SRC_ALPHA] }, setBlendMode: vi.fn() }
  return { renderer: { gl: GL, state } as unknown as Renderer, state }
}

describe('multiplySemTamparOFundo (terreno alto: a tela de cima com fundo transparente)', () => {
  it('no fundo transparente o alfa do destino fica como estava (ZERO, ONE) e a cor segue a do Pixi; sem ele, volta o do Pixi', () => {
    const { renderer, state } = rendererDeMentira()
    multiplySemTamparOFundo(renderer, true)
    // O bug: com (ONE, ONE_MINUS_SRC_ALPHA) no alfa, o pixel transparente virava preto opaco por cima da vista de baixo.
    expect(state.blendModesMap.multiply).toEqual([GL.DST_COLOR, GL.ONE_MINUS_SRC_ALPHA, GL.ZERO, GL.ONE])
    expect(state.setBlendMode).toHaveBeenLastCalledWith('normal')
    // Subir duas vezes não perde o original; descer devolve o multiply do Pixi intacto.
    multiplySemTamparOFundo(renderer, true)
    multiplySemTamparOFundo(renderer, false)
    expect(state.blendModesMap.multiply).toEqual(MULTIPLY_DO_PIXI)
    expect(state.blendModesMap.normal).toEqual([GL.ONE, GL.ONE_MINUS_SRC_ALPHA])
  })

  it('renderer sem WebGL não é tocado', () => {
    const state = { blendModesMap: { multiply: [...MULTIPLY_DO_PIXI] }, setBlendMode: vi.fn() }
    multiplySemTamparOFundo({ state } as unknown as Renderer, true)
    expect(state.blendModesMap.multiply).toEqual(MULTIPLY_DO_PIXI)
    expect(state.setBlendMode).not.toHaveBeenCalled()
  })
})

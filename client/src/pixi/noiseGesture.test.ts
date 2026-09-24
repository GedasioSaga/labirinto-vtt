/**
 * RUÍDO NO MAPA, lado do mestre: o botão "Ruído" arma; o próximo clique
 * esquerdo no mapa dispara o ruído naquele ponto e desarma (um toque, um
 * ruído). O gesto inteiro (down e up) fica com o ruído: a ferramenta ativa não
 * roda por baixo e não sai um traço de parede junto.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOISE_RANGE_DEFAULT_CELLS, NOISE_RANGE_MAX_CELLS } from '../lib/noise'
import { useNoiseStore } from '../stores/noiseStore'
import { createNoiseGesture } from './noiseGesture'

describe('noiseStore', () => {
  beforeEach(() => {
    useNoiseStore.setState({ armed: false, rangeCells: NOISE_RANGE_DEFAULT_CELLS })
  })

  it('arma, desarma e guarda o alcance preso na faixa', () => {
    expect(useNoiseStore.getState().armed).toBe(false)
    useNoiseStore.getState().setArmed(true)
    expect(useNoiseStore.getState().armed).toBe(true)
    useNoiseStore.getState().setRangeCells(6)
    expect(useNoiseStore.getState().rangeCells).toBe(6)
    useNoiseStore.getState().setRangeCells(9999)
    expect(useNoiseStore.getState().rangeCells).toBe(NOISE_RANGE_MAX_CELLS)
  })
})

describe('createNoiseGesture', () => {
  beforeEach(() => {
    useNoiseStore.setState({ armed: false, rangeCells: NOISE_RANGE_DEFAULT_CELLS })
  })

  it('desarmado: não consome nada e não emite', () => {
    const emit = vi.fn()
    const gesto = createNoiseGesture(emit)
    expect(gesto.pointerDown(0, { x: 10, y: 20 })).toBe(false)
    expect(gesto.pointerUp()).toBe(false)
    expect(emit).not.toHaveBeenCalled()
  })

  it('armado: o clique esquerdo emite o ponto uma vez, desarma e consome o up do mesmo gesto', () => {
    const emit = vi.fn()
    const gesto = createNoiseGesture(emit)
    useNoiseStore.getState().setArmed(true)
    expect(gesto.pointerDown(0, { x: 10, y: 20 })).toBe(true)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith({ x: 10, y: 20 })
    expect(useNoiseStore.getState().armed).toBe(false)
    expect(gesto.pointerUp()).toBe(true)
    // O gesto seguinte já é da ferramenta.
    expect(gesto.pointerDown(0, { x: 30, y: 40 })).toBe(false)
    expect(gesto.pointerUp()).toBe(false)
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('botão do meio ou direito não dispara nem desarma', () => {
    const emit = vi.fn()
    const gesto = createNoiseGesture(emit)
    useNoiseStore.getState().setArmed(true)
    expect(gesto.pointerDown(1, { x: 10, y: 20 })).toBe(false)
    expect(gesto.pointerDown(2, { x: 10, y: 20 })).toBe(false)
    expect(emit).not.toHaveBeenCalled()
    expect(useNoiseStore.getState().armed).toBe(true)
  })
})

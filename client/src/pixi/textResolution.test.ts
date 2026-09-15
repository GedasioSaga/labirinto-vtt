import { afterEach, describe, expect, it, vi } from 'vitest'
import { Container, Text } from 'pixi.js'
import {
  MAX_TEXT_TEXTURE_SIDE,
  TEXT_RESOLUTION_DEBOUNCE_MS,
  chooseTextResolution,
  createDebouncedTask,
  syncWorldTextResolution,
  textZoomStep,
} from './textResolution'

/** Text com tamanho local fixo: jsdom não mede texto (sem canvas 2d). */
function sizedText(width: number, height: number): Text {
  const text = new Text({ text: 'Sala' })
  Object.defineProperty(text, 'bounds', { get: () => ({ width, height }) })
  return text
}

describe('textZoomStep', () => {
  it.each([
    [0.1, 1],
    [0.5, 1],
    [1, 1],
    [1.01, 2],
    [2, 2],
    [2.01, 4],
    [4, 4],
    [10, 4],
  ])('escala %s → degrau %s', (scale, step) => {
    expect(textZoomStep(scale)).toBe(step)
  })

  it('escala inválida vira 1', () => {
    expect(textZoomStep(Number.NaN)).toBe(1)
    expect(textZoomStep(Number.POSITIVE_INFINITY)).toBe(1)
    expect(textZoomStep(-2)).toBe(1)
  })
})

describe('chooseTextResolution', () => {
  it('multiplica a resolução do renderer pelo degrau do zoom', () => {
    expect(chooseTextResolution(1, 4)).toBe(4)
    expect(chooseTextResolution(1, 3)).toBe(4)
    expect(chooseTextResolution(1.25, 2)).toBe(2.5)
    expect(chooseTextResolution(2, 0.5)).toBe(2)
  })

  it('limita o lado maior da textura a MAX_TEXT_TEXTURE_SIDE', () => {
    // 2000 px locais × 4 = 8000 > 4096: cai para 2 (4000 px).
    expect(chooseTextResolution(1, 4, 2000)).toBe(2)
    expect(2000 * chooseTextResolution(1, 4, 2000)).toBeLessThanOrEqual(MAX_TEXT_TEXTURE_SIDE)
    // Texto pequeno não é afetado pelo teto.
    expect(chooseTextResolution(1, 4, 100)).toBe(4)
  })

  it('nunca desce abaixo da resolução do renderer, nem com texto gigante', () => {
    expect(chooseTextResolution(2, 4, 5000)).toBe(2)
  })

  it('resolução de renderer inválida vira 1', () => {
    expect(chooseTextResolution(0, 2)).toBe(2)
    expect(chooseTextResolution(Number.NaN, 1)).toBe(1)
  })
})

describe('syncWorldTextResolution', () => {
  it('aplica a escala do world e dos containers até o Text, inclusive invisível', () => {
    const world = new Container()
    const direct = sizedText(80, 20)
    const stretched = new Container()
    stretched.scale.set(2, 1)
    const nested = sizedText(80, 20)
    nested.visible = false
    stretched.addChild(nested)
    world.addChild(direct, stretched)

    expect(syncWorldTextResolution(world, 2, 1)).toBe(4)
    expect(direct.resolution).toBe(2)
    expect(nested.resolution).toBe(4)

    expect(syncWorldTextResolution(world, 1, 1)).toBe(2)
    expect(direct.resolution).toBe(1)
    expect(nested.resolution).toBe(2)
  })

  it('só reatribui quando a resolução muda (atribuir força nova rasterização)', () => {
    const world = new Container()
    const text = sizedText(80, 20)
    world.addChild(text)
    syncWorldTextResolution(world, 4, 1)
    const update = vi.spyOn(text, 'onViewUpdate')
    syncWorldTextResolution(world, 3.5, 1)
    expect(update).not.toHaveBeenCalled()
    expect(text.resolution).toBe(4)
    syncWorldTextResolution(world, 1.5, 1)
    expect(update).toHaveBeenCalledTimes(1)
    expect(text.resolution).toBe(2)
  })

  it('texto grande respeita o teto de textura', () => {
    const world = new Container()
    const big = sizedText(3000, 200)
    world.addChild(big)
    expect(syncWorldTextResolution(world, 4, 1)).toBe(1)
    expect(big.resolution).toBe(1)
  })

  it('sem Text devolve 0', () => {
    expect(syncWorldTextResolution(new Container(), 4, 1)).toBe(0)
  })
})

describe('createDebouncedTask', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('várias chamadas seguidas rodam uma vez só, depois da espera', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const task = createDebouncedTask(run)
    task.schedule()
    vi.advanceTimersByTime(TEXT_RESOLUTION_DEBOUNCE_MS - 1)
    task.schedule()
    vi.advanceTimersByTime(TEXT_RESOLUTION_DEBOUNCE_MS - 1)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('flush roda já e descarta o pendente; cancel descarta sem rodar', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const task = createDebouncedTask(run)
    task.schedule()
    task.flush()
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(TEXT_RESOLUTION_DEBOUNCE_MS * 2)
    expect(run).toHaveBeenCalledTimes(1)
    task.schedule()
    task.cancel()
    vi.advanceTimersByTime(TEXT_RESOLUTION_DEBOUNCE_MS * 2)
    expect(run).toHaveBeenCalledTimes(1)
  })
})

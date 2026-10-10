import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import { createEmptyMap } from '../lib/mapFactory'
import { createStairHandleGesture } from '../pixi/stairHandleGesture'
import { stairHandles } from '../lib/stairHandles'
import type { MapData, Pin, Stair } from '../types/map'

const GRID = 70

function escada(overrides: Partial<Stair> = {}): Stair {
  return { id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 140, y1: 420, x2: 140, y2: 140 }], stepWidth: 70, ...overrides }
}

/** Pino invisível de escada que leva a outro andar: mora na boca (x1, y1). */
const PINO: Pin = { id: 'p1', x: 140, y: 420, kind: 'viagem', description: '', image: null, passagem: 'pede', escadaId: 's1' }

function abrir(stair: Stair, pins: Pin[] = []): void {
  const map: MapData = { ...createEmptyMap('t', 'Teste', 20, 16, GRID), stairs: [stair], pins }
  useMapStore.setState({ map, past: [], future: [] })
}

const atual = (): Stair => {
  const found = useMapStore.getState().map.stairs.find((s) => s.id === 's1')
  if (found === undefined) throw new Error('escada sumiu')
  return found
}

const ponto = (kind: string) => {
  const handle = stairHandles(atual()).find((h) => h.kind === kind)
  if (handle === undefined) throw new Error(`sem alça ${kind}`)
  return handle.point
}

beforeEach(() => abrir(escada()))

describe('painel: comprimento, largura e curva da escada já colocada', () => {
  it('comprimento novo com histórico: o pé (x1,y1) fica, e Ctrl+Z volta', () => {
    useMapStore.getState().setStairLength('s1', 420)
    expect(atual().segments[0]).toEqual({ x1: 140, y1: 420, x2: 140, y2: 0 })
    useMapStore.getState().undo()
    expect(atual().segments[0]).toEqual({ x1: 140, y1: 420, x2: 140, y2: 140 })
  })

  it('comprimento fora da faixa é limitado (nada de comprimento zero)', () => {
    useMapStore.getState().setStairLength('s1', 0)
    expect(Math.hypot(atual().segments[0].x2 - 140, atual().segments[0].y2 - 420)).toBeCloseTo(GRID * 0.25, 9)
  })

  it('curva ao vivo sem histórico; zero tira o campo', () => {
    useMapStore.getState().setStairCurveLive('s1', 50)
    expect(atual().curva).toBe(50)
    expect(useMapStore.getState().past).toHaveLength(0)
    useMapStore.getState().setStairCurveLive('s1', 0)
    expect(atual()).not.toHaveProperty('curva')
  })
})

describe('alças: um arrasto inteiro é um Ctrl+Z', () => {
  it('ponta: vários quadros, um passo de desfazer, e o pino da escada vai junto quando o pé anda', () => {
    abrir(escada(), [PINO])
    const gesto = createStairHandleGesture()
    expect(gesto.begin('s1', ponto('start'), 1)).toBe(true)
    gesto.move({ x: 140, y: 460 }, false)
    gesto.move({ x: 140, y: 500 }, false)
    expect(gesto.finish()).toBe(true)
    expect(atual().segments[0]).toEqual({ x1: 140, y1: 500, x2: 140, y2: 140 })
    expect(useMapStore.getState().map.pins[0]).toMatchObject({ x: 140, y: 500 })
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(atual().segments[0]).toEqual({ x1: 140, y1: 420, x2: 140, y2: 140 })
    expect(useMapStore.getState().map.pins[0]).toMatchObject({ x: 140, y: 420 })
  })

  it('curva pela alça do meio; Esc no meio volta como estava, sem histórico', () => {
    const gesto = createStairHandleGesture()
    expect(gesto.begin('s1', ponto('curve'), 1)).toBe(true)
    gesto.move({ x: 200, y: 280 }, false)
    expect(atual().curva).toBe(60)
    expect(gesto.cancel()).toBe(true)
    expect(atual()).toEqual(escada())
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('clique na alça sem arrastar não vira passo de desfazer', () => {
    const gesto = createStairHandleGesture()
    expect(gesto.begin('s1', ponto('side-left'), 1)).toBe(true)
    expect(gesto.finish()).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('escada travada não pega alça nenhuma', () => {
    abrir(escada({ locked: true }))
    expect(createStairHandleGesture().begin('s1', ponto('start'), 1)).toBe(false)
  })

  it('camada travada também não', () => {
    abrir(escada())
    useMapStore.setState((s) => ({ map: { ...s.map, lockedLayers: ['escadas'] } }))
    expect(createStairHandleGesture().begin('s1', ponto('start'), 1)).toBe(false)
  })

  it('fora de alça, o gesto não começa (o clique segue para arrastar a escada)', () => {
    expect(createStairHandleGesture().begin('s1', { x: 140, y: 350 }, 1)).toBe(false)
  })
})

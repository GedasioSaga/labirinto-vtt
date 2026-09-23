import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import {
  MEASURE_OFF,
  escapeDisarmsMeasure,
  measurePointFromScreen,
  measureWorldToScreen,
  playerMeasureLabel,
  playerMeasureReducer,
  withMeasureArmed,
  type PlayerMeasureState,
} from './playerMeasure'

const ARMED: PlayerMeasureState = { armed: true, measure: null }

describe('withMeasureArmed (liga/desliga do botão e do Escape)', () => {
  it('ligar começa sem medida nenhuma', () => {
    expect(withMeasureArmed(MEASURE_OFF, true)).toEqual({ armed: true, measure: null })
  })

  it('desligar apaga a medida que estava na tela', () => {
    const medindo = playerMeasureReducer(ARMED, { type: 'press', at: { x: 0, y: 0 } })
    expect(withMeasureArmed(medindo, false)).toEqual(MEASURE_OFF)
  })

  it('ligar de novo o que já está ligado não apaga a medida (re-render com a mesma prop)', () => {
    const solta = playerMeasureReducer(playerMeasureReducer(ARMED, { type: 'press', at: { x: 0, y: 0 } }), { type: 'release' })
    expect(withMeasureArmed(solta, true)).toBe(solta)
  })
})

describe('playerMeasureReducer (o gesto)', () => {
  it('pressionar com o modo desligado não mede', () => {
    expect(playerMeasureReducer(MEASURE_OFF, { type: 'press', at: { x: 5, y: 5 } })).toBe(MEASURE_OFF)
  })

  it('pressionar, arrastar e soltar deixa a medida parada na tela', () => {
    let s = playerMeasureReducer(ARMED, { type: 'press', at: { x: 300, y: 300 } })
    s = playerMeasureReducer(s, { type: 'move', at: { x: 400, y: 300 } })
    s = playerMeasureReducer(s, { type: 'move', at: { x: 450, y: 300 } })
    s = playerMeasureReducer(s, { type: 'release' })
    expect(s).toEqual({ armed: true, measure: { start: { x: 300, y: 300 }, end: { x: 450, y: 300 }, dragging: false } })
  })

  it('mover depois de soltar não estica a medida solta', () => {
    const solta = playerMeasureReducer(playerMeasureReducer(ARMED, { type: 'press', at: { x: 0, y: 0 } }), { type: 'release' })
    expect(playerMeasureReducer(solta, { type: 'move', at: { x: 999, y: 999 } })).toBe(solta)
    expect(playerMeasureReducer(solta, { type: 'release' })).toBe(solta)
  })

  it('o próximo toque troca a medida solta por uma nova', () => {
    const solta = playerMeasureReducer(playerMeasureReducer(ARMED, { type: 'press', at: { x: 0, y: 0 } }), { type: 'release' })
    const nova = playerMeasureReducer(solta, { type: 'press', at: { x: 50, y: 50 } })
    expect(nova.measure).toEqual({ start: { x: 50, y: 50 }, end: { x: 50, y: 50 }, dragging: true })
  })

  it('move e release sem medida nenhuma não fazem nada', () => {
    expect(playerMeasureReducer(ARMED, { type: 'move', at: { x: 1, y: 1 } })).toBe(ARMED)
    expect(playerMeasureReducer(ARMED, { type: 'release' })).toBe(ARMED)
  })
})

describe('escapeDisarmsMeasure', () => {
  it('Escape fora de campo desliga; outra tecla não', () => {
    expect(escapeDisarmsMeasure('Escape', null)).toBe(true)
    expect(escapeDisarmsMeasure('Enter', null)).toBe(false)
  })
})

describe('measurePointFromScreen (arrasto → ponto de mundo)', () => {
  const map = createEmptyMap('m', 'Teste', 20, 12, 50)
  const camera = { x: 24, y: 40, scale: 1.232 }

  it('desfaz a câmera e gruda no vértice da grade, como a régua do mestre', () => {
    const tela = measureWorldToScreen(camera, { x: 302, y: 297 })
    expect(measurePointFromScreen(camera, tela, map, false)).toEqual({ x: 300, y: 300 })
  })

  it('Alt inverte o grude: ponto livre', () => {
    const tela = measureWorldToScreen(camera, { x: 302, y: 297 })
    const p = measurePointFromScreen(camera, tela, map, true)
    expect(p.x).toBeCloseTo(302)
    expect(p.y).toBeCloseTo(297)
  })

  it('grade hexagonal gruda no vértice do hexágono, não no quadrado', () => {
    const hex: MapData = { ...map, gridShape: 'hex' }
    const p = measurePointFromScreen({ x: 0, y: 0, scale: 1 }, { x: 302, y: 297 }, hex, false)
    expect(p).not.toEqual({ x: 300, y: 300 })
  })
})

describe('playerMeasureLabel', () => {
  it('3 quadrados num mapa novo dão "4,5 m", o mesmo texto do mestre', () => {
    const map = createEmptyMap('m', 'Teste', 20, 12, 50)
    expect(playerMeasureLabel(map, { start: { x: 300, y: 300 }, end: { x: 450, y: 300 }, dragging: false })).toBe('4,5 m')
  })

  it('segue a escala e o modo de contagem que o mestre escolheu', () => {
    const base = createEmptyMap('m', 'Teste', 20, 12, 50)
    const map: MapData = { ...base, scale: { unitsPerCell: 5, unit: 'ft', precision: 0 }, measurementMode: 'alternating' }
    // (3,3) em 3.5e = 3 + floor(3/2) = 4 células = 20 ft.
    expect(playerMeasureLabel(map, { start: { x: 0, y: 0 }, end: { x: 150, y: 150 }, dragging: true })).toBe('20 ft')
  })

  it('medida de ponto único dá zero, sem NaN', () => {
    const map = createEmptyMap('m', 'Teste', 20, 12, 50)
    expect(playerMeasureLabel(map, { start: { x: 10, y: 10 }, end: { x: 10, y: 10 }, dragging: true })).toBe('0,0 m')
  })
})

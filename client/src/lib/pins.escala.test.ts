import { describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { createEmptyMap, updatePin } from './mapFactory'
import {
  PIN_HEAD_OFFSET,
  PIN_HEAD_RADIUS,
  PIN_HEIGHT,
  PIN_ESCALA_MIN,
  PIN_MIN_SCREEN_HEIGHT,
  corDoPino,
  fatorDoPino,
  pinSizeFloor,
  pinSizeFloorFor,
  pinSizeScale,
  corDoPinoParaGravar,
  escalaDoPino,
  escalaDoPinoParaGravar,
  findPinAt,
  findPinsAt,
} from './pins'

/**
 * TAMANHO DO PINO no toque (fatia 14): o alvo é o pino como ele aparece, então
 * cresce e encolhe com `Pin.escala`, multiplicado pelo fator do zoom. E o que a
 * Aparência grava: o padrão é sempre AUSENTE.
 */

const PINO: Pin = { id: 'p', x: 100, y: 200, kind: 'exclamacao', description: '', image: null }

/** Um ponto `dy` acima da ponta, na vertical do pino. */
const acima = (dy: number) => ({ x: PINO.x, y: PINO.y - dy })

describe('pins: escala e cor', () => {
  it('escalaDoPino: ausente ou torta = 1; na faixa, ela mesma', () => {
    expect(escalaDoPino({})).toBe(1)
    for (const torta of [0, 0.4, 4, Number.NaN, Number.POSITIVE_INFINITY]) expect(escalaDoPino({ escala: torta })).toBe(1)
    expect(escalaDoPino({ escala: 0.5 })).toBe(0.5)
    expect(escalaDoPino({ escala: 3 })).toBe(3)
  })

  it('corDoPino: só hex de seis dígitos vira número; o resto é o latão (null)', () => {
    expect(corDoPino({ cor: '#5b6670' })).toBe(0x5b6670)
    expect(corDoPino({})).toBeNull()
    expect(corDoPino({ cor: 'red' })).toBeNull()
  })

  it('o que a Aparência grava: padrão, latão de fábrica e 1 viram AUSENTE', () => {
    expect(corDoPinoParaGravar(null)).toBeUndefined()
    expect(corDoPinoParaGravar('#F2C14E')).toBeUndefined()
    expect(corDoPinoParaGravar('#5B6670')).toBe('#5b6670')
    expect(corDoPinoParaGravar('torta')).toBeUndefined()
    expect(escalaDoPinoParaGravar(null)).toBeUndefined()
    expect(escalaDoPinoParaGravar(1)).toBeUndefined()
    expect(escalaDoPinoParaGravar(7)).toBeUndefined()
    expect(escalaDoPinoParaGravar(1.5)).toBe(1.5)
  })

  it('escala 3: o topo da cabeça grande acerta, e fora dela não', () => {
    const grande = { ...PINO, escala: 3 }
    const topo = (PIN_HEAD_OFFSET + PIN_HEAD_RADIUS) * 3 - 1
    expect(findPinAt([grande], acima(topo))).toBe(grande)
    expect(findPinsAt([grande], acima(topo))).toEqual([grande])
    // O pino de sempre não chega lá.
    expect(findPinAt([PINO], acima(topo))).toBeNull()
    expect(findPinAt([grande], acima(topo + 3))).toBeNull()
  })

  it('escala 0,5: o ponto que o pino de sempre pegava passa a ser chão', () => {
    const pequeno = { ...PINO, escala: 0.5 }
    const centroDeSempre = acima(PIN_HEAD_OFFSET)
    expect(findPinAt([PINO], centroDeSempre)).toBe(PINO)
    expect(findPinAt([pequeno], centroDeSempre)).toBeNull()
    expect(findPinAt([pequeno], acima(PIN_HEAD_OFFSET * 0.5))).toBe(pequeno)
  })

  it('escala e zoom se multiplicam', () => {
    const grande = { ...PINO, escala: 2 }
    const topo = (PIN_HEAD_OFFSET + PIN_HEAD_RADIUS) * 4 - 1
    expect(findPinAt([grande], acima(topo), 0, 2)).toBe(grande)
    expect(findPinAt([grande], acima(topo), 0, 1)).toBeNull()
  })

  it('pino pequeno: a folga do dedo encolhe junto e não abre o pino tocando o chão ao lado', () => {
    const pequeno = { ...PINO, escala: 0.5 }
    const aoLado = { x: PINO.x + PIN_HEAD_RADIUS * 0.5 + 15, y: PINO.y - PIN_HEAD_OFFSET * 0.5 }
    expect(findPinAt([pequeno], aoLado, 16)).toBeNull()
    expect(findPinAt([PINO], { x: PINO.x + PIN_HEAD_RADIUS + 15, y: PINO.y - PIN_HEAD_OFFSET }, 16)).toBe(PINO)
  })

  it('piso de tela: o pino 0,5 não fica abaixo de PIN_MIN_SCREEN_HEIGHT; o de escala 1 ou maior não muda', () => {
    // Entre ~47% e ~94% de zoom o fator do zoom é 1, mas o 0,5 já ficaria abaixo do piso.
    const camera = (PIN_MIN_SCREEN_HEIGHT / PIN_HEIGHT) * 1.25
    const piso = pinSizeFloor(camera)
    expect(pinSizeScale(camera)).toBe(1)
    expect(PIN_HEIGHT * fatorDoPino({ escala: 0.5 }, 1, piso) * camera).toBeCloseTo(PIN_MIN_SCREEN_HEIGHT, 9)
    // De longe, o 0,5 fica do tamanho do 1 (o piso), e o 3 segue três vezes o 1.
    const longe = (PIN_MIN_SCREEN_HEIGHT / PIN_HEIGHT) * 0.25
    expect(fatorDoPino({ escala: 0.5 }, pinSizeScale(longe), pinSizeFloor(longe))).toBeCloseTo(pinSizeScale(longe), 9)
    expect(fatorDoPino({ escala: 3 }, pinSizeScale(longe), pinSizeFloor(longe))).toBeCloseTo(pinSizeScale(longe) * 3, 9)
    expect(fatorDoPino({}, pinSizeScale(camera), piso)).toBe(1)
    // De perto o piso não pesa: o 0,5 é metade, e o zoom de perto nunca repinta à toa.
    expect(pinSizeFloor(4)).toBe(PIN_ESCALA_MIN)
    expect(fatorDoPino({ escala: 0.5 }, 1, pinSizeFloor(4))).toBe(0.5)
    for (const torta of [0, -1, Number.NaN]) expect(pinSizeFloor(torta)).toBe(0)
    expect(fatorDoPino({ escala: 0.5 }, 1, Number.NaN)).toBe(0.5)
    // Sem pino reduzido não há piso (o zoom não repinta pino); com um, há.
    expect(pinSizeFloorFor([{}, { escala: 2 }], camera)).toBe(0)
    expect(pinSizeFloorFor([{}, { escala: 0.5 }], camera)).toBe(piso)
  })

  it('piso de tela no toque: a cabeça do 0,5 no tamanho do piso acerta', () => {
    const pequeno = { ...PINO, escala: 0.5 }
    const centroNoPiso = acima(PIN_HEAD_OFFSET * 0.8)
    expect(findPinAt([pequeno], centroNoPiso, 0, 1)).toBeNull()
    expect(findPinAt([pequeno], centroNoPiso, 0, 1, 0.8)).toBe(pequeno)
    expect(findPinsAt([pequeno], centroNoPiso, 0, 1, 0.8)).toEqual([pequeno])
  })

  it('findPinsAt: o mais perto do centro da cabeça DE CADA pino vem primeiro', () => {
    const grande = { ...PINO, id: 'g', escala: 3 }
    const comum = { ...PINO, id: 'c' }
    // No centro da cabeça grande, o pino comum também pega (a haste), mas está mais longe.
    expect(findPinsAt([comum, grande], acima(PIN_HEAD_OFFSET * 3)).map((p) => p.id)).toEqual(['g'])
    expect(findPinsAt([grande, comum], acima(PIN_HEAD_OFFSET)).map((p) => p.id)).toEqual(['c', 'g'])
  })
})

describe('mapFactory.updatePin: cor e escala', () => {
  const mapa = { ...createEmptyMap('m', 'M', 5, 5, 64), pins: [PINO] }

  it('só a cor ou só a escala é mudança', () => {
    expect(updatePin(mapa, 'p', { cor: '#5b6670' }).pins[0].cor).toBe('#5b6670')
    expect(updatePin(mapa, 'p', { escala: 2 }).pins[0].escala).toBe(2)
  })

  it('voltar ao padrão quem já é padrão, ou repetir o valor, não é mudança', () => {
    expect(updatePin(mapa, 'p', { cor: undefined, escala: undefined })).toBe(mapa)
    const colorido = updatePin(mapa, 'p', { cor: '#5b6670', escala: 2 })
    expect(updatePin(colorido, 'p', { cor: '#5b6670', escala: 2 })).toBe(colorido)
  })
})

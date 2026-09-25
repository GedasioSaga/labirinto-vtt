import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Stair } from '../types/map'
import { createEmptyMap, moveStair, removeStair, updateStairPoint } from './mapFactory'
import { countEntitiesByLayer, visiblePins } from './layers'
import { mapObjectsOf } from './mapObjects'
import { deserializeMap, serializeMap } from './mapFile'
import { pinSummary } from './pins'
import { buildPartnerStair, stairTravelLabel } from './stairTravel'
import { findStairPinAt } from './selectionHitTest'

/**
 * A escada que leva a outro andar carrega um pino de viagem INVISÍVEL: ele anda
 * com a escada, some com ela, não se desenha nem entra em lista, e sobrevive ao
 * disco. Arrastar a escada leva a ligação.
 */

const ESCADA: Stair = {
  id: 'escada-terreo',
  shape: 'straight',
  direction: 'up',
  segments: [{ x1: 400, y1: 300, x2: 400, y2: 180 }],
  stepWidth: 40,
}

const PINO_DA_ESCADA: Pin = {
  id: 'pino-da-escada',
  x: 400,
  y: 300,
  kind: 'viagem',
  description: '',
  image: null,
  passagem: 'livre',
  destino: { sceneId: 'cena-andar1', pinId: 'pino-de-cima' },
  escadaId: 'escada-terreo',
}

const MARCADOR: Pin = { id: 'marcador', x: 100, y: 100, kind: 'exclamacao', description: 'Baú', image: null }

function terreo(): MapData {
  return { ...createEmptyMap('m', 'Térreo', 30, 20, 40), stairs: [ESCADA], pins: [PINO_DA_ESCADA, MARCADOR] }
}

function pinoDaEscada(map: MapData): Pin | undefined {
  return map.pins.find((p) => p.id === 'pino-da-escada')
}

describe('escada leva a outro andar: o pino anda com a escada', () => {
  it('arrastar a escada inteira leva o pino junto, na boca dela', () => {
    const depois = moveStair(terreo(), 'escada-terreo', 80, -40)
    expect(pinoDaEscada(depois)).toMatchObject({ x: 480, y: 260, destino: PINO_DA_ESCADA.destino })
    // O marcador comum fica onde estava.
    expect(depois.pins.find((p) => p.id === 'marcador')).toEqual(MARCADOR)
  })

  it('puxar a ponta de chão do lance leva o pino; puxar a outra ponta não o tira do lugar', () => {
    const boca = updateStairPoint(terreo(), 'escada-terreo', 0, 0, 440, 320)
    expect(pinoDaEscada(boca)).toMatchObject({ x: 440, y: 320 })
    const topo = updateStairPoint(terreo(), 'escada-terreo', 0, 1, 400, 100)
    expect(pinoDaEscada(topo)).toMatchObject({ x: 400, y: 300 })
  })

  it('apagar a escada apaga o pino dela (e o guardião desliga o par)', () => {
    const depois = removeStair(terreo(), 'escada-terreo')
    expect(depois.pins.map((p) => p.id)).toEqual(['marcador'])
  })

  it('escada sem ligação: arrastar não copia a lista de pinos', () => {
    const semLigacao: MapData = { ...terreo(), pins: [MARCADOR] }
    expect(moveStair(semLigacao, 'escada-terreo', 10, 10).pins).toBe(semLigacao.pins)
  })
})

describe('escada leva a outro andar: nenhum pino extra à vista', () => {
  it('o pino da escada não se desenha, não entra na lista de objetos nem na contagem da camada', () => {
    const map = terreo()
    expect(visiblePins(map.pins, map.hiddenLayers).map((p) => p.id)).toEqual(['marcador'])
    expect(mapObjectsOf(map).filter((e) => e.kind === 'pin').map((e) => e.id)).toEqual(['marcador'])
    expect(countEntitiesByLayer(map).anotacoes).toBe(1)
  })

  it('o mestre lê "Escada" no pedido e na lista, nunca "Pino de viagem"', () => {
    expect(pinSummary(PINO_DA_ESCADA)).toBe('Escada')
  })
})

describe('escada leva a outro andar: disco', () => {
  it('escadaId sobrevive a gravar e abrir', () => {
    const lido = deserializeMap(serializeMap(terreo()))
    expect(pinoDaEscada(lido)?.escadaId).toBe('escada-terreo')
    expect(lido.pins.find((p) => p.id === 'marcador')?.escadaId).toBeUndefined()
  })

  it('escadaId fora da forma (número, texto vazio) volta ausente', () => {
    const cru = JSON.parse(serializeMap(terreo())) as { pins: Record<string, unknown>[] }
    cru.pins[0].escadaId = 42
    cru.pins[1].escadaId = ''
    const lido = deserializeMap(JSON.stringify(cru))
    expect(lido.pins.map((p) => p.escadaId)).toEqual([undefined, undefined])
  })
})

describe('escada leva a outro andar: a escada par e o toque', () => {
  it('a escada par tem o mesmo desenho, o sentido contrário e a boca no ponto pedido', () => {
    const par = buildPartnerStair('escada-andar1', ESCADA, { x: 600, y: 400 })
    expect(par).toEqual({
      id: 'escada-andar1',
      shape: 'straight',
      direction: 'down',
      segments: [{ x1: 600, y1: 400, x2: 600, y2: 280 }],
      stepWidth: 40,
    })
  })

  it('o jogador lê o sentido, nunca o andar', () => {
    expect(stairTravelLabel('up')).toBe('Subir')
    expect(stairTravelLabel('down')).toBe('Descer')
  })

  it('tocar em qualquer ponto do lance acha o pino da escada; fora dele, nada', () => {
    const map = terreo()
    expect(findStairPinAt(map, { x: 405, y: 240 }, 4)?.id).toBe('pino-da-escada')
    expect(findStairPinAt(map, { x: 700, y: 240 }, 4)).toBeNull()
    // Escada sem pino (não leva a lugar nenhum) não abre cartão.
    expect(findStairPinAt({ ...map, pins: [MARCADOR] }, { x: 405, y: 240 }, 4)).toBeNull()
  })
})

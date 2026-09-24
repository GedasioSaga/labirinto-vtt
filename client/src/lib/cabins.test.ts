/**
 * MOVIMENTO IMPOSTO — o pino de CABINE CONTÍNUA (paternoster). O mestre liga um
 * pino ao próximo pino da mesma cena; a cada "Avançar esteiras", a ficha que
 * ficou parada no pino é levada ao próximo. A esteira anda antes: quem a
 * esteira moveu neste Avançar não pega a cabine.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import { ficha, torre } from './__fixtures__/hazardTower'
import { cabinOf, cabinTargets, readCabin, setPinCabin } from './cabins'
import { advanceConveyors, roomConveyorState } from './conveyors'
import { deserializeMap, serializeMap } from './mapFile'

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: '', image: null, ...extra }
}

/** Duas paradas na sala A e uma na sala C (atrás da porta fechada B|C): A1 → A2 → C1 → A1. */
function elevador(tokens: Token[], extra: Partial<MapData> = {}): MapData {
  return {
    ...torre({ tokens }),
    pins: [
      pino('parada-a1', 75, 75, { cabine: 'parada-a2', description: 'Cabine do térreo' }),
      pino('parada-a2', 375, 325, { cabine: 'parada-c1' }),
      pino('parada-c1', 1275, 75, { cabine: 'parada-a1' }),
      pino('cartaz', 225, 225),
    ],
    ...extra,
  }
}

function posicao(map: MapData, id: string): { x: number; y: number } | undefined {
  const t = map.tokens.find((token) => token.id === id)
  return t === undefined ? undefined : { x: t.x, y: t.y }
}

describe('advanceConveyors — a cabine contínua leva quem ficou parado no pino', () => {
  it('a ficha parada no pino vai ao próximo; no Avançar seguinte, ao outro; e fecha o ciclo', () => {
    const um = advanceConveyors(elevador([ficha('ana', 75, 75)]))
    expect(posicao(um, 'ana')).toEqual({ x: 375, y: 325 })
    // Atravessa a porta fechada: a cabine anda no poço, não no chão.
    const dois = advanceConveyors(um)
    expect(posicao(dois, 'ana')).toEqual({ x: 1275, y: 75 })
    expect(posicao(advanceConveyors(dois), 'ana')).toEqual({ x: 75, y: 75 })
  })

  it('parado no pino é estar na casa do pino, não em cima do pixel exato', () => {
    expect(posicao(advanceConveyors(elevador([ficha('ana', 90, 60)])), 'ana')).toEqual({ x: 375, y: 325 })
    // Uma casa ao lado já não está no pino.
    const fora = elevador([ficha('ana', 125, 75)])
    expect(advanceConveyors(fora)).toBe(fora)
  })

  it('pino sem cabine, cabine que aponta para pino apagado e pino de viagem não levam ninguém', () => {
    const cartaz = elevador([ficha('ana', 225, 225)])
    expect(advanceConveyors(cartaz)).toBe(cartaz)
    const orfa: MapData = { ...torre({ tokens: [ficha('ana', 75, 75)] }), pins: [pino('p1', 75, 75, { cabine: 'sumiu' })] }
    expect(advanceConveyors(orfa)).toBe(orfa)
    const viagem: MapData = {
      ...torre({ tokens: [ficha('ana', 75, 75)] }),
      pins: [pino('p1', 75, 75, { kind: 'viagem', cabine: 'p2' }), pino('p2', 375, 325)],
    }
    expect(advanceConveyors(viagem)).toBe(viagem)
  })

  it('quem a esteira moveu neste Avançar não pega a cabine; quem a esteira não conseguiu mover pega', () => {
    const esteiraSul = { conveyors: [{ id: 'e1', roomId: 'sala-a', direction: 'sul' as const, stepCells: 3 }] }
    // Ana está no pino A1, mas a esteira a leva 3 casas para o sul: ela estava andando.
    const andando = advanceConveyors(elevador([ficha('ana', 75, 75)], esteiraSul))
    expect(posicao(andando, 'ana')).toEqual({ x: 75, y: 225 })
    // Com a esteira para o norte, Ana está colada na borda do mapa: ficou parada, a cabine a leva.
    const esteiraNorte = { conveyors: [{ id: 'e1', roomId: 'sala-a', direction: 'norte' as const, stepCells: 3 }] }
    const parada: MapData = { ...elevador([ficha('ana', 75, 25)], esteiraNorte), pins: [pino('p1', 75, 25, { cabine: 'p2' }), pino('p2', 375, 325)] }
    expect(posicao(advanceConveyors(parada), 'ana')).toEqual({ x: 375, y: 325 })
  })

  it('com "Fichas ocupam espaço", cabine cheia no destino segura a ficha; troca entre duas paradas passa', () => {
    const ocupa = { movement: { tokensOccupy: true } }
    // P2 é a última parada (não leva adiante): o guarda parado nela não sai do lugar.
    const terminal = (extra: Partial<MapData>): MapData => ({
      ...torre({ tokens: [ficha('ana', 75, 75), ficha('guarda', 375, 325)] }),
      pins: [pino('p1', 75, 75, { cabine: 'p2' }), pino('p2', 375, 325)],
      ...extra,
    })
    const cheia = terminal(ocupa)
    expect(advanceConveyors(cheia)).toBe(cheia)
    // Sem a regra, a cabine despeja em cima (a mesa que não liga ocupação não muda).
    expect(posicao(advanceConveyors(terminal({})), 'ana')).toEqual({ x: 375, y: 325 })
    // A1 → A2 e A2 → C1 ao mesmo tempo: a cabine de Bia sai de A2 enquanto a de Ana chega.
    const fila = advanceConveyors(elevador([ficha('ana', 75, 75), ficha('bia', 375, 325)], ocupa))
    expect(posicao(fila, 'ana')).toEqual({ x: 375, y: 325 })
    expect(posicao(fila, 'bia')).toEqual({ x: 1275, y: 75 })
    // Duas fichas para a mesma parada: vai a primeira, a segunda espera.
    const dupla: MapData = {
      ...torre({ tokens: [ficha('ana', 75, 75), ficha('bia', 375, 75)] }),
      pins: [pino('p1', 75, 75, { cabine: 'p3' }), pino('p2', 375, 75, { cabine: 'p3' }), pino('p3', 225, 325)],
      movement: { tokensOccupy: true },
    }
    const depois = advanceConveyors(dupla)
    expect(posicao(depois, 'ana')).toEqual({ x: 225, y: 325 })
    expect(posicao(depois, 'bia')).toEqual({ x: 375, y: 75 })
  })

  it('o painel sabe que o Avançar move alguém só pela cabine, mesmo sem esteira na cena', () => {
    expect(roomConveyorState(elevador([ficha('ana', 75, 75)]), 'sala-a').canAdvance).toBe(true)
    expect(roomConveyorState(elevador([ficha('ana', 225, 225)]), 'sala-a').canAdvance).toBe(false)
  })
})

describe('setPinCabin — o mestre liga o pino ao próximo', () => {
  it('liga, troca e desliga tirando o campo', () => {
    const base: MapData = { ...torre(), pins: [pino('p1', 75, 75), pino('p2', 375, 325), pino('p3', 225, 225)] }
    const ligada = setPinCabin(base, 'p1', 'p2')
    expect(cabinOf(ligada, 'p1')).toBe('p2')
    const trocada = setPinCabin(ligada, 'p1', 'p3')
    expect(cabinOf(trocada, 'p1')).toBe('p3')
    const desligada = setPinCabin(trocada, 'p1', null)
    expect(cabinOf(desligada, 'p1')).toBeNull()
    expect('cabine' in (desligada.pins[0] ?? {})).toBe(false)
  })

  it('o mesmo destino, o próprio pino, pino que não existe e pino de viagem devolvem o MESMO mapa', () => {
    const base: MapData = {
      ...torre(),
      pins: [pino('p1', 75, 75, { cabine: 'p2' }), pino('p2', 375, 325), pino('v1', 225, 225, { kind: 'viagem' })],
    }
    expect(setPinCabin(base, 'p1', 'p2')).toBe(base)
    expect(setPinCabin(base, 'p1', 'p1')).toBe(base)
    expect(setPinCabin(base, 'p1', 'nao-existe')).toBe(base)
    expect(setPinCabin(base, 'nao-existe', 'p2')).toBe(base)
    expect(setPinCabin(base, 'p1', 'v1')).toBe(base)
    expect(setPinCabin(base, 'v1', 'p2')).toBe(base)
    expect(setPinCabin(base, 'p2', null)).toBe(base)
  })

  it('as paradas que o painel oferece: os outros pinos "!"/"?" desta cena, com nome legível', () => {
    const map = elevador([])
    expect(cabinTargets(map, 'parada-a2')).toEqual([
      { id: 'parada-a1', label: 'Cabine do térreo' },
      { id: 'parada-c1', label: 'Pino na coluna 26, linha 2' },
      { id: 'cartaz', label: 'Pino na coluna 5, linha 5' },
    ])
  })
})

describe('cabine no arquivo', () => {
  it('volta igual do arquivo; mapa antigo abre sem o campo; lixo sai', () => {
    const map = elevador([])
    expect(deserializeMap(serializeMap(map)).pins.map((p) => p.cabine)).toEqual(['parada-a2', 'parada-c1', 'parada-a1', undefined])
    expect('cabine' in (deserializeMap(serializeMap({ ...torre(), pins: [pino('p1', 1, 1)] })).pins[0] ?? {})).toBe(false)
    expect(readCabin(42)).toBeUndefined()
    expect(readCabin('')).toBeUndefined()
    expect(readCabin('p2')).toBe('p2')
    expect(deserializeMap('{"id": "x", "pins": [{"id": "p1", "x": 1, "y": 1, "cabine": {"id": 3}}]}').pins[0]?.cabine).toBeUndefined()
  })
})

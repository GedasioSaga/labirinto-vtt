/**
 * MOVIMENTO IMPOSTO na base com PISOS NA MESMA CENA (`lib/pisos.ts`). A sala,
 * a parede, o pino e a ficha têm piso; a esteira e a cabine só valem no piso
 * delas. A ficha do térreo que passa sob a esteira do piso de cima não anda, a
 * parede do outro piso não segura ninguém, e a ficha de outro piso não segura a
 * fila ("Fichas ocupam espaço"): o jogador não a recebe (o recorte é por piso).
 * A alavanca é mecanismo de porta, não parada de cabine.
 */
import { describe, expect, it } from 'vitest'
import type { Conveyor, MapData, Pin, Token } from '../types/map'
import { ficha, parede, sala, torre } from './__fixtures__/hazardTower'
import { cabinOf, cabinTargets } from './cabins'
import { advanceConveyors } from './conveyors'
import { filterMapForGroup } from './fogFilter'

const LESTE: Conveyor = { id: 'e1', roomId: 'sala-a', direction: 'leste', stepCells: 3 }

function posicao(map: MapData, id: string): { x: number; y: number } | undefined {
  const t = map.tokens.find((token) => token.id === id)
  return t === undefined ? undefined : { x: t.x, y: t.y }
}

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: '', image: null, ...extra }
}

/** A torre com um mezanino (piso 1) sobre a sala A: a esteira é do mezanino. */
function comMezanino(tokens: Token[], extra: Partial<MapData> = {}): MapData {
  const base = torre({ tokens })
  return {
    ...base,
    regions: [
      { ...sala('sala-a', 0, 500), piso: 1 },
      { ...sala('sala-terreo', 0, 500) },
      sala('sala-b', 500, 1000),
      sala('sala-c', 1000, 1500),
    ],
    conveyors: [LESTE],
    ...extra,
  }
}

describe('esteira e pisos na mesma cena', () => {
  it('a esteira do mezanino empurra só a ficha do mezanino; a do térreo, no mesmo ponto, fica', () => {
    const antes = comMezanino([ficha('ana', 125, 75, { piso: 1 }), ficha('bia', 125, 175)])
    const depois = advanceConveyors(antes)
    expect(posicao(depois, 'ana')).toEqual({ x: 275, y: 75 })
    expect(posicao(depois, 'bia')).toEqual({ x: 125, y: 175 })
    // O piso não muda com a esteira: Ana continua no mezanino.
    expect(depois.tokens.find((t) => t.id === 'ana')?.piso).toBe(1)
  })

  it('só a ficha do térreo sob a esteira do mezanino: ninguém anda, o MESMO mapa (sem histórico à toa)', () => {
    const antes = comMezanino([ficha('bia', 125, 175)])
    expect(advanceConveyors(antes)).toBe(antes)
  })

  it('a parede de outro piso não segura; a do piso da ficha segura', () => {
    // Parede do térreo em x = 250, cortando a sala A de cima a baixo.
    const paredeTerreo = parede('meio-terreo', 250, 0, 250, 400)
    const doMezanino = comMezanino([ficha('ana', 125, 75, { piso: 1 })], { walls: [...torre().walls, paredeTerreo] })
    expect(posicao(advanceConveyors(doMezanino), 'ana')).toEqual({ x: 275, y: 75 })
    // A mesma parede no mezanino segura Ana na casa antes dela.
    const noMezanino = comMezanino([ficha('ana', 125, 75, { piso: 1 })], { walls: [...torre().walls, { ...paredeTerreo, piso: 1 }] })
    expect(posicao(advanceConveyors(noMezanino), 'ana')).toEqual({ x: 225, y: 75 })
  })

  it('"Fichas ocupam espaço": a ficha do térreo na casa à frente não segura Ana no mezanino — e o recorte de Ana não a traz', () => {
    // Bia, no térreo, encostada na divisória x = 500: a casa (475, 75) do térreo é dela.
    const antes = comMezanino([ficha('ana', 325, 75, { piso: 1 }), ficha('bia', 475, 75)], { movement: { tokensOccupy: true } })
    const depois = advanceConveyors(antes)
    expect(posicao(depois, 'ana')).toEqual({ x: 475, y: 75 })
    expect(posicao(depois, 'bia')).toEqual({ x: 475, y: 75 })
    // O jogador de Ana não recebe Bia: parar antes dela contaria que há alguém embaixo.
    const recorte = filterMapForGroup(antes, [{ tokenIds: ['ana'], visionRadius: 700 }])
    expect(recorte.map.tokens.map((t) => t.id)).toEqual(['ana'])
    // No mesmo piso, Bia (presa na borda do mezanino, x = 500) segura: Ana para na casa antes dela.
    const bordaDoMezanino = { ...parede('borda-mezanino', 500, 0, 500, 400), piso: 1 }
    const mesmoPiso = comMezanino([ficha('ana', 325, 75, { piso: 1 }), ficha('bia', 475, 75, { piso: 1 })], {
      movement: { tokensOccupy: true },
      walls: [...torre().walls, bordaDoMezanino],
    })
    expect(posicao(advanceConveyors(mesmoPiso), 'ana')).toEqual({ x: 425, y: 75 })
  })
})

describe('cabine contínua e pisos na mesma cena', () => {
  it('a ficha do térreo sob o pino do mezanino não pega a cabine; a do mezanino pega', () => {
    const pinos = [pino('p1', 75, 75, { cabineContinua: 'p2', piso: 1 }), pino('p2', 375, 325, { piso: 1 })]
    const terreo: MapData = { ...torre({ tokens: [ficha('bia', 75, 75)] }), pins: pinos }
    expect(advanceConveyors(terreo)).toBe(terreo)
    const mezanino: MapData = { ...torre({ tokens: [ficha('ana', 75, 75, { piso: 1 })] }), pins: pinos }
    expect(posicao(advanceConveyors(mezanino), 'ana')).toEqual({ x: 375, y: 325 })
  })
})

describe('a alavanca não é parada de cabine', () => {
  it('não aparece como próxima parada, e a ligação feita à mão para ela não leva ninguém', () => {
    const pinos = [pino('p1', 75, 75, { cabineContinua: 'alavanca' }), pino('alavanca', 375, 325, { kind: 'alavanca' }), pino('p3', 225, 225)]
    const map: MapData = { ...torre({ tokens: [ficha('ana', 75, 75)] }), pins: pinos }
    expect(cabinTargets(map, 'p1').map((t) => t.id)).toEqual(['p3'])
    expect(cabinOf(map, 'p1')).toBeNull()
    expect(advanceConveyors(map)).toBe(map)
    // A própria alavanca também não leva quem está nela.
    const daAlavanca: MapData = { ...map, pins: [pino('alavanca', 75, 75, { kind: 'alavanca', cabineContinua: 'p3' }), pino('p3', 225, 225)] }
    expect(advanceConveyors(daAlavanca)).toBe(daAlavanca)
  })
})

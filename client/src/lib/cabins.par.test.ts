/**
 * CABINE CONTÍNUA ATÉ O PAR — o paternoster que muda de andar. No app, o
 * "par" é o pino de viagem da OUTRA cena para onde este leva. O mestre liga a
 * cabine do pino de viagem ao par; a cada Avançar, quem ficou parado no pino
 * é levado de cena. A regra pura só diz QUEM vai e PARA ONDE (cena e pino):
 * quem troca a ficha de cena é a aventura (`stores/avancarMovimentoImposto.ts`).
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { ficha, torre } from './__fixtures__/hazardTower'
import { cabinOf, cabinTargetsOfPar, readCabin, setPinCabin } from './cabins'
import { advanceConveyors, canAdvanceImposed, imposedMovement, roomConveyorState } from './conveyors'
import { deserializeMap, serializeMap } from './mapFile'
import type { PinTravel } from './pinTravel'

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: '', image: null, ...extra }
}

/** Poço no térreo: leva ao par `poco-porao` (principal) e, pela segunda saída, a `poco-sotao`. */
function poco(extra: Partial<Pin> = {}): Pin {
  return pino('poco', 75, 75, {
    kind: 'viagem',
    destino: { sceneId: 'porao', pinId: 'poco-porao' },
    saidas: [{ id: 'saida-2', rotulo: 'Sótão', destino: { sceneId: 'sotao', pinId: 'poco-sotao' } }],
    ...extra,
  })
}

function terreo(pins: Pin[], tokens = [ficha('ana', 75, 75)], extra: Partial<MapData> = {}): MapData {
  return { ...torre({ tokens }), pins, ...extra }
}

describe('cabine do pino de viagem — liga ao par', () => {
  it('o mestre liga a cabine ao par de qualquer saída, troca e desliga', () => {
    const base = terreo([poco()])
    const ligada = setPinCabin(base, 'poco', 'poco-porao')
    expect(cabinOf(ligada, 'poco')).toBe('poco-porao')
    const trocada = setPinCabin(ligada, 'poco', 'poco-sotao')
    expect(cabinOf(trocada, 'poco')).toBe('poco-sotao')
    const desligada = setPinCabin(trocada, 'poco', null)
    expect(cabinOf(desligada, 'poco')).toBeNull()
    expect('cabineContinua' in (desligada.pins[0] ?? {})).toBe(false)
  })

  it('só o par vale: pino da mesma cena, pino sem ligação e a chegada oculta devolvem o MESMO mapa', () => {
    const base = terreo([poco(), pino('cartaz', 225, 225)])
    expect(setPinCabin(base, 'poco', 'cartaz')).toBe(base)
    expect(setPinCabin(base, 'poco', 'outro-par')).toBe(base)
    // "!"/"?" não liga a pino de viagem (o poço tem o seu próprio destino).
    expect(setPinCabin(base, 'cartaz', 'poco')).toBe(base)
    const oculta = terreo([poco({ soChegada: true })])
    expect(setPinCabin(oculta, 'poco', 'poco-porao')).toBe(oculta)
  })

  it('as opções do painel: um par por saída ligada, pelo nome da cena do mestre', () => {
    const partner = pino('poco-porao', 0, 0, { kind: 'viagem' })
    const exits: { rotulo: string; travel: PinTravel }[] = [
      { rotulo: '', travel: { status: 'ligado', sceneId: 'porao', sceneName: 'Porão', partner } },
      { rotulo: 'Sótão', travel: { status: 'indisponivel', sceneId: 'sotao', sceneName: 'Sótão' } },
      { rotulo: 'Cripta', travel: { status: 'ligado', sceneId: 'cripta', sceneName: 'Cripta', partner: { ...partner, id: 'cripta-par' } } },
    ]
    expect(cabinTargetsOfPar(exits)).toEqual([
      { id: 'poco-porao', label: 'Par em Porão' },
      { id: 'cripta-par', label: 'Par em Cripta (Cripta)' },
    ])
    expect(cabinTargetsOfPar([])).toEqual([])
  })

  it('volta igual do arquivo', () => {
    const map = setPinCabin(terreo([poco()]), 'poco', 'poco-sotao')
    expect(deserializeMap(serializeMap(map)).pins[0]?.cabineContinua).toBe('poco-sotao')
    expect(readCabin('poco-sotao')).toBe('poco-sotao')
  })
})

describe('imposedMovement — quem ficou parado no pino de viagem vai ao par', () => {
  it('a ficha parada no poço sai para o par, e o mapa desta cena fica igual (quem troca de cena é a aventura)', () => {
    const map = terreo([poco({ cabineContinua: 'poco-porao' })])
    const r = imposedMovement(map)
    expect(r.transfers).toEqual([{ tokenId: 'ana', sceneId: 'porao', pinId: 'poco-porao' }])
    expect(r.map).toBe(map)
    expect(advanceConveyors(map)).toBe(map)
    // O botão e o painel sabem que o Avançar leva alguém, mesmo sem mudar esta cena.
    expect(canAdvanceImposed(map)).toBe(true)
    expect(roomConveyorState(map, 'sala-a').canAdvance).toBe(true)
  })

  it('pela segunda saída, ao par dela', () => {
    expect(imposedMovement(terreo([poco({ cabineContinua: 'poco-sotao' })])).transfers).toEqual([{ tokenId: 'ana', sceneId: 'sotao', pinId: 'poco-sotao' }])
  })

  it('ninguém vai: poço sem cabine, ficha fora da casa do pino, cabine para par que não é de nenhuma saída, chegada oculta', () => {
    const semCabine = terreo([poco()])
    expect(imposedMovement(semCabine).transfers).toEqual([])
    expect(canAdvanceImposed(semCabine)).toBe(false)
    expect(imposedMovement(terreo([poco({ cabineContinua: 'poco-porao' })], [ficha('ana', 125, 75)])).transfers).toEqual([])
    expect(imposedMovement(terreo([poco({ cabineContinua: 'sumiu' })])).transfers).toEqual([])
    const oculta = terreo([poco({ cabineContinua: 'poco-porao', soChegada: true })])
    expect(imposedMovement(oculta).transfers).toEqual([])
    expect(canAdvanceImposed(oculta)).toBe(false)
  })

  it('quem a esteira moveu neste Avançar estava andando: não pega a cabine; quem ficou parado pega', () => {
    const esteiraSul = { conveyors: [{ id: 'e1', roomId: 'sala-a', direction: 'sul' as const, stepCells: 3 }] }
    const andando = imposedMovement(terreo([poco({ cabineContinua: 'poco-porao' })], [ficha('ana', 75, 75), ficha('bia', 375, 75)], esteiraSul))
    expect(andando.transfers).toEqual([])
    expect(andando.map.tokens.find((t) => t.id === 'ana')).toMatchObject({ x: 75, y: 225 })
    // Esteira para o norte com Ana colada na borda: ela não anda, então a cabine a leva.
    const esteiraNorte = { conveyors: [{ id: 'e1', roomId: 'sala-a', direction: 'norte' as const, stepCells: 3 }] }
    const parada = imposedMovement(terreo([poco({ x: 75, y: 25, cabineContinua: 'poco-porao' })], [ficha('ana', 75, 25), ficha('bia', 375, 325)], esteiraNorte))
    expect(parada.transfers).toEqual([{ tokenId: 'ana', sceneId: 'porao', pinId: 'poco-porao' }])
    // Bia, na mesma esteira, andou nesta cena no mesmo Avançar.
    expect(parada.map.tokens.find((t) => t.id === 'bia')).toMatchObject({ x: 375, y: 175 })
  })
})

/**
 * VEÍCULO pela tela do jogador — as regras puras novas: o MOTORISTA é o
 * primeiro a bordo, o próximo assume quando ele desce, o passo dele vira o
 * passo do veículo (`driveTarget`), e quem desce em cima do veículo vai para
 * a casa livre ao lado (`disembarkSpot`). O caminho pela rede é cobrado em
 * `stores/veiculoJogador.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { disembarkSpot } from './gatherParty'
import { boardVehicle, driveTarget, driverOf, leaveVehicle, moveTokenWithVehicle, passengerIdsOf } from './vehicle'

const GRADE = 64

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

/** O cesto (3 lugares) no meio de a06, o Gui à esquerda, a Bia à direita e o Caio embaixo — todos encostados. */
function cena(): MapData {
  return {
    ...createEmptyMap('a06', 'Poço', 20, 20, GRADE),
    tokens: [ficha('cesto', 352, 352, { veiculo: { lugares: 3 } }), ficha('gui', 288, 352), ficha('bia', 416, 352), ficha('caio', 352, 416)],
  }
}

function embarcar(map: MapData, ...ids: string[]): MapData {
  return ids.reduce((acc, id) => {
    const result = boardVehicle(acc, 'cesto', id)
    if (!result.ok) throw new Error(`${id} não embarcou: ${result.motivo}`)
    return result.map
  }, map)
}

const em = (map: MapData, id: string) => {
  const t = map.tokens.find((token) => token.id === id)
  return t === undefined ? null : [t.x, t.y]
}

describe('veículo: motorista', () => {
  it('o primeiro a bordo é o motorista; veículo vazio ou ficha comum não têm', () => {
    const map = cena()
    expect(driverOf(map, 'cesto')).toBeNull()
    expect(driverOf(map, 'gui')).toBeNull()
    const cheio = embarcar(map, 'bia', 'gui')
    expect(driverOf(cheio, 'cesto')).toBe('bia')
  })

  it('quando o motorista desce, o próximo da lista assume; o último a descer deixa o veículo sem motorista', () => {
    let map = embarcar(cena(), 'gui', 'bia', 'caio')
    map = leaveVehicle(map, 'gui')
    expect(driverOf(map, 'cesto')).toBe('bia')
    expect(passengerIdsOf(map, 'cesto')).toEqual(['bia', 'caio'])
    map = leaveVehicle(leaveVehicle(map, 'bia'), 'caio')
    expect(driverOf(map, 'cesto')).toBeNull()
  })

  it('o passo do motorista vira o passo do veículo, e o veículo leva todos mantendo o afastamento', () => {
    const map = embarcar(cena(), 'gui', 'bia')
    const alvo = driveTarget(map, 'gui', 288 + 2 * GRADE, 352 - GRADE)
    expect(alvo).toEqual({ vehicleId: 'cesto', x: 352 + 2 * GRADE, y: 352 - GRADE })
    if (alvo === null) return
    const andou = moveTokenWithVehicle(map, alvo.vehicleId, alvo.x, alvo.y)
    expect(em(andou, 'cesto')).toEqual([480, 288])
    expect(em(andou, 'gui')).toEqual([416, 288])
    expect(em(andou, 'bia')).toEqual([544, 288])
    // Quem ficou a pé, fica.
    expect(em(andou, 'caio')).toEqual([352, 416])
    // Ninguém desceu: o motorista continua o mesmo.
    expect(passengerIdsOf(andou, 'cesto')).toEqual(['gui', 'bia'])
  })

  it('passageiro que não é motorista, ficha a pé e veículo não dirigem', () => {
    const map = embarcar(cena(), 'gui', 'bia')
    expect(driveTarget(map, 'bia', 500, 352)).toBeNull()
    expect(driveTarget(map, 'caio', 352, 480)).toBeNull()
    expect(driveTarget(map, 'cesto', 400, 352)).toBeNull()
    expect(driveTarget(map, 'sumiu', 400, 352)).toBeNull()
  })
})

describe('veículo: onde fica quem desce', () => {
  it('ao lado do veículo, fica onde está', () => {
    const map = cena()
    const cesto = map.tokens[0]
    const gui = map.tokens[1]
    expect(disembarkSpot(map, cesto, gui)).toEqual({ x: 288, y: 352 })
  })

  it('em cima do veículo, vai para a casa livre mais perto — nem no veículo, nem em cima de outra ficha', () => {
    const map = { ...cena(), tokens: [...cena().tokens, ficha('dan', 352, 352)] }
    const cesto = map.tokens[0]
    const dan = map.tokens[4]
    const spot = disembarkSpot(map, cesto, dan)
    expect(spot).not.toEqual({ x: 352, y: 352 })
    // Uma casa do veículo, fora das casas do Gui, da Bia e do Caio.
    expect(Math.max(Math.abs(spot.x - 352), Math.abs(spot.y - 352))).toBe(GRADE)
    for (const [x, y] of [[288, 352], [416, 352], [352, 416]]) expect(spot).not.toEqual({ x, y })
  })

  it('a ficha que o jogador não vê (em `ignore`) não ocupa casa: desviar dela diria que existe', () => {
    const base = cena()
    // Só a casa de cima do cesto sobra fora as dos três; o guarda escondido está nela.
    const map = { ...base, tokens: [...base.tokens, ficha('dan', 352, 352), ficha('guarda', 352, 288)] }
    const cesto = map.tokens[0]
    const dan = map.tokens[4]
    const semIgnorar = disembarkSpot(map, cesto, dan)
    const ignorando = disembarkSpot(map, cesto, dan, new Set(['guarda']))
    expect(semIgnorar).not.toEqual({ x: 352, y: 288 })
    expect(ignorando).toEqual({ x: 352, y: 288 })
  })
})

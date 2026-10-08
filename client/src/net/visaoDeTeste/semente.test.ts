import { describe, expect, it, vi } from 'vitest'
import {
  SAVED_EXPLORATION_VERSION,
  SAVED_TABLE_VERSION,
  type SavedExploration,
  type SavedSceneMemory,
  type SavedSeat,
  type SavedSeatExploration,
  type SavedTable,
} from '../../lib/savedTable'
import { sementeDosAssentos } from './semente'
import { lerSementeDoDono, type LeituraDaSala } from './visaoDeTeste'

/**
 * VISÃO DE JOGADOR — a semente da memória do dono, a parte pura: da mesa e do
 * explorado (gravados ou como a sala viva os gravaria), quem tem a ficha e o
 * que ele lembra.
 */

function cena(mapId: string): SavedSceneMemory {
  return {
    mapId,
    width: 10,
    height: 10,
    grid: 50,
    explored: { cell: 25, cols: 20, rows: 20, bits: 'AAAA', rings: '' },
    doors: [{ wallId: 'porta-1', open: true, locked: false, kind: 'normal' }],
  }
}

const ASSENTOS: SavedSeat[] = [
  { name: 'Bia', tokenIds: ['lirio', 'faisca'], visionRadius: 250, sceneKey: 'm-salao' },
  { name: 'Caio', tokenIds: ['machado'], visionRadius: null, sceneKey: null },
]

const EXPLORADO: SavedSeatExploration[] = [
  { name: 'Caio', scenes: [cena('m-cripta')] },
  // O explorado acha o assento pelo nome NORMALIZADO, como o "Retomar a mesa".
  { name: '  BIA ', scenes: [cena('m-vila'), cena('m-salao')] },
]

describe('sementeDosAssentos', () => {
  it('a ficha leva ao assento do dono, com o raio dele, o fator dado e a memória pelo nome normalizado', () => {
    const semente = sementeDosAssentos(ASSENTOS, EXPLORADO, 'faisca', 1.5)
    expect(semente).toEqual({ nome: 'Bia', visionRadius: 250, visionFactor: 1.5, cenas: [cena('m-vila'), cena('m-salao')] })
  })

  it('ficha sem dono: null (o teste começa do zero)', () => {
    expect(sementeDosAssentos(ASSENTOS, EXPLORADO, 'npc-severa', null)).toBeNull()
    expect(sementeDosAssentos([], EXPLORADO, 'lirio', null)).toBeNull()
  })

  it('dono sem explorado gravado: a ficha e o raio vêm, a memória vem vazia', () => {
    expect(sementeDosAssentos(ASSENTOS, [], 'lirio', null)).toEqual({ nome: 'Bia', visionRadius: 250, visionFactor: null, cenas: [] })
  })

  it('é cópia: mexer na semente não muda o que a mesa de verdade guarda', () => {
    const explorado: SavedSeatExploration[] = [{ name: 'Caio', scenes: [cena('m-cripta')] }]
    const antes = JSON.stringify(explorado)
    const semente = sementeDosAssentos(ASSENTOS, explorado, 'machado', null)
    const primeira = semente?.cenas[0]
    if (primeira === undefined) throw new Error('a semente deveria trazer a cena da Cripta')
    primeira.explored.bits = 'mexido'
    primeira.doors[0] = { wallId: 'outra', open: false, locked: true, kind: 'gate' }
    semente?.cenas.push(cena('m-intrusa'))
    expect(JSON.stringify(explorado)).toBe(antes)
  })
})

describe('lerSementeDoDono: sala aberta lê a ponte da sala, fechada lê o disco', () => {
  const SALA = { code: 'SALA22', urls: [], qrSvg: '' }
  const DA_SALA = { nome: 'Bia', visionRadius: null, visionFactor: 1.5, cenas: [] }

  function sala(aberta: boolean, semente: typeof DA_SALA | null): LeituraDaSala {
    return { room: () => (aberta ? SALA : null), seatSeedFor: vi.fn(() => semente) }
  }

  it('sem fonte nenhuma: do zero', () => {
    expect(lerSementeDoDono({}, 'lirio')).toBeNull()
  })

  it('sala aberta: a sessão viva manda — sem dono lá, não há dono, e o disco nem é lido', () => {
    const mesaGuardada = vi.fn((): SavedTable => ({ version: SAVED_TABLE_VERSION, code: 'X', seats: ASSENTOS }))
    expect(lerSementeDoDono({ ponteDaSala: () => sala(true, DA_SALA), mesaGuardada }, 'lirio')).toEqual(DA_SALA)
    expect(lerSementeDoDono({ ponteDaSala: () => sala(true, null), mesaGuardada }, 'lirio')).toBeNull()
    expect(mesaGuardada).not.toHaveBeenCalled()
  })

  it('sala fechada (ou ponte ainda não criada): a mesa e o explorado do disco, sem fator', () => {
    const mesaGuardada = (): SavedTable => ({ version: SAVED_TABLE_VERSION, code: 'X', seats: ASSENTOS })
    const exploradoGuardado = (): SavedExploration => ({ version: SAVED_EXPLORATION_VERSION, seats: EXPLORADO })
    expect(lerSementeDoDono({ ponteDaSala: () => sala(false, DA_SALA), mesaGuardada, exploradoGuardado }, 'machado')).toEqual({
      nome: 'Caio',
      visionRadius: null,
      visionFactor: null,
      cenas: [cena('m-cripta')],
    })
    expect(lerSementeDoDono({ ponteDaSala: () => null, mesaGuardada, exploradoGuardado: () => null }, 'lirio')).toMatchObject({ nome: 'Bia', cenas: [] })
    expect(lerSementeDoDono({ ponteDaSala: () => null, mesaGuardada: () => null, exploradoGuardado }, 'lirio')).toBeNull()
  })
})

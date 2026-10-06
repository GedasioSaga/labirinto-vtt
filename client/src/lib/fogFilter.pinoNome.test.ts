import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * NOME SÓ DO MESTRE no recorte do jogador: o Diego, ao lado do "?", recebe o
 * pino e a descrição que o mestre escreveu para ele, mas nunca o nome "Faca"
 * — nem no pino, nem em lugar nenhum do recorte.
 */

const RAIO = 300
const POSSE = { diego: ['ficha-diego'] }
const DESCRICAO = 'Uma lâmina suja de sangue, embaixo do tapete.'

function mapaCom(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'ficha-diego', characterId: null, name: 'Diego', x: 200, y: 200, size: 1, image: null }],
    pins,
  }
}

const FACA: Pin = { id: 'pino-7', x: 240, y: 200, kind: 'interrogacao', description: DESCRICAO, image: null, nome: 'Faca' }

describe('fogFilter: nome do pino é só do mestre', () => {
  it('o pino chega com a descrição e sem o nome; "Faca" não está em nada do recorte', () => {
    const view = filterMapForPlayer(mapaCom([FACA]), 'diego', POSSE, RAIO)
    expect(view.map.pins).toHaveLength(1)
    expect(view.map.pins[0].description).toBe(DESCRICAO)
    expect('nome' in view.map.pins[0]).toBe(false)
    expect(JSON.stringify(view)).not.toContain('Faca')
  })

  it('controle: o mapa do mestre continua com o nome (o recorte é cópia)', () => {
    const mapa = mapaCom([FACA])
    filterMapForPlayer(mapa, 'diego', POSSE, RAIO)
    expect(mapa.pins[0].nome).toBe('Faca')
  })
})

describe('fogFilter: transição especial do pino de viagem', () => {
  it('o pino de viagem leva a transição; outro tipo de pino não', () => {
    const viagem: Pin = { id: 'porta', x: 240, y: 200, kind: 'viagem', description: '', image: null, transicao: { id: 'porta', duracaoS: 5 } }
    const nota = { ...FACA, transicao: { id: 'porta' } } as Pin
    const view = filterMapForPlayer(mapaCom([viagem, nota]), 'diego', POSSE, RAIO)
    expect(view.map.pins.find((p) => p.id === 'porta')?.transicao).toEqual({ id: 'porta', duracaoS: 5 })
    expect(view.map.pins.find((p) => p.id === 'pino-7')?.transicao).toBeUndefined()
  })
})

describe('fogFilter: transição especial da escada', () => {
  it('a escada que leva a outro piso chega ao jogador com a transição', () => {
    const escada = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 220, y1: 180, x2: 220, y2: 240 }], stepWidth: 40, levaAoPiso: 1, transicao: { id: 'escada-pedra' } } as MapData['stairs'][number]
    const view = filterMapForPlayer({ ...mapaCom([]), stairs: [escada] }, 'diego', POSSE, RAIO)
    expect(view.map.stairs.find((s) => s.id === 'escada')?.transicao).toEqual({ id: 'escada-pedra' })
  })
})

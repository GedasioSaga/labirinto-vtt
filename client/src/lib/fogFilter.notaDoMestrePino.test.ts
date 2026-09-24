/**
 * NOTA DO MESTRE NO PINO, lado do RECORTE: o jogador recebe o pino com a
 * descrição ("o jogador lê") e nunca a nota ("só eu leio") — nem o campo, nem
 * o texto dela em lugar nenhum do pacote, nem na pista que o cartão vira.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import { filterMapForPlayer, pinClueForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const RAIO = 700
const DESCRICAO = 'Um cofre de parede com três rodas numeradas.'
const NOTA = 'SEGREDO-DO-MESTRE: a combinação é 6-12-18.'

const ficha: Token = { id: 'arco', characterId: null, name: 'Arco', x: 100, y: 100, size: 1, image: null }

function pino(extra: Partial<Pin> = {}): Pin {
  return { id: 'cofre', x: 200, y: 100, kind: 'exclamacao', description: DESCRICAO, image: null, notaDoMestre: NOTA, ...extra }
}

function mapaCom(pins: Pin[]): MapData {
  return { ...createEmptyMap('m', 'Porão', 30, 10, 50), tokens: [ficha], pins }
}

describe('recorte: nota do mestre no pino', () => {
  it('o pino chega com a descrição e sem a nota, em campo nenhum', () => {
    const { map } = filterMapForPlayer(mapaCom([pino()]), 'duda', { duda: ['arco'] }, RAIO)
    expect(map.pins).toHaveLength(1)
    expect(map.pins[0].description).toBe(DESCRICAO)
    expect('notaDoMestre' in map.pins[0]).toBe(false)
    const json = JSON.stringify(map)
    expect(json).not.toContain('SEGREDO-DO-MESTRE')
    expect(json).not.toContain('notaDoMestre')
  })

  it('pino só com nota (descrição vazia) chega com a descrição vazia, nunca com a nota no lugar', () => {
    const { map } = filterMapForPlayer(mapaCom([pino({ description: '' })]), 'duda', { duda: ['arco'] }, RAIO)
    expect(map.pins.map((p) => p.description)).toEqual([''])
    expect(JSON.stringify(map)).not.toContain('SEGREDO-DO-MESTRE')
  })

  it('a pista do cartão leva a descrição e não a nota; pino só com nota não vira pista', () => {
    const pista = pinClueForPlayer(pino())
    expect(pista?.text).toBe(DESCRICAO)
    expect(JSON.stringify(pista)).not.toContain('SEGREDO-DO-MESTRE')
    expect(pinClueForPlayer(pino({ description: '' }))).toBeNull()
  })
})

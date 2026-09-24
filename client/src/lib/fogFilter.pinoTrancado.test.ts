import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * PINO TRANCADO VIRA PEDIDO, no recorte do jogador: o cartão precisa saber se
 * o pino trancado aceita "Pedir ao mestre" (a marca `mudo` diz que não). A
 * marca só sai no pino de viagem TRANCADO — em qualquer outro modo ela não diz
 * nada ao cartão e fica de fora. O destino, com a cena e o pino par, nunca sai.
 */

const RAIO = 300
const POSSE = { p1: ['diego'] }
const CENA_SECRETA = 'cena_patio_dos_fundos'

function mapaCom(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'diego', characterId: null, name: 'Diego', x: 200, y: 200, size: 1, image: null }],
    pins,
  }
}

function porta(extra: Partial<Pin>): Pin {
  return { id: 'porta-lab', x: 240, y: 200, kind: 'viagem', description: 'Porta de aço', image: null, destino: { sceneId: CENA_SECRETA, pinId: 'porta-patio' }, ...extra }
}

function pinoDoRecorte(pin: Pin): Pin {
  const view = filterMapForPlayer(mapaCom([pin]), 'p1', POSSE, RAIO)
  const [saiu] = view.map.pins
  if (saiu === undefined) throw new Error('o pino, visível, deveria sair no recorte')
  return saiu
}

describe('fogFilter: pino de viagem trancado', () => {
  it('trancado que aceita tentativas: sai trancado, sem a marca e sem destino', () => {
    const saiu = pinoDoRecorte(porta({ passagem: 'trancada' }))
    expect(saiu.passagem).toBe('trancada')
    expect(saiu.mudo).toBeUndefined()
    expect(saiu.destino).toBeUndefined()
  })

  it('trancado mudo: a marca sai (o cartão não oferece pedir), o destino continua de fora', () => {
    const view = filterMapForPlayer(mapaCom([porta({ passagem: 'trancada', mudo: true })]), 'p1', POSSE, RAIO)
    expect(view.map.pins[0]?.passagem).toBe('trancada')
    expect(view.map.pins[0]?.mudo).toBe(true)
    expect(JSON.stringify(view)).not.toContain(CENA_SECRETA)
    expect(JSON.stringify(view)).not.toContain('porta-patio')
  })

  it('a marca num pino que não é trancado (sobra de quando era) não sai', () => {
    expect(pinoDoRecorte(porta({ passagem: 'pede', mudo: true })).mudo).toBeUndefined()
    expect(pinoDoRecorte(porta({ passagem: 'livre', mudo: true })).mudo).toBeUndefined()
  })

  it('pino trancado no escuro não sai, nem a marca dele', () => {
    const longe = porta({ passagem: 'trancada', mudo: true, x: 900, y: 900 })
    const view = filterMapForPlayer(mapaCom([longe]), 'p1', POSSE, RAIO)
    expect(view.map.pins).toEqual([])
    expect(JSON.stringify(view)).not.toContain('porta-lab')
  })
})

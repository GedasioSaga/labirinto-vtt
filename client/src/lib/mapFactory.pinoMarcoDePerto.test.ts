import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { createEmptyMap, updatePin } from './mapFactory'

/**
 * `updatePin` com "Marco" e "Ler só de perto": ligar é mudança (entra no
 * desfazer); escrever o mesmo valor de novo, ou desligar o que nunca foi
 * ligado, devolve o MESMO mapa — sem entrada vazia no histórico.
 */

const CARTA: Pin = { id: 'carta', x: 10, y: 10, kind: 'interrogacao', description: 'Carta', image: null }
const mapa = (pin: Pin): MapData => ({ ...createEmptyMap('m', 'M', 5, 5, 50), pins: [pin] })

describe('mapFactory.updatePin: marco e lerDePerto', () => {
  it('ligar o marco e mudar as casas muda o pino', () => {
    const comMarco = updatePin(mapa(CARTA), 'carta', { marco: true })
    expect(comMarco.pins[0].marco).toBe(true)
    const duasCasas = updatePin(mapa({ ...CARTA, lerDePerto: 1 }), 'carta', { lerDePerto: 2 })
    expect(duasCasas.pins[0].lerDePerto).toBe(2)
  })

  it('o mesmo valor, ou desligar o que nunca foi ligado, devolve o mesmo mapa', () => {
    const antes = mapa({ ...CARTA, marco: true, lerDePerto: 3 })
    expect(updatePin(antes, 'carta', { marco: true, lerDePerto: 3 })).toBe(antes)
    const comum = mapa(CARTA)
    expect(updatePin(comum, 'carta', { marco: undefined, lerDePerto: undefined })).toBe(comum)
  })
})

import { describe, expect, it } from 'vitest'
import { createEmptyMap, setStairShape } from './mapFactory'
import { tokenReachesPin } from './doorReach'
import { tokenReachesPin as tokenReachesPinDoHost } from './items'
import { alcancePeloObjeto } from './obstaculosDeObjeto'
import type { MapData, Pin, Stair, Token } from '../types/map'

/**
 * ESCADA INTEIRA É O ALCANCE (pedido do mestre, 15/11/2026: "não importa o
 * lugar da escada se eu clicar é para dar para subir"). O pino da escada mora
 * na boca dela; a ficha em cima da outra ponta de um lance comprido ouvia
 * "Chegue mais perto para passar". A tela (`doorReach`) e o host (`items`)
 * têm de dar a mesma resposta.
 */

const GRID = 50
const BOCA = { x: 300, y: 450 }

function token(x: number, y: number): Token {
  return { id: 'saga', characterId: null, name: 'Saga', x, y, size: 1, image: null }
}

function mapaComEscadaComprida(): { map: MapData; pin: Pin } {
  const escada: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: BOCA.x, y1: BOCA.y, x2: BOCA.x, y2: 50 }], stepWidth: GRID }
  const pin: Pin = { id: 'pino-da-escada', x: BOCA.x, y: BOCA.y, kind: 'viagem', description: '', image: null, passagem: 'livre', escadaId: 'escada' }
  return { map: { ...createEmptyMap('m', 'Torre', 40, 10, GRID), stairs: [escada], pins: [pin] }, pin }
}

describe('alcance do pino da escada: a escada inteira conta', () => {
  it('a ficha em cima da ponta de cima de um lance comprido alcança o pino da boca, na tela e no host', () => {
    const { map, pin } = mapaComEscadaComprida()
    const naPonta = token(BOCA.x, 80)
    expect(tokenReachesPin(naPonta, pin, GRID, alcancePeloObjeto(map))).toBe(true)
    expect(tokenReachesPinDoHost(naPonta, pin, GRID, alcancePeloObjeto(map))).toBe(true)
    // Encostada do lado do lance, no meio dele, também.
    expect(tokenReachesPin(token(BOCA.x + 60, 250), pin, GRID, alcancePeloObjeto(map))).toBe(true)
  })

  it('longe da escada continua longe; e pino que não é de escada não ganha o alcance dela', () => {
    const { map, pin } = mapaComEscadaComprida()
    const longe = token(BOCA.x + 200, 80)
    expect(tokenReachesPin(longe, pin, GRID, alcancePeloObjeto(map))).toBe(false)
    expect(tokenReachesPinDoHost(longe, pin, GRID, alcancePeloObjeto(map))).toBe(false)
    const { escadaId: _semEscada, ...pinoComum } = pin
    expect(tokenReachesPin(token(BOCA.x, 80), pinoComum, GRID, alcancePeloObjeto(map))).toBe(false)
  })

  /**
   * Escadaria de dois lances (lote de 15/11/2026): a mesma escada comprida
   * dobrada pela ficha. A boca fica em (300, 450); na L o patamar da volta é o
   * meio em (300, 250) e o segundo lance vai até (500, 250); na U o patamar
   * atravessa até (350, 250) e o segundo lance desce de volta até (350, 450).
   */
  it.each([
    { forma: 'l' as const, noOutroLance: { x: 480, y: 250 }, noPatamar: { x: 318, y: 232 }, longe: { x: 500, y: 450 } },
    { forma: 'double' as const, noOutroLance: { x: 350, y: 290 }, noPatamar: { x: 362, y: 236 }, longe: { x: 600, y: 250 } },
  ])('escada $forma: o outro lance e o patamar da volta alcançam o pino da boca; longe não', ({ forma, noOutroLance, noPatamar, longe }) => {
    const { map: reta, pin } = mapaComEscadaComprida()
    const map = setStairShape(reta, 'escada', forma)
    const alcance = alcancePeloObjeto(map)
    for (const ponto of [noOutroLance, noPatamar]) {
      // Sem a escada inteira contar, o ponto ficaria longe do pino (mais de três casas da boca).
      expect(Math.hypot(ponto.x - BOCA.x, ponto.y - BOCA.y)).toBeGreaterThan(3 * GRID)
      expect(tokenReachesPin(token(ponto.x, ponto.y), pin, GRID, alcance)).toBe(true)
      expect(tokenReachesPinDoHost(token(ponto.x, ponto.y), pin, GRID, alcance)).toBe(true)
    }
    expect(tokenReachesPin(token(longe.x, longe.y), pin, GRID, alcance)).toBe(false)
    expect(tokenReachesPinDoHost(token(longe.x, longe.y), pin, GRID, alcance)).toBe(false)
  })
})

// @vitest-environment node
/**
 * VEÍCULO no ATALHO NA MESMA CENA — o veículo salta para o outro pino com
 * todos a bordo. Antes cada passageiro mantinha o afastamento às cegas e quem
 * estava fora do contorno do veículo podia pousar numa parede do destino.
 * Agora cada um assenta como na travessia entre cenas (`vehicleRiderSpots`):
 * no afastamento, quando a casa serve; senão, na casa livre mais perto do
 * veículo. Continua a bordo, e a tocha presa vai com ele.
 */
import { describe, expect, it } from 'vitest'
import type { Light, MapData, Token, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { passengerIdsOf } from './vehicle'
import { hopVehicleSeated } from './vehicleHop'

const GRADE = 64
/** O destino do salto, no meio de uma casa e longe da borda. */
const DESTINO = { x: 1312, y: 800 }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** O cesto em (352, 352) com a Bia uma casa à direita, a bordo; o Caio longe, a pé. */
function mapa(walls: Wall[] = [], lights: Light[] = []): MapData {
  const base = createEmptyMap('m', 'm', 30, 20, GRADE)
  return {
    ...base,
    walls,
    lights,
    tokens: [ficha('cesto', 352, 352, { veiculo: { lugares: 2, passageiros: ['bia'] } }), ficha('bia', 416, 352), ficha('caio', 96, 96)],
  }
}

const pos = (map: MapData, id: string): [number, number] => {
  const t = map.tokens.find((tk) => tk.id === id)
  if (t === undefined) throw new Error(`sem ${id}`)
  return [t.x, t.y]
}

/** A distância de `p` à parede (segmento), em px. */
function distanciaAParede(p: { x: number; y: number }, w: Wall): number {
  const dx = w.x2 - w.x1
  const dy = w.y2 - w.y1
  const t = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - (w.x1 + t * dx), p.y - (w.y1 + t * dy))
}

describe('hopVehicleSeated', () => {
  it('casa livre no destino: a Bia salta no mesmo afastamento e continua a bordo', () => {
    const depois = hopVehicleSeated(mapa(), 'cesto', DESTINO.x, DESTINO.y)
    expect(pos(depois, 'cesto')).toEqual([DESTINO.x, DESTINO.y])
    expect(pos(depois, 'bia')).toEqual([DESTINO.x + GRADE, DESTINO.y])
    expect(passengerIdsOf(depois, 'cesto')).toEqual(['bia'])
    expect(pos(depois, 'caio')).toEqual([96, 96])
  })

  it('parede cortando a casa do afastamento: a Bia assenta numa casa livre colada ao cesto, fora da parede, ainda a bordo', () => {
    // Um pilar curto bem no meio de onde a Bia cairia.
    const pilar = parede('pilar', DESTINO.x + GRADE, DESTINO.y - 20, DESTINO.x + GRADE, DESTINO.y + 20)
    const depois = hopVehicleSeated(mapa([pilar]), 'cesto', DESTINO.x, DESTINO.y)
    const [bx, by] = pos(depois, 'bia')
    expect([bx, by]).not.toEqual([DESTINO.x + GRADE, DESTINO.y])
    expect(distanciaAParede({ x: bx, y: by }, pilar)).toBeGreaterThanOrEqual(GRADE / 2 - 1)
    // Colada ao cesto (uma casa de distância, diagonal conta), não em cima dele.
    expect(Math.max(Math.abs(bx - DESTINO.x), Math.abs(by - DESTINO.y))).toBe(GRADE)
    expect(passengerIdsOf(depois, 'cesto')).toEqual(['bia'])
  })

  it('a tocha presa na Bia vai com ela para a casa nova', () => {
    const pilar = parede('pilar', DESTINO.x + GRADE, DESTINO.y - 20, DESTINO.x + GRADE, DESTINO.y + 20)
    const tocha: Light = { id: 'tocha', x: 416 + 10, y: 352, radius: 200, color: '#ffaa00', intensity: 1, attachedTokenId: 'bia' }
    const depois = hopVehicleSeated(mapa([pilar], [tocha]), 'cesto', DESTINO.x, DESTINO.y)
    const [bx, by] = pos(depois, 'bia')
    const luz = depois.lights.find((l) => l.id === 'tocha')
    expect([luz?.x, luz?.y]).toEqual([bx + 10, by])
  })

  it('a casa do afastamento tem ficha em cima: a Bia não empilha, vai para a casa livre ao lado', () => {
    const base = mapa()
    const ocupado = { ...base, tokens: [...base.tokens, ficha('dora', DESTINO.x + GRADE, DESTINO.y)] }
    const depois = hopVehicleSeated(ocupado, 'cesto', DESTINO.x, DESTINO.y)
    expect(pos(depois, 'bia')).not.toEqual([DESTINO.x + GRADE, DESTINO.y])
    expect(pos(depois, 'dora')).toEqual([DESTINO.x + GRADE, DESTINO.y])
  })

  it('veículo vazio: só ele salta', () => {
    const base = mapa()
    const vazio = { ...base, tokens: base.tokens.map((t) => (t.id === 'cesto' ? { ...t, veiculo: { lugares: 2 } } : t)) }
    const depois = hopVehicleSeated(vazio, 'cesto', DESTINO.x, DESTINO.y)
    expect(pos(depois, 'cesto')).toEqual([DESTINO.x, DESTINO.y])
    expect(pos(depois, 'bia')).toEqual([416, 352])
  })

  it('veículo que não existe: o mesmo mapa', () => {
    const base = mapa()
    expect(hopVehicleSeated(base, 'nada', DESTINO.x, DESTINO.y)).toBe(base)
  })
})

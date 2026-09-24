import { describe, expect, it } from 'vitest'
import type { CarriedItem, MapData, Pin, Stair } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * CHAVE ABRE PORTA encontra a ESCADA QUE LEVA A OUTRO ANDAR no recorte do
 * jogador: o pino invisível da escada trancada com "Abre com" sai com `chave`
 * (o nome do item que ELE carrega) só para quem encosta com o item — e nunca
 * com `abreCom`, o destino, o pino par ou o nome do andar.
 */

const RAIO = 300
const POSSE = { p1: ['bruno'] }
const ID_DO_PAR = 'pino_da_escada_do_andar1'
const ID_DA_CENA = 'cena_primeiro_andar'
const ABRE_COM = 'Chave da Torre'

const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 240, y1: 200, x2: 240, y2: 120 }], stepWidth: 40 }

const PINO: Pin = {
  id: 'pino_da_escada_do_terreo',
  x: 240,
  y: 200,
  kind: 'viagem',
  description: '',
  image: null,
  passagem: 'trancada',
  abreCom: ABRE_COM,
  destino: { sceneId: ID_DA_CENA, pinId: ID_DO_PAR },
  escadaId: 'escada',
}

/** Bruno ao pé da escada (a uma célula da boca), com a mochila dada. */
function mapa(mochila: CarriedItem[], x = 200): MapData {
  return {
    ...createEmptyMap('m', 'Térreo', 1000, 1000, 40),
    tokens: [{ id: 'bruno', characterId: null, name: 'Bruno', x, y: 200, size: 1, image: null, mochila }],
    stairs: [ESCADA],
    pins: [PINO],
  }
}

function semSegredo(view: ReturnType<typeof filterMapForPlayer>): void {
  const pinos = JSON.stringify(view.map.pins)
  expect(pinos).not.toContain('abreCom')
  expect(pinos).not.toContain(ID_DO_PAR)
  expect(pinos).not.toContain(ID_DA_CENA)
}

describe('fogFilter: escada trancada com "Abre com"', () => {
  it('Bruno com a chave, encostado: o pino da escada sai com `chave` e sem o que a escada pede', () => {
    const view = filterMapForPlayer(mapa([{ id: 'item-1', nome: 'chave da torre' }]), 'p1', POSSE, RAIO)
    expect(view.map.pins).toEqual([
      { id: PINO.id, x: 240, y: 200, kind: 'viagem', description: '', image: null, passagem: 'trancada', escadaId: 'escada', chave: 'chave da torre' },
    ])
    semSegredo(view)
  })

  it('Bruno sem a chave: o pino sai trancado, sem `chave`', () => {
    const view = filterMapForPlayer(mapa([{ id: 'item-2', nome: 'Lanterna' }]), 'p1', POSSE, RAIO)
    expect(view.map.pins.map((p) => p.id)).toEqual([PINO.id])
    expect(view.map.pins[0].chave).toBeUndefined()
    expect(view.map.pins[0].passagem).toBe('trancada')
    semSegredo(view)
  })

  it('Bruno com a chave mas longe da boca: vê a escada, sem `chave`', () => {
    const view = filterMapForPlayer(mapa([{ id: 'item-1', nome: ABRE_COM }], 400), 'p1', POSSE, RAIO)
    expect(view.map.stairs.map((s) => s.id)).toEqual(['escada'])
    expect(view.map.pins.map((p) => p.id)).toEqual([PINO.id])
    expect(view.map.pins[0].chave).toBeUndefined()
    semSegredo(view)
  })
})

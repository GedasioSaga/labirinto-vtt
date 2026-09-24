import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Wall } from '../types/map'
import { filterMapForPlayer, pinClueForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * FECHADURA COM SEGREDO no recorte do jogador. A resposta mora só no host: o
 * jogador recebe a FORMA (teclado ou volantes) e o número de casas, e nada
 * mais — nem a resposta, nem a porta que ela destranca. Fechadura aberta não
 * manda nada (o cartão volta a ser o de sempre).
 */

const RAIO = 300
const POSSE = { p1: ['heroi'] }
const RESPOSTA = '9-3-8-2'
const PORTA_LIGADA = 'porta_do_cofre_do_bispo'

function cofre(extra: Partial<Pin> = {}): Pin {
  return {
    id: 'cofre',
    x: 240,
    y: 200,
    kind: 'exclamacao',
    description: 'Cofre com quatro volantes',
    image: null,
    segredo: { resposta: RESPOSTA, forma: 'volantes', abrePorta: PORTA_LIGADA },
    ...extra,
  }
}

/** A porta que a fechadura abre, LONGE do herói: fora da visão dele. */
const PORTA: Wall = { id: PORTA_LIGADA, x1: 900, y1: 900, x2: 950, y2: 900, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }

function mapaCom(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
    walls: [PORTA],
    pins,
  }
}

describe('fogFilter: fechadura com segredo', () => {
  it('o jogador recebe a forma e as casas, e a resposta não aparece em nada do recorte', () => {
    const view = filterMapForPlayer(mapaCom([cofre()]), 'p1', POSSE, RAIO)
    expect(view.map.pins.map((p) => p.id)).toEqual(['cofre'])
    expect(view.map.pins[0].fechadura).toEqual({ forma: 'volantes', casas: 4 })
    expect(view.map.pins[0].segredo).toBeUndefined()
    const rede = JSON.stringify(view)
    expect(rede).not.toContain(RESPOSTA)
    expect(rede).not.toContain('9382')
    // A porta ligada não é dita pelo pino: nem o id atravessa.
    expect(rede).not.toContain(PORTA_LIGADA)
  })

  it('fechadura já aberta não manda nada: o cartão é o de sempre', () => {
    const view = filterMapForPlayer(mapaCom([cofre({ segredo: { resposta: RESPOSTA, forma: 'volantes', aberta: true } })]), 'p1', POSSE, RAIO)
    expect(view.map.pins).toHaveLength(1)
    expect(view.map.pins[0].fechadura).toBeUndefined()
    expect(JSON.stringify(view)).not.toContain('9382')
  })

  it('uma "fechadura" pública que venha no mapa do mestre não é copiada: o recorte a monta', () => {
    const forjada = cofre({ segredo: undefined, fechadura: { forma: 'teclado', casas: 99 } })
    const view = filterMapForPlayer(mapaCom([forjada]), 'p1', POSSE, RAIO)
    expect(view.map.pins).toHaveLength(1)
    expect(view.map.pins[0].fechadura).toBeUndefined()
  })

  it('a pista do cartão (caderno) também não leva a resposta', () => {
    const pista = pinClueForPlayer(cofre())
    expect(pista?.text).toBe('Cofre com quatro volantes')
    expect(JSON.stringify(pista)).not.toContain('9382')
  })
})

describe('mapFile: fechadura com segredo', () => {
  it('o segredo vai e volta do disco; a forma pública do jogador nunca entra no mapa do mestre', () => {
    const lido = deserializeMap(serializeMap(mapaCom([cofre({ fechadura: { forma: 'teclado', casas: 2 } })])))
    expect(lido.pins[0].segredo).toEqual({ resposta: RESPOSTA, forma: 'volantes', abrePorta: PORTA_LIGADA })
    expect(lido.pins[0].fechadura).toBeUndefined()
  })

  it('mapa antigo abre sem o campo', () => {
    const antigo = deserializeMap('{"id": "antigo", "pins": [{"id": "p", "x": 1, "y": 2, "kind": "exclamacao", "description": "", "image": null}]}')
    expect(antigo.pins[0].segredo).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('segredo')
  })
})

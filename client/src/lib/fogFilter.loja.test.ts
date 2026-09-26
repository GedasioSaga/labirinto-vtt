import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer, type PinAudiences } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * LOJA COM PREÇOS no recorte do jogador: a banca que ele vê leva as
 * mercadorias (nome, preço, estoque). A banca que a névoa, a zona oculta, o
 * "Oculto para jogadores" ou o "Quem vê" escondem não leva NADA — nem o nome
 * de uma mercadoria —, e campo que o mestre guardar no item não viaja.
 */

const RAIO = 300
const POSSE = { diego: ['ficha-diego'], carla: ['ficha-carla'] }
const MERCADORIA_RARA = 'Chave-mestra do Relicário'

function banca(extra: Partial<Pin> = {}): Pin {
  return {
    id: 'botica',
    x: 240,
    y: 200,
    kind: 'exclamacao',
    description: 'Botica de Zulmira',
    image: null,
    loja: [
      { id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', estoque: 3 },
      { id: 'chave', nome: MERCADORIA_RARA, preco: '40 moedas', estoque: 1 },
    ],
    ...extra,
  }
}

function quarto(pins: Pin[], extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m', 'Mercado', 1000, 1000, 40),
    tokens: [
      { id: 'ficha-diego', characterId: null, name: 'Diego', x: 200, y: 200, size: 1, image: null },
      { id: 'ficha-carla', characterId: null, name: 'Carla', x: 200, y: 240, size: 1, image: null },
    ],
    pins,
    ...extra,
  }
}

const recorte = (map: MapData, playerId = 'diego', audiences?: PinAudiences) => filterMapForPlayer(map, playerId, POSSE, RAIO, undefined, undefined, audiences)

describe('recorte: loja com preços', () => {
  it('banca à vista leva as mercadorias com nome, preço e estoque', () => {
    const pin = recorte(quarto([banca()])).map.pins.find((p) => p.id === 'botica')
    expect(pin?.loja).toEqual([
      { id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', estoque: 3 },
      { id: 'chave', nome: MERCADORIA_RARA, preco: '40 moedas', estoque: 1 },
    ])
  })

  it('pino sem loja continua sem o campo', () => {
    const pin = recorte(quarto([banca({ loja: undefined })])).map.pins.find((p) => p.id === 'botica')
    expect(pin).toBeDefined()
    expect(pin !== undefined && 'loja' in pin).toBe(false)
  })

  it('campo que o mestre guardar no item (ou arquivo editado à mão) não viaja', () => {
    const comNota = { id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', notaDoMestre: 'é veneno' }
    const view = recorte(quarto([{ ...banca(), loja: [comNota] }]))
    expect(view.map.pins[0]?.loja).toEqual([{ id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda' }])
    expect(JSON.stringify(view.map)).not.toContain('é veneno')
  })

  it('banca no escuro (longe da visão, nunca explorada) não leva mercadoria nenhuma', () => {
    const view = recorte(quarto([banca({ x: 900, y: 900 })]))
    expect(view.map.pins).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain(MERCADORIA_RARA)
  })

  it('banca "Oculta para jogadores" não leva mercadoria nenhuma', () => {
    const view = recorte(quarto([banca({ secret: true })]))
    expect(view.map.pins).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain(MERCADORIA_RARA)
  })

  it('banca dentro de zona oculta ativa não leva mercadoria nenhuma', () => {
    const zona = { id: 'z', name: 'Fundos', revealed: false, points: [{ x: 150, y: 150 }, { x: 350, y: 150 }, { x: 350, y: 300 }, { x: 150, y: 300 }] }
    const view = recorte(quarto([banca()], { concealZones: [zona] }))
    expect(view.map.pins).toEqual([])
    expect(JSON.stringify(view.map)).not.toContain(MERCADORIA_RARA)
  })

  it('"Quem vê" só a Carla: o Diego, no mesmo quarto, não recebe a banca nem as mercadorias', () => {
    const audiences: PinAudiences = new Map([['botica', new Set(['carla'])]])
    const diego = recorte(quarto([banca()]), 'diego', audiences)
    expect(diego.map.pins).toEqual([])
    expect(JSON.stringify(diego.map)).not.toContain(MERCADORIA_RARA)
    const carla = recorte(quarto([banca()]), 'carla', audiences)
    expect(carla.map.pins[0]?.loja?.map((i) => i.nome)).toEqual(['Xarope de tosse', MERCADORIA_RARA])
  })
})

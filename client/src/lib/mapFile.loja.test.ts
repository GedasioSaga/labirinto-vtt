import { describe, expect, it } from 'vitest'
import { createEmptyMap, updatePin } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * LOJA COM PREÇOS no disco: `loja` é campo novo e opcional do pino. As
 * mercadorias vão e voltam; a torta cai sozinha e as boas ficam; mapa antigo
 * não ganha o campo. E editar a lista no painel é mudança do pino.
 */

const pino = (extra: string): string => `{"id": "p", "x": 1, "y": 2, "kind": "exclamacao", "description": "", "image": null${extra}}`

describe('mapFile: loja', () => {
  it('as mercadorias vão e voltam do disco', () => {
    const map = {
      ...createEmptyMap('map_l', 'L', 5, 5, 64),
      pins: [{ id: 'b', x: 64, y: 64, kind: 'exclamacao' as const, description: 'Banca', image: null, loja: [{ id: 'x', nome: 'Xarope', preco: '1 moeda', estoque: 2 }] }],
    }
    expect(deserializeMap(serializeMap(map)).pins[0]?.loja).toEqual([{ id: 'x', nome: 'Xarope', preco: '1 moeda', estoque: 2 }])
  })

  it('mercadoria torta cai, a boa fica, e campo desconhecido não entra no mapa do mestre', () => {
    const lido = deserializeMap(`{"id": "torto", "pins": [${pino(', "loja": [{"id": "a", "nome": "Pão", "preco": "1", "extra": "x"}, {"nome": "sem id"}, 7]')}]}`)
    expect(lido.pins[0]?.loja).toEqual([{ id: 'a', nome: 'Pão', preco: '1' }])
  })

  it('mapa antigo abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "pins": [${pino('')}]}`)
    expect(antigo.pins[0]?.loja).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('loja')
  })
})

describe('updatePin: loja', () => {
  it('pôr, mudar e tirar a loja é mudança; gravar a mesma lista de novo não é', () => {
    const map = { ...createEmptyMap('m', 'M', 5, 5, 64), pins: [{ id: 'b', x: 1, y: 1, kind: 'exclamacao' as const, description: '', image: null }] }
    const comLoja = updatePin(map, 'b', { loja: [{ id: 'x', nome: 'Xarope', preco: '1' }] })
    expect(comLoja).not.toBe(map)
    expect(comLoja.pins[0]?.loja).toEqual([{ id: 'x', nome: 'Xarope', preco: '1' }])
    expect(updatePin(comLoja, 'b', { loja: [{ id: 'x', nome: 'Xarope', preco: '1' }] })).toBe(comLoja)
    const outroPreco = updatePin(comLoja, 'b', { loja: [{ id: 'x', nome: 'Xarope', preco: '2' }] })
    expect(outroPreco.pins[0]?.loja?.[0]?.preco).toBe('2')
    expect(updatePin(comLoja, 'b', { loja: undefined }).pins[0]?.loja).toBeUndefined()
    // Tirar a loja de um pino que nunca teve não é mudança.
    expect(updatePin(map, 'b', { loja: undefined })).toBe(map)
  })
})

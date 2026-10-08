import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'
import { createEmptyMap } from './mapFactory'
import { pontosChaveDoDesenho } from './pontosChave'
import type { Drawing } from '../types/map'

/**
 * PONTOS-CHAVE no disco: o traço editado reabre com as alças no mesmo lugar.
 * Campo novo e opcional — mapa antigo abre sem ele, e lixo no arquivo é
 * ignorado na leitura (as alças voltam a sair do Douglas-Peucker).
 */
describe('mapFile: pontos-chave do traço', () => {
  const traco: Drawing = {
    id: 't',
    kind: 'freehand',
    points: Array.from({ length: 101 }, (_, i) => ({ x: i * 2, y: 0 })),
    color: '#000',
    width: 3,
    pontosChave: [0, 30, 100],
  }

  it('salvar e abrir mantém os pontos-chave', () => {
    const lido = deserializeMap(serializeMap({ ...createEmptyMap('m', 'M', 10, 10, 50), drawings: [traco] }))
    const desenho = lido.drawings[0]
    expect(desenho.kind === 'freehand' && desenho.pontosChave).toEqual([0, 30, 100])
    if (desenho.kind === 'freehand') expect(pontosChaveDoDesenho(desenho)).toEqual([0, 30, 100])
  })

  it('pontos-chave com lixo no arquivo não quebram nada: as alças voltam a ser calculadas', () => {
    const salvo = serializeMap({ ...createEmptyMap('m', 'M', 10, 10, 50), drawings: [traco] })
    const json = salvo.replace(/"pontosChave": \[[^\]]*\]/, '"pontosChave": "oi"')
    expect(json).not.toBe(salvo)
    const desenho = deserializeMap(json).drawings[0]
    if (desenho.kind !== 'freehand') throw new Error('o traço sumiu')
    expect('pontosChave' in desenho).toBe(false)
    expect(pontosChaveDoDesenho(desenho)).toEqual([0, 100])
  })

  it('mapa salvo antes do campo abre igual, sem ganhar campo', () => {
    const antigo: Drawing = { id: 'a', kind: 'freehand', points: [{ x: 0, y: 0 }, { x: 40, y: 10 }], color: '#000', width: 3 }
    const desenho = deserializeMap(serializeMap({ ...createEmptyMap('m', 'M', 10, 10, 50), drawings: [antigo] })).drawings[0]
    expect(desenho).toEqual(antigo)
  })
})

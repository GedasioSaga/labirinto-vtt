import { describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import { alternarOlhoDosJogadores, definirOpacidade, paraVersao2 } from './camadas/estado'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * FATIA 6: o olho do mestre e o cadeado de toda camada moram em
 * `hiddenLayers` e `lockedLayers` (alargados para `CamadaId[]`). Os ids novos
 * só existem no mapa v2; no mapa de antes a leitura fica com as 9 de antes,
 * e o mapa de antes continua saindo idêntico (o round-trip congelado de
 * 924c2bdd mora em `mapFile.camadas.test.ts`).
 */

function mapa(campos: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'Painel', 10, 10, 64), ...campos }
}

const idaEVolta = (map: MapData): MapData => deserializeMap(serializeMap(map))

/** O arquivo do mapa com campos crus postos à mão (valor torto incluído). */
function comCampos(map: MapData, crus: Record<string, unknown>): string {
  const objeto: unknown = JSON.parse(serializeMap(map))
  return JSON.stringify(typeof objeto === 'object' && objeto !== null ? { ...objeto, ...crus } : objeto)
}

describe('olho e cadeado das 13 no arquivo', () => {
  it('mapa v2: ids novos e livres voltam iguais, na mesma ordem', () => {
    const v2 = mapa({ versaoDasCamadas: 2, ocultasDoJogador: ['telhados'], hiddenLayers: ['chao', 'paredes', 'telhados', 'livre_4b95797c'], lockedLayers: ['terreno', 'desenhos'] })
    const lido = idaEVolta(v2)
    expect(lido.hiddenLayers).toEqual(['chao', 'paredes', 'telhados', 'livre_4b95797c'])
    expect(lido.lockedLayers).toEqual(['terreno', 'desenhos'])
    expect(lido.versaoDasCamadas).toBe(2)
  })

  it('mapa v2: id torto sai, os bons ficam', () => {
    const texto = comCampos(mapa({ versaoDasCamadas: 2, ocultasDoJogador: [] }), { hiddenLayers: ['chao', 42, 'nao-existe', 'livre_ com espaço', 'telhados'] })
    expect(deserializeMap(texto).hiddenLayers).toEqual(['chao', 'telhados'])
  })

  it('mapa de antes: id novo no olho ou no cadeado sai (só as 9 de antes); as 9 ficam como estão', () => {
    const texto = comCampos(mapa(), { hiddenLayers: ['salas', 'chao', 'telhados'], lockedLayers: ['terreno', 'tokens'] })
    const lido = deserializeMap(texto)
    expect(lido.versaoDasCamadas).toBeUndefined()
    expect(lido.hiddenLayers).toEqual(['salas'])
    expect(lido.lockedLayers).toEqual(['tokens'])
  })

  it('a virada materializada sobrevive à ida e volta (mesmos campos)', () => {
    const virado = definirOpacidade(alternarOlhoDosJogadores(paraVersao2(mapa({ hiddenLayers: ['salas', 'anotacoes'], lockedLayers: ['salas'] })), 'tokens'), 'objetos', 0.4)
    const lido = idaEVolta(virado)
    expect(lido.hiddenLayers).toEqual(virado.hiddenLayers)
    expect(lido.lockedLayers).toEqual(virado.lockedLayers)
    expect(lido.ocultasDoJogador).toEqual(virado.ocultasDoJogador)
    expect(lido.opacidadeDasCamadas).toEqual({ objetos: 0.4 })
  })

  it('mapa de antes sem nada tocado: o texto do arquivo não ganha chave nenhuma', () => {
    const antes = mapa({ hiddenLayers: ['paredes'], lockedLayers: ['tokens'] })
    expect(serializeMap(idaEVolta(antes))).toBe(serializeMap(antes))
  })
})

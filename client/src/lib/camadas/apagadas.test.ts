// REVISÃO DA FATIA 7 (23/10/2026): camada livre que sumiu da lista mas ainda
// esconde itens dos jogadores (apagada noutra cena, ou o mapa salvo por um
// cliente antigo sem a lista) ganha a linha "Camada apagada" no painel, e o
// passo do Ctrl+Z que a usa a traz de volta à lista. A falha FECHADA não muda.
import { describe, expect, it } from 'vitest'
import { addToken, createEmptyMap } from '../mapFactory'
import { deserializeMap, serializeMap } from '../mapFile'
import type { CamadaId, MapData } from '../../types/map'
import { contextoDeCamadas } from './consulta'
import { alternarOlhoDosJogadores } from './estado'
import { CAMADAS_PADRAO } from './padrao'
import { camadasApagadasEscondidas, modeloParaOPasso } from './modelo'

const L: CamadaId = 'livre_0badc0de'

function mapaComFicha(): MapData {
  return addToken(createEmptyMap('m', 'Mapa', 10, 10, 64), { id: 't1', characterId: null, name: 'Ana', x: 64, y: 64, size: 1, image: null })
}

describe('camada apagada que ainda esconde itens', () => {
  it('arquivo de cliente antigo (sem a lista, a ficha na camada e o olho fechado): a linha aparece; mostrar abre só ela', () => {
    const bruto = JSON.parse(serializeMap(mapaComFicha()))
    bruto.versaoDasCamadas = 2
    bruto.hiddenLayers = [L]
    bruto.tokens[0].camada = L
    const map = deserializeMap(JSON.stringify(bruto))
    expect(map.modeloCamadas).toBeUndefined()
    // Falha FECHADA: o jogador não vê a ficha da camada que ninguém lista.
    expect(contextoDeCamadas(map).jogadorVeItem('ficha', map.tokens[0])).toBe(false)
    expect(camadasApagadasEscondidas(map)).toEqual([L])
    const mostrado = alternarOlhoDosJogadores(map, L)
    expect(camadasApagadasEscondidas(mostrado)).toEqual([])
    expect(contextoDeCamadas(mostrado).jogadorVeItem('ficha', mostrado.tokens[0])).toBe(true)
  })

  it('só as livres fora da lista: padrão escondida, livre listada e lista do mestre (com a dos jogadores presente) não contam', () => {
    const modeloCamadas = { ordem: [...CAMADAS_PADRAO.map((id) => ({ id })), { id: 'livre_11111111' as CamadaId, nome: 'Cripta' }] }
    const map = { hiddenLayers: [L], ocultasDoJogador: ['paredes', 'livre_11111111', 'livre_22222222'] as CamadaId[], modeloCamadas }
    expect(camadasApagadasEscondidas(map)).toEqual(['livre_22222222'])
  })
})

describe('o passo do Ctrl+Z que usa uma livre que sumiu da lista a traz de volta', () => {
  const comL = { ordem: [{ id: 'salas' as CamadaId }, { id: L, nome: 'Cripta' }, ...CAMADAS_PADRAO.filter((id) => id !== 'salas').map((id) => ({ id }))] }

  it('com a ficha nela: volta com o nome e logo acima da vizinha de baixo que tinha', () => {
    const passo: MapData = { ...mapaComFicha(), modeloCamadas: comL }
    passo.tokens = passo.tokens.map((t) => ({ ...t, camada: L }))
    const modelo = modeloParaOPasso(undefined, passo)
    const ids = modelo?.ordem.map((c) => c.id) ?? []
    expect(ids.indexOf(L)).toBe(ids.indexOf('salas') + 1)
    expect(ids).toHaveLength(CAMADAS_PADRAO.length + 1)
    expect(modelo?.ordem.find((c) => c.id === L)?.nome).toBe('Cripta')
  })

  it('sem nada nela (só estava na lista): fica o modelo da aventura, mesma referência', () => {
    const daAventura = { ordem: CAMADAS_PADRAO.map((id) => ({ id })) }
    expect(modeloParaOPasso(daAventura, { ...mapaComFicha(), modeloCamadas: comL })).toBe(daAventura)
  })
})

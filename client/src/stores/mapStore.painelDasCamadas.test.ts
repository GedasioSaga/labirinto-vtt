import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import { contextoDeCamadas } from '../lib/camadas/consulta'
import { parede, peca } from '../lib/__fixtures__/itensDeCamada'
import type { MapData } from '../types/map'

/**
 * PAINEL DAS 13 CAMADAS × CTRL+Z (fase 3, fatia 6). Cada controle do painel
 * (olho do mestre, olho dos jogadores, cadeado, opacidade) é UM passo de
 * desfazer; a opacidade de um arrasto inteiro (o mesmo gesto) é UM passo, e
 * dois arrastos são dois. A virada para o mapa v2 entra no mesmo passo do
 * controle que a causou: um Ctrl+Z volta ao mapa de antes, idêntico.
 */

function abrir(extra: Partial<MapData> = {}): MapData {
  useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m', 'M', 20, 12, 50), ...extra })
  return useMapStore.getState().map
}

const estado = () => useMapStore.getState()

beforeEach(() => {
  abrir()
})

describe('cada controle entra no Ctrl+Z', () => {
  it('olho dos jogadores: um passo, e o Ctrl+Z volta ao MESMO mapa de antes (v1)', () => {
    const antes = abrir()
    estado().alternarOlhoDosJogadores('tokens')
    expect(estado().past).toHaveLength(1)
    expect(estado().map.versaoDasCamadas).toBe(2)
    expect(contextoDeCamadas(estado().map).jogadorVe('tokens')).toBe(false)
    estado().undo()
    expect(estado().map).toBe(antes)
  })

  it('olho do mestre de Telhados e cadeado de Chão: um passo cada', () => {
    const antes = abrir()
    estado().toggleLayerVisibility('telhados')
    estado().toggleLayerLock('chao')
    expect(estado().past).toHaveLength(2)
    expect(contextoDeCamadas(estado().map).mestreVe('telhados')).toBe(false)
    expect(contextoDeCamadas(estado().map).travada('chao')).toBe(true)
    estado().undo()
    estado().undo()
    expect(estado().map).toBe(antes)
  })

  it('opacidade: os quadros de UM arrasto (mesmo gesto) são UM passo; outro gesto, outro passo', () => {
    const antes = abrir()
    for (const valor of [0.9, 0.8, 0.7, 0.6, 0.55]) estado().definirOpacidadeDaCamada('objetos', valor, 'g1')
    expect(estado().past).toHaveLength(1)
    expect(contextoDeCamadas(estado().map).alfa('objetos')).toBe(0.55)
    estado().definirOpacidadeDaCamada('objetos', 0.3, 'g2')
    expect(estado().past).toHaveLength(2)
    estado().undo()
    expect(contextoDeCamadas(estado().map).alfa('objetos')).toBe(0.55)
    estado().undo()
    expect(estado().map).toBe(antes)
  })

  it('opacidade igual à de agora não grava passo', () => {
    abrir()
    estado().definirOpacidadeDaCamada('objetos', 1, 'g1')
    expect(estado().past).toHaveLength(0)
  })

  it('ocultar a camada do item selecionado tira o item da seleção; Chão no mapa v2', () => {
    abrir({ walls: [parede], floor: [peca], versaoDasCamadas: 2, ocultasDoJogador: [] })
    estado().setSelection([{ kind: 'wall', id: parede.id }, { kind: 'floor', id: peca.id }])
    estado().toggleLayerVisibility('chao')
    expect(estado().selection).toEqual([{ kind: 'wall', id: parede.id }])
    estado().toggleLayerLock('paredes')
    expect(estado().selection).toEqual([])
  })
})

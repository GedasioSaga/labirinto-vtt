/**
 * REVISÃO DA FATIA 6 NA STORE (`docs/planos/camadas-fase3-2026-10-22.md`):
 * - o olho (ou o cadeado) de uma camada NOVA num mapa de antes vira o mapa
 *   para v2 e, a partir dali, "Ocultar Paredes" esconde só do mestre: a
 *   virada AVISA, só na primeira vez de cada mapa; a mesma virada pelo olho
 *   dos jogadores ou pela opacidade não avisa (quem pediu o controle novo
 *   já sabe o que pediu);
 * - o balde pergunta pelo MAPA (não pela lista) se o desenho está à vista:
 *   no mapa v2, Desenhos é camada própria, fora de Anotações.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'
import * as mapFactory from '../lib/mapFactory'
import type { CamadaId, Drawing, MapData, Region } from '../types/map'

let proximo = 0
/** Um mapa de antes com id novo a cada teste: o aviso é "uma vez por mapa". */
function mapaDeAntes(): MapData {
  proximo += 1
  return mapFactory.createEmptyMap(`virada-${proximo}`, 'Virada', 10, 10, 64)
}

const textos = (): string[] => useToastStore.getState().toasts.map((t) => t.text)
const avisosDaVirada = (): string[] => textos().filter((t) => t.startsWith('Camadas novas ativadas'))

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('aviso da virada para v2 pelo olho do mestre', () => {
  it('olho de Telhados num mapa de antes: vira v2 e avisa, com o Ctrl+Z como saída', () => {
    useMapStore.getState().loadMap(mapaDeAntes())
    useMapStore.getState().toggleLayerVisibility('telhados')
    expect(useMapStore.getState().map.versaoDasCamadas).toBe(2)
    expect(avisosDaVirada()).toEqual(['Camadas novas ativadas: o olho "Você vê" agora não esconde dos jogadores. Desfazer: Ctrl+Z'])
  })

  it('só na PRIMEIRA virada de cada mapa: desfazer e virar de novo não repete o aviso', () => {
    useMapStore.getState().loadMap(mapaDeAntes())
    useMapStore.getState().toggleLayerVisibility('chao')
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.versaoDasCamadas).toBeUndefined()
    useMapStore.getState().toggleLayerVisibility('chao')
    expect(useMapStore.getState().map.versaoDasCamadas).toBe(2)
    expect(avisosDaVirada()).toHaveLength(1)
  })

  it('o cadeado de uma camada nova também vira e avisa', () => {
    useMapStore.getState().loadMap(mapaDeAntes())
    useMapStore.getState().toggleLayerLock('terreno')
    expect(useMapStore.getState().map.versaoDasCamadas).toBe(2)
    expect(avisosDaVirada()).toHaveLength(1)
  })

  it.each(['paredes', 'tokens', 'salas'] as const)('olho de %s (uma das 9 de antes) não vira e não avisa', (id: CamadaId) => {
    useMapStore.getState().loadMap(mapaDeAntes())
    useMapStore.getState().toggleLayerVisibility(id)
    expect(useMapStore.getState().map.versaoDasCamadas).toBeUndefined()
    expect(avisosDaVirada()).toHaveLength(0)
  })

  it('mapa já v2: o olho de Telhados não avisa', () => {
    useMapStore.getState().loadMap({ ...mapaDeAntes(), versaoDasCamadas: 2, ocultasDoJogador: [] })
    useMapStore.getState().toggleLayerVisibility('telhados')
    expect(avisosDaVirada()).toHaveLength(0)
  })
})

describe('controle: a mesma virada pelo controle novo não avisa', () => {
  it('olho dos jogadores num mapa de antes: vira v2 sem aviso', () => {
    useMapStore.getState().loadMap(mapaDeAntes())
    useMapStore.getState().alternarOlhoDosJogadores('tokens')
    expect(useMapStore.getState().map.versaoDasCamadas).toBe(2)
    expect(avisosDaVirada()).toHaveLength(0)
  })

  it('opacidade num mapa de antes: vira v2 sem aviso', () => {
    useMapStore.getState().loadMap(mapaDeAntes())
    useMapStore.getState().definirOpacidadeDaCamada('salas', 0.5, 'tecla-1')
    expect(useMapStore.getState().map.versaoDasCamadas).toBe(2)
    expect(avisosDaVirada()).toHaveLength(0)
  })
})

describe('balde no mapa v2: Desenhos é camada própria', () => {
  const ilha: Region = {
    id: 'ilha',
    tag: 'region',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    points: [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 500 },
      { x: 100, y: 500 },
    ],
  }
  const mata: Drawing = {
    id: 'mata',
    kind: 'polygon',
    points: [
      { x: 200, y: 200 },
      { x: 400, y: 200 },
      { x: 400, y: 400 },
      { x: 200, y: 400 },
    ],
    color: '#177c5c',
    width: 0,
    filled: true,
    fillAlpha: 1,
  }
  const carregar = (hiddenLayers: CamadaId[]) => {
    const base = mapFactory.createEmptyMap('balde-v2', 'Balde', 20, 12, 50)
    useMapStore.getState().loadMap({ ...base, continente: true, regions: [ilha], drawings: [mata], versaoDasCamadas: 2, ocultasDoJogador: [], hiddenLayers })
    useMapStore.getState().setTexturaModo('balde')
  }

  it('Anotações oculta e Desenhos à vista: o balde enche o desenho', () => {
    carregar(['anotacoes'])
    expect(useMapStore.getState().encherComTextura({ x: 300, y: 300 })).toBe('pintou')
    expect(useMapStore.getState().map.texturas?.[0]).toMatchObject({ alvo: { tipo: 'desenho', id: 'mata' } })
  })

  it('Desenhos oculta: o balde passa pelo desenho e enche a ilha', () => {
    carregar(['desenhos'])
    expect(useMapStore.getState().encherComTextura({ x: 300, y: 300 })).toBe('pintou')
    expect(useMapStore.getState().map.texturas?.[0]).toMatchObject({ alvo: { tipo: 'regiao', id: 'ilha' } })
  })
})

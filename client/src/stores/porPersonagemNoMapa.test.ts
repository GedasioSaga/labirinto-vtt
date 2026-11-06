import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { useMapStore } from './mapStore'
import { casaDoSoltar, porPersonagemNoMapa } from './porPersonagemNoMapa'

/*
 * Pedido de 06/11/2026: "quando eu puxar o jogador para o campo é para o
 * token dele aparecer". Arrastar a linha do painel Personagens até o mapa
 * põe o token ligado à ficha, na casa sob o ponteiro, com zoom e pan.
 */

const MAPA = { grid: 50, width: 20, height: 20, gridShape: 'square' as const }

describe('personagem arrastado para o mapa (stores/porPersonagemNoMapa)', () => {
  beforeEach(() => {
    useMapStore.setState({ map: createEmptyMap('m1', 'Campo', 20, 20, 50), camera: { x: 0, y: 0, scale: 1 }, selection: EMPTY_SELECTION, past: [], future: [], pisoAtivo: 0 })
  })

  it('a casa sob o ponteiro segue zoom e pan: centro da casa no mundo, quadrado dela na tela, e presa dentro do mapa', () => {
    // Canvas a (300, 40) da janela, câmera com pan (100, 50) e zoom 2: o ponteiro em (660, 430) é o mundo (130, 170).
    const casa = casaDoSoltar({ x: 660, y: 430 }, { left: 300, top: 40 }, { x: 100, y: 50, scale: 2 }, MAPA)
    expect(casa.mundo).toEqual({ x: 125, y: 175 })
    expect(casa.tela).toEqual({ x: 650, y: 440, lado: 100, redonda: false })
    // Ponteiro à esquerda e acima do mapa: a primeira casa, não fora dele.
    expect(casaDoSoltar({ x: 0, y: 0 }, { left: 300, top: 40 }, { x: 100, y: 50, scale: 2 }, MAPA).mundo).toEqual({ x: 25, y: 25 })
  })

  it('o token nasce ligado à ficha, na casa, no piso em edição, num passo do desfazer; soltar de novo põe um segundo', async () => {
    useMapStore.setState({ pisoAtivo: 2 })
    const ana = { id: 'p-ana', nome: 'Ana', tipo: 'jogador' as const, retrato: null }

    const id = await porPersonagemNoMapa(ana, { x: 125, y: 175 }, null)
    const token = useMapStore.getState().map.tokens.find((t) => t.id === id)
    expect(token).toMatchObject({ characterId: 'p-ana', name: 'Ana', x: 125, y: 175, size: 1, piso: 2, imageData: null })
    expect(token !== undefined && 'npc' in token).toBe(false)
    expect(useMapStore.getState().past.length).toBe(1)

    const segundo = await porPersonagemNoMapa(ana, { x: 225, y: 175 }, null)
    expect(segundo).not.toBe(id)
    expect(useMapStore.getState().map.tokens.filter((t) => t.characterId === 'p-ana')).toHaveLength(2)
  })
})

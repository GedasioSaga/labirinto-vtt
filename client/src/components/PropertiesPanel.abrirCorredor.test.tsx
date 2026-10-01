import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Region, Wall } from '../types/map'
import { PropertiesPanel } from './PropertiesPanel'
import { propsDoPainel } from './propertiesPanelTestProps'

/*
 * A costura do "Abrir para o corredor" (pedido 4 de 30/09/2026, fatia 3) com o
 * painel DE VERDADE: o painel diz ao bloco da Sala de que Sala ele é, e a
 * linha faz o resto pela store. O App não passa conta nem callback — é de
 * outra trilha, e a ação já mora na store (`abrirSalaParaCorredores`).
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** A "Sala 3" da imagem 4 (0..600 × 0..500) com as linhas dadas. */
function salaCom(linhas: Wall[]): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['s0', 's1', 's2', 's3'], { x: 0, y: 0 }, { x: 600, y: 500 }, undefined, undefined, 'Sala 3')
  const comSala = addRoom(createEmptyMap('m_painel_abrir', 'Corredor', 30, 30, 64), region, walls)
  return { ...comSala, walls: [...comSala.walls, ...linhas] }
}

// Imagem 4: uma linha entra pela borda de cima, a outra pela lateral esquerda.
const A = parede('A', -200, -200, 150, 50)
const B = parede('B', -300, -100, 50, 180)

describe('painel de propriedades — "Abrir para o corredor"', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useToastStore.setState({ toasts: [] })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  /** O painel com a Sala selecionada, como está no mapa AGORA. */
  function renderSala(map: MapData): void {
    useMapStore.setState({ map, past: [], future: [], pisoAtivo: 0 })
    const sala: Region | undefined = map.regions.find((r) => r.id === 'sala')
    if (sala === undefined) throw new Error('a sala não está no mapa')
    const props = propsDoPainel(null, {
      groups: relevantPropertyGroups('select', { region: true, regionIsRoom: true }),
      selectedRegion: sala,
    })
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  const linhaAbrir = () => [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Abrir para'))

  it('Sala da imagem 4 selecionada: a linha "(1)" mora no bloco da Sala, e o clique abre num passo do desfazer', () => {
    renderSala(salaCom([A, B]))
    const linha = linhaAbrir()
    if (linha === undefined) throw new Error('o painel da Sala não tem a linha "Abrir para o corredor"')
    expect(linha.textContent).toBe('Abrir para o corredor (1)')
    expect(linha.closest('section')?.querySelector('h2')?.textContent).toBe('Sala')

    act(() => linha.click())
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(linhaAbrir()).toBeUndefined()
  })

  it('Sala sem corredor encostando: o bloco da Sala não tem a linha', () => {
    renderSala(salaCom([]))
    expect(container.querySelector('#lb-room-name')).not.toBeNull()
    expect(linhaAbrir()).toBeUndefined()
  })
})

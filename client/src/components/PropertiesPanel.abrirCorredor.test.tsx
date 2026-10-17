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
 * painel DE VERDADE: desde a fatia 15 ele é um item do "Mais ações" da cabeça
 * da Sala (`useAcaoAbrirCorredor`), e o item faz o resto pela store. O App não
 * passa conta nem callback — a ação já mora na store (`abrirSalaParaCorredores`).
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
      selection: { selection: { kind: 'region', count: 1 }, defaultTokenName: 'Token 1', onAddToken: () => {}, onRemoveSelected: () => {} },
    })
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  const maisAcoes = () => container.querySelector<HTMLButtonElement>('button[aria-label="Mais ações"]')
  /** Abre o "Mais ações" (quando a cabeça o tem) e devolve o item do corredor; o menu abre num balão. */
  function itemAbrir(): HTMLElement | undefined {
    const mais = maisAcoes()
    if (mais !== null && mais.getAttribute('aria-expanded') !== 'true') act(() => mais.click())
    return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent?.startsWith('Abrir para'))
  }

  it('Sala da imagem 4 selecionada: o item "(1)" mora no "Mais ações" da cabeça, fora do corpo da ficha, e o clique abre num passo do desfazer', () => {
    renderSala(salaCom([A, B]))
    const item = itemAbrir()
    if (item === undefined) throw new Error('o "Mais ações" da Sala não tem o item "Abrir para o corredor"')
    expect(item.textContent).toContain('Abrir para o corredor (1)')
    expect(container.querySelector('.lb-ficha-da-sala')?.contains(item)).toBe(false)

    act(() => item.click())
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(itemAbrir()).toBeUndefined()
  })

  it('Sala sem corredor encostando: o "Mais ações" não tem o item', () => {
    renderSala(salaCom([]))
    expect(container.querySelector('#lb-room-name')).not.toBeNull()
    expect(itemAbrir()).toBeUndefined()
  })
})

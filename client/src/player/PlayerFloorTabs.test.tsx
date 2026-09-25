/**
 * MAPA POR ANDARES — as abas do jogador (1F, 2F, B1). Só os rótulos que o host
 * mandou; setas trocam de aba, Home/End vão às pontas e a fileira é uma parada
 * só do Tab (convenção de Abas).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration } from '../lib/exploration'
import { floorShown, PlayerFloorTabs } from './PlayerFloorTabs'
import type { PlayerFloors } from './playerConnection'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function memoria(rotulo: string, mapId: string) {
  return { rotulo, map: createEmptyMap(mapId, '', 10, 10, 50), explored: createExploration({ width: 500, height: 500, grid: 50 }), concealed: [] }
}

const ANDARES: PlayerFloors = { atual: '1F', outros: [memoria('2F', 'm-sotao'), memoria('B1', 'm-porao')] }

function abas(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
}

function desenha(selected: string, onSelect = vi.fn()) {
  act(() => root.render(<PlayerFloorTabs andares={ANDARES} selected={selected} onSelect={onSelect} />))
  return onSelect
}

function tecla(alvo: HTMLElement, key: string) {
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

describe('PlayerFloorTabs', () => {
  it('uma aba por andar conhecido, de baixo para cima, e a do andar dele diz onde ele está', () => {
    desenha('1F')
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Andares do prédio')
    expect(abas().map((a) => a.textContent)).toEqual(['B1', '1F', '2F'].map((r) => expect.stringContaining(r)))
    expect(abas().map((a) => a.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    // Uma parada só do Tab: só a aba escolhida entra na ordem.
    expect(abas().map((a) => a.tabIndex)).toEqual([-1, 0, -1])
    expect(abas()[1]?.getAttribute('aria-label')).toBe('1F, você está aqui')
    expect(abas()[0]?.getAttribute('aria-label')).toBe('B1')
  })

  it('clique escolhe o andar', () => {
    const onSelect = desenha('1F')
    act(() => abas()[0]?.click())
    expect(onSelect).toHaveBeenCalledWith('B1')
  })

  it('setas trocam de aba (com volta nas pontas), Home e End vão às pontas, e o foco acompanha', () => {
    const onSelect = desenha('1F')
    const [b1, f1, f2] = abas()
    if (b1 === undefined || f1 === undefined || f2 === undefined) throw new Error('faltou aba')
    f1.focus()
    tecla(f1, 'ArrowRight')
    expect(onSelect).toHaveBeenLastCalledWith('2F')
    expect(document.activeElement).toBe(f2)
    tecla(f2, 'ArrowRight')
    expect(onSelect).toHaveBeenLastCalledWith('B1')
    expect(document.activeElement).toBe(b1)
    tecla(b1, 'ArrowLeft')
    expect(onSelect).toHaveBeenLastCalledWith('2F')
    tecla(f2, 'Home')
    expect(onSelect).toHaveBeenLastCalledWith('B1')
    tecla(b1, 'End')
    expect(onSelect).toHaveBeenLastCalledWith('2F')
    expect(onSelect).toHaveBeenCalledTimes(5)
  })
})

describe('floorShown', () => {
  it('outro andar conhecido: a memória dele; o andar atual, ou um que sumiu da lista: null (o mapa ao vivo)', () => {
    expect(floorShown(ANDARES, 'B1')?.map.id).toBe('m-porao')
    expect(floorShown(ANDARES, '1F')).toBeNull()
    expect(floorShown(ANDARES, '3F')).toBeNull()
    expect(floorShown(undefined, 'B1')).toBeNull()
  })
})

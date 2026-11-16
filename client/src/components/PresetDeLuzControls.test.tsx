import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from '../stores/mapStore'
import { PresetDeLuzControls } from './PresetDeLuzControls'

/** Fase 6 (16/11/2026, "Luz da tocha no objeto"): o painel da Luz não tem mais presets de chama; leva ao Objeto. */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useMapStore.getState().setActiveTool('light')
  useMapStore.getState().setMobiliaTipo('mesa')
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('PresetDeLuzControls', () => {
  it('sem rádio de preset; Lampião arma a ferramenta Objeto com o lampião, que acende sozinho', () => {
    act(() => root.render(<PresetDeLuzControls />))
    expect(container.querySelector('[role="radiogroup"]')).toBeNull()
    const lampiao = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Lampião')
    expect(lampiao).toBeDefined()
    act(() => lampiao?.click())
    expect(useMapStore.getState().activeTool).toBe('mobilia')
    expect(useMapStore.getState().mobiliaTipo).toBe('lampiao')
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { useMapStore } from '../stores/mapStore'
import { MobiliaControls } from './MobiliaControls'

/**
 * "VISTA 3/4" no painel do móvel (MT11): liga a 3/4 no MAPA inteiro
 * (`MapData.vistaDosMoveis`), com Ctrl+Z, e só aparece com a obra do
 * Meio-Termo ligada (sem ela a vista não desenha nada).
 */

const BARRIL: Prop = { id: 'b', src: '', x: 100, y: 100, width: 50, height: 50, linkedMapPath: null, mobilia: 'barril' }

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const { vistaDosMoveis: _v, ...mapa } = useMapStore.getState().map
  useMapStore.setState({ map: { ...mapa, props: [BARRIL] }, selection: [], past: [], future: [] })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  trocarObraNoTeste(false)
})

function render(): void {
  const nada = (): void => {}
  act(() => root.render(<MobiliaControls parte="essencial" prop={BARRIL} onTipoChange={nada} onVistaChange={nada} onFormaChange={nada} onAparenciaChange={nada} />))
}

function interruptor(): HTMLInputElement | null {
  const rotulo = [...container.querySelectorAll('label.lb-switch')].find((l) => l.textContent?.includes('Vista 3/4'))
  return rotulo?.querySelector('input') ?? null
}

describe('interruptor "Vista 3/4" do mapa', () => {
  it('não aparece com a obra desligada', () => {
    render()
    expect(interruptor()).toBeNull()
  })

  it('com a obra: liga e desliga a 3/4 do mapa, com desfazer, e diz em português o que faz', () => {
    trocarObraNoTeste(true)
    render()
    const input = interruptor()
    expect(input).not.toBeNull()
    expect(input?.checked).toBe(false)
    const ajuda = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(ajuda?.textContent).toContain('todos os móveis deste mapa')
    act(() => input?.click())
    expect(useMapStore.getState().map.vistaDosMoveis).toBe('tres-quartos')
    expect(interruptor()?.checked).toBe(true)
    act(() => useMapStore.getState().undo())
    expect(useMapStore.getState().map.vistaDosMoveis).toBeUndefined()
    act(() => useMapStore.getState().redo())
    expect(useMapStore.getState().map.vistaDosMoveis).toBe('tres-quartos')
    act(() => interruptor()?.click())
    expect('vistaDosMoveis' in useMapStore.getState().map).toBe(false)
  })
})

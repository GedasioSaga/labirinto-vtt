import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FloorPiece } from '../types/map'
import { FloorLayersList } from './FloorLayersList'

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

function peca(id: string, fillColor?: string): FloorPiece {
  return { id, shape: { kind: 'rect', cx: 0, cy: 0, w: 10, h: 10 }, op: 'add', fillColor, modifiers: [] } as FloorPiece
}

function botao(nome: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  if (!achado) throw new Error(`botão "${nome}" não achado`)
  return achado
}

describe('FloorLayersList', () => {
  it('lista de cima para baixo, trava, sobe, desce e seleciona pela linha', () => {
    const onSelect = vi.fn()
    const onToggleLock = vi.fn()
    const onReorder = vi.fn()
    act(() =>
      root.render(
        <FloorLayersList
          floor={[peca('mar', '#2f6690'), peca('chao')]}
          floorFillColor="#ddccaa"
          selectedPieceId={null}
          onSelect={onSelect}
          onToggleLock={onToggleLock}
          onColorChange={vi.fn()}
          onReorder={onReorder}
        />,
      ),
    )
    const nomes = [...container.querySelectorAll('.lb-floor-layers__pick')].map((b) => b.textContent)
    expect(nomes).toEqual(['Chão', 'Mar'])

    act(() => botao('Travar Mar').click())
    expect(onToggleLock).toHaveBeenCalledWith('mar', true)
    act(() => botao('Subir Mar').click())
    expect(onReorder).toHaveBeenCalledWith('mar', 1)
    expect(botao('Subir Chão').disabled).toBe(true)
    expect(botao('Descer Mar').disabled).toBe(true)
    act(() => botao('Chão').click())
    expect(onSelect).toHaveBeenCalledWith('chao')
  })
})

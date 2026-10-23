import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawingTool } from '../types/tools'
import { useMapStore } from '../stores/mapStore'
import { Toolbar } from './Toolbar'
import type { ToolVariantBindings } from './ToolVariantMenu'

/**
 * ATALHO DA ÁRVORE no painel de Objetos (fatia MT5 do Meio-Termo): a árvore
 * continua CARIMBO (não é móvel), e o menu do botão Objeto ganha um atalho que
 * arma a ferramenta Carimbo com a árvore redonda. Nada de tecla nova.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useMapStore.getState().setCarimboEscolhido('pinheiro')
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function bindings(onSelectTool: (tool: DrawingTool) => void): ToolVariantBindings {
  return {
    doorKind: { value: 'normal', onChange: vi.fn() },
    wallKind: { value: undefined, onChange: vi.fn() },
    regionFillPattern: { value: 'solid', onChange: vi.fn() },
    polygonSides: { value: 6, onChange: vi.fn() },
    stairSizePreset: { value: 'medium', onChange: vi.fn() },
    drawTexture: { value: 'pen', onChange: vi.fn() },
    brushMode: { value: 'traco', onChange: vi.fn() },
    eraseMode: { value: 'objeto', onChange: vi.fn() },
    floorShapeKind: { value: 'rect', onChange: vi.fn() },
    floorOp: { value: 'add', onChange: vi.fn() },
    floorPolygonSides: { value: 6, onChange: vi.fn() },
    floorBrushSize: { value: 1, onChange: vi.fn() },
    floorCamada: { value: 'chao', onChange: vi.fn() },
    mobiliaTipo: { value: 'mesa', onChange: vi.fn() },
    roomFreeKind: { value: 'sala', onChange: vi.fn() },
    roomFreeRounded: { value: false, onChange: vi.fn() },
    drawShape: { value: 'mobilia', onChange: onSelectTool },
  }
}

function render(activeTool: DrawingTool, onSelectTool: (tool: DrawingTool) => void): void {
  act(() => root.render(<Toolbar activeTool={activeTool} onSelectTool={onSelectTool} lastDrawingTool="brush" variantBindings={bindings(onSelectTool)} />))
}

const botao = (nome: string): HTMLButtonElement => {
  const achado = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.getAttribute('aria-label') === nome)
  if (achado === undefined) throw new Error(`botão ${nome} ausente`)
  return achado
}

const menuDeObjeto = () => document.body.querySelector('[role="group"][aria-label="Opções de Objeto"]:not(.gr-sai)')

describe('MT5: atalho da árvore redonda no menu do Objeto', () => {
  it('o menu do Objeto mostra o atalho "Árvore redonda" num grupo próprio, depois dos objetos', () => {
    render('mobilia', vi.fn())
    act(() => botao('Opções de Objeto').click())
    const atalhos = menuDeObjeto()?.querySelector('[role="group"][aria-label="Atalho"]')
    expect(atalhos).not.toBeNull()
    const arvore = atalhos?.querySelector<HTMLButtonElement>('button[aria-label="Árvore redonda"]')
    expect(arvore).not.toBeNull()
    expect(arvore?.querySelector('svg')).not.toBeNull()
    // Diz o que faz: arma o Carimbo (não é um móvel posto pelo Objeto).
    const descricao = arvore?.getAttribute('aria-describedby')
    expect(descricao !== null && descricao !== undefined && document.getElementById(descricao)?.textContent?.includes('Carimbo')).toBe(true)
  })

  it('clicar arma a ferramenta Carimbo com a árvore redonda e fecha o menu', () => {
    const onSelectTool = vi.fn()
    render('mobilia', onSelectTool)
    act(() => botao('Opções de Objeto').click())
    act(() => botao('Árvore redonda').click())
    expect(onSelectTool).toHaveBeenCalledWith('carimbos')
    expect(useMapStore.getState().carimboEscolhido).toBe('arvore-redonda')
    expect(menuDeObjeto()).toBeNull()
  })

  it('o atalho não aparece no menu de outra ferramenta', () => {
    render('wall', vi.fn())
    act(() => botao('Opções de Parede').click())
    expect(document.body.querySelector('[role="group"][aria-label="Atalho"]')).toBeNull()
  })
})

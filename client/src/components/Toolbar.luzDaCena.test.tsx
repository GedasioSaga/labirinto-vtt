/**
 * O BALÃO "LUZ DA CENA" do botão do sol (auditoria da frente B, 09/11/2026): o
 * Escape só o fechava com o foco DENTRO dele. Com o foco em outro lugar (o
 * mestre abriu, clicou num campo do painel e apertou Esc) o balão ficava
 * aberto. Esc e clique fora fecham sempre, e o foco volta ao botão do sol.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'
import type { ToolVariantBindings } from './ToolVariantMenu'

let container: HTMLDivElement
let root: Root

function bindings(): ToolVariantBindings {
  return {
    doorKind: { value: 'normal', onChange: vi.fn() },
    wallKind: { value: undefined, onChange: vi.fn() },
    wallFeitio: { value: 'pedra', onChange: vi.fn() },
    wallAcabamento: { value: 'linhas', onChange: vi.fn() },
    wallMaterial: { value: 'castelo', onChange: vi.fn() },
    estiloDoMapa: { value: 'atual' },
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
    drawShape: { value: 'select', onChange: vi.fn() },
  }
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Toolbar activeTool="select" onSelectTool={vi.fn()} lastDrawingTool="rect" variantBindings={bindings()} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function botaoDoSol(): HTMLButtonElement {
  const botao = document.body.querySelector<HTMLButtonElement>('button[aria-label="Luz"]')
  if (botao === null) throw new Error('botão do sol ausente')
  return botao
}

/** Abre o balão e leva o foco para fora dele, como quem clicou num campo do painel ao lado. */
function abrirComOFocoFora(): HTMLInputElement {
  act(() => botaoDoSol().click())
  expect(botaoDoSol().getAttribute('aria-expanded')).toBe('true')
  const campo = document.createElement('input')
  document.body.appendChild(campo)
  act(() => campo.focus())
  return campo
}

describe('Toolbar: o balão "Luz da cena"', () => {
  it('o Escape fecha o balão mesmo com o foco fora dele, e o foco volta ao botão do sol', () => {
    const campo = abrirComOFocoFora()
    act(() => {
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(botaoDoSol().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(botaoDoSol())
    campo.remove()
  })

  it('o clique fora fecha; o foco volta ao botão do sol, a não ser que o clique tenha pousado em outro controle', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      // Clique no mapa (nada focável): o foco, que estava no balão, volta ao botão.
      act(() => botaoDoSol().click())
      expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull()
      act(() => {
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        vi.runOnlyPendingTimers()
      })
      expect(botaoDoSol().getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(botaoDoSol())

      // Clique num campo: fecha, e o foco fica no campo.
      const campo = abrirComOFocoFora()
      act(() => {
        campo.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        vi.runOnlyPendingTimers()
      })
      expect(botaoDoSol().getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(campo)
      campo.remove()
    } finally {
      vi.useRealTimers()
    }
  })
})

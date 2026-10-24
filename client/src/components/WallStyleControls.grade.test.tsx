import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Wall } from '../types/map'
import { WallStyleControls } from './WallStyleControls'
import { gradeDaParede } from './gradeDaParede'

/**
 * GRADE DE PRISÃO no painel da parede (MT10): o interruptor aparece logo
 * abaixo de "Janela", só numa janela sem porta e só com a obra do Meio-Termo
 * ligada (`gradeDaParede` decide; sem ele o controle não entra).
 */

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

const JANELA: Wall = { id: 'j', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, janela: true }

function interruptor(rotulo: string): HTMLInputElement | null {
  const label = [...container.querySelectorAll('label.lb-switch')].find((l) => l.textContent?.includes(rotulo))
  return label?.querySelector('input') ?? null
}

describe('WallStyleControls: grade de prisão', () => {
  it('com o handler: aparece, marcada conforme a parede, e o clique pede a troca', () => {
    const onChange = vi.fn()
    act(() =>
      root.render(
        <WallStyleControls wallKind="exterior" onWallKindChange={vi.fn()} janela onJanelaChange={vi.fn()} grade={{ ligada: true, onChange }} parte="deixa" />,
      ),
    )
    const input = interruptor('Grade de prisão')
    expect(input).not.toBeNull()
    expect(input?.checked).toBe(true)
    act(() => input?.click())
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('sem o handler, não aparece', () => {
    act(() => root.render(<WallStyleControls wallKind="exterior" onWallKindChange={vi.fn()} janela onJanelaChange={vi.fn()} parte="deixa" />))
    expect(interruptor('Grade de prisão')).toBeNull()
  })
})

describe('gradeDaParede: quando o controle entra', () => {
  const definir = vi.fn()
  it('só com a obra ligada, numa janela sem porta', () => {
    expect(gradeDaParede(JANELA, true, definir)).toEqual({ ligada: false, onChange: expect.any(Function) })
    expect(gradeDaParede({ ...JANELA, grade: true }, true, definir)?.ligada).toBe(true)
    expect(gradeDaParede(JANELA, false, definir)).toBeUndefined()
    expect(gradeDaParede(null, true, definir)).toBeUndefined()
    const { janela: _j, ...comum } = JANELA
    expect(gradeDaParede(comum, true, definir)).toBeUndefined()
    expect(gradeDaParede({ ...JANELA, door: { open: false, locked: false, kind: 'normal' } }, true, definir)).toBeUndefined()
  })

  it('o clique chama a store com o id da parede', () => {
    const chamada = vi.fn()
    gradeDaParede(JANELA, true, chamada)?.onChange(true)
    expect(chamada).toHaveBeenCalledWith('j', true)
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlignDistributeControls } from './AlignDistributeControls'

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

const ALINHAR = ['Alinhar à esquerda', 'Alinhar ao centro', 'Alinhar à direita', 'Alinhar ao topo', 'Alinhar ao meio', 'Alinhar à base']
const DISTRIBUIR = ['Distribuir na horizontal', 'Distribuir na vertical']

function botao(nome: string): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${nome}"]`)
}

function montar(count: number) {
  const onAlign = vi.fn()
  const onDistribute = vi.fn()
  act(() => root.render(<AlignDistributeControls count={count} onAlign={onAlign} onDistribute={onDistribute} />))
  return { onAlign, onDistribute }
}

describe('AlignDistributeControls', () => {
  it('com 0 ou 1 item não mostra nada', () => {
    montar(1)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    montar(0)
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('com 2 itens mostra os seis alinhar clicáveis e os dois distribuir desabilitados, com o motivo', () => {
    montar(2)
    for (const nome of ALINHAR) {
      const b = botao(nome)
      expect(b, nome).not.toBeNull()
      expect(b?.disabled, nome).toBe(false)
      expect(b?.title, nome).toBe(nome)
    }
    for (const nome of DISTRIBUIR) {
      expect(botao(nome)?.disabled, nome).toBe(true)
    }
    expect(container.textContent).toContain('3 ou mais itens')
  })

  it('com 3 itens os dois distribuir ficam clicáveis e o aviso some', () => {
    montar(3)
    for (const nome of DISTRIBUIR) expect(botao(nome)?.disabled, nome).toBe(false)
    expect(container.textContent).not.toContain('3 ou mais itens')
  })

  it('cada botão chama a ação certa', () => {
    const { onAlign, onDistribute } = montar(3)
    const esperado: Record<string, string> = {
      'Alinhar à esquerda': 'left',
      'Alinhar ao centro': 'center',
      'Alinhar à direita': 'right',
      'Alinhar ao topo': 'top',
      'Alinhar ao meio': 'middle',
      'Alinhar à base': 'bottom',
    }
    for (const [nome, edge] of Object.entries(esperado)) {
      act(() => botao(nome)?.click())
      expect(onAlign).toHaveBeenLastCalledWith(edge)
    }
    act(() => botao('Distribuir na horizontal')?.click())
    expect(onDistribute).toHaveBeenLastCalledWith('horizontal')
    act(() => botao('Distribuir na vertical')?.click())
    expect(onDistribute).toHaveBeenLastCalledWith('vertical')
    expect(onAlign).toHaveBeenCalledTimes(6)
    expect(onDistribute).toHaveBeenCalledTimes(2)
  })
})

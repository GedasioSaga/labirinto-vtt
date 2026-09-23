import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WATCH_DEFAULT } from '../lib/npcWatch'
import type { TokenWatch } from '../types/map'
import { TokenWatchControls } from './TokenWatchControls'

/**
 * OLHOS DO GUARDA, lado do PAINEL do mestre: um interruptor liga a vigia da
 * ficha selecionada; ligada, três escolhas de um clique — para onde olha, a
 * abertura do olhar e até onde enxerga. Cada escolha pede a vigia inteira
 * nova; desligar pede `null` (a ficha volta a ser uma ficha comum).
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

function render(node: React.ReactNode) {
  act(() => root.render(node))
}

function interruptor(): HTMLInputElement {
  const input = container.querySelector('input[type="checkbox"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('sem o interruptor da vigia')
  return input
}

function grupo(nome: string): HTMLElement {
  const achado = [...container.querySelectorAll<HTMLElement>('[role="radiogroup"]')].find((g) => g.getAttribute('aria-label') === nome)
  if (!achado) throw new Error(`sem o grupo "${nome}"`)
  return achado
}

function opcao(nomeDoGrupo: string, nome: string): HTMLButtonElement {
  const achado = [...grupo(nomeDoGrupo).querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === nome)
  if (!achado) throw new Error(`sem a opção "${nome}" em "${nomeDoGrupo}"`)
  return achado
}

const NORTE_60: TokenWatch = { direcao: 270, abertura: 60, alcance: 9 }

describe('TokenWatchControls', () => {
  it('ficha comum: interruptor desligado e nenhuma escolha de cone à vista', () => {
    render(<TokenWatchControls watch={null} onWatchChange={vi.fn()} />)
    expect(container.querySelector('h2')?.textContent).toBe('Vigia')
    expect(interruptor().checked).toBe(false)
    expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(0)
  })

  it('ligar o interruptor pede a vigia padrão', () => {
    const onWatchChange = vi.fn()
    render(<TokenWatchControls watch={null} onWatchChange={onWatchChange} />)
    act(() => interruptor().click())
    expect(onWatchChange).toHaveBeenCalledWith(WATCH_DEFAULT)
  })

  it('ligada: o que está na ficha aparece marcado nos três grupos', () => {
    render(<TokenWatchControls watch={NORTE_60} onWatchChange={vi.fn()} />)
    expect(interruptor().checked).toBe(true)
    expect(opcao('Para onde olha', 'Norte').getAttribute('aria-checked')).toBe('true')
    expect(opcao('Para onde olha', 'Leste').getAttribute('aria-checked')).toBe('false')
    expect(grupo('Para onde olha').querySelectorAll('button')).toHaveLength(8)
    expect(opcao('Abertura do olhar', '60 graus').getAttribute('aria-checked')).toBe('true')
    expect(opcao('Alcance', '9 quadrados').getAttribute('aria-checked')).toBe('true')
  })

  it('cada escolha pede a vigia inteira com só aquele campo trocado', () => {
    const onWatchChange = vi.fn()
    render(<TokenWatchControls watch={NORTE_60} onWatchChange={onWatchChange} />)
    act(() => opcao('Para onde olha', 'Sudoeste').click())
    expect(onWatchChange).toHaveBeenLastCalledWith({ ...NORTE_60, direcao: 135 })
    act(() => opcao('Abertura do olhar', 'Em volta').click())
    expect(onWatchChange).toHaveBeenLastCalledWith({ ...NORTE_60, abertura: 360 })
    act(() => opcao('Alcance', '3 quadrados').click())
    expect(onWatchChange).toHaveBeenLastCalledWith({ ...NORTE_60, alcance: 3 })
  })

  it('desligar pede null', () => {
    const onWatchChange = vi.fn()
    render(<TokenWatchControls watch={NORTE_60} onWatchChange={onWatchChange} />)
    act(() => interruptor().click())
    expect(onWatchChange).toHaveBeenCalledWith(null)
  })
})

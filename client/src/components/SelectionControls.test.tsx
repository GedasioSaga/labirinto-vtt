import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectionControls, type SelectionControlsProps } from './SelectionControls'

/**
 * "Oculto para jogadores" em lote, no painel da seleção: três estados (nenhum,
 * todos, misturado) num checkbox só. Misturado marca todos — o gesto de quem
 * selecionou 4 guardas para esconder de uma vez.
 */
describe('SelectionControls — Oculto para jogadores em lote', () => {
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

  const base: Pick<SelectionControlsProps, 'secret'> = {}
  const render = (props: Pick<SelectionControlsProps, 'secret'>) => act(() => root.render(<SelectionControls {...props} />))
  const caixa = (): HTMLInputElement | null => {
    const rotulo = Array.from(container.querySelectorAll('label')).find((el) => el.textContent?.startsWith('Oculto para jogadores'))
    return rotulo?.querySelector('input[type="checkbox"]') ?? null
  }

  it('misturado: caixa indeterminada, e o clique esconde todos', () => {
    const onSecretChange = vi.fn<(secret: boolean) => void>()
    render({ ...base, secret: { state: 'mixed', count: 4, onChange: onSecretChange } })
    const input = caixa()
    expect(input?.indeterminate).toBe(true)
    expect(input?.checked).toBe(false)
    expect(container.textContent).toContain('Oculto para jogadores (4)')
    act(() => input?.click())
    expect(onSecretChange).toHaveBeenCalledWith(true)
  })

  it('todos ocultos: marcada; o clique mostra todos', () => {
    const onSecretChange = vi.fn<(secret: boolean) => void>()
    render({ ...base, secret: { state: 'all', count: 4, onChange: onSecretChange } })
    expect(caixa()?.checked).toBe(true)
    expect(caixa()?.indeterminate).toBe(false)
    act(() => caixa()?.click())
    expect(onSecretChange).toHaveBeenCalledWith(false)
  })

  it('nenhum oculto: desmarcada; o clique esconde', () => {
    const onSecretChange = vi.fn<(secret: boolean) => void>()
    render({ ...base, secret: { state: 'none', count: 4, onChange: onSecretChange } })
    expect(caixa()?.checked).toBe(false)
    expect(caixa()?.indeterminate).toBe(false)
    act(() => caixa()?.click())
    expect(onSecretChange).toHaveBeenCalledWith(true)
  })

  it('com o lote: a seção é só o título "Seleção" e o interruptor, sem botão nenhum', () => {
    render({ secret: { state: 'none', count: 4, onChange: () => {} } })
    expect(container.querySelector('h2')?.textContent).toBe('Seleção')
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})

/**
 * A seção "Seleção" só existe para o lote (pedido painel-acervo, fatia 2): o
 * "Adicionar token" foi para o "+ Token" (faixa do topo sem seleção, título do
 * Acervo com seleção), o "Nada selecionado" virou a faixa do topo
 * (`NadaSelecionado`) e o "Apagar" já morava na faixa da seleção.
 */
describe('SelectionControls — fora do lote, nada', () => {
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

  it('sem o prop (um item só, nada que aceite, ou nada selecionado): não desenha nada', () => {
    act(() => root.render(<SelectionControls />))
    expect(container.childElementCount).toBe(0)
  })
})

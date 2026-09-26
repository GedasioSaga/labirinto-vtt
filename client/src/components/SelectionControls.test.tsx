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

  const base: SelectionControlsProps = {
    selection: { kind: 'token', count: 4 },
    defaultTokenName: 'Token 1',
    onAddToken: () => {},
    onRemoveSelected: () => {},
  }
  const render = (props: SelectionControlsProps) => act(() => root.render(<SelectionControls {...props} />))
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

  it('sem o prop (um item só, ou nada que aceite): nenhuma caixa', () => {
    render(base)
    expect(caixa()).toBeNull()
    expect(container.textContent).toContain('Adicionar token')
  })
})

/**
 * O "Apagar" mora na faixa do topo (`SelectionHeader`). Aqui, com seleção, não
 * pode repetir (dois botões com o mesmo nome quebram o modo estrito das
 * jornadas); sem seleção fica o "Nada selecionado" desabilitado, que as
 * jornadas leem para saber que o clique no vazio desmarcou.
 */
describe('SelectionControls — o Apagar saiu para a faixa da seleção', () => {
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

  const botoes = () => Array.from(container.querySelectorAll('button')).map((b) => b.textContent)

  it('com seleção: só "Adicionar token", nenhum "Apagar" nem "Nada selecionado"', () => {
    act(() =>
      root.render(<SelectionControls selection={{ kind: 'region', count: 1 }} defaultTokenName="Token 1" onAddToken={() => {}} onRemoveSelected={() => {}} />),
    )
    expect(botoes()).toEqual(['Adicionar token'])
    expect(container.querySelector('h2')?.textContent).toBe('Seleção')
  })

  it('sem seleção: "Nada selecionado", desabilitado, depois de "Adicionar token"', () => {
    act(() => root.render(<SelectionControls selection={null} defaultTokenName="Token 1" onAddToken={() => {}} onRemoveSelected={() => {}} />))
    expect(botoes()).toEqual(['Adicionar token', 'Nada selecionado'])
    const nada = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Nada selecionado')
    expect(nada?.disabled).toBe(true)
  })
})

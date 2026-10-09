import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinControls, type PinControlsProps } from './PinControls'

/**
 * "Nome do local" no painel do pino: sete "?" iguais no mapa do crime, e o
 * mestre escreve "Faca" num deles para achar depois. Desde 09/10/2026 é também
 * o título que o jogador lê no painel da revelação (antes era "Nome (só
 * mestre)"), e a "Nota do mestre" do pino saiu.
 */

describe('PinControls: nome do local', () => {
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

  function render(extra: Partial<PinControlsProps>): void {
    const props: PinControlsProps = {
      kind: 'interrogacao',
      onKindChange: () => {},
      description: 'Uma lâmina suja de sangue.',
      onDescriptionChange: () => {},
      locked: false,
      onLockedChange: () => {},
      marco: false,
      onMarcoChange: () => {},
      lerDePerto: null,
      onLerDePertoChange: () => {},
      image: null,
      onChooseImage: () => {},
      onClearImage: () => {},
      onDelete: () => {},
      iconChoice: null,
      ...extra,
    }
    act(() => root.render(<PinControls {...props} />))
  }

  function campoNome(): HTMLInputElement | null {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === 'Nome do local')
    const id = label?.getAttribute('for')
    const input = id ? document.getElementById(id) : null
    return input instanceof HTMLInputElement ? input : null
  }

  function digitar(input: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('mostra o nome gravado, sem o aviso antigo de que o jogador não o lê', () => {
    render({ nome: 'Faca', onNomeChange: () => {} })
    const campo = campoNome()
    expect(campo?.value).toBe('Faca')
    expect(campo?.hasAttribute('aria-describedby')).toBe(false)
    expect(container.textContent).not.toMatch(/não veem o nome|só mestre/i)
  })

  it('a nota do mestre do pino saiu; a descrição continua começando por "Descrição"', () => {
    render({ nome: 'Faca', onNomeChange: () => {} })
    const rotulos = Array.from(container.querySelectorAll('label')).map((l) => l.textContent ?? '')
    expect(rotulos.some((t) => /nota do mestre|só eu leio/i.test(t))).toBe(false)
    expect(rotulos.filter((t) => /descri/i.test(t))).toHaveLength(1)
    expect(rotulos.find((t) => /descri/i.test(t))).toMatch(/^Descrição/)
    expect(container.querySelectorAll('textarea')).toHaveLength(1)
  })

  it('escrever no campo manda o nome novo', () => {
    const onNomeChange = vi.fn()
    render({ nome: '', onNomeChange })
    const campo = campoNome()
    if (campo === null) throw new Error('sem campo de nome')
    digitar(campo, 'Faca')
    expect(onNomeChange).toHaveBeenLastCalledWith('Faca')
  })

  it('sem pino selecionado, não há campo de nome', () => {
    render({ description: null, nome: '', onNomeChange: () => {} })
    expect(campoNome()).toBeNull()
    expect(container.textContent).not.toContain('Nome do local')
  })
})

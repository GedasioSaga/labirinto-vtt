import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerWhereAmI } from './PlayerWhereAmI'
import type { WhereAmI } from './whereAmI'

describe('PlayerWhereAmI (faixa "Onde estou")', () => {
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

  function render(where: WhereAmI | null, showTokenName: boolean, onFocus: (tokenId: string) => void): void {
    act(() => root.render(<PlayerWhereAmI where={where} showTokenName={showTokenName} onFocus={onFocus} />))
  }

  function faixa(): HTMLButtonElement {
    const found = container.querySelector('button')
    if (!found) throw new Error('sem a faixa')
    return found
  }

  const noFarol: WhereAmI = { tokenId: 'ana', tokenName: 'Ana', trail: ['Farol', 'Farol, piso 5', 'Sala do Faroleiro'] }

  it('um botão de verdade com o caminho prédio › piso › cômodo', () => {
    render(noFarol, false, () => {})
    const button = faixa()
    expect(button.type).toBe('button')
    expect(button.textContent).toBe('Farol›Farol, piso 5›Sala do Faroleiro')
    expect(button.getAttribute('aria-label')).toBe('Onde estou: Farol › Farol, piso 5 › Sala do Faroleiro. Centralizar Ana')
    // O cômodo é o destaque: é ele que muda a cada passo.
    expect(button.querySelector('.pp-where__step--here')?.textContent).toBe('Sala do Faroleiro')
  })

  it('tocar na faixa centraliza a ficha que ela acompanha', () => {
    const onFocus = vi.fn()
    render(noFarol, false, onFocus)
    act(() => faixa().click())
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledWith('ana')
  })

  it('com duas fichas, diz de qual ficha é o caminho', () => {
    render(noFarol, true, () => {})
    expect(faixa().querySelector('.pp-where__who')?.textContent).toBe('Ana')
    render(noFarol, false, () => {})
    expect(faixa().querySelector('.pp-where__who')).toBeNull()
  })

  it('fora de toda Sala: "Fora das salas", e o toque continua centralizando', () => {
    const onFocus = vi.fn()
    render({ tokenId: 'ana', tokenName: 'Ana', trail: [] }, false, onFocus)
    expect(faixa().textContent).toBe('Fora das salas')
    act(() => faixa().click())
    expect(onFocus).toHaveBeenCalledWith('ana')
  })

  it('sem ficha no mapa: a faixa não aparece (nada clicável sem efeito)', () => {
    render(null, false, () => {})
    expect(container.querySelector('button')).toBeNull()
    expect(container.childElementCount).toBe(0)
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { TokenPersonagemControls } from './TokenPersonagemControls'

/** "Personagem" do token: liga o token ao personagem da aventura e abre a ficha dele. */

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const PERSONAGENS = [
  { id: 'p-aira', nome: 'Aira' },
  { id: 'p-vagn', nome: 'Vagn Kane' },
]

function escolher(select: HTMLSelectElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  act(() => {
    setter?.call(select, valor)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('TokenPersonagemControls', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function select(): HTMLSelectElement {
    const achado = container.querySelector('select')
    if (achado === null) throw new Error('o seletor deveria existir')
    return achado
  }

  it('sem personagem: o seletor diz isso e escolher liga', () => {
    const onLigar = vi.fn()
    act(() => root.render(<TokenPersonagemControls characterId={null} personagens={PERSONAGENS} onLigar={onLigar} onAbrirFicha={vi.fn()} />))
    expect(select().value).toBe('')
    expect(container.querySelector('label')?.textContent).toBe('Personagem')
    expect(container.textContent).not.toContain('Abrir ficha')
    escolher(select(), 'p-vagn')
    expect(onLigar).toHaveBeenCalledWith('p-vagn')
  })

  it('ligado: mostra o personagem, abre a ficha e desliga com "sem personagem"', () => {
    const onLigar = vi.fn()
    const onAbrirFicha = vi.fn()
    act(() => root.render(<TokenPersonagemControls characterId="p-aira" personagens={PERSONAGENS} onLigar={onLigar} onAbrirFicha={onAbrirFicha} />))
    expect(select().value).toBe('p-aira')
    const abrir = Array.from(container.querySelectorAll('button')).find((botao) => botao.textContent === 'Abrir ficha')
    act(() => abrir?.click())
    expect(onAbrirFicha).toHaveBeenCalledWith('p-aira')
    escolher(select(), '')
    expect(onLigar).toHaveBeenCalledWith(null)
  })

  it('personagem apagado da aventura: aparece como sem personagem, com o aviso ligado ao campo', () => {
    act(() => root.render(<TokenPersonagemControls characterId="p-sumiu" personagens={PERSONAGENS} onLigar={vi.fn()} onAbrirFicha={vi.fn()} />))
    expect(select().value).toBe('')
    const avisoId = select().getAttribute('aria-describedby')
    expect(avisoId === null ? null : document.getElementById(avisoId)?.textContent).toContain('foi apagado')
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEXT_TURN_SHORTCUT } from '../lib/keymap'
import { InitiativeSection, type InitiativeSectionProps } from './InitiativeSection'

const FICHAS = [
  { id: 'lanterna', name: 'Lanterna' },
  { id: 'machado', name: 'Machado' },
  { id: 'goblin', name: 'Goblin' },
  { id: 'vulto', name: 'Vulto' },
]

describe('InitiativeSection (aba Jogo)', () => {
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

  function render(overrides: Partial<InitiativeSectionProps> = {}): InitiativeSectionProps {
    const props: InitiativeSectionProps = {
      tokens: FICHAS,
      values: {},
      turnTokenId: null,
      onValueChange: vi.fn(),
      onStart: vi.fn(),
      onNext: vi.fn(),
      onStop: vi.fn(),
      ...overrides,
    }
    act(() => root.render(<InitiativeSection {...props} />))
    return props
  }

  function secao(): HTMLElement {
    const heading = Array.from(container.querySelectorAll('h3')).find((h) => h.textContent === 'Iniciativa')
    const section = heading?.closest('section')
    if (!section || section.getAttribute('aria-labelledby') !== heading?.id) throw new Error('sem região "Iniciativa"')
    return section
  }

  function campo(nome: string): HTMLInputElement {
    const input = secao().querySelector<HTMLInputElement>(`input[aria-label="Iniciativa de ${nome}"]`)
    if (!input) throw new Error(`sem campo "Iniciativa de ${nome}"`)
    return input
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(secao().querySelectorAll('button')).find((b) => b.textContent?.trim() === nome)
  }

  function digitar(input: HTMLInputElement, texto: string): void {
    act(() => {
      input.focus()
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, texto)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('é uma região "Iniciativa" com um campo numérico por ficha da cena, secreta inclusive', () => {
    render()
    for (const f of FICHAS) {
      const input = campo(f.name)
      expect(input.type).toBe('number')
    }
  })

  it('o valor vale ao sair do campo; vazio tira a ficha; lixo não sai e avisa', () => {
    const props = render()
    const input = campo('Machado')
    digitar(input, '17')
    expect(props.onValueChange).not.toHaveBeenCalled()
    act(() => input.blur())
    expect(props.onValueChange).toHaveBeenCalledWith('machado', 17)

    const outro = render({ values: { machado: 17 } })
    const m = campo('Machado')
    digitar(m, '')
    act(() => m.blur())
    expect(outro.onValueChange).toHaveBeenCalledWith('machado', null)
  })

  it('Enter também confirma o valor', () => {
    const props = render()
    const input = campo('Goblin')
    digitar(input, '5')
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(props.onValueChange).toHaveBeenCalledWith('goblin', 5)
  })

  it('a lista "Ordem de iniciativa" vai do maior para o menor, com o valor, e sem quem não tem valor', () => {
    render({ values: { lanterna: 12, machado: 17, goblin: 5 } })
    const lista = secao().querySelector('[aria-label="Ordem de iniciativa"]')
    expect(lista?.tagName).toBe('OL')
    const itens = Array.from(lista?.querySelectorAll('li') ?? []).map((li) => li.textContent ?? '')
    expect(itens).toHaveLength(3)
    expect(itens[0]).toContain('Machado')
    expect(itens[0]).toContain('17')
    expect(itens[1]).toContain('Lanterna')
    expect(itens[2]).toContain('Goblin')
    expect(itens.join(' ')).not.toContain('Vulto')
  })

  it('antes de começar: "Começar" põe a vez no primeiro; ninguém marcado como a vez', () => {
    const props = render({ values: { lanterna: 12, machado: 17 } })
    expect(secao().querySelectorAll('[aria-current]')).toHaveLength(0)
    expect(botao('Próxima vez')).toBeUndefined()
    const comecar = botao('Começar')
    act(() => comecar?.click())
    expect(props.onStart).toHaveBeenCalledTimes(1)
  })

  it('sem valor nenhum não há o que começar: a seção diz como montar a ordem', () => {
    render()
    expect(botao('Começar')).toBeUndefined()
    expect(secao().textContent).toContain('Dê um valor')
  })

  it('começada: só a entrada da vez tem aria-current; "Próxima vez" anuncia a tecla; "Encerrar" tira a vez', () => {
    const props = render({ values: { lanterna: 12, machado: 17, goblin: 5 }, turnTokenId: 'lanterna' })
    const atuais = Array.from(secao().querySelectorAll('li[aria-current]'))
    expect(atuais).toHaveLength(1)
    expect(atuais[0]?.getAttribute('aria-current')).toBe('true')
    expect(atuais[0]?.textContent).toContain('Lanterna')
    expect(botao('Começar')).toBeUndefined()

    const proxima = botao('Próxima vez')
    expect(proxima?.getAttribute('aria-keyshortcuts')).toBe(NEXT_TURN_SHORTCUT)
    act(() => proxima?.click())
    expect(props.onNext).toHaveBeenCalledTimes(1)

    act(() => botao('Encerrar')?.click())
    expect(props.onStop).toHaveBeenCalledTimes(1)
  })

  it('cena sem fichas: diz que não há ficha, sem campo nenhum', () => {
    render({ tokens: [] })
    expect(secao().querySelectorAll('input')).toHaveLength(0)
    expect(secao().textContent).toContain('Nenhuma ficha nesta cena')
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEVAR_JUNTO_HINT, LEVAR_JUNTO_SEM_FICHA, TokenCarryControls } from './TokenCarryControls'

/**
 * LEVAR FICHA JUNTO, lado do PAINEL do mestre: com o ferido selecionado, o
 * mestre escolhe de quem ele vai junto (a ficha mais perto primeiro); preso,
 * o painel diz com quem ele vai e um botão o solta. Selecionada a ficha que
 * LEVA, o painel lista quem vai com ela, cada um com o seu "Soltar".
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

function seletor(): HTMLSelectElement {
  const select = container.querySelector('select')
  if (!(select instanceof HTMLSelectElement)) throw new Error('sem a lista "Vai junto de"')
  return select
}

function botao(nome: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão "${nome}"`)
  return achado
}

const ANA = { id: 'ana', name: 'Ana' }
const BRUNO = { id: 'bruno', name: 'Bruno' }

describe('TokenCarryControls', () => {
  it('ficha solta: a lista tem rótulo, começa sem escolha e traz as fichas na ordem dada', () => {
    render(<TokenCarryControls tokenId="ferido" carrier={null} carried={[]} candidates={[ANA, BRUNO]} onCarry={vi.fn()} onRelease={vi.fn()} />)
    const select = seletor()
    expect(select.labels?.[0]?.textContent).toBe('Vai junto de')
    expect(select.value).toBe('')
    expect([...select.options].map((o) => o.textContent)).toEqual(['Ninguém', 'Ana', 'Bruno'])
    // A frase de para que serve continua ligada à lista (a dica sob demanda a mostra num balão).
    expect(document.getElementById(select.getAttribute('aria-describedby') ?? 'sem-id')?.textContent).toBe(LEVAR_JUNTO_HINT)
  })

  it('solta, é UMA linha: rótulo e lista lado a lado, sem título de bloco', () => {
    render(<TokenCarryControls tokenId="ferido" carrier={null} carried={[]} candidates={[ANA]} onCarry={vi.fn()} onRelease={vi.fn()} />)
    expect(container.querySelector('h2')).toBeNull()
    const linha = seletor().closest('.lb-token-par')
    expect(linha?.querySelector('label')?.textContent).toBe('Vai junto de')
  })

  it('escolher a Ana prende o ferido a ela', () => {
    const onCarry = vi.fn()
    render(<TokenCarryControls tokenId="ferido" carrier={null} carried={[]} candidates={[ANA, BRUNO]} onCarry={onCarry} onRelease={vi.fn()} />)
    const select = seletor()
    act(() => {
      select.value = 'ana'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onCarry).toHaveBeenCalledWith('ana')
  })

  it('preso: diz com quem vai, e "Soltar" solta ESTA ficha', () => {
    const onRelease = vi.fn()
    render(<TokenCarryControls tokenId="ferido" carrier={ANA} carried={[]} candidates={[ANA, BRUNO]} onCarry={vi.fn()} onRelease={onRelease} />)
    expect(container.textContent).toContain('Vai junto de Ana')
    expect(container.querySelector('select')).toBeNull()
    act(() => botao('Soltar').click())
    expect(onRelease).toHaveBeenCalledWith('ferido')
  })

  it('a ficha que leva: lista quem vai com ela e solta um de cada vez', () => {
    const onRelease = vi.fn()
    const levados = [{ id: 'ferido', name: 'Ferido' }, { id: 'npc', name: 'Escoltado' }]
    render(<TokenCarryControls tokenId="ana" carrier={null} carried={levados} candidates={[]} onCarry={vi.fn()} onRelease={onRelease} />)
    expect(container.textContent).toContain('Leva junto')
    act(() => botao('Soltar Escoltado').click())
    expect(onRelease).toHaveBeenCalledWith('npc')
    expect(container.querySelector('select')).toBeNull()
  })

  it('sem outra ficha na cena: a linha fica, apagada, com o motivo escrito no lugar da lista — e nada clicável', () => {
    render(<TokenCarryControls tokenId="ferido" carrier={null} carried={[]} candidates={[]} onCarry={vi.fn()} onRelease={vi.fn()} />)
    expect(container.querySelector('select')).toBeNull()
    expect(container.querySelectorAll('button')).toHaveLength(0)
    const linha = container.querySelector('.lb-token-par--vazio')
    expect(linha?.textContent).toContain('Vai junto de')
    expect(linha?.textContent).toContain(LEVAR_JUNTO_SEM_FICHA)
    expect(container.querySelector('h2')).toBeNull()
  })
})

/**
 * No arrasto, o painel re-renderiza a cada pointermove com uma lista NOVA
 * (arrays e objetos novos), quase sempre igual à anterior. As <option> só são
 * refeitas quando a lista muda de verdade; estes casos provam que ela nunca
 * fica velha.
 */
describe('TokenCarryControls: a lista re-renderizada', () => {
  function textos(): string[] {
    return [...seletor().options].map((o) => o.textContent ?? '')
  }

  function solta(candidates: { id: string; name: string }[]) {
    render(<TokenCarryControls tokenId="ferido" carrier={null} carried={[]} candidates={candidates} onCarry={vi.fn()} onRelease={vi.fn()} />)
  }

  it('acompanha a ordem nova: a ficha andou e outra ficou mais perto', () => {
    solta([ANA, BRUNO])
    solta([{ ...BRUNO }, { ...ANA }])
    expect(textos()).toEqual(['Ninguém', 'Bruno', 'Ana'])
    expect([...seletor().options].map((o) => o.value)).toEqual(['', 'bruno', 'ana'])
  })

  it('renomear uma ficha troca o texto da opção, com os mesmos ids na mesma ordem', () => {
    solta([ANA, BRUNO])
    solta([{ id: 'ana', name: 'Ana Clara' }, { ...BRUNO }])
    expect(textos()).toEqual(['Ninguém', 'Ana Clara', 'Bruno'])
  })

  it('a mesma lista em objetos novos mantém as mesmas opções, e escolher continua prendendo', () => {
    solta([ANA, BRUNO])
    const antes = [...seletor().options]
    const onCarry = vi.fn()
    render(<TokenCarryControls tokenId="ferido" carrier={null} carried={[]} candidates={[{ ...ANA }, { ...BRUNO }]} onCarry={onCarry} onRelease={vi.fn()} />)
    const depois = [...seletor().options]
    expect(textos()).toEqual(['Ninguém', 'Ana', 'Bruno'])
    expect(depois.every((opcao, i) => opcao === antes[i])).toBe(true)
    act(() => {
      seletor().value = 'bruno'
      seletor().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onCarry).toHaveBeenCalledWith('bruno')
  })

  it('ficha que entra ou sai da cena entra ou sai da lista', () => {
    solta([ANA])
    solta([{ ...ANA }, BRUNO])
    expect(textos()).toEqual(['Ninguém', 'Ana', 'Bruno'])
    solta([{ ...BRUNO }])
    expect(textos()).toEqual(['Ninguém', 'Bruno'])
  })
})

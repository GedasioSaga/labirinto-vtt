import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EstadoDoMundo } from '../lib/estadoDoMundo'
import { WorldStateSection, type ResumoDaTroca } from './WorldStateSection'

const MARE: EstadoDoMundo = { id: 'mare', nome: 'Maré', valores: ['alta', 'baixa'], atual: 'alta' }
const GIRO: EstadoDoMundo = { id: 'giro', nome: 'Giro', valores: ['1', '2', '3'], atual: '2' }

describe('WorldStateSection: o painel "Estado do mundo" do mestre', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  interface Opcoes {
    estados?: readonly EstadoDoMundo[]
    amarrados?: ReadonlyMap<string, number>
    onCriar?: (nome: string, valores: string) => string | null
    onTrocar?: (estadoId: string, valor: string) => ResumoDaTroca | null
  }

  function render(o: Opcoes = {}): void {
    act(() =>
      root.render(
        <WorldStateSection
          estados={o.estados ?? [MARE, GIRO]}
          amarrados={o.amarrados ?? new Map([['mare', 5]])}
          onCriar={o.onCriar ?? (() => 'novo')}
          onTrocar={o.onTrocar ?? (() => ({ elementos: 0, cenas: 0 }))}
        />,
      ),
    )
  }

  function botao(nome: string): HTMLButtonElement {
    const b = Array.from(container.querySelectorAll('button')).find((el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === nome)
    if (b === undefined) throw new Error(`sem botão "${nome}"`)
    return b
  }

  function abrir(): void {
    act(() => botao('Estado do mundo').click())
  }

  function radio(grupo: string, valor: string): HTMLInputElement {
    const fieldset = Array.from(container.querySelectorAll('fieldset')).find((f) => f.querySelector('legend')?.textContent?.startsWith(grupo))
    const input = Array.from(fieldset?.querySelectorAll<HTMLInputElement>('input[type=radio]') ?? []).find((r) => r.value === valor)
    if (input === undefined) throw new Error(`sem opção ${grupo}=${valor}`)
    return input
  }

  function campo(rotulo: string): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.startsWith(rotulo))
    const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null
    if (!(input instanceof HTMLInputElement)) throw new Error(`sem campo "${rotulo}"`)
    return input
  }

  function digita(alvo: HTMLInputElement, texto: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function status(): string {
    return container.querySelector('[role="status"]')?.textContent ?? ''
  }

  it('lista cada estado com os valores como opções, o atual marcado, e quantos elementos obedecem a ele', () => {
    render()
    abrir()
    expect(radio('Maré', 'alta').checked).toBe(true)
    expect(radio('Maré', 'baixa').checked).toBe(false)
    expect(radio('Giro', '2').checked).toBe(true)
    expect(container.textContent).toContain('5 elementos amarrados')
    expect(container.textContent).toContain('Nada amarrado ainda')
  })

  it('um toque no valor troca o estado e diz o que mudou em quantas cenas', () => {
    const onTrocar = vi.fn(() => ({ elementos: 4, cenas: 2 }))
    render({ onTrocar })
    abrir()
    act(() => radio('Maré', 'baixa').click())
    expect(onTrocar).toHaveBeenCalledWith('mare', 'baixa')
    expect(status()).toBe('Maré: baixa. 4 elementos mudaram em 2 cenas.')
  })

  it('troca sem nada para mudar avisa em vez de ficar muda', () => {
    render({ onTrocar: () => ({ elementos: 0, cenas: 0 }) })
    abrir()
    act(() => radio('Maré', 'baixa').click())
    expect(status()).toBe('Maré: baixa. Nenhum elemento mudou.')
  })

  it('"Novo estado": nome e valores separados por vírgula criam o estado', () => {
    const onCriar = vi.fn(() => 'energia')
    render({ onCriar })
    abrir()
    act(() => botao('Novo estado').click())
    digita(campo('Nome'), 'Energia')
    digita(campo('Valores'), 'ligada, cortada')
    act(() => botao('Criar').click())
    expect(onCriar).toHaveBeenCalledWith('Energia', 'ligada, cortada')
    expect(status()).toBe('Estado "Energia" criado.')
    // O formulário fecha depois de criar.
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Criar')).toBe(false)
  })

  it('enviar sem nome marca o campo, diz o que falta e põe o foco nele; nada é criado', () => {
    const onCriar = vi.fn(() => 'x')
    render({ onCriar })
    abrir()
    act(() => botao('Novo estado').click())
    act(() => botao('Criar').click())
    expect(onCriar).not.toHaveBeenCalled()
    const nome = campo('Nome')
    expect(nome.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(nome)
    expect(container.textContent).toContain('Dê um nome ao estado')
  })

  it('sem nenhum estado, a seção explica o que é e oferece criar', () => {
    render({ estados: [], amarrados: new Map() })
    abrir()
    expect(container.textContent).toContain('Nenhum estado ainda')
    expect(botao('Novo estado')).toBeDefined()
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PARTY_CENTER_LABEL, type PartyDestination } from '../lib/party'
import { CARRY_FAILED, CARRY_OWNED_HINT, CARRY_TO_LABEL, TokenCarryControls } from './TokenCarryControls'

/*
 * O painel da ficha selecionada ganha "Levar para…" quando ela não tem dono:
 * o mestre muda o zumbi de cena sem apagar e recriar (e perder nome, cor e
 * foto). Ficha de jogador não ganha: quem a leva é o "Mandar para…" do Grupo,
 * que também avisa o jogador e a sessão.
 */

const DESTINOS: PartyDestination[] = [
  { sceneId: 's-terreo', name: 'Térreo', arrivals: [{ pinId: 'alcapao', label: 'Alçapão' }] },
  { sceneId: 's-sotao', name: 'Sótão', arrivals: [] },
]

describe('TokenCarryControls', () => {
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

  function render(props: { owned?: boolean; destinations?: PartyDestination[]; onCarry?: (sceneId: string, pinId: string | null) => boolean }): void {
    act(() =>
      root.render(<TokenCarryControls tokenName="Zumbi" owned={props.owned ?? false} destinations={props.destinations ?? DESTINOS} onCarry={props.onCarry ?? (() => true)} />),
    )
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => b.textContent === nome)
  }

  function escolher(select: HTMLSelectElement, valor: string): void {
    act(() => {
      select.value = valor
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('ficha sem dono: "Levar para…" abre cena e chegada, e "Levar" leva ao alçapão escolhido', () => {
    const onCarry = vi.fn(() => true)
    render({ onCarry })
    const abrir = botao(CARRY_TO_LABEL)
    expect(abrir?.getAttribute('aria-expanded')).toBe('false')
    act(() => abrir?.click())
    expect(abrir?.getAttribute('aria-expanded')).toBe('true')

    const form = container.querySelector('form')
    expect(form?.getAttribute('aria-label')).toBe('Levar Zumbi para outra cena')
    const [cena, chegada] = Array.from(container.querySelectorAll('select'))
    if (cena === undefined || chegada === undefined) throw new Error('faltam as listas de cena e chegada')
    // O foco vai para a primeira escolha: teclado e leitor de tela começam por ela.
    expect(document.activeElement).toBe(cena)
    expect(Array.from(cena.options).map((o) => o.textContent)).toEqual(['Térreo', 'Sótão'])
    expect(Array.from(chegada.options).map((o) => o.textContent)).toEqual([PARTY_CENTER_LABEL, 'Alçapão'])

    escolher(chegada, 'alcapao')
    act(() => botao('Levar')?.click())
    expect(onCarry).toHaveBeenCalledWith('s-terreo', 'alcapao')
    expect(onCarry).toHaveBeenCalledTimes(1)
    expect(container.querySelector('form')).toBeNull()
  })

  it('trocar de cena volta a chegada ao centro: o pino escolhido era da outra cena', () => {
    const onCarry = vi.fn(() => true)
    render({ onCarry })
    act(() => botao(CARRY_TO_LABEL)?.click())
    const [cena, chegada] = Array.from(container.querySelectorAll('select'))
    if (cena === undefined || chegada === undefined) throw new Error('faltam as listas de cena e chegada')
    escolher(chegada, 'alcapao')
    escolher(cena, 's-sotao')
    act(() => botao('Levar')?.click())
    expect(onCarry).toHaveBeenCalledWith('s-sotao', null)
  })

  it('não deu (a cena ou a ficha mudou): o formulário fica aberto com o aviso', () => {
    render({ onCarry: () => false })
    act(() => botao(CARRY_TO_LABEL)?.click())
    act(() => botao('Levar')?.click())
    expect(container.querySelector('form')).not.toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(CARRY_FAILED)
  })

  it('Esc fecha sem levar e não chega ao canvas', () => {
    const onCarry = vi.fn(() => true)
    render({ onCarry })
    act(() => botao(CARRY_TO_LABEL)?.click())
    const form = container.querySelector('form')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      form?.dispatchEvent(esc)
    })
    expect(esc.defaultPrevented).toBe(true)
    expect(container.querySelector('form')).toBeNull()
    expect(onCarry).not.toHaveBeenCalled()
  })

  it('ficha de jogador não ganha "Levar para…": o painel aponta o "Mandar para…" do Grupo', () => {
    render({ owned: true })
    expect(botao(CARRY_TO_LABEL)).toBeUndefined()
    expect(container.textContent).toContain(CARRY_OWNED_HINT)
  })

  it('sem outra cena (mapa solto ou aventura de uma cena só) não há nada a mostrar', () => {
    render({ destinations: [] })
    expect(container.innerHTML).toBe('')
  })
})

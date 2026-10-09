/**
 * MARCAÇÕES no painel do jogador: "Marcar destino", "Anotar" e "Deixar marca
 * aqui…" num menu só, atrás de um botão. Menu de verdade: foco no primeiro
 * item, setas com volta, Escape fecha e devolve o foco (sem chegar à janela,
 * que fecharia a gaveta), escolher fecha.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerMarcacoes, type PlayerMarcacoesProps } from './PlayerMarcacoes'

describe('PlayerMarcacoes', () => {
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

  function render(props: PlayerMarcacoesProps): void {
    act(() => root.render(<PlayerMarcacoes {...props} />))
  }

  function todas(over: Partial<PlayerMarcacoesProps> = {}): PlayerMarcacoesProps {
    return {
      destination: { armed: false, has: false, onToggle: vi.fn(), onClear: vi.fn() },
      note: { armed: false, onToggle: vi.fn() },
      markForm: { result: undefined, onPlace: vi.fn(), onClose: vi.fn() },
      ...over,
    }
  }

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === texto)
    if (!achado) throw new Error(`sem o botão "${texto}"`)
    return achado
  }

  const menu = () => container.querySelector('[role="menu"]')
  const itens = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))

  function tecla(key: string): KeyboardEvent {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    act(() => {
      document.activeElement?.dispatchEvent(evento)
    })
    return evento
  }

  it('fechado: só o botão "Marcações"; os três modos não ficam soltos no painel', () => {
    render(todas())
    expect(Array.from(container.querySelectorAll('button')).map((b) => (b.textContent ?? '').trim())).toEqual(['Marcações'])
    expect(botao('Marcações').getAttribute('aria-haspopup')).toBe('menu')
    expect(botao('Marcações').getAttribute('aria-expanded')).toBe('false')
  })

  it('abre o menu com Marcar destino, Anotar e Deixar marca aqui…, com o foco no primeiro', () => {
    render(todas())
    act(() => botao('Marcações').click())
    expect(botao('Marcações').getAttribute('aria-expanded')).toBe('true')
    expect(menu()?.getAttribute('aria-label')).toBe('Marcações')
    expect(itens().map((b) => b.textContent)).toEqual(['Marcar destino', 'Anotar', 'Deixar marca aqui…'])
    expect(document.activeElement).toBe(itens()[0])
  })

  it('com destino no mapa: "Mudar destino" e "Tirar marca"; ligado, o item vira "Cancelar"', () => {
    render(todas({ destination: { armed: false, has: true, onToggle: vi.fn(), onClear: vi.fn() }, note: { armed: true, onToggle: vi.fn() } }))
    act(() => botao('Marcações').click())
    expect(itens().map((b) => b.textContent)).toEqual(['Mudar destino', 'Tirar marca', 'Cancelar nota', 'Deixar marca aqui…'])
    // O modo ligado diz, embaixo do botão, para onde o dedo vai.
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Toque onde anotar. Só você vê. Esc sai.')
  })

  it('escolher roda o modo e fecha o menu', () => {
    const p = todas()
    render(p)
    act(() => botao('Marcações').click())
    act(() => botao('Anotar').click())
    expect(p.note?.onToggle).toHaveBeenCalledTimes(1)
    expect(menu()).toBeNull()
    act(() => botao('Marcações').click())
    act(() => botao('Marcar destino').click())
    expect(p.destination?.onToggle).toHaveBeenCalledTimes(1)
  })

  it('"Deixar marca aqui…" abre o formulário do bilhete; "Fechar" recolhe e o foco volta a "Marcações"', () => {
    const p = todas()
    render(p)
    act(() => botao('Marcações').click())
    act(() => botao('Deixar marca aqui…').click())
    expect(container.querySelector('form[aria-label="Deixar marca aqui"]')).not.toBeNull()
    act(() => botao('Fechar').click())
    expect(container.querySelector('form')).toBeNull()
    expect(p.markForm?.onClose).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(botao('Marcações'))
  })

  it('setas andam com volta, Home/End vão às pontas; Escape fecha, devolve o foco e não chega à janela', () => {
    render(todas())
    act(() => botao('Marcações').click())
    tecla('ArrowUp')
    expect(document.activeElement).toBe(itens()[2])
    tecla('ArrowDown')
    expect(document.activeElement).toBe(itens()[0])
    tecla('End')
    expect(document.activeElement).toBe(itens()[2])
    tecla('Home')
    expect(document.activeElement).toBe(itens()[0])
    const naJanela = vi.fn()
    window.addEventListener('keydown', naJanela)
    try {
      tecla('Escape')
    } finally {
      window.removeEventListener('keydown', naJanela)
    }
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(botao('Marcações'))
    expect(naJanela).not.toHaveBeenCalled()
  })

  it('pelo teclado o menu aparece na hora; pelo dedo ou mouse, com a entrada curta', () => {
    render(todas())
    act(() => botao('Marcações').click())
    expect(menu()?.classList.contains('pp-marcacoes__menu--instant')).toBe(true)
    act(() => botao('Marcações').click())
    act(() => {
      botao('Marcações').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
    expect(menu()?.classList.contains('pp-marcacoes__menu--instant')).toBe(false)
  })

  it('tocar fora fecha o menu sem escolher nada', () => {
    const p = todas()
    render(p)
    act(() => botao('Marcações').click())
    act(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    expect(menu()).toBeNull()
    expect(p.note?.onToggle).not.toHaveBeenCalled()
  })

  it('tela sem nenhum dos três (teste, tela antiga): nem o botão aparece', () => {
    render({})
    expect(container.querySelector('button')).toBeNull()
  })
})

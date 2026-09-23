import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionBar, type ActionBarProps } from './ActionBar'

function makeProps(hasBackgroundImage: boolean): ActionBarProps {
  return {
    onSave: vi.fn(),
    onOpen: vi.fn(),
    onImportBackground: vi.fn(),
    onExportFolder: vi.fn(),
    onImportFolder: vi.fn(),
    onGoHome: vi.fn(),
    hasBackgroundImage,
    onFloorFromBackground: vi.fn(),
    onDetailsFromBackground: vi.fn(),
    onRecreateMinimapFromBackground: vi.fn(),
  }
}

describe('ActionBar / menu da imagem de fundo', () => {
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
    vi.restoreAllMocks()
  })

  const render = (props: ActionBarProps) => act(() => root.render(<ActionBar {...props} />))
  const button = (label: string) => {
    const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
    if (!found) throw new Error(`botão "${label}" ausente`)
    return found
  }
  const menu = () => container.querySelector<HTMLElement>('[role="menu"]')
  const items = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  const itemNamed = (name: string) => {
    const found = items().find((item) => item.querySelector('.lb-actionbar-menu__label')?.textContent === name)
    if (!found) throw new Error(`item "${name}" ausente`)
    return found
  }
  const click = (element: HTMLElement) => act(() => element.click())
  const press = (element: Element, key: string) =>
    act(() => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })

  it('sem imagem de fundo: o botão importa direto e não abre menu', () => {
    const props = makeProps(false)
    render(props)
    const trigger = button('Importar imagem de fundo')
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false)
    expect(trigger.hasAttribute('aria-expanded')).toBe(false)

    click(trigger)

    expect(props.onImportBackground).toHaveBeenCalledTimes(1)
    expect(menu()).toBeNull()
  })

  it('com imagem de fundo: o clique abre o menu com 4 itens descritos e foco no primeiro', () => {
    const props = makeProps(true)
    render(props)
    const trigger = button('Imagem de fundo e conversão')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    click(trigger)

    expect(props.onImportBackground).not.toHaveBeenCalled()
    expect(menu()).not.toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-controls')).toBe(menu()?.id)
    expect(items().map((item) => item.querySelector('.lb-actionbar-menu__label')?.textContent)).toEqual([
      'Trocar imagem de fundo',
      'Chão a partir da imagem',
      'Linhas e portas a partir da imagem',
      'Recriar minimapa completo',
    ])
    for (const item of items()) {
      const labelId = item.getAttribute('aria-labelledby')
      const descriptionId = item.getAttribute('aria-describedby')
      expect(labelId && document.getElementById(labelId)?.textContent).toBeTruthy()
      expect(descriptionId && document.getElementById(descriptionId)?.textContent).toBeTruthy()
    }
    expect(document.activeElement).toBe(items()[0])
  })

  it.each([
    ['Trocar imagem de fundo', 'onImportBackground'],
    ['Chão a partir da imagem', 'onFloorFromBackground'],
    ['Linhas e portas a partir da imagem', 'onDetailsFromBackground'],
    ['Recriar minimapa completo', 'onRecreateMinimapFromBackground'],
  ] as const)('item "%s" chama só %s, fecha o menu e devolve o foco', (label, callback) => {
    const props = makeProps(true)
    render(props)
    const trigger = button('Imagem de fundo e conversão')
    click(trigger)

    click(itemNamed(label))

    const callbacks = [
      'onImportBackground',
      'onFloorFromBackground',
      'onDetailsFromBackground',
      'onRecreateMinimapFromBackground',
    ] as const
    for (const name of callbacks) {
      expect(props[name]).toHaveBeenCalledTimes(name === callback ? 1 : 0)
    }
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('Esc fecha o menu, devolve o foco ao botão e não chega aos atalhos da janela', () => {
    const props = makeProps(true)
    render(props)
    const trigger = button('Imagem de fundo e conversão')
    click(trigger)
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)

    press(items()[0], 'Escape')

    window.removeEventListener('keydown', onWindowKey)
    expect(menu()).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
    expect(onWindowKey).not.toHaveBeenCalled()
  })

  it('setas, Home e End navegam entre os itens em ciclo', () => {
    render(makeProps(true))
    click(button('Imagem de fundo e conversão'))
    const [first, second, , last] = items()

    press(first, 'ArrowDown')
    expect(document.activeElement).toBe(second)
    press(second, 'ArrowUp')
    expect(document.activeElement).toBe(first)
    press(first, 'ArrowUp')
    expect(document.activeElement).toBe(last)
    press(last, 'ArrowDown')
    expect(document.activeElement).toBe(first)
    press(first, 'End')
    expect(document.activeElement).toBe(last)
    press(last, 'Home')
    expect(document.activeElement).toBe(first)
  })

  it('clicar de novo no botão ou fora do menu fecha', () => {
    render(makeProps(true))
    const trigger = button('Imagem de fundo e conversão')
    click(trigger)
    click(trigger)
    expect(menu()).toBeNull()

    click(trigger)
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(menu()).toBeNull()
  })

  it('botão de atalhos: abre a tela de atalhos e diz que abre uma janela', () => {
    const onShowShortcuts = vi.fn()
    render({ ...makeProps(false), onShowShortcuts })
    const help = button('Atalhos do teclado (?)')
    expect(help.getAttribute('data-tip')).toBe('Atalhos do teclado (?)')
    expect(help.getAttribute('aria-haspopup')).toBe('dialog')
    expect(help.getAttribute('aria-expanded')).toBe('false')

    click(help)

    expect(onShowShortcuts).toHaveBeenCalledTimes(1)
    render({ ...makeProps(false), onShowShortcuts, shortcutsOpen: true })
    expect(button('Atalhos do teclado (?)').getAttribute('aria-expanded')).toBe('true')
  })

  it('sem quem abra a tela de atalhos, o botão não aparece (controle sem efeito não entra)', () => {
    render(makeProps(false))
    expect(container.querySelector('button[aria-label="Atalhos do teclado (?)"]')).toBeNull()
    // Os outros botões seguem sem anunciar janela nenhuma.
    expect(button('Salvar').hasAttribute('aria-haspopup')).toBe(false)
    expect(button('Salvar').hasAttribute('aria-expanded')).toBe(false)
  })

  it('imagem removida com o menu aberto: o menu some e o botão volta a importar direto', () => {
    const props = makeProps(true)
    render(props)
    click(button('Imagem de fundo e conversão'))
    expect(menu()).not.toBeNull()

    render({ ...props, hasBackgroundImage: false })

    expect(menu()).toBeNull()
    click(button('Importar imagem de fundo'))
    expect(props.onImportBackground).toHaveBeenCalledTimes(1)
    expect(menu()).toBeNull()
  })
})

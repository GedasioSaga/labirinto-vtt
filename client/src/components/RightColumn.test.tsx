import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ChatUnread } from './MasterChatPanel'
import {
  DIVIDER_BIG_STEP_PX,
  DIVIDER_STEP_PX,
  RIGHT_COLUMN_NARROW_PX,
  RightColumn,
  SCENES_DEFAULT_PX,
  SCENES_MIN_PX,
  TABS_MIN_PX,
  useRightColumnOpen,
  type RightColumnTab,
  type RightColumnTabDef,
} from './RightColumn'

/**
 * COLUNA DA DIREITA do mestre: abas Jogo | Chat em cima, Cenas embaixo, o
 * divisor entre as duas (ponteiro e setas, com limites, lembrado), Cenas que
 * recolhe, a coluna que se esconde pelo botão ou por Shift+J (lembrado) e o
 * contador do chat na aba e no botão de reabrir.
 */

const SEM_NOVAS: ChatUnread = { count: 0, mention: false }

interface HarnessProps {
  withTabs?: boolean
  scenesOpen?: boolean
  unread?: ChatUnread
}

function Harness({ withTabs = true, scenesOpen = true, unread = SEM_NOVAS }: HarnessProps) {
  const [open, setOpen] = useRightColumnOpen()
  const [active, setActive] = useState<RightColumnTab>('room')
  const tabs: RightColumnTabDef[] = withTabs
    ? [
        { id: 'room', label: 'Jogo', panel: <p>painel jogo</p> },
        { id: 'chat', label: 'Chat', unread, panel: <p>painel chat</p> },
      ]
    : []
  return (
    <>
      <input aria-label="campo de fora" />
      <RightColumn
        open={open}
        onOpenChange={setOpen}
        tabs={tabs}
        active={active}
        onActiveChange={setActive}
        scenes={<p>lista de cenas</p>}
        scenesOpen={scenesOpen}
        unread={unread}
      />
    </>
  )
}

describe('RightColumn', () => {
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
    window.localStorage.clear()
  })

  const render = (props: HarnessProps = {}) => act(() => root.render(<Harness {...props} />))
  const remount = (props: HarnessProps = {}) => {
    act(() => root.unmount())
    root = createRoot(container)
    render(props)
  }

  const column = () => {
    const found = container.querySelector<HTMLElement>('aside.lb-coldir')
    if (found === null) throw new Error('sem a coluna')
    return found
  }
  const tab = (name: string) => {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((el) => el.textContent?.startsWith(name))
    if (found === undefined) throw new Error(`sem aba ${name}`)
    return found
  }
  const panelOf = (button: HTMLButtonElement) => {
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '')
    if (panel === null) throw new Error('aria-controls sem painel')
    return panel
  }
  const divider = () => container.querySelector<HTMLElement>('[role="separator"]')
  const hideButton = () => container.querySelector<HTMLButtonElement>('button.lb-coldir__esconder')
  const reopenButton = () => container.querySelector<HTMLButtonElement>('button.lb-coldir__reabrir')
  const press = (target: Element, key: string, init: KeyboardEventInit = {}) =>
    act(() => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
    })
  const pointer = (target: Element, type: string, clientY: number) =>
    act(() => {
      target.dispatchEvent(new MouseEvent(type, { clientY, button: 0, bubbles: true, cancelable: true }))
    })
  /** Mede as duas metades como o navegador mediria (o jsdom devolve 0). */
  const measure = (tabsPx: number, scenesPx: number) => {
    const abas = container.querySelector<HTMLElement>('.lb-coldir__abas')
    const cenas = container.querySelector<HTMLElement>('.lb-coldir__cenas')
    if (abas === null || cenas === null) throw new Error('sem as metades')
    Object.defineProperty(abas, 'offsetHeight', { configurable: true, get: () => tabsPx })
    Object.defineProperty(cenas, 'offsetHeight', { configurable: true, get: () => scenesPx })
  }

  describe('abas Jogo | Chat', () => {
    it('começam em Jogo, com o painel do Chat escondido e aria ligado', () => {
      render()
      const list = container.querySelector('[role="tablist"]')
      expect(list?.getAttribute('aria-label')).toBe('Jogo e chat')
      expect(tab('Jogo').getAttribute('aria-selected')).toBe('true')
      expect(tab('Chat').getAttribute('aria-selected')).toBe('false')
      expect(panelOf(tab('Jogo')).hidden).toBe(false)
      expect(panelOf(tab('Chat')).hidden).toBe(true)
      expect(panelOf(tab('Chat')).getAttribute('role')).toBe('tabpanel')
      expect(panelOf(tab('Chat')).getAttribute('aria-labelledby')).toBe(tab('Chat').id)
      // O id do painel Jogo é o de antes: as jornadas e2e acham a aba por ele.
      expect(panelOf(tab('Jogo')).id).toBe('lb-rail-panel-room')
    })

    it('clique troca o painel; os dois ficam montados', () => {
      render()
      act(() => tab('Chat').click())
      expect(tab('Chat').getAttribute('aria-selected')).toBe('true')
      expect(panelOf(tab('Chat')).hidden).toBe(false)
      expect(panelOf(tab('Jogo')).hidden).toBe(true)
      expect(panelOf(tab('Jogo')).textContent).toBe('painel jogo')
    })

    it('setas, Home e End trocam de aba e levam o foco (roving tabindex)', () => {
      render()
      tab('Jogo').focus()
      press(tab('Jogo'), 'ArrowRight')
      expect(tab('Chat').getAttribute('aria-selected')).toBe('true')
      expect(document.activeElement).toBe(tab('Chat'))
      expect(tab('Chat').tabIndex).toBe(0)
      expect(tab('Jogo').tabIndex).toBe(-1)
      press(tab('Chat'), 'ArrowRight')
      expect(tab('Jogo').getAttribute('aria-selected')).toBe('true')
      press(tab('Jogo'), 'ArrowLeft')
      expect(tab('Chat').getAttribute('aria-selected')).toBe('true')
      press(tab('Chat'), 'Home')
      expect(document.activeElement).toBe(tab('Jogo'))
      press(tab('Jogo'), 'End')
      expect(document.activeElement).toBe(tab('Chat'))
    })

    it('sem abas (navegador puro): só as Cenas, sem tablist e sem divisor', () => {
      render({ withTabs: false })
      expect(container.querySelector('[role="tablist"]')).toBeNull()
      expect(divider()).toBeNull()
      expect(column().getAttribute('aria-label')).toBe('Cenas da aventura')
      expect(column().textContent).toContain('lista de cenas')
      // O botão de esconder continua lá.
      expect(hideButton()).not.toBeNull()
    })
  })

  describe('divisor entre as abas e as Cenas', () => {
    it('é um separador de teclado com alvo próprio e nasce na altura padrão', () => {
      render()
      const sep = divider()
      expect(sep).not.toBeNull()
      expect(sep?.getAttribute('aria-orientation')).toBe('horizontal')
      expect(sep?.tabIndex).toBe(0)
      expect(sep?.getAttribute('aria-valuenow')).toBe(String(SCENES_DEFAULT_PX))
      expect(sep?.getAttribute('aria-valuemin')).toBe(String(SCENES_MIN_PX))
      const cenas = document.getElementById(sep?.getAttribute('aria-controls') ?? '')
      expect(cenas?.getAttribute('aria-label')).toBe('Cenas')
      expect(column().style.getPropertyValue('--lb-coldir-cenas')).toBe(`${SCENES_DEFAULT_PX}px`)
    })

    it('setas mudam a altura das Cenas (Shift = passo grande) e o app lembra', () => {
      render()
      const sep = divider()
      if (sep === null) throw new Error('sem divisor')
      press(sep, 'ArrowUp')
      expect(sep.getAttribute('aria-valuenow')).toBe(String(SCENES_DEFAULT_PX + DIVIDER_STEP_PX))
      press(sep, 'ArrowUp', { shiftKey: true })
      expect(sep.getAttribute('aria-valuenow')).toBe(String(SCENES_DEFAULT_PX + DIVIDER_STEP_PX + DIVIDER_BIG_STEP_PX))
      press(sep, 'ArrowDown')
      const esperado = SCENES_DEFAULT_PX + DIVIDER_BIG_STEP_PX
      expect(sep.getAttribute('aria-valuenow')).toBe(String(esperado))
      expect(window.localStorage.getItem('lb-coldir:cenas')).toBe(String(esperado))
      remount()
      expect(divider()?.getAttribute('aria-valuenow')).toBe(String(esperado))
      expect(column().style.getPropertyValue('--lb-coldir-cenas')).toBe(`${esperado}px`)
    })

    it('limites: End vai ao mínimo das Cenas, nada passa dele, e Home para no mínimo das abas', () => {
      render()
      const sep = divider()
      if (sep === null) throw new Error('sem divisor')
      press(sep, 'End')
      expect(sep.getAttribute('aria-valuenow')).toBe(String(SCENES_MIN_PX))
      press(sep, 'ArrowDown', { shiftKey: true })
      expect(sep.getAttribute('aria-valuenow')).toBe(String(SCENES_MIN_PX))
      // Coluna medida: 400 de abas + 320 de Cenas. O teto deixa às abas o mínimo delas.
      measure(400, 320)
      press(sep, 'Home')
      expect(sep.getAttribute('aria-valuenow')).toBe(String(400 + 320 - TABS_MIN_PX))
      // O navegador agora mede as abas no mínimo e as Cenas com o resto.
      measure(TABS_MIN_PX, 400 + 320 - TABS_MIN_PX)
      press(sep, 'ArrowUp', { shiftKey: true })
      expect(sep.getAttribute('aria-valuenow')).toBe(String(400 + 320 - TABS_MIN_PX))
    })

    it('arrastar com o ponteiro: para cima cresce as Cenas, sem passar do teto; soltar grava', () => {
      render()
      const sep = divider()
      if (sep === null) throw new Error('sem divisor')
      measure(400, 320)
      pointer(sep, 'pointerdown', 500)
      expect(column().classList.contains('lb-coldir--arrastando')).toBe(true)
      pointer(sep, 'pointermove', 450)
      // No arrasto o estilo muda direto, sem esperar o React.
      expect(column().style.getPropertyValue('--lb-coldir-cenas')).toBe('370px')
      expect(window.localStorage.getItem('lb-coldir:cenas')).toBeNull()
      pointer(sep, 'pointermove', -1000)
      expect(column().style.getPropertyValue('--lb-coldir-cenas')).toBe(`${720 - TABS_MIN_PX}px`)
      pointer(sep, 'pointermove', 2000)
      expect(column().style.getPropertyValue('--lb-coldir-cenas')).toBe(`${SCENES_MIN_PX}px`)
      pointer(sep, 'pointermove', 540)
      pointer(sep, 'pointerup', 540)
      expect(column().classList.contains('lb-coldir--arrastando')).toBe(false)
      expect(sep.getAttribute('aria-valuenow')).toBe('280')
      expect(window.localStorage.getItem('lb-coldir:cenas')).toBe('280')
    })

    it('duplo clique volta à altura padrão', () => {
      window.localStorage.setItem('lb-coldir:cenas', '500')
      render()
      const sep = divider()
      if (sep === null) throw new Error('sem divisor')
      expect(sep.getAttribute('aria-valuenow')).toBe('500')
      act(() => {
        sep.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      })
      expect(sep.getAttribute('aria-valuenow')).toBe(String(SCENES_DEFAULT_PX))
    })

    it('altura lembrada estragada (texto, abaixo do mínimo) volta ao padrão', () => {
      window.localStorage.setItem('lb-coldir:cenas', 'muito')
      render()
      expect(divider()?.getAttribute('aria-valuenow')).toBe(String(SCENES_DEFAULT_PX))
      act(() => root.unmount())
      window.localStorage.setItem('lb-coldir:cenas', '10')
      root = createRoot(container)
      render()
      expect(divider()?.getAttribute('aria-valuenow')).toBe(String(SCENES_DEFAULT_PX))
    })
  })

  describe('Cenas recolhida', () => {
    it('some o divisor e as abas ficam com a altura toda', () => {
      render({ scenesOpen: false })
      expect(divider()).toBeNull()
      expect(column().classList.contains('lb-coldir--cenas-recolhida')).toBe(true)
      render({ scenesOpen: true })
      expect(divider()).not.toBeNull()
      expect(column().classList.contains('lb-coldir--cenas-recolhida')).toBe(false)
    })
  })

  describe('esconder e mostrar a coluna', () => {
    it('o botão esconde, o foco vai ao botão de reabrir, e o app lembra', () => {
      render()
      const hide = hideButton()
      expect(hide?.getAttribute('aria-label')).toBe('Esconder a coluna da direita')
      expect(hide?.getAttribute('aria-keyshortcuts')).toBe('Shift+J')
      expect(hide?.title).toContain('Shift+J')
      expect(reopenButton()).toBeNull()
      act(() => hide?.click())
      expect(column().hidden).toBe(true)
      const reopen = reopenButton()
      expect(reopen).not.toBeNull()
      expect(document.activeElement).toBe(reopen)
      expect(reopen?.getAttribute('aria-keyshortcuts')).toBe('Shift+J')
      expect(reopen?.title).toContain('Shift+J')
      expect(reopen?.getAttribute('aria-expanded')).toBe('false')
      expect(window.localStorage.getItem('lb-coldir:aberta')).toBe('0')
      remount()
      expect(column().hidden).toBe(true)
      // Reabrir pelo botão: a coluna entra deslizando e o foco vai à aba escolhida.
      act(() => reopenButton()?.click())
      expect(column().hidden).toBe(false)
      expect(column().dataset.entrada).toBe('deslizando')
      expect(document.activeElement).toBe(tab('Jogo'))
      expect(window.localStorage.getItem('lb-coldir:aberta')).toBe('1')
    })

    it('Shift+J esconde e mostra de qualquer ponto, menos num campo de texto', () => {
      render()
      press(document.body, 'J', { shiftKey: true })
      expect(column().hidden).toBe(true)
      press(document.body, 'J', { shiftKey: true })
      expect(column().hidden).toBe(false)
      // Pelo teclado a coluna aparece parada.
      expect(column().dataset.entrada).toBeUndefined()
      const campo = container.querySelector('input')
      if (campo === null) throw new Error('sem campo')
      press(campo, 'J', { shiftKey: true })
      expect(column().hidden).toBe(false)
      // Ctrl+Shift+J não é o atalho.
      press(document.body, 'J', { shiftKey: true, ctrlKey: true })
      expect(column().hidden).toBe(false)
    })

    it('escondida, continua montada: o conteúdo das abas e das Cenas não se perde', () => {
      render()
      act(() => hideButton()?.click())
      expect(column().textContent).toContain('painel jogo')
      expect(column().textContent).toContain('lista de cenas')
    })

    it('sem escolha lembrada, a janela estreita começa com a coluna escondida', () => {
      const largura = window.innerWidth
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: RIGHT_COLUMN_NARROW_PX - 1 })
      try {
        render()
        expect(column().hidden).toBe(true)
        expect(reopenButton()).not.toBeNull()
      } finally {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: largura })
      }
    })
  })

  describe('contador do chat', () => {
    it('a aba Chat leva o número e o nome com as novas; @mestre acende', () => {
      render({ unread: { count: 3, mention: true } })
      expect(tab('Chat').getAttribute('aria-label')).toBe('Chat (3 novas, menciona você)')
      const badge = tab('Chat').querySelector('.lb-mchat__badge')
      expect(badge?.textContent).toBe('@3')
      expect(badge?.classList.contains('lb-mchat__badge--mention')).toBe(true)
      // Sem novas, a aba é só "Chat" e não leva número.
      render({ unread: SEM_NOVAS })
      expect(tab('Chat').getAttribute('aria-label')).toBe('Chat')
      expect(tab('Chat').querySelector('.lb-mchat__badge')).toBeNull()
    })

    it('com a coluna escondida, o botão de reabrir leva o contador', () => {
      render({ unread: { count: 1, mention: false } })
      act(() => hideButton()?.click())
      const reopen = reopenButton()
      expect(reopen?.getAttribute('aria-label')).toBe('Mostrar a coluna da direita (1 nova)')
      expect(reopen?.querySelector('.lb-mchat__badge')?.textContent).toBe('1')
      render({ unread: { count: 2, mention: true } })
      expect(reopenButton()?.getAttribute('aria-label')).toBe('Mostrar a coluna da direita (2 novas, menciona você)')
      expect(reopenButton()?.querySelector('.lb-mchat__badge--mention')?.textContent).toBe('@2')
    })
  })
})

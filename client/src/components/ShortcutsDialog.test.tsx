import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hiddenTools, TOOL_SHORTCUTS } from '../lib/keymap'
import type { DrawingTool } from '../types/tools'
import { TOOL_LABELS } from './labels'
import { ShortcutsDialog } from './ShortcutsDialog'

// A tela de atalhos sem navegador: o que ela diz e como abre e fecha pelo
// teclado. A régua de ponta a ponta (tecla ? no mapa, botão no editor) é
// `e2e/task-jornada-tela-de-atalhos.spec.ts`; as leituras abaixo seguem a dela.

/** Uma linha do painel, não o painel inteiro (mesmo teto da régua e2e). */
const MAX_CHARS_DA_LINHA = 120

/** Letra isolada (não pedaço de palavra), em maiúscula como no balão da barra. */
function letraIsolada(letra: string): RegExp {
  return new RegExp(`(^|[^\\p{L}])${letra}([^\\p{L}]|$)`, 'u')
}

/** Existe no painel uma LINHA curta com a tecla e o que ela faz? */
function linhaDoPainel(painel: HTMLElement, tecla: RegExp, oQueFaz: RegExp | string): string | null {
  const fala = (texto: string) =>
    typeof oQueFaz === 'string' ? texto.toLowerCase().includes(oQueFaz.toLowerCase()) : oQueFaz.test(texto)
  for (const elemento of Array.from(painel.querySelectorAll('*'))) {
    const texto = elemento.textContent ?? ''
    const linha = texto.replace(/\s+/g, ' ').trim()
    if (!fala(linha) || !tecla.test(texto)) continue
    if (linha.length > 0 && linha.length < MAX_CHARS_DA_LINHA) return linha
  }
  return null
}

/** O editor em miniatura: um botão que abre a tela, como a barra de ações faz. */
function Editor() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        abrir
      </button>
      {open && <ShortcutsDialog onClose={() => setOpen(false)} />}
    </>
  )
}

describe('ShortcutsDialog — a tela de atalhos', () => {
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

  // A tela vai por portal para o body, fora do container.
  const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
  const opener = () => {
    const button = container.querySelector<HTMLButtonElement>('button')
    if (!button) throw new Error('botão de abrir não renderizado')
    return button
  }
  const openDialog = () => {
    act(() => root.render(<Editor />))
    opener().focus()
    act(() => opener().click())
    const opened = dialog()
    if (!opened) throw new Error('a tela de atalhos não abriu')
    return opened
  }
  const press = (key: string, init: KeyboardEventInit = {}) =>
    act(() => {
      const alvo = document.activeElement ?? document.body
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
    })

  it('abre como janela modal chamada "Atalhos do teclado"', () => {
    const opened = openDialog()
    expect(opened.getAttribute('aria-modal')).toBe('true')
    const titleId = opened.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(titleId)?.textContent).toBe('Atalhos do teclado')
  })

  it('agrupa por assunto: cada grupo tem um título que o nomeia', () => {
    const opened = openDialog()
    const groups = Array.from(opened.querySelectorAll('[role="group"]'))
    expect(groups.length).toBeGreaterThanOrEqual(2)
    for (const group of groups) {
      const heading = document.getElementById(group.getAttribute('aria-labelledby') ?? '')
      expect(heading?.tagName).toMatch(/^H[1-6]$/)
      expect(heading?.textContent?.trim()).not.toBe('')
    }
  })

  it('cada letra que a barra promete aparece numa linha curta, com o nome da ferramenta', () => {
    const opened = openDialog()
    const escondidas = hiddenTools()
    const faltando: string[] = []
    for (const [ferramenta, letra] of Object.entries(TOOL_SHORTCUTS) as [DrawingTool, string][]) {
      const nome = TOOL_LABELS[ferramenta]
      if (!letra || !nome || escondidas.has(ferramenta)) continue
      if (linhaDoPainel(opened, letraIsolada(letra), nome) === null) faltando.push(`${letra} → ${nome}`)
    }
    expect(faltando).toEqual([])
  })

  it('mostra Ctrl+Z com desfazer, F com enquadrar e ? com o que ele faz no pino', () => {
    const opened = openDialog()
    expect(linhaDoPainel(opened, /Ctrl\s*\+?\s*Z/i, /desfaz/i)).not.toBeNull()
    expect(linhaDoPainel(opened, letraIsolada('F'), /enquadr/i)).not.toBeNull()
    expect(linhaDoPainel(opened, /\?/, /pino/i)).not.toBeNull()
  })

  it('o foco entra na tela ao abrir e volta a quem abriu quando o Esc fecha', () => {
    const opened = openDialog()
    expect(opened.contains(document.activeElement)).toBe(true)

    press('Escape')

    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(opener())
  })

  it('com a tela aberta, nenhuma tecla chega aos atalhos do editor (window)', () => {
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    try {
      openDialog()
      press('w')
      press('Delete')
      expect(dialog()).not.toBeNull()
      press('Escape')
      expect(dialog()).toBeNull()
      expect(onWindowKey).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', onWindowKey)
    }
  })

  it('a mesma tecla ? fecha; segurada (repetição do teclado), não fecha', () => {
    openDialog()
    press('?', { shiftKey: true, repeat: true })
    expect(dialog()).not.toBeNull()

    press('?', { shiftKey: true })

    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(opener())
  })

  it('Tab e Shift+Tab ficam dentro da tela', () => {
    const opened = openDialog()
    const close = opened.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
    expect(close).not.toBeNull()

    for (let i = 0; i < 4; i++) {
      press('Tab')
      expect(opened.contains(document.activeElement), `Tab ${i + 1} saiu da tela`).toBe(true)
    }
    for (let i = 0; i < 4; i++) {
      press('Tab', { shiftKey: true })
      expect(opened.contains(document.activeElement), `Shift+Tab ${i + 1} saiu da tela`).toBe(true)
    }
  })

  it('o botão Fechar fecha; clique no fundo fecha; clique dentro da tela não', () => {
    let opened = openDialog()
    act(() => {
      opened.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      opened.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(dialog()).not.toBeNull()

    const backdrop = document.body.querySelector<HTMLElement>('.lb-dialog-backdrop')
    if (!backdrop) throw new Error('fundo da janela ausente')
    act(() => {
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(dialog()).toBeNull()

    act(() => opener().click())
    opened = dialog() ?? opened
    const close = opened.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
    if (!close) throw new Error('botão Fechar ausente')
    act(() => close.click())
    expect(dialog()).toBeNull()
  })
})

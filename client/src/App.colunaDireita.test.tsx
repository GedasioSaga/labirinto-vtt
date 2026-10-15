import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O editor com a COLUNA DA DIREITA: as Cenas saíram do inspetor da esquerda
 * para a coluna, o rail da esquerda não tem mais abas, o botão "Chat"
 * flutuante saiu e a coluna inteira se esconde (Shift+J). Fora do Tauri não
 * há sala, então a coluna é só das Cenas.
 */

// O canvas de verdade precisa de WebGL.
vi.mock('./pixi/PixiCanvas', () => ({
  PixiCanvas: () => <div className="duble-do-canvas" />,
}))

const { default: App } = await import('./App')

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

function botao(nome: string, exato: boolean, dentro: ParentNode = container): HTMLButtonElement | undefined {
  return [...dentro.querySelectorAll('button')].find((b) => {
    const texto = (b.textContent ?? '').trim()
    return exato ? texto === nome : texto.startsWith(nome)
  })
}

/** O caminho do menu inicial, o mesmo do e2e (`e2e/helpers/enterEditor.ts`). */
async function abrirOEditor() {
  await act(async () => root.render(<App />))
  await act(async () => botao('Criar Mapas', false)?.click())
  await act(async () => botao('Criar mapa', true)?.click())
  if (container.querySelector('.duble-do-canvas') === null) throw new Error('o editor não abriu')
}

const editor = () => container.querySelector<HTMLElement>('.lb-editor')
const coluna = () => container.querySelector<HTMLElement>('aside.lb-coldir')
const livro = () => container.querySelector<HTMLElement>('aside[aria-label="Livro do mestre"]')

describe('App: coluna da direita', () => {
  it('as Cenas moram na coluna da direita; a esquerda é o livro do mestre, sem as abas Jogo e Chat', async () => {
    await abrirOEditor()
    const direita = coluna()
    expect(direita).not.toBeNull()
    expect(direita?.hidden).toBe(false)
    expect(botao('Cenas', false, direita ?? container)).toBeDefined()
    // A esquerda: o livro do mestre, sem as Cenas; as abas dele são as páginas, não Jogo e Chat.
    expect(livro()).not.toBeNull()
    expect(botao('Cenas', false, livro() ?? container)).toBeUndefined()
    const abas = Array.from(livro()?.querySelectorAll('[role="tab"]') ?? []).map((aba) => aba.textContent)
    expect(abas).toEqual(['Ficha', 'Cena', 'Aventura', 'Acervo'])
    // Navegador puro: sem sala, sem as abas Jogo | Chat.
    expect(direita?.querySelector('[role="tablist"]')).toBeNull()
    expect(editor()?.dataset.coldir).toBe('aberta')
  })

  it('o botão "Chat" flutuante saiu do mapa', async () => {
    await abrirOEditor()
    expect(container.querySelector('.lb-mchat__toggle')).toBeNull()
    expect(botao('Chat', false)).toBeUndefined()
  })

  it('Shift+J esconde a coluna e deixa o botão de reabrir; de novo, ela volta', async () => {
    await abrirOEditor()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(coluna()?.hidden).toBe(true)
    expect(editor()?.dataset.coldir).toBe('escondida')
    expect(container.querySelector('button.lb-coldir__reabrir')).not.toBeNull()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(coluna()?.hidden).toBe(false)
    expect(editor()?.dataset.coldir).toBe('aberta')
  })
})

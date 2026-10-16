import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O editor com o LIVRO DA MESA (fatia 4 do design consolidado) na borda
 * direita: as Cenas são uma página dele, o livro do mestre da esquerda não tem
 * as abas Jogo e Chat, o botão "Chat" flutuante saiu e a página recolhe para
 * dentro da lombada (Shift+J). Fora do Tauri não há sala, então o livro fica
 * só com a página Cenas.
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
const livroDaMesa = () => container.querySelector<HTMLElement>('aside[aria-label="Livro da mesa"]')
const livro = () => container.querySelector<HTMLElement>('aside[aria-label="Livro do mestre"]')

describe('App: livro da mesa', () => {
  it('as Cenas são a página do livro da mesa; a esquerda é o livro do mestre, sem as abas Jogo e Chat', async () => {
    await abrirOEditor()
    const direita = livroDaMesa()
    expect(direita).not.toBeNull()
    expect(direita?.classList.contains('gr-e-recolhido')).toBe(false)
    const cenas = direita?.querySelector<HTMLElement>('[role="region"][aria-label="Cenas"]')
    expect(cenas?.closest('[hidden]')).toBeNull()
    expect(botao('Cenas', false, cenas ?? container)).toBeDefined()
    // A esquerda: o livro do mestre, sem as Cenas; as abas dele são as páginas, não Jogo e Chat.
    expect(livro()).not.toBeNull()
    expect(botao('Cenas', false, livro() ?? container)).toBeUndefined()
    const abas = Array.from(livro()?.querySelectorAll('[role="tab"]') ?? []).map((aba) => aba.textContent)
    expect(abas).toEqual(['Ficha', 'Cena', 'Aventura', 'Acervo'])
    // Navegador puro: sem sala, o livro da mesa só tem o marcador Cenas e nenhum topo da Sala.
    expect(Array.from(direita?.querySelectorAll('[role="tab"]') ?? []).map((aba) => aba.textContent)).toEqual(['Cenas'])
    expect(direita?.querySelector('.gr-pagina__topo')).toBeNull()
    expect(editor()?.dataset.coldir).toBe('aberta')
  })

  it('o botão "Chat" flutuante saiu do mapa', async () => {
    await abrirOEditor()
    expect(container.querySelector('.lb-mchat__toggle')).toBeNull()
    expect(botao('Chat', false)).toBeUndefined()
  })

  it('Shift+J recolhe a página para dentro da lombada (que fica, com o botão de abrir); de novo, ela volta', async () => {
    await abrirOEditor()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(livroDaMesa()?.classList.contains('gr-e-recolhido')).toBe(true)
    expect(livroDaMesa()?.querySelector('.gr-pagina-trilho')?.hasAttribute('inert')).toBe(true)
    expect(editor()?.dataset.coldir).toBe('escondida')
    expect(livroDaMesa()?.querySelector('button[aria-label="Abrir a página"]')?.getAttribute('aria-expanded')).toBe('false')
    // A escolha fica lembrada, como a da coluna de antes.
    expect(window.localStorage.getItem('lb-coldir:aberta')).toBe('0')
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'J', shiftKey: true, bubbles: true, cancelable: true }))
    })
    expect(livroDaMesa()?.classList.contains('gr-e-recolhido')).toBe(false)
    expect(editor()?.dataset.coldir).toBe('aberta')
  })
})

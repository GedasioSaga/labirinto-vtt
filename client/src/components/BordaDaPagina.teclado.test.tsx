/**
 * A BORDA QUE ARRASTA a página do livro da mesa (lista de cenas, ideia 5), pelo
 * teclado e pelo clique duplo: seta para a esquerda alarga (16 px; Shift, 64),
 * para a direita estreita, Home e End vão às pontas, o clique duplo volta ao
 * padrão. A largura vai para o `:root` (o livro e a barra do pé leem) e fica
 * neste computador.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHAVE_DA_LARGURA, LARGURA_PADRAO, PASSO_DO_TECLADO, larguraMaximaPara } from '../lib/larguraDaPagina'
import { BordaDaPagina } from './livro/BordaDaPagina'

describe('BordaDaPagina: teclado e clique duplo', () => {
  let container: HTMLDivElement
  let root: Root

  const janelaDeAntes = window.innerWidth

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    // Janela de PC largo: a página tem para onde crescer (no jsdom de 1024 px o teto é o padrão).
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true })
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<BordaDaPagina escondida={false} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    Object.defineProperty(window, 'innerWidth', { value: janelaDeAntes, configurable: true })
  })

  const borda = () => {
    const el = container.querySelector<HTMLElement>('[role="separator"][aria-label="Largura da página"]')
    if (el === null) throw new Error('sem a borda')
    return el
  }
  const tecla = (key: string, shiftKey = false) => {
    const evento = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
    act(() => {
      borda().dispatchEvent(evento)
    })
    return evento
  }
  const largura = () => Number(borda().getAttribute('aria-valuenow'))
  const naRaiz = () => document.documentElement.style.getPropertyValue('--lb-livrodir-pagina')

  it('setas andam 16 px (Shift, 64), Home e End vão às pontas, e a seta não chega ao mapa', () => {
    expect(largura()).toBe(LARGURA_PADRAO)
    const seta = tecla('ArrowLeft')
    expect(seta.defaultPrevented).toBe(true)
    expect(largura()).toBe(LARGURA_PADRAO + PASSO_DO_TECLADO)
    expect(naRaiz()).toBe(`${LARGURA_PADRAO + PASSO_DO_TECLADO}px`)
    expect(window.localStorage.getItem(CHAVE_DA_LARGURA)).toBe(String(LARGURA_PADRAO + PASSO_DO_TECLADO))
    tecla('ArrowLeft', true)
    expect(largura()).toBe(LARGURA_PADRAO + 5 * PASSO_DO_TECLADO)
    tecla('ArrowRight')
    expect(largura()).toBe(LARGURA_PADRAO + 4 * PASSO_DO_TECLADO)
    tecla('End')
    expect(largura()).toBe(larguraMaximaPara(window.innerWidth))
    tecla('Home')
    expect(largura()).toBe(LARGURA_PADRAO)
    // No padrão a variável sai do :root e a chave sai do disco.
    expect(naRaiz()).toBe('')
    expect(window.localStorage.getItem(CHAVE_DA_LARGURA)).toBeNull()
  })

  it('clique duplo volta ao padrão, de qualquer largura', () => {
    tecla('ArrowLeft', true)
    expect(largura()).toBeGreaterThan(LARGURA_PADRAO)
    act(() => {
      borda().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(largura()).toBe(LARGURA_PADRAO)
    expect(naRaiz()).toBe('')
    expect(window.localStorage.getItem(CHAVE_DA_LARGURA)).toBeNull()
  })
})

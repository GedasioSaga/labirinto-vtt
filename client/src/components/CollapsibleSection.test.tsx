import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CollapsibleSection } from './CollapsibleSection'

describe('CollapsibleSection', () => {
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
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  const render = (defaultOpen: boolean, id = 'layers') =>
    act(() =>
      root.render(
        <CollapsibleSection id={id} title="Camadas" defaultOpen={defaultOpen}>
          <p>conteúdo</p>
        </CollapsibleSection>,
      ),
    )

  const header = () => {
    const button = container.querySelector<HTMLButtonElement>('button[aria-expanded]')
    if (button === null) throw new Error('sem cabeçalho')
    return button
  }
  const body = () => {
    const el = document.getElementById(header().getAttribute('aria-controls') ?? '')
    if (el === null) throw new Error('aria-controls sem corpo')
    return el
  }

  it('cabeçalho é botão com o título; aria-controls aponta para o corpo', () => {
    render(true)
    expect(header().textContent).toBe('Camadas')
    expect(body().textContent).toBe('conteúdo')
  })

  it('clique abre e fecha, trocando aria-expanded e hidden do corpo', () => {
    render(true)
    expect(header().getAttribute('aria-expanded')).toBe('true')
    expect(body().hidden).toBe(false)
    act(() => header().click())
    expect(header().getAttribute('aria-expanded')).toBe('false')
    expect(body().hidden).toBe(true)
    act(() => header().click())
    expect(header().getAttribute('aria-expanded')).toBe('true')
    expect(body().hidden).toBe(false)
  })

  it('sem preferência gravada, segue defaultOpen (inclusive quando ele muda)', () => {
    render(false)
    expect(header().getAttribute('aria-expanded')).toBe('false')
    render(true)
    expect(header().getAttribute('aria-expanded')).toBe('true')
  })

  it('lembra o estado em localStorage (lb-section:<id>) e ele vence defaultOpen', () => {
    render(true)
    act(() => header().click())
    expect(window.localStorage.getItem('lb-section:layers')).toBe('0')

    // Remonta do zero: o estado vem do armazenamento, não do defaultOpen.
    act(() => root.unmount())
    root = createRoot(container)
    render(true)
    expect(header().getAttribute('aria-expanded')).toBe('false')

    // defaultOpen mudando depois do clique não reabre.
    render(false)
    act(() => header().click())
    expect(window.localStorage.getItem('lb-section:layers')).toBe('1')
    render(false)
    expect(header().getAttribute('aria-expanded')).toBe('true')
  })

  it('persist=false nasce fechado mesmo com lb-section:<id>=1 gravado, e o clique não grava', () => {
    window.localStorage.setItem('lb-section:advanced', '1')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    act(() =>
      root.render(
        <CollapsibleSection id="advanced" title="Avançado" defaultOpen={false} persist={false}>
          <p>conteúdo</p>
        </CollapsibleSection>,
      ),
    )
    expect(header().getAttribute('aria-expanded')).toBe('false')
    expect(body().hidden).toBe(true)
    act(() => header().click())
    expect(header().getAttribute('aria-expanded')).toBe('true')
    expect(setItem).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('lb-section:advanced')).toBe('1')
  })

  it('headingLevel=3 renderiza h3; o padrão continua h2', () => {
    render(true)
    expect(container.querySelector('h2.lb-collapsible__heading')).not.toBeNull()
    act(() =>
      root.render(
        <CollapsibleSection id="advanced" title="Avançado" defaultOpen={false} headingLevel={3}>
          <p>conteúdo</p>
        </CollapsibleSection>,
      ),
    )
    expect(container.querySelector('h3.lb-collapsible__heading')).not.toBeNull()
    expect(container.querySelector('h2')).toBeNull()
  })

  it('ids diferentes não compartilham estado', () => {
    window.localStorage.setItem('lb-section:floor', '0')
    render(true, 'layers')
    expect(header().getAttribute('aria-expanded')).toBe('true')
  })

  it('lazy: fechada, o conteúdo nem existe no DOM; aberta, monta; fechar de novo desmonta', () => {
    const renderLazy = () =>
      act(() =>
        root.render(
          <CollapsibleSection id="objects" title="Objetos do mapa" defaultOpen={false} lazy>
            <input aria-label="Buscar objeto" />
          </CollapsibleSection>,
        ),
      )
    renderLazy()
    expect(body().hidden).toBe(true)
    expect(body().querySelector('input')).toBeNull()
    act(() => header().click())
    expect(body().querySelector('input')).not.toBeNull()
    act(() => header().click())
    expect(body().querySelector('input')).toBeNull()
    // Sem `lazy`, o corpo fechado continua montado (só escondido), como sempre foi.
    render(false)
    expect(body().textContent).toBe('conteúdo')
  })

  it('openRequest: mudar o valor abre (e grava a preferência); o valor da montagem não abre nada', () => {
    const renderPedido = (openRequest: number) =>
      act(() =>
        root.render(
          <CollapsibleSection id="objects" title="Objetos do mapa" defaultOpen={false} openRequest={openRequest}>
            <p>conteúdo</p>
          </CollapsibleSection>,
        ),
      )
    renderPedido(3)
    expect(header().getAttribute('aria-expanded')).toBe('false')
    renderPedido(4)
    expect(header().getAttribute('aria-expanded')).toBe('true')
    expect(window.localStorage.getItem('lb-section:objects')).toBe('1')
    // Fechar à mão continua valendo até o próximo pedido.
    act(() => header().click())
    renderPedido(4)
    expect(header().getAttribute('aria-expanded')).toBe('false')
    renderPedido(5)
    expect(header().getAttribute('aria-expanded')).toBe('true')
  })

  it('localStorage indisponível (getItem/setItem lançam) não quebra: abre/fecha só em memória', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    render(true)
    expect(header().getAttribute('aria-expanded')).toBe('true')
    act(() => header().click())
    expect(setItem).toHaveBeenCalledWith('lb-section:layers', '0')
    expect(header().getAttribute('aria-expanded')).toBe('false')
    expect(body().hidden).toBe(true)
  })
})

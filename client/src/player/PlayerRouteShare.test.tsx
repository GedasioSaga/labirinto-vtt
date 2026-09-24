/**
 * MOSTRAR UM CAMINHO COM A RÉGUA na tela do jogador. Quem mediu vê "Mostrar
 * a…", escolhe um colega da cena e lê o que o host respondeu. Quem recebe vê o
 * aviso "Gui mostrou um caminho", que não rouba o foco, e o dispensa. O traço
 * em si é tracejado: `dashedSegments` corta o caminho em traços e vãos.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerRouteShare, PlayerSharedRouteNotice, type RouteShareProps } from './PlayerRouteShare'
import { dashedSegments, sharedRouteLabel } from './drawSharedRoute'

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

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

function props(extra: Partial<RouteShareProps> = {}): RouteShareProps {
  return { peers: undefined, result: undefined, onAskPeers: () => {}, onShow: () => {}, ...extra }
}

describe('PlayerRouteShare', () => {
  it('depois de medir, "Mostrar a…" pede a lista de colegas', () => {
    const onAskPeers = vi.fn()
    act(() => root.render(<PlayerRouteShare {...props({ onAskPeers })} />))
    act(() => botao('Mostrar a…').click())
    expect(onAskPeers).toHaveBeenCalledTimes(1)
  })

  it('lista os colegas da cena; tocar num nome manda o traço a ele', () => {
    const onShow = vi.fn()
    act(() => root.render(<PlayerRouteShare {...props({ peers: { phase: 'ready', names: ['Ana', 'Bia'] }, onShow })} />))
    expect(container.querySelector('[aria-label="Mostrar o caminho a"]')).not.toBeNull()
    act(() => botao('Bia').click())
    expect(onShow).toHaveBeenCalledWith('Bia')
  })

  it('esperando a lista diz que procura; lista vazia diz que ninguém mais está na cena', () => {
    act(() => root.render(<PlayerRouteShare {...props({ peers: { phase: 'loading' } })} />))
    expect(container.textContent).toMatch(/Procurando quem está nesta cena/)
    act(() => root.render(<PlayerRouteShare {...props({ peers: { phase: 'ready', names: [] } })} />))
    expect(container.textContent).toMatch(/Ninguém mais está nesta cena agora/)
    expect(container.querySelectorAll('li')).toHaveLength(0)
  })

  it('enviando, os nomes ficam indisponíveis; depois diz o que o host respondeu', () => {
    const peers: RouteShareProps['peers'] = { phase: 'ready', names: ['Ana'] }
    act(() => root.render(<PlayerRouteShare {...props({ peers, result: { to: 'Ana', phase: 'sending' } })} />))
    expect(botao('Ana').disabled).toBe(true)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Mostrando o caminho a Ana…')
    act(() => root.render(<PlayerRouteShare {...props({ peers, result: { to: 'Ana', phase: 'ok' } })} />))
    expect(botao('Ana').disabled).toBe(false)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Caminho mostrado a Ana.')
    act(() => root.render(<PlayerRouteShare {...props({ peers, result: { to: 'Ana', phase: 'too_soon' } })} />))
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Espere um instante e toque em Ana de novo.')
    act(() => root.render(<PlayerRouteShare {...props({ peers, result: { to: 'Ana', phase: 'failed' } })} />))
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/^O caminho não chegou a Ana/)
  })

  it('a recusa não fala do que o colega conhece do mapa, só que ele não está mais na cena', () => {
    const peers: RouteShareProps['peers'] = { phase: 'ready', names: ['Ana'] }
    act(() => root.render(<PlayerRouteShare {...props({ peers, result: { to: 'Ana', phase: 'failed' } })} />))
    expect(container.querySelector('[role="status"]')?.textContent).toBe('O caminho não chegou a Ana: não está mais nesta cena.')
  })
})

describe('PlayerSharedRouteNotice', () => {
  it('diz de quem é o caminho, não rouba o foco e "Dispensar" apaga', () => {
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()
    const onDismiss = vi.fn()
    act(() => root.render(<PlayerSharedRouteNotice from="Gui" onDismiss={onDismiss} />))
    const aviso = container.querySelector('[role="status"]')
    expect(aviso?.textContent).toMatch(/^Gui mostrou um caminho no mapa/)
    expect(document.activeElement).toBe(campo)
    act(() => botao('Dispensar').click())
    expect(onDismiss).toHaveBeenCalledTimes(1)
    campo.remove()
  })
})

describe('traço do caminho', () => {
  it('a etiqueta diz de quem é o caminho', () => {
    expect(sharedRouteLabel('Gui')).toBe('caminho do Gui')
  })

  it('corta cada trecho em traços e vãos, sem passar do fim', () => {
    const tracos = dashedSegments([{ x: 0, y: 0 }, { x: 25, y: 0 }], 6, 4)
    expect(tracos).toEqual([
      { from: { x: 0, y: 0 }, to: { x: 6, y: 0 } },
      { from: { x: 10, y: 0 }, to: { x: 16, y: 0 } },
      { from: { x: 20, y: 0 }, to: { x: 25, y: 0 } },
    ])
  })

  it('o ritmo segue pela dobra do caminho, e trecho de comprimento zero não vira traço', () => {
    const tracos = dashedSegments([{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 12 }], 6, 4)
    expect(tracos).toEqual([
      { from: { x: 0, y: 0 }, to: { x: 6, y: 0 } },
      // O vão começou em x=6 e acaba 2 px depois da dobra.
      { from: { x: 8, y: 2 }, to: { x: 8, y: 8 } },
    ])
  })

  it('traço que cruza a dobra sai em dois pedaços, um de cada lado', () => {
    const tracos = dashedSegments([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 10 }], 6, 4)
    expect(tracos).toEqual([
      { from: { x: 0, y: 0 }, to: { x: 4, y: 0 } },
      { from: { x: 4, y: 0 }, to: { x: 4, y: 2 } },
      { from: { x: 4, y: 6 }, to: { x: 4, y: 10 } },
    ])
  })
})

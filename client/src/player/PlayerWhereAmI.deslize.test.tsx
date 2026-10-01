import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerWhereAmI } from './PlayerWhereAmI'
import type { WhereAmI } from './whereAmI'

/**
 * SELO "ONDE ESTOU" diz à câmera COMO ir até a ficha: o toque do dedo ou o
 * clique do mouse (`detail` 1 ou mais) pede o deslize (`animate` = true), que
 * mostra para que lado a ficha estava; Enter e Espaço sintetizam o clique com
 * `detail` 0 e fazem o pedido de sempre, só com a ficha — a câmera salta,
 * porque ação de teclado não espera animação. O mesmo padrão dos botões de
 * zoom (`PlayerZoomControls`).
 */
describe('PlayerWhereAmI — o toque pede o deslize da câmera, o teclado pede o salto', () => {
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

  const noFarol: WhereAmI = { tokenId: 'ana', tokenName: 'Ana', trail: ['Farol', 'Sala do Faroleiro'] }

  function faixa(): HTMLButtonElement {
    const found = container.querySelector('button')
    if (!found) throw new Error('sem a faixa')
    return found
  }

  function render(onFocus: (tokenId: string, animate?: boolean) => void): void {
    act(() => root.render(<PlayerWhereAmI sceneName="Casa do porto" where={noFarol} showTokenName={false} onFocus={onFocus} />))
  }

  it('toque do dedo ou clique do mouse: centraliza a ficha deslizando', () => {
    const onFocus = vi.fn()
    render(onFocus)
    act(() => {
      faixa().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledWith('ana', true)
  })

  it('Enter ou Espaço (clique sintetizado, detail 0): o pedido de sempre, só com a ficha, e ela é centralizada de uma vez', () => {
    const onFocus = vi.fn()
    render(onFocus)
    act(() => faixa().click())
    expect(onFocus).toHaveBeenCalledTimes(1)
    // Exatamente um argumento: sem `animate`, quem recebe centraliza de uma vez, como antes do deslize existir.
    expect(onFocus).toHaveBeenCalledWith('ana')
  })
})

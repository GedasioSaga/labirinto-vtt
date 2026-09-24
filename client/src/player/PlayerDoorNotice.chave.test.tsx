import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerDoorNotice } from './PlayerDoorNotice'

/** CHAVE ABRE PORTA na tela do jogador: quem tem a chave lê "Usar <chave>" antes dos pedidos ao mestre. */
describe('PlayerDoorNotice com chave na mochila', () => {
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

  const botoes = () => [...container.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent)

  it('Diego com a chave: "Usar Chave do Escudo" vem primeiro e usa a chave nesta porta', () => {
    const onUseKey = vi.fn()
    const onRequest = vi.fn()
    act(() =>
      root.render(
        <PlayerDoorNotice notice={{ id: 1, reason: 'locked', wallId: 'escritorio', key: 'Chave do Escudo' }} onRequest={onRequest} onUseKey={onUseKey} onClose={vi.fn()} />,
      ),
    )
    expect(container.textContent).toContain('Trancada')
    expect(botoes()).toEqual(['Usar Chave do Escudo', 'Bater', 'Forçar', 'Usar chave', 'Fechar aviso'])
    const usar = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Usar Chave do Escudo')
    act(() => usar?.click())
    expect(onUseKey).toHaveBeenCalledWith('escritorio')
    expect(onRequest).not.toHaveBeenCalled()
  })

  it('Ana sem a chave: "Trancada" só com os pedidos ao mestre', () => {
    act(() => root.render(<PlayerDoorNotice notice={{ id: 2, reason: 'locked', wallId: 'escritorio' }} onRequest={vi.fn()} onUseKey={vi.fn()} onClose={vi.fn()} />))
    expect(botoes()).toEqual(['Bater', 'Forçar', 'Usar chave', 'Fechar aviso'])
    expect(container.textContent).not.toContain('Escudo')
  })
})

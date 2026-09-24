import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PassTokenOption } from '../lib/pinPass'
import { PlayerPinCard } from '../player/PlayerPinCard'
import type { PinPassage } from '../types/map'
import { PinTravelControls } from './PinTravelControls'

/**
 * PASSE no painel do mestre (item e fichas marcadas) e no cartão do jogador
 * (tenta passar, sem saber o que abre a catraca).
 */

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

const FICHAS: PassTokenOption[] = [
  { id: 'ficha-fabi', nome: 'Fabi', marcada: true },
  { id: 'ficha-caio', nome: 'Caio', marcada: false },
]

function renderPainel(passage: PinPassage) {
  const handlers = { onPassageChange: vi.fn(), onPassItemChange: vi.fn(), onPassTokenToggle: vi.fn() }
  act(() =>
    root.render(
      <PinTravelControls
        exits={[{ id: 'principal', rotulo: '', travel: { status: 'sem-destino' } }]}
        scenes={[]}
        pinsIn={() => []}
        onLinkNew={vi.fn()}
        onLinkExisting={vi.fn()}
        onUnlink={vi.fn()}
        onRename={vi.fn()}
        onGo={vi.fn()}
        passage={passage}
        passItem="Crachá"
        passTokens={FICHAS}
        onOneWayChange={vi.fn()}
        arrivalOnly={false}
        {...handlers}
      />,
    ),
  )
  return handlers
}

function botao(texto: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
  if (achado === undefined) throw new Error(`sem o botão ${texto}`)
  return achado
}

function campoDoItem(): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>('#lb-pin-travel-pass-item')
}

describe('painel do mestre: passagem com passe', () => {
  it('"Com passe" é um dos modos, e escolhê-lo avisa quem chama', () => {
    const h = renderPainel('pede')
    act(() => botao('Com passe').click())
    expect(h.onPassageChange).toHaveBeenCalledWith('passe')
    // Fora do modo passe, o item e as fichas não aparecem.
    expect(campoDoItem()).toBeNull()
  })

  it('no modo passe, o campo do item grava ao sair e cada ficha liga e desliga a marca', () => {
    const h = renderPainel('passe')
    const campo = campoDoItem()
    if (campo === null) throw new Error('o campo do item deveria aparecer no modo passe')
    expect(campo.value).toBe('Crachá')
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      campo.focus()
      setValue?.call(campo, 'Cartão de acesso')
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => campo.blur())
    expect(h.onPassItemChange).toHaveBeenCalledWith('Cartão de acesso')

    expect(botao('Fabi').getAttribute('aria-pressed')).toBe('true')
    expect(botao('Caio').getAttribute('aria-pressed')).toBe('false')
    act(() => botao('Caio').click())
    expect(h.onPassTokenToggle).toHaveBeenCalledWith('ficha-caio', true)
    act(() => botao('Fabi').click())
    expect(h.onPassTokenToggle).toHaveBeenCalledWith('ficha-fabi', false)
  })
})

describe('cartão do jogador: pino com passe', () => {
  it('oferece "Passar" e avisa que, sem o passe, o pedido vai ao mestre', () => {
    const onRequestTravel = vi.fn()
    act(() =>
      root.render(
        <PlayerPinCard
          pin={{ id: 'catraca', x: 0, y: 0, kind: 'viagem', description: 'Catraca', image: null, passagem: 'passe' }}
          onClose={vi.fn()}
          onRequestTravel={onRequestTravel}
        />,
      ),
    )
    act(() => botao('Passar').click())
    expect(container.textContent).toContain('Sem o passe, o pedido vai ao mestre.')
    const confirmar = [...container.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Passar').at(-1)
    act(() => confirmar?.click())
    expect(onRequestTravel).toHaveBeenCalledTimes(1)
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConcealZoneControls } from './ConcealZoneControls'
import { ItemTransformControls } from './ItemTransformControls'
import { PlayerSecretControls, type RevealToControlsProps } from './PlayerSecretControls'

/**
 * "Revelar para…" da ficha secreta, da escada secreta e da zona oculta: uma
 * caixa por jogador, com a bolinha da cor dele. Só aparece enquanto o item
 * está escondido — revelado para todos, a lista não diria nada.
 */

const JOGADORES: RevealToControlsProps['players'] = [
  { playerId: 'ana', name: 'Ana', color: '#3cff00' },
  { playerId: 'duda', name: 'Duda', color: null },
]

describe('Revelar para…', () => {
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

  const lista = (): HTMLElement | null => container.querySelector('[aria-label="Revelar para"]')
  const caixa = (name: string): HTMLInputElement => {
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(name))
    const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
    if (input === null) throw new Error(`sem a caixa de ${name}`)
    return input
  }

  it('escada secreta: marcar Ana manda [ana]; marcar Duda junto manda os dois, na ordem da lista', () => {
    const onChange = vi.fn()
    const render = (chosen: readonly string[]) =>
      act(() => root.render(<PlayerSecretControls secret onSecretChange={() => undefined} reveal={{ players: JOGADORES, chosen, onChange }} />))
    render([])
    expect(lista()).not.toBeNull()
    expect(container.textContent).toContain('Ninguém descobriu')
    act(() => caixa('Ana').click())
    expect(onChange).toHaveBeenLastCalledWith(['ana'])
    render(['ana'])
    expect(caixa('Ana').checked).toBe(true)
    expect(caixa('Duda').checked).toBe(false)
    const bolinha = caixa('Ana').closest('label')?.querySelector<HTMLElement>('.lb-party__dot')
    expect(bolinha?.style.background).toBe('rgb(60, 255, 0)')
    act(() => caixa('Duda').click())
    expect(onChange).toHaveBeenLastCalledWith(['ana', 'duda'])
  })

  it('item que não está oculto para jogadores não mostra a lista (todos já veem)', () => {
    act(() =>
      root.render(<PlayerSecretControls secret={false} onSecretChange={() => undefined} reveal={{ players: JOGADORES, chosen: ['ana'], onChange: vi.fn() }} />),
    )
    expect(lista()).toBeNull()
  })

  it('zona oculta ativa: "Revelar para" com as caixas; revelada para todos, some', () => {
    const onChange = vi.fn()
    const zona = (revealed: boolean) =>
      act(() =>
        root.render(
          <ConcealZoneControls
            name="Tapete"
            onNameChange={() => undefined}
            revealed={revealed}
            onRevealedChange={() => undefined}
            onDelete={() => undefined}
            reveal={{ players: JOGADORES, chosen: ['ana'], onChange }}
          />,
        ),
      )
    zona(false)
    expect(lista()).not.toBeNull()
    act(() => caixa('Ana').click())
    expect(onChange).toHaveBeenLastCalledWith([])
    zona(true)
    expect(lista()).toBeNull()
  })

  it('ficha secreta: a lista vem abaixo de "Oculto para jogadores" e só com ele ligado', () => {
    const onChange = vi.fn()
    const token = (secret: boolean) =>
      act(() =>
        root.render(
          <ItemTransformControls
            title="Token"
            locked={false}
            onLockedChange={() => undefined}
            secret={secret}
            onSecretChange={() => undefined}
            reveal={{ players: JOGADORES, chosen: [], onChange }}
          />,
        ),
      )
    token(true)
    act(() => caixa('Duda').click())
    expect(onChange).toHaveBeenLastCalledWith(['duda'])
    token(false)
    expect(lista()).toBeNull()
  })

  it('sem jogador na sala: diz isso em vez de uma lista vazia', () => {
    act(() => root.render(<PlayerSecretControls secret onSecretChange={() => undefined} reveal={{ players: [], chosen: [], onChange: vi.fn() }} />))
    expect(container.textContent).toContain('Nenhum jogador na sala.')
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(1) // só o "Oculto para jogadores"
  })
})

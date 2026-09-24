import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerSecretControls, type PinAudienceControlsProps } from './PlayerSecretControls'

/**
 * "Quem vê: Todos | Só estes" do pino, na seção Jogadores: uma caixa por
 * jogador, com a bolinha da cor dele. Quem aplica a lista é a sessão do host;
 * aqui só o que o mestre marca e o que o painel mostra.
 */

const JOGADORES: PinAudienceControlsProps['players'] = [
  { playerId: 'diego', name: 'Diego', color: '#3cff00' },
  { playerId: 'carla', name: 'Carla', color: null },
]

describe('PlayerSecretControls: quem vê o pino', () => {
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

  const render = (chosen: readonly string[] | null, onChange: (chosen: string[] | null) => void, secret = false) =>
    act(() =>
      root.render(
        <PlayerSecretControls secret={secret} onSecretChange={() => undefined} audience={{ players: JOGADORES, chosen, onChange }} />,
      ),
    )

  const radio = (label: string): HTMLButtonElement => {
    const found = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent?.trim() === label)
    if (found === undefined) throw new Error(`sem a opção ${label}`)
    return found
  }
  const caixa = (name: string): HTMLInputElement => {
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(name))
    const input = label?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
    if (input === null) throw new Error(`sem a caixa de ${name}`)
    return input
  }

  it('"Todos" começa marcado e não há lista; "Só estes" começa sem ninguém', () => {
    const onChange = vi.fn()
    render(null, onChange)
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Quem vê')
    expect(radio('Todos').getAttribute('aria-checked')).toBe('true')
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(1) // só o "Oculto para jogadores"
    act(() => radio('Só estes').click())
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('Só Diego: a caixa dele marcada com a bolinha da cor dele; marcar Carla manda os dois', () => {
    const onChange = vi.fn()
    render(['diego'], onChange)
    expect(radio('Só estes').getAttribute('aria-checked')).toBe('true')
    expect(caixa('Diego').checked).toBe(true)
    expect(caixa('Carla').checked).toBe(false)
    const bolinha = caixa('Diego').closest('label')?.querySelector<HTMLElement>('.lb-party__dot')
    expect(bolinha?.style.background).toBe('rgb(60, 255, 0)')
    act(() => caixa('Carla').click())
    expect(onChange).toHaveBeenLastCalledWith(['diego', 'carla'])
  })

  it('desmarcar o último avisa que ninguém vê; "Todos" apaga a lista', () => {
    const onChange = vi.fn()
    render(['diego'], onChange)
    act(() => caixa('Diego').click())
    expect(onChange).toHaveBeenLastCalledWith([])
    render([], onChange)
    expect(container.textContent).toContain('Ninguém vê este pino')
    act(() => radio('Todos').click())
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('"Oculto para jogadores" ligado esconde o "Quem vê": ninguém vê de qualquer jeito', () => {
    render(['diego'], vi.fn(), true)
    expect(container.querySelector('[role="radiogroup"]')).toBeNull()
  })

  it('sem sala aberta (audience ausente) não há "Quem vê"', () => {
    act(() => root.render(<PlayerSecretControls secret={false} onSecretChange={() => undefined} />))
    expect(container.querySelector('[role="radiogroup"]')).toBeNull()
  })
})

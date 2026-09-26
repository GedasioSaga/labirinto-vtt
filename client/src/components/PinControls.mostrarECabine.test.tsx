import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinControls, type PinControlsProps } from './PinControls'
import { SHOW_PIN_NOW_LABEL } from './ShowPinNowControls'

/**
 * O painel do "!" com a sala aberta leva as DUAS ações que chegaram juntas:
 * a cabine contínua (esteira e cabine) e o "Mostrar agora a…". Uma não pode
 * apagar a outra — as duas vivem nas mesmas linhas do painel.
 */

describe('PinControls: cabine contínua e Mostrar agora a… no mesmo pino', () => {
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

  function render(extra: Partial<PinControlsProps>): void {
    const props: PinControlsProps = {
      kind: 'exclamacao',
      onKindChange: () => {},
      description: 'Uma carta amassada.',
      onDescriptionChange: () => {},
      locked: false,
      onLockedChange: () => {},
      marco: false,
      onMarcoChange: () => {},
      lerDePerto: null,
      onLerDePertoChange: () => {},
      image: null,
      onChooseImage: () => {},
      onClearImage: () => {},
      onDelete: () => {},
      iconChoice: null,
      ...extra,
    }
    act(() => root.render(<PinControls {...props} />))
  }

  function botao(texto: string): HTMLButtonElement | null {
    return Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto) ?? null
  }

  function rotulo(texto: string): HTMLLabelElement | null {
    return Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === texto) ?? null
  }

  const cabin: NonNullable<PinControlsProps['cabin']> = {
    target: null,
    targets: [{ id: 'pino-b', label: 'Pino B' }],
    canAdvance: false,
    onChange: () => {},
    onAdvance: () => {},
  }

  it('mostra a cabine e o Mostrar agora a…, e tocar na Ana manda o cartão só para ela', () => {
    const onShow = vi.fn()
    render({
      cabin,
      showNow: {
        pinId: 'pino-a',
        candidates: [
          { playerId: 'ana', name: 'Ana', color: '#e0a040' },
          { playerId: 'bia', name: 'Bia', color: '#40a0e0' },
        ],
        onShow,
      },
    })
    expect(rotulo('Cabine contínua: leva a')).not.toBeNull()
    const abrir = botao(SHOW_PIN_NOW_LABEL)
    if (abrir === null) throw new Error('sem o botão Mostrar agora a…')
    act(() => abrir.click())
    const ana = botao('Ana')
    if (ana === null) throw new Error('sem a Ana na lista')
    act(() => ana.click())
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(onShow).toHaveBeenCalledWith('ana')
    // A cabine continua no painel depois de mandar o cartão.
    expect(rotulo('Cabine contínua: leva a')).not.toBeNull()
  })

  it('sem sala (showNow null) a cabine fica e o Mostrar agora a… some', () => {
    render({ cabin, showNow: null })
    expect(rotulo('Cabine contínua: leva a')).not.toBeNull()
    expect(botao(SHOW_PIN_NOW_LABEL)).toBeNull()
  })

  it('sem cabine (chegada oculta) o Mostrar agora a… continua', () => {
    render({ cabin: null, showNow: { pinId: 'pino-a', candidates: [], onShow: () => {} } })
    expect(rotulo('Cabine contínua: leva a')).toBeNull()
    expect(botao(SHOW_PIN_NOW_LABEL)).not.toBeNull()
  })
})

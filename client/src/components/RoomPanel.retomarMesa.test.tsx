import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import { RoomPanel, type RoomPanelProps } from './RoomPanel'

/**
 * "Abrir sala" com mesa guardada pergunta "Retomar a mesa?": Retomar devolve
 * as fichas pelo nome; "Mesa nova" é a sala de hoje. Sem mesa guardada, abre
 * direto, como sempre.
 */

const IDLE: TunnelState = { kind: 'idle' }

describe('RoomPanel: Retomar a mesa?', () => {
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

  const render = (props: Partial<RoomPanelProps>) => {
    const onStart = vi.fn()
    const noop = vi.fn()
    act(() =>
      root.render(
        <RoomPanel
          room={null}
          players={[]}
          tokens={[]}
          tunnel={IDLE}
          onStart={onStart}
          onStop={noop}
          onStartTunnel={noop}
          onStopTunnel={noop}
          onAssign={noop}
          onUnassign={noop}
          onKick={noop}
          onVisionRadiusChange={noop}
          onRevealPlan={noop}
          onHidePlan={noop}
          {...props}
        />,
      ),
    )
    return onStart
  }

  const botao = (nome: string): HTMLButtonElement => {
    const found = [...container.querySelectorAll('button')].find((b) => b.textContent === nome)
    if (found === undefined) throw new Error(`sem o botão "${nome}"`)
    return found
  }
  const clica = (nome: string) => act(() => botao(nome).click())

  it('sem mesa guardada, "Abrir sala" abre direto a mesa de hoje', () => {
    const onStart = render({ savedTableNames: null })
    clica('Abrir sala')
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(false)
    expect(container.textContent).not.toContain('Retomar a mesa?')
  })

  it('com mesa guardada, "Abrir sala" pergunta; Retomar abre com a mesa', () => {
    const onStart = render({ savedTableNames: 'Ana e Bruno' })
    clica('Abrir sala')
    expect(onStart).not.toHaveBeenCalled()
    const pergunta = container.querySelector<HTMLElement>('[role="group"]')
    if (pergunta === null) throw new Error('a pergunta deveria ser um grupo com nome')
    const titulo = pergunta.getAttribute('aria-labelledby')
    expect(titulo === null ? null : document.getElementById(titulo)?.textContent).toBe('Retomar a mesa?')
    expect(pergunta.textContent).toContain('Ana e Bruno')
    // O foco vai para a resposta mais provável: quem guarda a mesa quer retomá-la.
    expect(document.activeElement).toBe(botao('Retomar a mesa'))
    clica('Retomar a mesa')
    expect(onStart).toHaveBeenCalledWith(true)
  })

  it('"Mesa nova" abre a sala de hoje', () => {
    const onStart = render({ savedTableNames: 'Ana' })
    clica('Abrir sala')
    clica('Mesa nova')
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(false)
  })

  it('"Voltar" desiste sem abrir sala', () => {
    const onStart = render({ savedTableNames: 'Ana' })
    clica('Abrir sala')
    clica('Voltar')
    expect(onStart).not.toHaveBeenCalled()
    // O foco volta para onde estava: quem desistiu pelo teclado continua no "Abrir sala".
    expect(document.activeElement).toBe(botao('Abrir sala'))
    expect(container.textContent).not.toContain('Retomar a mesa?')
  })
})

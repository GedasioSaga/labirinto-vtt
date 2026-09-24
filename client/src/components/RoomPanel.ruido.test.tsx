/**
 * "Ruído" na aba Jogo: o botão arma o ruído (o próximo clique no mapa o
 * dispara) e a lista escolhe até onde ele chega. Sem o handler, nada aparece.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import { NOISE_BUTTON_LABEL, RoomPanel } from './RoomPanel'

const noop = vi.fn()
const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onVisionFactorChange: noop, onRevealPlan: noop, onHidePlan: noop, clues: { rows: [], onCenter: noop, onToggle: noop } }
const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

describe('RoomPanel: Ruído', () => {
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

  function botao(): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => b.textContent === NOISE_BUTTON_LABEL)
  }

  it('o botão mostra se está armado e o clique pede para armar', () => {
    const onToggle = vi.fn()
    const noise = { armed: false, rangeCells: 12, onToggle, onRangeChange: noop }
    act(() => root.render(<RoomPanel room={ROOM} players={[]} tokens={[]} tunnel={IDLE} {...handlers} noise={noise} />))
    expect(botao()?.getAttribute('aria-pressed')).toBe('false')
    act(() => botao()?.click())
    expect(onToggle).toHaveBeenCalledTimes(1)
    act(() => root.render(<RoomPanel room={ROOM} players={[]} tokens={[]} tunnel={IDLE} {...handlers} noise={{ ...noise, armed: true }} />))
    expect(botao()?.getAttribute('aria-pressed')).toBe('true')
  })

  it('o alcance tem rótulo e devolve o número de casas escolhido', () => {
    const onRangeChange = vi.fn()
    act(() => root.render(<RoomPanel room={ROOM} players={[]} tokens={[]} tunnel={IDLE} {...handlers} noise={{ armed: false, rangeCells: 12, onToggle: noop, onRangeChange }} />))
    const lista = container.querySelector('select[aria-label="Alcance do ruído"], select#lb-room-noise-range')
    expect(lista).not.toBeNull()
    if (!(lista instanceof HTMLSelectElement)) throw new Error('esperava select')
    expect(lista.value).toBe('12')
    act(() => {
      lista.value = '24'
      lista.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onRangeChange).toHaveBeenCalledWith(24)
    const rotulo = container.querySelector(`label[for="${lista.id}"]`)
    expect(rotulo?.textContent).toBe('Alcance do ruído')
  })

  it('sem o handler (sala sem ruído) o botão não aparece', () => {
    act(() => root.render(<RoomPanel room={ROOM} players={[]} tokens={[]} tunnel={IDLE} {...handlers} />))
    expect(botao()).toBeUndefined()
  })
})

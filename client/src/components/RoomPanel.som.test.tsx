/**
 * SOM DA MESA no mestre (pedido "sons", fatia 3): uma linha curta "Som da
 * mesa" com o alto-falante, logo abaixo do cabeçalho da sala e acima do Ruído.
 * O cabeçalho (SALA, código, Laser) já ocupa a largura toda da coluna: um
 * botão a mais nele quebrava o código em duas linhas. Sem sala não há som de
 * mesa para regular.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import { PREFERENCIA_DE_SOM_PADRAO, useSomStore } from '../stores/somStore'
import { TITULO_DO_SOM } from './ControleDeSom'
import { NOISE_BUTTON_LABEL, RoomPanel } from './RoomPanel'

const noop = vi.fn()
const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onVisionFactorChange: noop, onRevealPlan: noop, onHidePlan: noop, clues: { rows: [], onCenter: noop, onToggle: noop } }
const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }
const NOISE = { armed: false, rangeCells: 12, onToggle: noop, onRangeChange: noop }

describe('RoomPanel: Som da mesa', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    useSomStore.setState({ ...PREFERENCIA_DE_SOM_PADRAO })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  /** O alto-falante: o botão que a legenda "Som da mesa" nomeia. */
  function som(): HTMLButtonElement | null {
    const legenda = Array.from(container.querySelectorAll('label')).find((rotulo) => rotulo.textContent === TITULO_DO_SOM)
    const alvo = legenda === undefined ? null : document.getElementById(legenda.htmlFor)
    return alvo instanceof HTMLButtonElement ? alvo : null
  }

  function antes(a: Node, b: Node): boolean {
    return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  }

  it('com a sala aberta, "Som da mesa" fica entre o cabeçalho e o Ruído, fora da linha do código e do Laser', () => {
    act(() => root.render(<RoomPanel room={ROOM} players={[]} tokens={[]} tunnel={IDLE} {...handlers} onToggleLaser={noop} noise={NOISE} />))
    const botao = som()
    if (botao === null) throw new Error('sem o alto-falante "Som da mesa"')
    const cabecalho = container.querySelector('.lb-room__head')
    if (cabecalho === null) throw new Error('sem o cabeçalho da sala')
    expect(cabecalho.contains(botao)).toBe(false)
    expect(Array.from(cabecalho.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Laser'])
    const ruido = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === NOISE_BUTTON_LABEL)
    if (ruido === undefined) throw new Error('sem o Ruído')
    expect(antes(cabecalho, botao)).toBe(true)
    expect(antes(botao, ruido)).toBe(true)
    expect(botao.closest('.lb-som')?.classList.contains('lb-som--painel')).toBe(true)
  })

  it('o alto-falante abre o popover "Som da mesa" com volume e mudo', () => {
    act(() => root.render(<RoomPanel room={ROOM} players={[]} tokens={[]} tunnel={IDLE} {...handlers} onToggleLaser={noop} />))
    act(() => som()?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    const dialogo = container.querySelector('[role="dialog"]')
    expect(document.getElementById(dialogo?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(TITULO_DO_SOM)
    expect(dialogo?.querySelector('input[type="range"]')).not.toBeNull()
    expect(dialogo?.querySelector('button[aria-label="Mudo"]')).not.toBeNull()
  })

  it('sem sala aberta não há alto-falante', () => {
    act(() => root.render(<RoomPanel room={null} players={[]} tokens={[]} tunnel={IDLE} {...handlers} />))
    expect(som()).toBeNull()
    expect(container.querySelector('.lb-som')).toBeNull()
  })
})

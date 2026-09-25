/**
 * Painel Sala, visão por cena: cada jogador tem um "Fator de visão" (x1,0 de
 * fábrica) que vale em toda cena. Na cena com "Visão nesta cena", o mestre lê
 * quantos quadrados aquele jogador enxerga ali e o raio em px some (não conta
 * lá). Na cena sem valor, o raio em px continua como sempre.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { PlayerInfo } from '../net/hostSession'
import { RoomPanel } from './RoomPanel'

const noop = vi.fn()
const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

function handlers(onVisionFactorChange = vi.fn()) {
  return { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onVisionFactorChange, onRevealPlan: noop, onHidePlan: noop, clues: { rows: [], onCenter: noop, onToggle: noop } }
}

function player(overrides: Partial<PlayerInfo> = {}): PlayerInfo {
  return { clientId: 'c1', playerId: 'p1', name: 'Eva', status: 'playing', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...overrides }
}

function html(p: PlayerInfo): string {
  return renderToStaticMarkup(<RoomPanel room={ROOM} players={[p]} tokens={[]} tunnel={IDLE} {...handlers()} />)
}

describe('RoomPanel — fator de visão', () => {
  it('todo jogador tem o slider "Fator de visão" com o valor em x1,0', () => {
    const out = html(player({ visionFactor: 1.5 }))
    expect(out).toMatch(/<label class="lb-label" for="lb-room-vision-factor-p1">Fator de visão<\/label>/)
    expect(out).toContain('>x1,5</span>')
    expect(out).toMatch(/<input id="lb-room-vision-factor-p1" class="lb-range" type="range" min="0.5" max="3" step="0.1" value="1.5"\/>/)
  })

  it('cena com "Visão nesta cena": mostra os quadrados dele ali e esconde o raio em px', () => {
    const out = html(player({ visionFactor: 1.5, sceneVisionCells: 6 }))
    expect(out).toContain('Nesta cena: 9 quadrados')
    expect(out).not.toContain('Raio de visão')
    expect(out).not.toContain('700 px')
  })

  it('cena sem valor (ou jogador aguardando): o raio em px de sempre continua', () => {
    const out = html(player({ status: 'waiting', visionRadius: 250 }))
    expect(out).toMatch(/<label class="lb-label" for="lb-room-vision-p1">Raio de visão<\/label>/)
    expect(out).toContain('250 px')
    expect(out).not.toContain('Nesta cena:')
  })
})

describe('RoomPanel — arrastar o fator', () => {
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

  it('manda o fator escolhido para aquele jogador', () => {
    const onVisionFactorChange = vi.fn()
    act(() => root.render(<RoomPanel room={ROOM} players={[player()]} tokens={[]} tunnel={IDLE} {...handlers(onVisionFactorChange)} />))
    const slider = container.querySelector<HTMLInputElement>('#lb-room-vision-factor-p1')
    if (slider === null) throw new Error('slider do fator ausente')
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setValue?.call(slider, '1.5')
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onVisionFactorChange).toHaveBeenCalledTimes(1)
    expect(onVisionFactorChange).toHaveBeenCalledWith('p1', 1.5)
  })
})

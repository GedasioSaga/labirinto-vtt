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

/**
 * ABA JOGO COMPACTA: no card de quem JOGA, raio e fator moram no "Mais" (…),
 * fechado por padrão. Monta o painel de verdade, abre o "Mais de Eva" e
 * devolve o card aberto (o `container` é removido pelo chamador via `fechar`).
 */
function comMaisAberto(p: PlayerInfo): { container: HTMLDivElement; fechar(): void } {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(<RoomPanel room={ROOM} players={[p]} tokens={[]} tunnel={IDLE} {...handlers()} />))
  const mais = container.querySelector<HTMLButtonElement>(`button[aria-label="Mais de ${p.name}"]`)
  if (mais === null) throw new Error(`sem o "Mais" de ${p.name}`)
  act(() => mais.click())
  return {
    container,
    fechar: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

describe('RoomPanel — fator de visão', () => {
  it('todo jogador tem o slider "Fator de visão" com o valor em x1,0', () => {
    const { container, fechar } = comMaisAberto(player({ visionFactor: 1.5 }))
    try {
      const label = container.querySelector<HTMLLabelElement>('label[for="lb-room-vision-factor-p1"]')
      expect(label?.className).toBe('lb-label')
      expect(label?.textContent).toBe('Fator de visão')
      expect(Array.from(container.querySelectorAll('span')).map((s) => s.textContent)).toContain('x1,5')
      const slider = container.querySelector<HTMLInputElement>('input#lb-room-vision-factor-p1')
      expect(slider?.className).toBe('lb-range')
      expect(slider?.type).toBe('range')
      expect(slider?.min).toBe('0.5')
      expect(slider?.max).toBe('3')
      expect(slider?.step).toBe('0.1')
      expect(slider?.value).toBe('1.5')
    } finally {
      fechar()
    }
  })

  it('cena com "Visão nesta cena": mostra os quadrados dele ali e esconde o raio em px', () => {
    const { container, fechar } = comMaisAberto(player({ visionFactor: 1.5, sceneVisionCells: 6 }))
    try {
      const out = container.innerHTML
      expect(out).toContain('Nesta cena: 9 quadrados')
      expect(out).not.toContain('Raio de visão')
      expect(out).not.toContain('700 px')
    } finally {
      fechar()
    }
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
    // ABA JOGO COMPACTA: o fator de quem joga mora no "Mais" (…), fechado por padrão.
    const mais = container.querySelector<HTMLButtonElement>('button[aria-label="Mais de Eva"]')
    if (mais === null) throw new Error('sem o "Mais" de Eva')
    act(() => mais.click())
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

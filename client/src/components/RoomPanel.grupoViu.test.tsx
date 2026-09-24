/**
 * "Dar o que o grupo viu" no card do jogador: só para quem está jogando (tem
 * cena), e o mestre lê o resultado na hora — quantos colegas, ou que ninguém
 * mais explorou a cena.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { PlayerInfo } from '../net/hostSession'
import { GROUP_VIEW_LABEL, RoomPanel, groupViewFeedbackText } from './RoomPanel'

const noop = vi.fn()
const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onVisionFactorChange: noop, onRevealPlan: noop, onHidePlan: noop }
const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

function player(overrides: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c1', playerId: 'p1', name: 'Duda', status: 'playing', connected: true, tokenIds: ['t1'], visionRadius: 700, visionFactor: 1, ...overrides }
}

describe('RoomPanel: Dar o que o grupo viu', () => {
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

  function botoes(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === GROUP_VIEW_LABEL)
  }

  it('aparece só para quem joga; o clique chama com o id e o aviso diz quantos colegas', () => {
    const onGiveGroupView = vi.fn((): number | null => 3)
    const jogadores = [player({}), player({ clientId: 'c2', playerId: 'p2', name: 'Caio', status: 'waiting', tokenIds: [] })]
    act(() => root.render(<RoomPanel room={ROOM} players={jogadores} tokens={[]} tunnel={IDLE} {...handlers} onGiveGroupView={onGiveGroupView} />))
    expect(botoes()).toHaveLength(1)
    act(() => botoes()[0]?.click())
    expect(onGiveGroupView).toHaveBeenCalledWith('p1')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Duda recebeu o que 3 colegas viram')
  })

  it('ninguém mais explorou: o aviso diz isso', () => {
    act(() => root.render(<RoomPanel room={ROOM} players={[player({})]} tokens={[]} tunnel={IDLE} {...handlers} onGiveGroupView={() => 0} />))
    act(() => botoes()[0]?.click())
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Ninguém mais explorou a cena de Duda')
  })

  it('sem o handler o botão não aparece', () => {
    act(() => root.render(<RoomPanel room={ROOM} players={[player({})]} tokens={[]} tunnel={IDLE} {...handlers} />))
    expect(botoes()).toHaveLength(0)
  })

  it('textos do aviso', () => {
    expect(groupViewFeedbackText('Duda', 1)).toBe('Duda recebeu o que 1 colega viu')
    expect(groupViewFeedbackText('Duda', 2)).toBe('Duda recebeu o que 2 colegas viram')
    expect(groupViewFeedbackText('Duda', 0)).toBe('Ninguém mais explorou a cena de Duda')
    expect(groupViewFeedbackText('Duda', null)).toBe('Não deu: a sala não está aberta.')
  })
})

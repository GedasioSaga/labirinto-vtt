import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerInfo } from '../net/hostSession'
import { FIREWALL_HINT, RoomPanel, assignableTokens, playerStatusLabel, qrDataUrl } from './RoomPanel'

const noop = vi.fn()
const handlers = { onStart: noop, onStop: noop, onAssign: noop, onUnassign: noop, onKick: noop }
const TOKENS = [
  { id: 't1', name: 'Herói' },
  { id: 't2', name: 'Ladino' },
]

function player(overrides: Partial<PlayerInfo> = {}): PlayerInfo {
  return { clientId: 'c1', playerId: 'p1', name: 'Ana', status: 'waiting', connected: true, tokenIds: [], ...overrides }
}

describe('RoomPanel', () => {
  it('qrDataUrl codifica o SVG', () => {
    expect(qrDataUrl('<svg a="1"/>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%221%22%2F%3E')
  })

  it('playerStatusLabel e assignableTokens', () => {
    expect(playerStatusLabel(player())).toBe('aguardando · conectado')
    expect(playerStatusLabel(player({ status: 'playing', connected: false }))).toBe('jogando · desconectado')
    expect(assignableTokens(TOKENS, player({ tokenIds: ['t1'] }))).toEqual([{ id: 't2', name: 'Ladino' }])
  })

  it('sem sala mostra só Abrir sala e a dica', () => {
    const html = renderToStaticMarkup(<RoomPanel room={null} players={[]} tokens={TOKENS} {...handlers} />)
    expect(html).toContain('Abrir sala')
    expect(html).not.toContain('Fechar sala')
    expect(html).toContain(FIREWALL_HINT)
  })

  it('com sala mostra código, URLs, QR e jogadores; desconectado não tem Expulsar', () => {
    const room = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
    const players = [player(), player({ playerId: 'p2', clientId: null, name: 'Bia', connected: false, tokenIds: ['t2'] })]
    const html = renderToStaticMarkup(<RoomPanel room={room} players={players} tokens={TOKENS} {...handlers} />)
    expect(html).toContain('Fechar sala')
    expect(html).toContain('AB12CD')
    expect(html).toContain('http://10.0.0.2:7777')
    expect(html).toContain('alt="QR da sala"')
    expect(html).toContain('Bia — aguardando · desconectado')
    expect(html).toContain('Remover Ladino')
    expect(html.match(/Expulsar/g)).toHaveLength(1)
  })
})

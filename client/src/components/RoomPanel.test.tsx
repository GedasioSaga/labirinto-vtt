import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { PlayerInfo } from '../net/hostSession'
import { FIREWALL_HINT, LASER_HINT, PLAN_HINT, RoomPanel, TUNNEL_WARNING, assignOptionLabel, assignableTokens, downloadLabel, playerStatusLabel, qrDataUrl, tokenDotColor } from './RoomPanel'

const noop = vi.fn()
const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onRevealPlan: noop, onHidePlan: noop }
const TOKENS = [
  { id: 't1', name: 'Herói' },
  { id: 't2', name: 'Ladino' },
]
const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

function player(overrides: Partial<PlayerInfo> = {}): PlayerInfo {
  return { clientId: 'c1', playerId: 'p1', name: 'Ana', status: 'waiting', connected: true, tokenIds: [], visionRadius: 700, ...overrides }
}

function renderWithTunnel(tunnel: TunnelState): string {
  return renderToStaticMarkup(<RoomPanel room={ROOM} players={[]} tokens={TOKENS} tunnel={tunnel} {...handlers} />)
}

describe('RoomPanel', () => {
  it('botão Laser aparece com a sala aberta e reflete o estado em aria-pressed', () => {
    const off = renderToStaticMarkup(<RoomPanel room={ROOM} players={[]} tokens={TOKENS} tunnel={IDLE} {...handlers} onToggleLaser={noop} />)
    expect(off).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Laser<\/button>/)
    expect(off).toContain(LASER_HINT)
    const on = renderToStaticMarkup(<RoomPanel room={ROOM} players={[]} tokens={TOKENS} tunnel={IDLE} {...handlers} laserOn onToggleLaser={noop} />)
    expect(on).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Laser<\/button>/)
    const closed = renderToStaticMarkup(<RoomPanel room={null} players={[]} tokens={TOKENS} tunnel={IDLE} {...handlers} onToggleLaser={noop} />)
    expect(closed).not.toContain('>Laser<')
  })

  it('B3: card do jogador tem slider de raio com o valor efetivo, Revelar planta e Esconder de novo', () => {
    const html = renderToStaticMarkup(<RoomPanel room={ROOM} players={[player({ visionRadius: 350 })]} tokens={TOKENS} tunnel={IDLE} {...handlers} />)
    expect(html).toMatch(/<label class="lb-label" for="lb-room-vision-p1">Raio de visão<\/label>/)
    expect(html).toContain('350 px')
    expect(html).toMatch(/<input id="lb-room-vision-p1" class="lb-range" type="range" min="50" max="2000" step="50" value="350"\/>/)
    expect(html).toContain('>Revelar planta</button>')
    expect(html).toContain('>Esconder de novo</button>')
    expect(html).toContain(PLAN_HINT)
  })

  it('qrDataUrl codifica o SVG', () => {
    expect(qrDataUrl('<svg a="1"/>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%221%22%2F%3E')
  })

  it('playerStatusLabel e assignableTokens', () => {
    expect(playerStatusLabel(player())).toBe('aguardando · conectado')
    expect(playerStatusLabel(player({ status: 'playing', connected: false }))).toBe('jogando · desconectado')
    expect(assignableTokens(TOKENS, player({ tokenIds: ['t1'] }))).toEqual([{ id: 't2', name: 'Ladino' }])
  })

  it('lista de atribuir mostra o nome de cada token com bolinha de cor própria, sem os já atribuídos', () => {
    const tokens = [...TOKENS, { id: 't3', name: 'Token 1' }]
    const html = renderToStaticMarkup(<RoomPanel room={ROOM} players={[player({ tokenIds: ['t2'] })]} tokens={tokens} tunnel={IDLE} {...handlers} />)
    const options = [...html.matchAll(/<option value="(t\d)" style="color:([^"]+)">([^<]*)<\/option>/g)].map((m) => ({ id: m[1], color: m[2], label: m[3] }))
    expect(options).toEqual([
      { id: 't1', color: tokenDotColor('t1'), label: '● Herói' },
      { id: 't3', color: tokenDotColor('t3'), label: '● Token 1' },
    ])
    expect(assignOptionLabel({ id: 'x', name: 'Ladino' })).toBe('● Ladino')
  })

  it('tokenDotColor é estável por id e cai na paleta; ids diferentes podem ter cores diferentes', () => {
    expect(tokenDotColor('t1')).toBe(tokenDotColor('t1'))
    expect(tokenDotColor('t1')).toMatch(/^#[0-9a-f]{6}$/)
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(tokenDotColor))
    expect(colors.size).toBeGreaterThan(1)
  })

  it('sem sala mostra só Abrir sala e a dica', () => {
    const html = renderToStaticMarkup(<RoomPanel room={null} players={[]} tokens={TOKENS} tunnel={IDLE} {...handlers} />)
    expect(html).toContain('Abrir sala')
    expect(html).not.toContain('Fechar sala')
    expect(html).not.toContain('Tornar pública')
    expect(html).toContain(FIREWALL_HINT)
  })

  it('com sala mostra código, URLs, QR e jogadores; desconectado não tem Expulsar', () => {
    const players = [player(), player({ playerId: 'p2', clientId: null, name: 'Bia', connected: false, tokenIds: ['t2'] })]
    const html = renderToStaticMarkup(<RoomPanel room={ROOM} players={players} tokens={TOKENS} tunnel={IDLE} {...handlers} />)
    expect(html).toContain('Fechar sala')
    expect(html).toContain('AB12CD')
    expect(html).toContain('http://10.0.0.2:7777')
    expect(html).toContain('alt="QR da sala"')
    expect(html).toContain('Bia — aguardando · desconectado')
    expect(html).toContain('Remover Ladino')
    expect(html.match(/Expulsar/g)).toHaveLength(1)
  })

  it('idle: botão Tornar pública habilitado e dica do firewall rotulada como rede local', () => {
    const html = renderWithTunnel(IDLE)
    expect(html).toMatch(/<button type="button" class="lb-btn lb-btn--block">Tornar pública<\/button>/)
    expect(html).toContain('Rede local')
    expect(html).toContain(FIREWALL_HINT)
    expect(html).not.toContain('Link público')
  })

  it('downloading: porcentagem com role status e botão desabilitado', () => {
    expect(downloadLabel(0.426)).toBe('Baixando cloudflared 43%')
    const html = renderWithTunnel({ kind: 'downloading', progress: 0.43 })
    expect(html).toContain('<p class="lb-label" role="status">Baixando cloudflared 43%</p>')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Tornar pública<\/button>/)
  })

  it('connecting: texto de conexão e botão desabilitado', () => {
    const html = renderWithTunnel({ kind: 'connecting' })
    expect(html).toContain('Conectando ao túnel…')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Tornar pública<\/button>/)
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Cancelar<\/button>/)
  })

  it('downloading: botão Cancelar habilitado para desistir do download', () => {
    const html = renderWithTunnel({ kind: 'downloading', progress: 0.1 })
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Cancelar<\/button>/)
  })

  it('idle e ready: sem botão Cancelar', () => {
    expect(renderWithTunnel({ kind: 'idle' })).not.toContain('>Cancelar<')
    expect(renderWithTunnel({ kind: 'ready', url: 'https://a-b.trycloudflare.com/player', qrSvg: '<svg/>' })).not.toContain('>Cancelar<')
  })

  it('error: mensagem acima do botão Tornar pública', () => {
    const html = renderWithTunnel({ kind: 'error', message: 'sem internet' })
    expect(html).toContain('role="alert">sem internet</p>')
    expect(html.indexOf('sem internet')).toBeLessThan(html.indexOf('Tornar pública'))
    expect(html).not.toMatch(/disabled=""[^>]*>Tornar pública/)
  })

  it('ready: link, QR público no lugar do da LAN, aviso, encerrar; código e URLs da LAN continuam', () => {
    const url = 'https://abc-def.trycloudflare.com'
    const html = renderWithTunnel({ kind: 'ready', url, qrSvg: '<svg id="pub"/>' })
    expect(html).toContain('Link público')
    expect(html).toContain(`<strong class="lb-room__link">${url}</strong>`)
    expect(html).toContain('alt="QR do link público"')
    expect(html).toContain(qrDataUrl('<svg id="pub"/>').replace(/&/g, '&amp;'))
    expect(html).not.toContain('alt="QR da sala"')
    expect(html).toContain(TUNNEL_WARNING)
    expect(html).toContain('Encerrar link público')
    expect(html).not.toContain('Tornar pública')
    expect(html).toContain('AB12CD')
    expect(html).toContain('http://10.0.0.2:7777')
  })
})

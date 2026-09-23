import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Token } from '../types/map'
import type { PlayerInfo } from './hostSession'
import { createHostBridge, DROP_ANNOUNCE_DELAY_MS, HOST_AWAY_STALE_AFTER_MS, HOST_STALE_AFTER_MS, LIVENESS_SWEEP_MS } from './hostBridge'
import { PING_INTERVAL_MS } from '../player/playerConnection'

/**
 * RECONEXÃO AUTOMÁTICA, lado do mestre: "Gina caiu" quando alguém cai (quedas
 * juntas viram UM aviso), "Gina voltou" quando volta. Piscar de Wi-Fi que volta
 * antes do aviso não vira aviso nenhum.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null }
}

async function mesa() {
  let relogio = 1_000
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  let players: PlayerInfo[] = []
  const map = { ...createEmptyMap('m', 'Mapa', 30, 10, 50), tokens: [ficha('f-gina', 100), ficha('f-bruno', 200), ficha('f-ana', 300)] }
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => map,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: (list) => {
      players = list
    },
    now: () => relogio,
  })
  await bridge.start()
  const emit = (event: string, payload: unknown) => {
    const handler = handlers.get(event)
    if (handler === undefined) throw new Error(`sem listener de ${event}`)
    handler({ payload })
  }
  const tokens = new Map<string, string>()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
    // O resume que o welcome levou a este jogador.
    const welcome = invoke.mock.calls
      .filter((call) => call[0] === 'net_send')
      .map((call) => JSON.stringify(call[1]))
      .find((text) => text.includes(`"clientId":"${clientId}"`) && text.includes('"welcome"'))
    const match = /"resumeToken":"([^"]+)"/.exec(welcome ?? '')
    if (match?.[1] === undefined) throw new Error('sem resumeToken')
    tokens.set(name, match[1])
  }
  const cai = (clientId: string) => emit('net:peer', { clientId, event: 'disconnected' })
  const volta = (clientId: string, name: string) =>
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name, resume: tokens.get(name) } })
  entra('c1', 'Gina', 'f-gina')
  entra('c2', 'Bruno', 'f-bruno')
  entra('c3', 'Ana', 'f-ana')
  useToastStore.setState({ toasts: [] })
  return {
    bridge,
    invoke,
    cai,
    volta,
    ping: (clientId: string) => emit('net:message', { clientId, msg: { type: 'ping' } }),
    /** Ping da aba em segundo plano. */
    pingAway: (clientId: string) => emit('net:message', { clientId, msg: { type: 'ping', away: true } }),
    avanca: (ms: number) => {
      relogio += ms
      vi.advanceTimersByTime(ms)
    },
    /** O tempo passa com estas conexões mandando o ping de sempre (o cliente vivo). */
    avancaComPing: (ms: number, ...clientIds: string[]) => {
      for (let t = 0; t < ms; t += PING_INTERVAL_MS) {
        const passo = Math.min(PING_INTERVAL_MS, ms - t)
        relogio += passo
        vi.advanceTimersByTime(passo)
        for (const clientId of clientIds) emit('net:message', { clientId, msg: { type: 'ping' } })
      }
    },
    textos: () => useToastStore.getState().toasts.map((t) => t.text),
    players: () => players,
    agora: () => relogio,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('hostBridge: quem caiu e quem voltou', () => {
  it('"Gina caiu" aparece pouco depois da queda, e o Grupo sabe desde quando', async () => {
    const m = await mesa()
    m.cai('c1')
    const quedaEm = m.agora()
    expect(m.players().find((p) => p.name === 'Gina')).toMatchObject({ connected: false, disconnectedAt: quedaEm })
    m.avanca(DROP_ANNOUNCE_DELAY_MS)
    expect(m.textos()).toContain('Gina caiu')
    expect(DROP_ANNOUNCE_DELAY_MS).toBeLessThanOrEqual(5_000)
  })

  it('quedas juntas viram UM aviso', async () => {
    const m = await mesa()
    m.cai('c1')
    m.avanca(500)
    m.cai('c2')
    m.avanca(500)
    m.cai('c3')
    m.avanca(DROP_ANNOUNCE_DELAY_MS)
    const quedas = m.textos().filter((t) => t.includes('caí') || t.includes('caiu'))
    expect(quedas).toEqual(['Gina, Bruno e Ana caíram'])
  })

  it('duas quedas juntas: "Gina e Bruno caíram"', async () => {
    const m = await mesa()
    m.cai('c1')
    m.cai('c2')
    m.avanca(DROP_ANNOUNCE_DELAY_MS)
    expect(m.textos()).toContain('Gina e Bruno caíram')
  })

  it('Wi-Fi que pisca e volta antes do aviso: nem "caiu" nem "voltou"', async () => {
    const m = await mesa()
    m.cai('c1')
    m.avanca(800)
    m.volta('c9', 'Gina')
    m.avancaComPing(DROP_ANNOUNCE_DELAY_MS * 2, 'c9', 'c2', 'c3')
    expect(m.textos().filter((t) => t.includes('Gina'))).toEqual([])
  })

  it('volta depois do aviso: "Gina voltou", e o "Gina caiu" sai da tela', async () => {
    const m = await mesa()
    m.cai('c1')
    m.avanca(DROP_ANNOUNCE_DELAY_MS)
    expect(m.textos()).toContain('Gina caiu')
    m.avancaComPing(10_000, 'c2', 'c3')
    m.volta('c9', 'Gina')
    expect(m.textos()).toContain('Gina voltou')
    expect(m.textos()).not.toContain('Gina caiu')
    const gina = m.players().find((p) => p.name === 'Gina')
    expect(gina?.connected).toBe(true)
    expect(gina?.disconnectedAt).toBeUndefined()
  })
})

/**
 * CONEXÃO MORTA QUE NÃO FECHA: o Wi-Fi do celular some sem FIN, e o Rust só
 * saberia da queda minutos depois. O host guarda a hora da última mensagem
 * de cada conexão (o ping do cliente chega a cada `PING_INTERVAL_MS`); uma
 * varredura dá como caído quem passou do prazo — pelo MESMO caminho da queda
 * com `close`: Grupo "fora", aviso "Gina caiu".
 */
describe('hostBridge: varredura de quem sumiu sem fechar', () => {
  /** Bruno e Ana seguem mandando ping; Gina sumiu sem aviso. */
  const passaComGinaMuda = (m: Awaited<ReturnType<typeof mesa>>, total: number) => {
    for (let t = 0; t < total; t += 1_000) {
      m.avanca(1_000)
      if ((t + 1_000) % PING_INTERVAL_MS === 0) {
        m.ping('c2')
        m.ping('c3')
      }
    }
  }

  it('Gina muda: em até 0:10 o Grupo a mostra fora (desde o último sinal) e sai "Gina caiu"', async () => {
    const m = await mesa()
    const ultimoSinal = m.agora()
    passaComGinaMuda(m, 10_000)
    const gina = m.players().find((p) => p.name === 'Gina')
    expect(gina).toMatchObject({ connected: false, disconnectedAt: ultimoSinal })
    expect(m.textos()).toContain('Gina caiu')
    // Só ela: quem mandou ping segue na sala.
    expect(m.players().filter((p) => p.connected).map((p) => p.name)).toEqual(['Bruno', 'Ana'])
    // A conexão zumbi é derrubada no Rust: se ela ressuscitar, o cliente vê o close e volta pelo resume.
    expect(m.invoke.mock.calls).toContainEqual(['net_kick', { clientId: 'c1' }])
    // O prazo cabe no aceite: detectar + avisar em até 10 s.
    expect(HOST_STALE_AFTER_MS + LIVENESS_SWEEP_MS + DROP_ANNOUNCE_DELAY_MS).toBeLessThanOrEqual(10_000)
    expect(HOST_STALE_AFTER_MS).toBeGreaterThanOrEqual(2 * PING_INTERVAL_MS)
  })

  it('quem só manda ping fica na sala por quanto tempo for, e cada ping recebe pong', async () => {
    const m = await mesa()
    for (let t = 0; t < 60_000; t += PING_INTERVAL_MS) {
      m.avanca(PING_INTERVAL_MS)
      m.ping('c1')
      m.ping('c2')
      m.ping('c3')
    }
    expect(m.players().every((p) => p.connected)).toBe(true)
    expect(m.textos().filter((t) => t.includes('caiu') || t.includes('caíram'))).toEqual([])
    expect(m.invoke.mock.calls.some((call) => call[0] === 'net_kick')).toBe(false)
    const pongs = m.invoke.mock.calls.filter((call) => call[0] === 'net_send' && JSON.stringify(call[1]) === '{"clientId":"c1","msg":{"type":"pong"}}')
    expect(pongs.length).toBeGreaterThan(0)
  })

  it('o close que o Rust manda depois do kick não vira um segundo "Gina caiu"', async () => {
    const m = await mesa()
    passaComGinaMuda(m, 10_000)
    m.cai('c1')
    m.avanca(DROP_ANNOUNCE_DELAY_MS * 2)
    expect(m.textos().filter((t) => t.includes('Gina'))).toEqual(['Gina caiu'])
  })

  it('volta pelo resume depois da varredura: "Gina voltou"', async () => {
    const m = await mesa()
    passaComGinaMuda(m, 10_000)
    m.volta('c9', 'Gina')
    expect(m.textos()).toContain('Gina voltou')
    expect(m.players().find((p) => p.name === 'Gina')?.connected).toBe(true)
  })

  it('sala fechada: a varredura para (ninguém é dado como caído depois)', async () => {
    const m = await mesa()
    await m.bridge.stop()
    m.invoke.mockClear()
    m.avanca(HOST_STALE_AFTER_MS * 5)
    expect(m.invoke.mock.calls).toEqual([])
    expect(m.textos().filter((t) => t.includes('caiu') || t.includes('caíram'))).toEqual([])
  })
})

/**
 * ABA EM SEGUNDO PLANO: com a aba oculta há mais de 5 min, o Chrome e o Edge
 * rodam o timer do ping 1 vez por minuto (intensive wake-up throttling; ter
 * WebSocket aberto não isenta). O ping chega marcado com `away: true`, e o
 * host espera `HOST_AWAY_STALE_AFTER_MS` em vez de 6 s — senão o jogador que
 * foi ler a ficha num PDF cairia e voltaria a cada minuto.
 */
describe('hostBridge: aba do jogador em segundo plano', () => {
  const MINUTO = 60_000
  /** Bruno e Ana à vista (ping a cada 2 s); Gina com a aba oculta, ping marcado de minuto em minuto. */
  const passaComGinaOculta = (m: Awaited<ReturnType<typeof mesa>>, total: number) => {
    for (let t = 0; t < total; t += 1_000) {
      m.avanca(1_000)
      if ((t + 1_000) % PING_INTERVAL_MS === 0) {
        m.ping('c2')
        m.ping('c3')
      }
      if ((t + 1_000) % MINUTO === 0) m.pingAway('c1')
    }
  }

  it('ping de minuto em minuto com a aba oculta: 10 min na sala, sem "Gina caiu" e sem kick', async () => {
    const m = await mesa()
    m.pingAway('c1')
    passaComGinaOculta(m, 10 * MINUTO)
    expect(m.players().find((p) => p.name === 'Gina')).toMatchObject({ connected: true })
    expect(m.players().every((p) => p.connected)).toBe(true)
    expect(m.textos().filter((t) => t.includes('Gina'))).toEqual([])
    expect(m.invoke.mock.calls.some((call) => call[0] === 'net_kick')).toBe(false)
  })

  it('o prazo da aba oculta cobre um despertar de minuto perdido, e só vale para quem avisou', () => {
    expect(HOST_AWAY_STALE_AFTER_MS).toBeGreaterThanOrEqual(2 * MINUTO)
    expect(HOST_AWAY_STALE_AFTER_MS).toBeLessThanOrEqual(3 * MINUTO)
    expect(HOST_STALE_AFTER_MS).toBe(6_000)
  })

  it('a aba voltou à vista (ping comum): o prazo curto volta a valer', async () => {
    const m = await mesa()
    m.pingAway('c1')
    m.avancaComPing(30_000, 'c2', 'c3')
    expect(m.players().find((p) => p.name === 'Gina')).toMatchObject({ connected: true })
    m.ping('c1')
    const ultimoSinal = m.agora()
    m.avancaComPing(10_000, 'c2', 'c3')
    expect(m.players().find((p) => p.name === 'Gina')).toMatchObject({ connected: false, disconnectedAt: ultimoSinal })
    expect(m.textos()).toContain('Gina caiu')
    expect(m.invoke.mock.calls).toContainEqual(['net_kick', { clientId: 'c1' }])
  })

  it('aba oculta que parou de vez (congelada): cai depois do prazo longo, com um aviso só', async () => {
    const m = await mesa()
    m.pingAway('c1')
    const ultimoSinal = m.agora()
    m.avancaComPing(HOST_AWAY_STALE_AFTER_MS - 2_000, 'c2', 'c3')
    expect(m.players().find((p) => p.name === 'Gina')).toMatchObject({ connected: true })
    m.avancaComPing(2_000 + LIVENESS_SWEEP_MS + DROP_ANNOUNCE_DELAY_MS, 'c2', 'c3')
    expect(m.players().find((p) => p.name === 'Gina')).toMatchObject({ connected: false, disconnectedAt: ultimoSinal })
    expect(m.textos().filter((t) => t.includes('Gina'))).toEqual(['Gina caiu'])
  })
})

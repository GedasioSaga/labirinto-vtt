/**
 * CONTAS DOS JOGADORES na ponte do mestre: a entrada com nome + PIN passa pela
 * porta (`entradaComConta.ts`) antes da sessão, recebe o `welcome`, as fichas
 * dos personagens da conta e, UMA vez, o segredo do aparelho; com o segredo, o
 * aparelho entra sozinho (de novo o mesmo jogador); a recusa responde e derruba
 * a conexão; a ponte sem contas (a Visão de jogador) recusa sem ler conta.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { guardarPin, serializarContas, type ArquivoDeContas } from '../lib/contasDosJogadores'
import { createEmptyMap } from '../lib/mapFactory'
import { novoPersonagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { useToastStore } from '../stores/toastStore'
import type { HostWorld } from './hostSession'
import { createHostBridge, type HostBridge } from './hostBridge'
import { criarPortaDasContas } from './entradaComConta'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const PIN = '8642'
const LIRIO = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Lírio'), id: 'pers_lirio', dono: 'conta_ana' }

const world = (): HostWorld => ({
  open: {
    sceneId: 'cena-a',
    name: 'Salão',
    map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: [{ id: 'ficha-lirio', characterId: LIRIO.id, name: 'Lírio', x: 200, y: 200, size: 1, image: null }] },
  },
  background: [],
  rpg: { sistema: SISTEMA_ONE_PIECE, personagens: [LIRIO] },
})

let aberta: HostBridge | null = null

afterEach(async () => {
  await aberta?.stop()
  aberta = null
})

async function mesa(opcoes: { comContas?: boolean; soComConta?: boolean } = {}) {
  useToastStore.setState({ toasts: [] })
  let arquivo: ArquivoDeContas = { soComConta: opcoes.soComConta === true, contas: [{ id: 'conta_ana', nome: 'Ana', pin: await guardarPin(PIN), aparelhos: [], criada: 1 }] }
  const porta = criarPortaDasContas({
    prontas: async () => undefined,
    ler: () => arquivo,
    alterar: async (mudar) => {
      arquivo = mudar(arquivo)
    },
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    ...(opcoes.comContas === false ? {} : { contas: porta }),
  })
  aberta = bridge
  const emit = (channel: string, payload: unknown) => {
    const handler = handlers.get(channel)
    if (handler === undefined) throw new Error(`sem listener de ${channel}`)
    handler({ payload })
  }
  const sentTo = (clientId: string) =>
    invoke.mock.calls.filter((call) => call[0] === 'net_send').flatMap((call) => {
      const args = call[1]
      return typeof args === 'object' && args !== null && 'clientId' in args && 'msg' in args && args.clientId === clientId ? [args.msg] : []
    })
  const kicked = (clientId: string) => invoke.mock.calls.some((call) => call[0] === 'net_kick' && JSON.stringify(call[1]) === JSON.stringify({ clientId }))
  const join = (clientId: string, extra: Record<string, unknown>) => emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name: 'Ana', ...extra } })
  await bridge.start()
  return { bridge, join, emit, sentTo, kicked, arquivo: () => arquivo }
}

const tipoDe = (msg: unknown): unknown => (typeof msg === 'object' && msg !== null && 'type' in msg ? msg.type : undefined)

describe('hostBridge: entrar com a conta', () => {
  it('nome + PIN: welcome, a ficha do personagem da conta e o segredo do aparelho (guardado só como hash)', async () => {
    const { bridge, join, sentTo, arquivo } = await mesa()
    join('c1', { pin: PIN, deviceLabel: 'Chrome no Android' })
    await vi.waitFor(() => expect(sentTo('c1').map(tipoDe)).toContain('account.device'), { timeout: 5000 })
    const tipos = sentTo('c1').map(tipoDe)
    expect(tipos[0]).toBe('welcome')
    expect(tipos.indexOf('account.device')).toBeGreaterThan(0)
    expect(bridge.players().find((p) => p.name === 'Ana')).toMatchObject({ status: 'playing', tokenIds: ['ficha-lirio'] })
    const device = sentTo('c1').find((msg) => tipoDe(msg) === 'account.device')
    const token = typeof device === 'object' && device !== null && 'token' in device ? String(device.token) : ''
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(arquivo().contas[0].aparelhos).toHaveLength(1)
    expect(serializarContas(arquivo())).not.toContain(token)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toContain('Ana entrou com a conta e recebeu Lírio.')
    // Nem o PIN, nem o segredo, nem o hash vão em outra mensagem a quem quer que seja.
    const resto = JSON.stringify(sentTo('c1').filter((msg) => tipoDe(msg) !== 'account.device'))
    expect(resto).not.toContain(token)
    expect(resto).not.toContain(PIN)
    expect(resto).not.toContain(arquivo().contas[0].aparelhos[0].hash)
    expect(resto).not.toContain(arquivo().contas[0].pin.hash)
  })

  it('o aparelho lembrado entra sozinho, de outra conexão, como o MESMO jogador; não ganha segredo novo', async () => {
    const { join, sentTo, emit } = await mesa()
    join('c1', { pin: PIN })
    await vi.waitFor(() => expect(sentTo('c1').map(tipoDe)).toContain('account.device'), { timeout: 5000 })
    const primeira = sentTo('c1')
    const welcome = primeira[0]
    const device = primeira.find((msg) => tipoDe(msg) === 'account.device')
    const token = typeof device === 'object' && device !== null && 'token' in device ? String(device.token) : ''
    emit('net:peer', { clientId: 'c1', event: 'disconnected' })
    join('c2', { device: token })
    await vi.waitFor(() => expect(sentTo('c2').map(tipoDe)).toContain('welcome'), { timeout: 5000 })
    const segundo = sentTo('c2')[0]
    expect(typeof segundo === 'object' && segundo !== null && 'playerId' in segundo ? segundo.playerId : null).toBe(
      typeof welcome === 'object' && welcome !== null && 'playerId' in welcome ? welcome.playerId : 'x',
    )
    expect(sentTo('c2').map(tipoDe)).not.toContain('account.device')
  })

  it('PIN errado: a mesma recusa de nome errado, e a conexão cai', async () => {
    const { join, sentTo, kicked, emit } = await mesa()
    join('c1', { pin: '1111' })
    emit('net:message', { clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Zeca', pin: PIN } })
    await vi.waitFor(() => expect(kicked('c1') && kicked('c2')).toBe(true), { timeout: 5000 })
    expect(sentTo('c1')).toEqual([{ type: 'account.refused', reason: 'invalid' }])
    expect(sentTo('c2')).toEqual(sentTo('c1'))
  })

  it('aparelho esquecido: "device" e a conexão cai', async () => {
    const { join, sentTo, kicked } = await mesa()
    join('c1', { device: 'b'.repeat(43) })
    await vi.waitFor(() => expect(kicked('c1')).toBe(true), { timeout: 5000 })
    expect(sentTo('c1')).toEqual([{ type: 'account.refused', reason: 'device' }])
  })

  it('"Só com conta": só o nome é recusado e cai; com a conta, entra', async () => {
    const { emit, join, sentTo, kicked } = await mesa({ soComConta: true })
    emit('net:message', { clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Bia' } })
    expect(sentTo('c1')).toEqual([{ type: 'error', reason: 'account_required' }])
    await vi.waitFor(() => expect(kicked('c1')).toBe(true))
    join('c2', { pin: PIN })
    await vi.waitFor(() => expect(sentTo('c2').map(tipoDe)).toContain('welcome'), { timeout: 5000 })
  })

  it('a ponte sem contas (a Visão de jogador) recusa o PIN sem conferir nada, e a conexão cai', async () => {
    const { join, sentTo, kicked, arquivo } = await mesa({ comContas: false })
    const antes = arquivo()
    join('c1', { pin: PIN })
    expect(sentTo('c1')).toEqual([{ type: 'account.refused', reason: 'unavailable' }])
    await vi.waitFor(() => expect(kicked('c1')).toBe(true))
    expect(arquivo()).toBe(antes)
  })
})

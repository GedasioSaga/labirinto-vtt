// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token, Wall } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'
import { abrirPacote, COMPRIMIR_A_PARTIR_DE } from './pacoteComprimido'

/**
 * PACOTE COMPRIMIDO pela ponte do mestre: o jogador que disse no `join` que
 * abre gzip recebe o mapa grande no envelope `{"gz":...}`; aberto, ele é
 * exatamente o que o jogador sem gzip recebe, na mesma ordem. Quem não
 * declarou (cliente antigo) recebe texto como sempre.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const ficha: Token = { id: 'ficha-ana', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }

/** Um corredor comprido de paredes: o mapa que o jogador recebe passa do limite de compressão. */
const paredes: Wall[] = Array.from({ length: 900 }, (_, i) => ({
  id: `parede-${i}`,
  x1: i * 10,
  y1: 0,
  x2: i * 10 + 10,
  y2: 0,
  blocksLight: false,
  blocksMove: true,
  door: null,
}))

const world = (): HostWorld => ({
  open: { sceneId: 'cena-a', name: 'Corredor', map: { ...createEmptyMap('mapa-a', 'A', 9000, 400, 50), walls: paredes, tokens: [ficha] } },
  background: [],
})

function ponte() {
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
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  /** O que saiu para cada cliente, na ordem do `net_send`. */
  const sent = (): unknown[] => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  return { bridge, emit, sent }
}

function msgDe(envio: unknown): unknown {
  return typeof envio === 'object' && envio !== null ? Reflect.get(envio, 'msg') : undefined
}

/** Abre o envelope, se for um; senão devolve a mensagem como veio. */
async function aberta(msg: unknown): Promise<unknown> {
  if (typeof msg !== 'object' || msg === null) return msg
  const gz: unknown = Reflect.get(msg, 'gz')
  if (typeof gz !== 'string') return msg
  const texto = await abrirPacote(gz)
  if (texto === null) throw new Error('pacote não abriu')
  return JSON.parse(texto)
}

/** `playerId` e `resumeToken` são sorteados a cada sessão: a comparação entre duas pontes os ignora. */
function semIdsSorteados(msg: unknown): unknown {
  return JSON.parse(JSON.stringify(msg, (chave: string, valor: unknown) => (chave === 'playerId' || chave === 'resumeToken' ? 'sorteado' : valor)))
}

async function entraEJoga(accept: string[] | undefined) {
  const p = ponte()
  await p.bridge.start()
  const join = { type: 'join', code: ROOM.code, name: 'Ana', ...(accept === undefined ? {} : { accept }) }
  p.emit({ clientId: 'c1', msg: join })
  const player = p.bridge.players().find((j) => j.name === 'Ana')
  if (player === undefined) throw new Error('Ana deveria ter entrado')
  p.bridge.assignToken(player.playerId, 'ficha-ana')
  p.emit({ clientId: 'c1', msg: { type: 'ping' } })
  return p
}

describe('hostBridge: pacote comprimido', () => {
  it('cliente antigo (sem accept) recebe o mapa grande em texto, como sempre', async () => {
    const { sent } = await entraEJoga(undefined)
    await vi.waitFor(() => expect(sent().length).toBeGreaterThan(2))
    const msgs = sent().map(msgDe)
    expect(msgs.some((m) => typeof m === 'object' && m !== null && 'gz' in m)).toBe(false)
    // Pré-condição do teste: há mesmo uma mensagem acima do limite.
    expect(Math.max(...msgs.map((m) => JSON.stringify(m).length))).toBeGreaterThanOrEqual(COMPRIMIR_A_PARTIR_DE)
  })

  it('quem pediu gzip recebe o mapa grande no envelope, menor, e a mesma sequência depois de aberta', async () => {
    const antigo = await entraEJoga(undefined)
    const novo = await entraEJoga(['gzip'])
    await vi.waitFor(() => expect(novo.sent()).toHaveLength(antigo.sent().length))
    const cru = novo.sent().map(msgDe)
    const pacotes: unknown[] = cru.filter((m) => typeof m === 'object' && m !== null && 'gz' in m)
    expect(pacotes.length).toBeGreaterThanOrEqual(1)
    // Todo o que ficou acima do limite foi comprimido; e o envelope é bem menor.
    for (const m of cru) if (!pacotes.includes(m)) expect(JSON.stringify(m).length).toBeLessThan(COMPRIMIR_A_PARTIR_DE)
    const maiorAntigo = Math.max(...antigo.sent().map((e) => JSON.stringify(msgDe(e)).length))
    const maiorPacote = Math.max(...pacotes.map((m) => JSON.stringify(m).length))
    expect(maiorPacote * 5).toBeLessThan(maiorAntigo)
    // Aberto, é exatamente o que o cliente antigo recebeu, na mesma ordem.
    const abertas = await Promise.all(cru.map(aberta))
    expect(abertas.map(semIdsSorteados)).toEqual(antigo.sent().map(msgDe).map(semIdsSorteados))
  })
})

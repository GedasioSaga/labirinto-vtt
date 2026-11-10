/**
 * CUTSCENES pela ponte do mestre (09/11/2026, "deixe tudo carregado primeiro
 * para aí sim tocar"): a tela viva que ainda carrega segura a ordem de tocar
 * além do prazo da tela muda, e a abertura que o mestre marcou é mandada
 * aquecer a quem está na sala e a quem entra depois.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import { pretenderAbertura } from '../transicoes/intencao'
import { BATIDA_DE_CARREGANDO_MS, PRAZO_DA_LARGADA_MS } from '../transicoes/largada'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const ABERTURA = 'espadas-cruzadas'

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: id, x, y: 100, size: 1, image: null }
}

const VILA: HostWorld = {
  open: { sceneId: 's-vila', name: 'Vila', map: { ...createEmptyMap('m-vila', 'Vila', 30, 10, 50), tokens: [ficha('t-ana', 100), ficha('t-bruno', 700)] } },
  background: [],
}

interface Envio {
  clientId: string
  tipo: string
  msg: object
}

/** O `net_send` que saiu, lido sem confiar na forma. */
function lerEnvio(args: unknown): Envio | null {
  if (typeof args !== 'object' || args === null || !('clientId' in args) || !('msg' in args)) return null
  const { clientId, msg } = args
  if (typeof clientId !== 'string' || typeof msg !== 'object' || msg === null || !('type' in msg) || typeof msg.type !== 'string') return null
  return { clientId, tipo: msg.type, msg }
}

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return () => {}
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => VILA.open.map,
    getWorld: () => VILA,
    applyMove: () => {},
    applyDoor: () => {},
    now: () => 0,
  })
  await bridge.start()
  const chegar = (clientId: string, msg: unknown) => handlers.get('net:message')?.({ payload: { clientId, msg } })
  const entrar = (clientId: string, name: string) => chegar(clientId, { type: 'join', code: ROOM.code, name })
  entrar('c-ana', 'Ana')
  entrar('c-bruno', 'Bruno')
  const ids = Object.fromEntries(bridge.players().map((p) => [p.name, p.playerId]))
  bridge.assignToken(ids.Ana, 't-ana')
  bridge.assignToken(ids.Bruno, 't-bruno')
  const enviados = (tipo: string): Envio[] =>
    invoke.mock.calls.flatMap((call) => {
      const envio = call[0] === 'net_send' ? lerEnvio(call[1]) : null
      return envio !== null && envio.tipo === tipo ? [envio] : []
    })
  return { bridge, chegar, entrar, enviados }
}

afterEach(() => {
  vi.useRealTimers()
  pretenderAbertura(null)
})

describe('hostBridge: largada combinada com tela viva e tela muda', () => {
  it('o aviso da abertura pede a batida, e a tela muda só segura a ordem pelo prazo curto', async () => {
    const { bridge, chegar, enviados } = await mesa()
    vi.useFakeTimers()
    bridge.anunciarBatalha({ sceneKey: 's-vila', transicao: ABERTURA })
    const avisos = enviados('batalha.iniciada')
    expect(avisos.map((aviso) => aviso.clientId).sort()).toEqual(['c-ana', 'c-bruno'])
    expect(avisos[0]?.msg).toMatchObject({ transicao: ABERTURA, preparo: 1, batidaMs: BATIDA_DE_CARREGANDO_MS })
    // A Ana fica pronta; o Bruno nunca diz nada (cliente antigo, aba travada).
    chegar('c-ana', { type: 'cutscene.pronta', preparo: 1 })
    vi.advanceTimersByTime(PRAZO_DA_LARGADA_MS - 1)
    expect(enviados('cutscene.tocar')).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(enviados('cutscene.tocar').map((ordem) => ordem.clientId).sort()).toEqual(['c-ana', 'c-bruno'])
  })

  it('a tela viva que bate "carregando" segura a ordem além do prazo curto, e a ordem sai quando ela fica pronta', async () => {
    const { bridge, chegar, enviados } = await mesa()
    vi.useFakeTimers()
    bridge.anunciarBatalha({ sceneKey: 's-vila', transicao: ABERTURA })
    chegar('c-ana', { type: 'cutscene.pronta', preparo: 1 })
    for (let passou = 0; passou < PRAZO_DA_LARGADA_MS * 2; passou += BATIDA_DE_CARREGANDO_MS) {
      chegar('c-bruno', { type: 'cutscene.carregando', preparo: 1 })
      vi.advanceTimersByTime(BATIDA_DE_CARREGANDO_MS)
    }
    expect(enviados('cutscene.tocar')).toHaveLength(0)
    chegar('c-bruno', { type: 'cutscene.pronta', preparo: 1 })
    expect(enviados('cutscene.tocar').map((ordem) => ordem.clientId).sort()).toEqual(['c-ana', 'c-bruno'])
    // A batida não vira pedido de sessão: ninguém foi derrubado por mandar mensagem estranha.
    expect(bridge.players().filter((p) => p.connected)).toHaveLength(2)
  })
})

describe('hostBridge: aquecer pela intenção', () => {
  it('a abertura que o mestre marcou vai a todos uma vez, e depois só a quem entra', async () => {
    const { entrar, enviados } = await mesa()
    pretenderAbertura('tiro-na-tela')
    pretenderAbertura('tiro-na-tela')
    expect(enviados('cutscene.aquecer').map((pedido) => pedido.clientId).sort()).toEqual(['c-ana', 'c-bruno'])
    expect(enviados('cutscene.aquecer')[0]?.msg).toEqual({ type: 'cutscene.aquecer', abertura: 'tiro-na-tela' })
    entrar('c-caio', 'Caio')
    expect(enviados('cutscene.aquecer').map((pedido) => pedido.clientId).sort()).toEqual(['c-ana', 'c-bruno', 'c-caio'])
  })

  it('sem marca do mestre, quem entra depois de uma batalha aquece a abertura que a sala tocou', async () => {
    const { bridge, entrar, enviados } = await mesa()
    bridge.anunciarBatalha({ sceneKey: 's-vila', transicao: ABERTURA })
    // Quem recebeu a abertura para tocar não recebe o recado de aquecer.
    expect(enviados('cutscene.aquecer')).toHaveLength(0)
    entrar('c-caio', 'Caio')
    expect(enviados('cutscene.aquecer').map((pedido) => [pedido.clientId, pedido.msg])).toEqual([['c-caio', { type: 'cutscene.aquecer', abertura: ABERTURA }]])
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * "MOSTRAR AGORA A…" do lado do integrador: o cartão sai NA HORA, só para o
 * escolhido; a lista "Quem vê" nova sai no snapshot e no painel do mestre.
 * Sala fechada: nada sai.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const TEXTO = 'Carta: encontre-me na capela'

const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 200, size: 1, image: null })
const CARTA: Pin = { id: 'carta', x: 300, y: 200, kind: 'exclamacao', description: TEXTO, image: null }
const MAPA: MapData = { ...createEmptyMap('m', 'Quarto', 40, 10, 50), tokens: [ficha('ficha-gabi', 200), ficha('ficha-diego', 250)], pins: [CARTA] }

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const onPinAudiencesChange = vi.fn()
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => MAPA,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    onPinAudiencesChange,
    now: () => 0,
  })
  await bridge.start()
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const entra = (clientId: string, name: string, tokenId: string): string => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
    return player.playerId
  }
  const gabi = entra('c-gabi', 'Gabi', 'ficha-gabi')
  const diego = entra('c-diego', 'Diego', 'ficha-diego')
  /** Tipos de mensagem enviados a `clientId`, na ordem. */
  const tiposPara = (clientId: string): string[] =>
    invoke.mock.calls.flatMap((call) => {
      const envio = call[1]
      if (call[0] !== 'net_send' || typeof envio !== 'object' || envio === null || !('clientId' in envio) || !('msg' in envio)) return []
      if (envio.clientId !== clientId) return []
      const msg = envio.msg
      return typeof msg === 'object' && msg !== null && 'type' in msg && typeof msg.type === 'string' ? [msg.type] : []
    })
  return { bridge, gabi, diego, tiposPara, invoke, onPinAudiencesChange }
}

describe('hostBridge: "Mostrar agora a…"', () => {
  it('o cartão sai na hora só para Gabi; Diego não recebe pin.show', async () => {
    const { bridge, gabi, tiposPara } = await mesa()
    expect(bridge.showPin(gabi, 'carta')).toBe(true)
    expect(tiposPara('c-gabi')).toContain('pin.show')
    expect(tiposPara('c-diego')).not.toContain('pin.show')
  })

  it('com "Só estes", Gabi entra na lista: o painel do mestre recebe a lista nova', async () => {
    const { bridge, gabi, onPinAudiencesChange } = await mesa()
    bridge.setPinAudience('carta', [])
    expect(bridge.showPin(gabi, 'carta')).toBe(true)
    expect(onPinAudiencesChange).toHaveBeenLastCalledWith({ carta: [gabi] })
  })

  it('pino que não existe: false e nada sai; sala fechada: null', async () => {
    const { bridge, gabi, tiposPara } = await mesa()
    expect(bridge.showPin(gabi, 'inventado')).toBe(false)
    expect(tiposPara('c-gabi')).not.toContain('pin.show')
    await bridge.stop()
    expect(bridge.showPin(gabi, 'carta')).toBeNull()
    expect(tiposPara('c-gabi')).not.toContain('pin.show')
  })
})

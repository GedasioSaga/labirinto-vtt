import { beforeEach, describe, expect, it, vi } from 'vitest'
import { showPinNowWithNotice } from '../components/ShowPinNowControls'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Pin, Region, Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { HostWorld } from './hostSession'

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

  it('o aviso do mestre confirma: "Mostrar agora a Gabi" vira "Cartão aberto na tela de Gabi."', async () => {
    useToastStore.setState({ toasts: [] })
    const { bridge, gabi } = await mesa()
    showPinNowWithNotice(bridge, 'carta', gabi, (kind, text) => useToastStore.getState().push(kind, text))
    const avisos = useToastStore.getState().toasts
    expect(avisos.filter((t) => t.text.includes('cartão') || t.text.includes('Cartão')).map((t) => [t.kind, t.text])).toEqual([['info', 'Cartão aberto na tela de Gabi.']])
    expect(avisos.filter((t) => t.kind === 'error')).toEqual([])
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

/**
 * "ENTREGAR PISTA…" num pedido de Revistar: a linha da Caixa oferece um botão
 * por pino oculto da sala ("Entregar: Carta"). Tocar abre a carta só em Gabi,
 * responde o pedido dela e o mestre lê que o cartão saiu.
 */
describe('hostBridge: Revistar > Entregar pista', () => {
  const ESCRITORIO: Region = {
    id: 'escritorio',
    points: [
      { x: 100, y: 100 },
      { x: 600, y: 100 },
      { x: 600, y: 400 },
      { x: 100, y: 400 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Escritório' },
  }
  const CARTA_OCULTA: Pin = { id: 'carta-oculta', x: 500, y: 300, kind: 'exclamacao', nome: 'Carta', description: 'Querido irmão, o cofre fica atrás do quadro.', image: null, secret: true }
  const mundo = (): HostWorld => ({
    open: {
      sceneId: 'cena-casa',
      name: 'Casa',
      map: { ...createEmptyMap('mapa-casa', 'Casa', 40, 10, 50), regions: [ESCRITORIO], tokens: [ficha('ficha-gabi', 200), ficha('ficha-diego', 250)], pins: [CARTA_OCULTA] },
    },
    background: [],
  })

  async function mesaDaCasa() {
    const handlers = new Map<string, (event: { payload: unknown }) => void>()
    const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
    const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(name, handler)
      return vi.fn()
    })
    const bridge = createHostBridge({
      invoke,
      listen,
      getMap: () => mundo().open.map,
      getWorld: mundo,
      applyMove: vi.fn(),
      applyDoor: vi.fn(),
      onPlayersChange: vi.fn(),
      now: () => 0,
    })
    await bridge.start()
    const emit = (payload: unknown) => {
      const handler = handlers.get('net:message')
      if (handler === undefined) throw new Error('sem listener de net:message')
      handler({ payload })
    }
    const entra = (clientId: string, name: string, tokenId: string): void => {
      emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
      const player = bridge.players().find((p) => p.name === name)
      if (player === undefined) throw new Error(`${name} deveria ter entrado`)
      bridge.assignToken(player.playerId, tokenId)
    }
    entra('c-gabi', 'Gabi', 'ficha-gabi')
    entra('c-diego', 'Diego', 'ficha-diego')
    const enviadosA = (clientId: string): unknown[] =>
      invoke.mock.calls.flatMap((call) => {
        const envio = call[1]
        if (call[0] !== 'net_send' || typeof envio !== 'object' || envio === null || !('clientId' in envio) || !('msg' in envio)) return []
        return envio.clientId === clientId ? [envio.msg] : []
      })
    return { emit, enviadosA }
  }

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a linha "Gabi quer Revistar — Escritório" oferece "Entregar: Carta"; tocar abre a carta só em Gabi e o aviso confirma', async () => {
    const { emit, enviadosA } = await mesaDaCasa()
    emit({ clientId: 'c-gabi', msg: { type: 'point.action', action: 'revistar', x: 200, y: 200 } })
    const pedido = useToastStore.getState().toasts.find((t) => t.text === 'Gabi quer Revistar — Escritório')
    if (pedido === undefined) throw new Error('o Revistar deveria virar linha na Caixa')
    const entregar = pedido.actions?.find((a) => a.label === 'Entregar: Carta')
    if (entregar === undefined) throw new Error('a linha deveria oferecer "Entregar: Carta"')

    entregar.run()

    const paraGabi = JSON.stringify(enviadosA('c-gabi'))
    expect(paraGabi).toContain('"type":"pin.show"')
    expect(paraGabi).toContain('o cofre fica atrás do quadro')
    expect(paraGabi).toContain('"type":"point.action.answer"')
    expect(JSON.stringify(enviadosA('c-diego'))).not.toContain('cofre fica atrás do quadro')
    const textos = useToastStore.getState().toasts.map((t) => t.text)
    expect(textos).not.toContain('Gabi quer Revistar — Escritório')
    expect(textos).toContain('Cartão aberto na tela de Gabi.')
  })

  it('Procurar no mesmo lugar não oferece entregar pista', async () => {
    const { emit } = await mesaDaCasa()
    emit({ clientId: 'c-gabi', msg: { type: 'point.action', action: 'procurar', x: 200, y: 200 } })
    const pedido = useToastStore.getState().toasts.find((t) => t.text === 'Gabi quer Procurar — Escritório')
    expect(pedido?.actions?.map((a) => a.label)).toEqual(['Nada aqui', 'Feito'])
  })
})

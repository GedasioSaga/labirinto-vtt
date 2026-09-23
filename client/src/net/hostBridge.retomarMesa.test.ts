import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SavedTable } from '../lib/savedTable'
import { useToastStore } from '../stores/toastStore'
import type { Token } from '../types/map'
import { createHostBridge } from './hostBridge'

/**
 * RETOMAR A MESA, lado da ponte: "Abrir sala > Retomar" reabre com a mesa
 * guardada, quem volta com o mesmo nome reencontra a ficha (com "Desfazer" no
 * aviso do mestre), e toda mudança de dono/raio regrava o arquivo da mesa.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

function ficha(id: string, name: string): Token {
  return { id, characterId: null, name, x: 100, y: 100, size: 1, image: null }
}

const GUARDADA: SavedTable = {
  version: 1,
  code: 'ZZ99ZZ',
  seats: [{ name: 'Ana', tokenIds: ['lirio'], visionRadius: 350, sceneKey: null }],
}

function montar(guardada: SavedTable | null = GUARDADA) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const map = { ...createEmptyMap('m', 'Mapa', 30, 10, 50), tokens: [ficha('lirio', 'Lírio'), ficha('grog', 'Grog')] }
  const gravadas: SavedTable[] = []
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => map,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    loadTable: () => guardada,
    saveTable: (table) => {
      gravadas.push(table)
    },
  })
  const entra = (clientId: string, name: string) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload: { clientId, msg: { type: 'join', code: ROOM.code, name } } })
  }
  const enviadas = (clientId: string) =>
    invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => JSON.stringify(call[1])).filter((text) => text.includes(`"clientId":"${clientId}"`))
  return { bridge, entra, enviadas, gravadas }
}

describe('hostBridge: retomar a mesa', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('Retomar: "ana" entra já com Lírio e o mestre lê "ana voltou: Lírio devolvida" com Desfazer', async () => {
    const m = montar()
    await m.bridge.start({ resume: true })
    m.entra('c1', 'ana')
    expect(m.bridge.players()[0]).toMatchObject({ name: 'ana', status: 'playing', tokenIds: ['lirio'], visionRadius: 350 })
    const aviso = useToastStore.getState().toasts.find((t) => t.text === 'ana voltou: Lírio devolvida')
    if (aviso === undefined) throw new Error('faltou o aviso da ficha devolvida')
    expect(aviso.actions?.map((a) => a.label)).toEqual(['Desfazer'])
    // O aviso de "entrou sem personagem" não sai junto: ela não está sem.
    expect(useToastStore.getState().toasts.some((t) => t.text.includes('sem personagem'))).toBe(false)
    // Desfazer: a ficha sai e a tela dela volta a "Aguardando o mestre".
    aviso.actions?.[0]?.run()
    expect(m.bridge.players()[0]).toMatchObject({ status: 'waiting', tokenIds: [], visionRadius: 700 })
    expect(m.enviadas('c1').some((text) => text.includes('"lobby.waiting"'))).toBe(true)
  })

  it('Mesa nova = hoje: mesmo nome entra sem personagem', async () => {
    const m = montar()
    await m.bridge.start({ resume: false })
    m.entra('c1', 'Ana')
    expect(m.bridge.players()[0]).toMatchObject({ status: 'waiting', tokenIds: [] })
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Ana entrou e está sem personagem. Abra a aba Jogo para atribuir um.'])
  })

  it('start() sem opção também é a mesa de hoje', async () => {
    const m = montar()
    await m.bridge.start()
    m.entra('c1', 'Ana')
    expect(m.bridge.players()[0]?.tokenIds).toEqual([])
  })

  it('cada mudança de dono ou raio grava a mesa com o código da sala; fechar a sala não apaga', async () => {
    const m = montar(null)
    await m.bridge.start()
    expect(m.gravadas).toEqual([])
    m.entra('c1', 'Bruno')
    const bruno = m.bridge.players()[0]
    if (bruno === undefined) throw new Error('Bruno deveria ter entrado')
    m.bridge.assignToken(bruno.playerId, 'grog')
    expect(m.gravadas.at(-1)).toEqual({ version: 1, code: ROOM.code, seats: [{ name: 'Bruno', tokenIds: ['grog'], visionRadius: null, sceneKey: 'm' }] })
    m.bridge.setVisionRadius(bruno.playerId, 500)
    expect(m.gravadas.at(-1)?.seats[0]?.visionRadius).toBe(500)
    const antes = m.gravadas.length
    await m.bridge.stop()
    expect(m.gravadas.length).toBe(antes)
  })

  it('a mesa gravada nunca vai pela rede: quem entra não recebe nome nem ficha guardados', async () => {
    const m = montar({ ...GUARDADA, seats: [...GUARDADA.seats, { name: 'Bruno', tokenIds: ['grog'], visionRadius: null, sceneKey: null }] })
    await m.bridge.start({ resume: true })
    m.entra('c1', 'Carla')
    const texto = m.enviadas('c1').join('\n')
    expect(texto).toContain('"welcome"')
    expect(texto).not.toContain('Ana')
    expect(texto).not.toContain('Bruno')
    expect(texto).not.toContain('ZZ99ZZ')
  })
})

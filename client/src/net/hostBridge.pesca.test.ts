import { describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { minigamePadraoDo } from '../lib/pins'
import type { MapData, Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { PescaAoVivo } from './pescaNoHost'

/**
 * MINIGAME DE PESCA, lado do integrador: o convite sai pelo `net_send` só a
 * quem o mestre chamou (ou a quem pediu de perto), o painel acompanha por
 * `onPescaChange`, e os comandos valem por pino. Não há desfecho que aplique
 * nada: nem porta, nem mochila, nem aviso de prêmio.
 */

const ROOM = { code: 'P35C4R', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 250, size: 1, image: null, mochila: [{ id: 'velho', nome: 'Corda' }] })

function mapa(entrada: 'mestre' | 'pino'): MapData {
  const pesca = minigamePadraoDo('pesca')
  if (pesca.jogo !== 'pesca') throw new Error('o padrão da pesca tem de ser pesca')
  return {
    ...createEmptyMap('m-lago', 'Lago', 1000, 1000, 50),
    pins: [{ ...buildPin('pino-pesca', { x: 300, y: 300 }, 'minigame'), minigame: { ...pesca, entrada } }],
    tokens: [ficha('ficha-gabi', 300), ficha('ficha-ana', 100)],
  }
}

async function mesa(map: MapData = mapa('mestre')) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const applyDoor = vi.fn()
  const unlockAndOpenDoor = vi.fn()
  const applyItems = vi.fn()
  const onPescaChange = vi.fn<(pescas: PescaAoVivo[]) => void>()
  const bridge = createHostBridge({ invoke, listen, getMap: () => map, applyMove: vi.fn(), applyDoor, unlockAndOpenDoor, applyItems, onPescaChange, now: () => 0 })
  await bridge.start()
  const emit = (name: string, payload: unknown) => {
    const handler = handlers.get(name)
    if (handler === undefined) throw new Error(`sem listener de ${name}`)
    handler({ payload })
  }
  const entra = (clientId: string, name: string, tokenId: string): string => {
    emit('net:message', { clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
    return player.playerId
  }
  const gabi = entra('c-gabi', 'Gabi', 'ficha-gabi')
  const ana = entra('c-ana', 'Ana', 'ficha-ana')
  const enviados = () => invoke.mock.calls.filter(([cmd]) => cmd === 'net_send').map(([, args]) => JSON.stringify(args))
  return { bridge, emit, gabi, ana, invoke, enviados, onPescaChange, applyDoor, unlockAndOpenDoor, applyItems }
}

describe('hostBridge: pesca', () => {
  it('mestre chama: o convite sai só para os chamados, e o painel acompanha do convite ao cesto', async () => {
    const { bridge, gabi, emit, invoke, enviados, onPescaChange, applyDoor, unlockAndOpenDoor, applyItems } = await mesa()
    invoke.mockClear()
    const convite = bridge.convidarParaPesca('pino-pesca', [gabi])
    expect(convite).toEqual({ ok: true, sessao: expect.any(String), convidados: 1 })
    expect(enviados().filter((e) => e.includes('pesca.convite'))).toEqual([expect.stringContaining('"c-gabi"')])
    expect(onPescaChange).toHaveBeenLastCalledWith([expect.objectContaining({ pinId: 'pino-pesca', fase: 'aberta', participantes: [expect.objectContaining({ playerId: gabi, status: 'convidado' })] })])
    const sessao = convite?.ok === true ? convite.sessao : ''
    emit('net:message', { clientId: 'c-gabi', msg: { type: 'pesca.pronto', sessao, dificuldade: 'normal' } })
    emit('net:message', { clientId: 'c-gabi', msg: { type: 'pesca.vivo', sessao, fase: 'puxada', lance: 1, de: 3, medidor: 0.7 } })
    expect(onPescaChange.mock.lastCall?.[0][0]?.participantes[0]?.vivo).toEqual({ fase: 'puxada', lance: 1, de: 3, medidor: 0.7 })
    const peixe = { peixe: 'bagre', cm: 64, estrelas: 2, perfeito: false, bau: true }
    emit('net:message', { clientId: 'c-gabi', msg: { type: 'pesca.lance', sessao, lance: 1, resultado: 'pegou', peixe } })
    emit('net:message', { clientId: 'c-gabi', msg: { type: 'pesca.fim', sessao, cesto: [peixe] } })
    expect(onPescaChange.mock.lastCall?.[0][0]?.participantes[0]).toMatchObject({ status: 'terminou', cesto: [peixe], maior: peixe })
    expect(bridge.pausarPesca('pino-pesca')).toBe(true)
    expect(bridge.pesca()[0]?.fase).toBe('pausa')
    expect(bridge.retomarPesca('pino-pesca')).toBe(true)
    expect(bridge.encerrarPesca('pino-pesca')).toBe(true)
    expect(bridge.encerrarPesca('pino-pesca')).toBe(false)
    // Prêmio e consequência são só texto: nada no mapa.
    expect(applyDoor).not.toHaveBeenCalled()
    expect(unlockAndOpenDoor).not.toHaveBeenCalled()
    expect(applyItems).not.toHaveBeenCalled()
  })

  it('jogador toca no pino: o pedido de perto volta o convite só para ele; o de longe, nada', async () => {
    const { emit, invoke, enviados, bridge } = await mesa(mapa('pino'))
    invoke.mockClear()
    emit('net:message', { clientId: 'c-ana', msg: { type: 'pesca.pedir', pinId: 'pino-pesca' } })
    expect(enviados().some((e) => e.includes('pesca.convite'))).toBe(false)
    emit('net:message', { clientId: 'c-gabi', msg: { type: 'pesca.pedir', pinId: 'pino-pesca' } })
    expect(enviados().filter((e) => e.includes('pesca.convite'))).toEqual([expect.stringContaining('"c-gabi"')])
    expect(bridge.pesca()[0]?.participantes.map((p) => p.nome)).toEqual(['Gabi'])
  })

  it('sala fechada: comandos não fazem nada e o painel fica vazio', () => {
    const bridge = createHostBridge({ invoke: vi.fn(), listen: vi.fn(), getMap: () => mapa('mestre'), applyMove: vi.fn(), applyDoor: vi.fn(), now: () => 0 })
    expect(bridge.convidarParaPesca('pino-pesca', ['x'])).toBeNull()
    expect(bridge.pausarPesca('pino-pesca')).toBe(false)
    expect(bridge.pesca()).toEqual([])
  })
})

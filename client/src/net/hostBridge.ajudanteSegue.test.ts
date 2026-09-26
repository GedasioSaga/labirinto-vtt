import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { AppliedTransfer, HostWorld } from './hostSession'

/**
 * AJUDANTE CONTRATADO, lado da PONTE: a sessão diz quem acompanha a dona
 * (`companions`); a ponte tem de mover cada um pela mesma travessia da store,
 * DEPOIS da ficha principal. Sem isto o Tiziu ficava no Porto mesmo com a
 * sessão sabendo que ele devia ir.
 */

const ROOM = { code: 'AJSG22', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const PRAZO_MINUTOS = 30

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: id, x, y: 200, size: 1, image: null }
}

function escada(id: string, x: number, y: number, description: string, sceneId: string, pinId: string): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino: { sceneId, pinId } }
}

/** Porto (aberto) e Cripta (de fundo). `onde` diz em que cena cada ficha está; a store de mentira muda isso. */
function setup(falhaNoAjudante = false) {
  const onde = new Map<string, 'cena-a' | 'cena-b'>([
    ['arco', 'cena-a'],
    ['tiziu', 'cena-a'],
  ])
  const pos = new Map<string, { x: number; y: number }>([
    ['arco', { x: 350, y: 200 }],
    ['tiziu', { x: 300, y: 200 }],
  ])
  const fichasEm = (sceneId: string): Token[] =>
    [...onde].flatMap(([id, cena]) => {
      const p = pos.get(id)
      return cena === sceneId && p !== undefined ? [{ ...ficha(id, p.x), y: p.y }] : []
    })
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Porto',
      map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: fichasEm('cena-a'), pins: [escada('escada-a', 400, 200, 'Escada que desce', 'cena-b', 'escada-b')] },
    },
    background: [
      {
        sceneId: 'cena-b',
        name: 'Cripta',
        map: { ...createEmptyMap('mapa-b', 'B', 40, 10, 50), tokens: fichasEm('cena-b'), pins: [escada('escada-b', 1000, 250, 'Escada que sobe', 'cena-a', 'escada-a')] },
      },
    ],
  })
  const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
    if (falhaNoAjudante && transfer.tokenId === 'tiziu') return false
    if (onde.get(transfer.tokenId) !== transfer.fromSceneId || (transfer.toSceneId !== 'cena-a' && transfer.toSceneId !== 'cena-b')) return false
    onde.set(transfer.tokenId, transfer.toSceneId)
    pos.set(transfer.tokenId, { x: transfer.x, y: transfer.y })
    return true
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const bridge = createHostBridge({
    invoke: vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined)),
    listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
      handlers.set(name, handler)
      return vi.fn()
    }),
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer,
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const emit = (msg: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener para net:message')
    handler({ payload: { clientId: 'c1', msg } })
  }
  const duda = async (): Promise<string> => {
    await bridge.start()
    emit({ type: 'join', code: ROOM.code, name: 'Duda' })
    const id = bridge.players().find((p) => p.name === 'Duda')?.playerId
    if (id === undefined) throw new Error('esperava a Duda na sala')
    bridge.assignToken(id, 'arco')
    bridge.lendToken(id, 'tiziu', { tarefa: 'carregar a lanterna', minutos: PRAZO_MINUTOS, visao: false })
    return id
  }
  return { bridge, applyTransfer, onde, emit, duda }
}

describe('hostBridge: o ajudante emprestado atravessa junto', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('"Levar para…": move o Arco e, depois, o Tiziu para a Cripta', async () => {
    const t = setup()
    const duda = await t.duda()
    expect(t.bridge.sendPlayer(duda, 'cena-b', 'escada-b')).toBe(true)
    expect(t.applyTransfer.mock.calls.map(([tr]) => tr.tokenId)).toEqual(['arco', 'tiziu'])
    expect(t.onde.get('tiziu')).toBe('cena-b')
    expect(t.bridge.players().find((p) => p.playerId === duda)?.sceneName).toBe('Cripta')
  })

  it('"Deixar ir" no pino: o Tiziu desce a escada junto com o Arco', async () => {
    const t = setup()
    await t.duda()
    t.emit({ type: 'pin.travel.request', pinId: 'escada-a' })
    const aviso = useToastStore.getState().toasts.find((toast) => toast.text === 'Duda quer passar por Escada que desce → Cripta')
    if (aviso === undefined) throw new Error('o mestre deveria ver o pedido')
    aviso.actions?.[0]?.run()
    expect(t.onde.get('arco')).toBe('cena-b')
    expect(t.onde.get('tiziu')).toBe('cena-b')
  })

  it('o ajudante que não dá para mover não desfaz a viagem da dona', async () => {
    const t = setup(true)
    const duda = await t.duda()
    expect(t.bridge.sendPlayer(duda, 'cena-b', null)).toBe(true)
    expect(t.onde.get('arco')).toBe('cena-b')
    expect(t.onde.get('tiziu')).toBe('cena-a')
  })
})

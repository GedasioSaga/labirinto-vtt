import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Token, TokenWatch } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * OLHOS DO GUARDA, lado do MESTRE: quando uma ficha de jogador ENTRA no olhar
 * de um guarda, o mestre recebe "Guarda viu Ana" — uma vez por entrada, não um
 * aviso por snapshot. Sair do olhar e voltar avisa de novo. Guarda numa cena
 * de fundo avisa com o nome da cena, que é do mestre.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const OESTE: TokenWatch = { direcao: 180, abertura: 90, alcance: 4 }

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

/** Pátio (aberto) com o Guarda; Torre (de fundo) com a Sentinela. `ana`/`bia`: onde está cada ficha. */
function mesa() {
  const estado = { ana: { x: 425, y: 325 }, bia: { x: 1200, y: 325 }, biaNaTorre: false }
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-patio',
      name: 'Pátio',
      map: {
        ...createEmptyMap('mapa-patio', 'Pátio', 30, 12, 50),
        tokens: [
          ficha('guarda', 'Guarda', 500, 325, { vigia: OESTE }),
          ficha('ficha-ana', 'Lanterna', estado.ana.x, estado.ana.y),
          ...(estado.biaNaTorre ? [] : [ficha('ficha-bia', 'Corvo', estado.bia.x, estado.bia.y)]),
        ],
      },
    },
    background: [
      {
        sceneId: 'cena-torre',
        name: 'Torre',
        map: {
          ...createEmptyMap('mapa-torre', 'Torre', 30, 12, 50),
          tokens: [
            ficha('sentinela', 'Sentinela', 500, 325, { vigia: OESTE }),
            ...(estado.biaNaTorre ? [ficha('ficha-bia', 'Corvo', 425, 325)] : []),
          ],
        },
      },
    ],
  })
  return { estado, world }
}

async function sala() {
  const m = mesa()
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => m.world().open.map,
    getWorld: m.world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload: { clientId, msg: { type: 'join', code: ROOM.code, name } } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  return { ...m, bridge, entra }
}

function avisos(): string[] {
  return useToastStore.getState().toasts.map((t) => t.text)
}

describe('hostBridge: "Guarda viu <jogador>"', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('a ficha de Ana entra no olhar do guarda: o mestre lê "Guarda viu Ana", uma vez só', async () => {
    const { bridge, entra } = await sala()
    entra('c1', 'Ana', 'ficha-ana')
    expect(avisos()).toContain('Guarda viu Ana')
    // Snapshots seguintes com Ana parada no mesmo lugar não repetem o aviso.
    bridge.notifyTurnChanged()
    bridge.notifyTurnChanged()
    expect(avisos().filter((t) => t === 'Guarda viu Ana')).toHaveLength(1)
  })

  it('Ana sai do olhar e volta: avisa de novo', async () => {
    const { bridge, entra, estado } = await sala()
    entra('c1', 'Ana', 'ficha-ana')
    estado.ana = { x: 100, y: 100 }
    bridge.notifyTurnChanged()
    estado.ana = { x: 425, y: 325 }
    bridge.notifyTurnChanged()
    expect(avisos().filter((t) => t === 'Guarda viu Ana')).toHaveLength(2)
  })

  it('ficha que não é de jogador na frente do guarda não avisa nada', async () => {
    const { bridge } = await sala()
    bridge.notifyTurnChanged()
    expect(avisos().some((t) => t.includes(' viu '))).toBe(false)
  })

  it('guarda numa cena de fundo avisa com o nome dela', async () => {
    const { bridge, entra, estado } = await sala()
    entra('c2', 'Bia', 'ficha-bia')
    expect(avisos().some((t) => t.includes('viu Bia'))).toBe(false)
    estado.biaNaTorre = true
    bridge.notifyTurnChanged()
    expect(avisos()).toContain('Sentinela viu Bia em Torre')
  })
})

/**
 * O FIO que as specs e2e de sessão real leem, sem navegador: o jogador de
 * verdade (esta conexão) e o host de verdade (`net/hostSession.ts`), ligados
 * como `page.routeWebSocket` liga em client/e2e/task-player-page,
 * task-player-map e task-conceal-zone.
 *
 * Aquelas specs leem o fio de dois jeitos que o `patch` não pode quebrar:
 * - o `join` que o jogador manda, comparado inteiro (`toEqual`);
 * - "o último snapshot" do fio como a tela que o jogador tem agora.
 * Mapa pequeno não ganha nada com `patch` (a tela inteira é menor que o
 * risco de um patch que não encaixa): ali o fio segue com snapshot inteiro.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createHostSession, type HostResult } from '../net/hostSession'
import type { HostMessage } from '../net/protocol'
import type { ConcealZone, Drawing, MapData, Region, Token, Wall } from '../types/map'
import { createPlayerConnection, type SocketLike } from './playerConnection'

const CODE = 'ABC123'
const CLIENT = 'c1'
const OTHER_CLIENT = 'c2'
const GRID = 50
const WORLD_H = 12 * GRID // 600
const MID_X = 500

class FilaSocket implements SocketLike {
  readyState = 0
  saida: string[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  send(data: string): void {
    this.saida.push(data)
  }
  close(): void {
    this.readyState = 3
  }
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  recebe(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
}

function token(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

/**
 * Mestre simulado como nas specs: o que o jogador manda vai para
 * `handleMessage`, o que sai para CLIENT fica em `sent` e chega ao jogador.
 */
function mesaDeSpec(inicial: MapData) {
  let map = inicial
  const session = createHostSession({ code: CODE, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  const sockets: FilaSocket[] = []
  const conexao = createPlayerConnection({
    url: 'ws://host/ws',
    code: CODE,
    name: 'Ana',
    storage: null,
    createSocket: () => {
      const socket = new FilaSocket()
      sockets.push(socket)
      return socket
    },
  })
  const socket = sockets[0]
  if (socket === undefined) throw new Error('socket não criado')
  const received: unknown[] = []
  const sent: HostMessage[] = []
  let playerId: string | null = null

  const dispatch = (r: HostResult): void => {
    for (const { clientId, msg } of r.outbound) {
      if (clientId !== CLIENT) continue
      sent.push(msg)
      if (msg.type === 'welcome') playerId = msg.playerId
      socket.recebe(JSON.stringify(msg))
    }
  }

  socket.open()
  while (socket.saida.length > 0) {
    const texto = socket.saida.shift()
    if (texto === undefined) break
    received.push(JSON.parse(texto))
    dispatch(session.handleMessage(CLIENT, texto, map))
  }
  if (playerId === null) throw new Error('sem welcome')
  const anaId: string = playerId

  return {
    session,
    conexao,
    received,
    sent,
    anaId,
    /** Outro jogador por outra conexão, com join de jogador antigo (sem aviso de patch), como nas specs. */
    entraBia: (tokenId: string) => {
      const other = session.handleMessage(OTHER_CLIENT, JSON.stringify({ type: 'join', code: CODE, name: 'Bia' }), map)
      const welcome = other.outbound.find((o) => o.msg.type === 'welcome')?.msg
      if (welcome?.type !== 'welcome') throw new Error('Bia sem welcome')
      session.assignToken(welcome.playerId, tokenId)
    },
    transmite: (novo: MapData) => {
      map = novo
      dispatch(session.broadcast(map))
    },
    lastSnapshot: () => {
      const snapshot = [...sent].reverse().find((m) => m.type === 'snapshot')
      if (snapshot?.type !== 'snapshot') throw new Error('sem snapshot')
      return snapshot
    },
  }
}

describe('task-player-page: o join que sai do jogador', () => {
  it('é exatamente { type, code, name }: o aviso de que o jogador aplica patch vai em mensagem própria, depois', () => {
    const mesa = mesaDeSpec(createEmptyMap('m-player', 'Teste jogador', 20, 12, GRID))
    expect(mesa.received[0]).toEqual({ type: 'join', code: CODE, name: 'Ana' })
    expect(mesa.received[1]).toEqual({ type: 'view.patches' })
    expect(mesa.received).toHaveLength(2)
  })
})

describe('task-player-map: mapa pequeno, o último snapshot do fio é a tela de agora', () => {
  function room(id: string, name: string, fillColor: string, x1: number, x2: number): Region {
    const points = [
      { x: x1, y: 50 },
      { x: x2, y: 50 },
      { x: x2, y: WORLD_H - 50 },
      { x: x1, y: WORLD_H - 50 },
    ]
    return { id, points, tag: '', fillColor, fillPattern: 'solid', data: {}, room: { shape: 'rect', name } }
  }

  function wall(id: string, y1: number, y2: number, door: Wall['door']): Wall {
    return { id, x1: MID_X, y1, x2: MID_X, y2, blocksLight: true, blocksMove: true, door, thickness: 'thick' }
  }

  function buildMap(): MapData {
    const text: Drawing = { id: 'd-texto', kind: 'text', x: 300, y: 130, text: 'Altar antigo', color: '#f5e6b8', fontSize: 22 }
    return {
      ...createEmptyMap('m-mapa', 'Tela do jogador', 20, 12, GRID),
      regions: [room('r-a', 'Salão', '#7a4b2a', 50, 450), room('r-b', 'Biblioteca', '#2f5d50', 550, 950)],
      walls: [wall('w-cima', 0, 250, null), wall('w-porta', 250, 350, { open: false, locked: false, kind: 'normal' }), wall('w-baixo', 350, WORLD_H, null)],
      drawings: [text],
      tokens: [token('tok-a', 'Heroi', 250, 430), token('tok-c', 'Espiao', 380, 480)],
    }
  }

  it('Heroi vai da sala A para a B: o último snapshot tem as duas salas e o Espião, fora da visão, não está nele', () => {
    let map = buildMap()
    const mesa = mesaDeSpec(map)
    mesa.entraBia('tok-c')
    mesa.session.assignToken(mesa.anaId, 'tok-a')
    mesa.transmite(map)
    expect(mesa.lastSnapshot().map.regions.map((r) => r.id)).toEqual(['r-a'])
    expect(mesa.lastSnapshot().map.tokens.map((t) => t.id).sort()).toEqual(['tok-a', 'tok-c'])

    map = { ...map, tokens: map.tokens.map((t) => (t.id === 'tok-a' ? { ...t, x: 750, y: 430 } : t)) }
    mesa.transmite(map)
    const after = mesa.lastSnapshot()
    expect(mesa.sent.at(-1)).toBe(after)
    expect(after.map.regions.map((r) => r.id).sort()).toEqual(['r-a', 'r-b'])
    const payload = JSON.stringify(after)
    expect(payload).not.toContain('tok-c')
    expect(payload).not.toContain('Espiao')
    // A tela do jogador é a do snapshot: nada ficou de fora nem sobrou.
    expect(mesa.conexao.getState().map?.tokens.map((t) => t.id)).toEqual(['tok-a'])
  })
})

describe('task-conceal-zone: mapa pequeno, Revelar chega como snapshot inteiro', () => {
  function buildMap(revealed: boolean): MapData {
    const room: Region = {
      id: 'r-salao',
      points: [
        { x: 50, y: 50 },
        { x: 950, y: 50 },
        { x: 950, y: 550 },
        { x: 50, y: 550 },
      ],
      tag: '',
      fillColor: '#7a4b2a',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Salão' },
    }
    const zone: ConcealZone = {
      id: 'zona-e2e',
      name: 'Galeria escondida',
      revealed,
      points: [
        { x: 50, y: 50 },
        { x: 950, y: 50 },
        { x: 950, y: 300 },
        { x: 50, y: 300 },
      ],
    }
    return {
      ...createEmptyMap('m-zona', 'Zona oculta', 20, 12, GRID),
      regions: [room],
      tokens: [token('tok-a', 'Heroi', 500, 450), token('tok-c', 'Espiao', 600, 150)],
      concealZones: [zone],
    }
  }

  it('zona ativa esconde o Espião; depois de Revelar o último snapshot tem o Espião e concealed vazio', () => {
    const mesa = mesaDeSpec(buildMap(false))
    mesa.entraBia('tok-c')
    mesa.session.assignToken(mesa.anaId, 'tok-a')
    mesa.transmite(buildMap(false))
    const hidden = mesa.lastSnapshot()
    expect(JSON.stringify(hidden)).not.toContain('tok-c')
    expect(hidden.concealed).toHaveLength(1)

    mesa.transmite(buildMap(true))
    const shown = mesa.lastSnapshot()
    expect(mesa.sent.at(-1)).toBe(shown)
    expect(JSON.stringify(shown)).toContain('tok-c')
    expect(shown.concealed).toEqual([])
    expect(mesa.conexao.getState().map?.tokens.map((t) => t.id).sort()).toEqual(['tok-a', 'tok-c'])
  })
})

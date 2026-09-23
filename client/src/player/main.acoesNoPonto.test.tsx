import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createPlayerConnection, type PlayerConnection, type SocketLike } from './playerConnection'
import type { PlayerView } from './PlayerView'

/**
 * AÇÕES NO PONTO montadas na sessão do jogador (main.tsx): o toque longo que o
 * PlayerView avisa abre o menu, escolher envia o pedido pelo socket e o aviso
 * aparece na tela. O canvas (Pixi) não roda no jsdom: o PlayerView vira um
 * dublê que só guarda as props que a sessão lhe passa.
 */

type PlayerViewProps = ComponentProps<typeof PlayerView>

const vista = vi.hoisted((): { props: PlayerViewProps | null } => ({ props: null }))

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_COLOR: 0x3b82f6,
  PlayerView: (props: PlayerViewProps) => {
    vista.props = props
    return null
  },
}))

class FakeSocket implements SocketLike {
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }
  close(): void {}
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

let Session: (typeof import('./main'))['Session']

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  // main.tsx monta o app em #root ao ser importado (sem sessão guardada, é só o formulário).
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
  await act(async () => {
    Session = (await import('./main')).Session
  })
})

describe('sessão do jogador: ações no ponto', () => {
  let container: HTMLDivElement
  let root: Root
  let connection: PlayerConnection
  let socket: FakeSocket
  let sockets: FakeSocket[]

  beforeEach(() => {
    vista.props = null
    sockets = []
    connection = createPlayerConnection({
      url: 'ws://host/ws',
      code: 'ABC123',
      name: 'Fabi',
      storage: null,
      createSocket: () => {
        const created = new FakeSocket()
        sockets.push(created)
        return created
      },
    })
    const first = sockets[0]
    if (first === undefined) throw new Error('socket não criado')
    socket = first
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Fabi' })
    // 10 x 10 casas de 50 px: o mapa vai de 0 a 500 nos dois eixos.
    socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<Session connection={connection} code="ABC123" typedName="Fabi" hostName="Fabi" onLeave={vi.fn()} onQuit={vi.fn()} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    connection.close()
  })

  function props(): PlayerViewProps {
    if (vista.props === null) throw new Error('a sessão deveria montar o PlayerView')
    return vista.props
  }

  function tocarLongo(x: number, y: number, screenX: number, screenY: number) {
    const onLongPress = props().onLongPress
    if (onLongPress === undefined) throw new Error('a sessão deveria repassar onLongPress ao PlayerView')
    act(() => onLongPress(x, y, screenX, screenY))
  }

  const menu = () => container.querySelector('[role="menu"]')
  const aviso = () => container.querySelector('.pp-notice--point')?.textContent ?? null
  const pedidos = () => socket.sent.filter((m) => JSON.stringify(m).includes('"point.action"'))

  function escolher(label: string) {
    const item = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((b) => b.textContent === label)
    if (item === undefined) throw new Error(`o menu deveria ter "${label}"`)
    act(() => item.click())
  }

  it('toque longo abre o menu; Procurar envia o pedido com o ponto e mostra a espera', () => {
    expect(menu()).toBeNull()
    tocarLongo(120, 130, 200, 150)
    expect(menu()).not.toBeNull()
    escolher('Procurar')
    expect(pedidos()).toEqual([{ type: 'point.action', action: 'procurar', x: 120, y: 130 }])
    expect(menu()).toBeNull()
    expect(aviso()).toBe('Procurar: esperando o mestre')
    act(() => socket.receive({ type: 'point.action.answer', action: 'procurar', answer: 'nothing' }))
    expect(aviso()).toBe('Você não encontrou nada')
  })

  it('toque longo fora do mapa (câmera arrastada até a borda escura) não abre o menu', () => {
    tocarLongo(-10, 100, 5, 150)
    expect(menu()).toBeNull()
    tocarLongo(100, 520, 200, 600)
    expect(menu()).toBeNull()
    expect(pedidos()).toEqual([])
    expect(aviso()).toBeNull()
  })

  it('tocar de novo no mapa fecha o menu sem pedir nada', () => {
    tocarLongo(120, 130, 200, 150)
    const onMapPointerDown = props().onMapPointerDown
    if (onMapPointerDown === undefined) throw new Error('a sessão deveria repassar onMapPointerDown ao PlayerView')
    act(() => onMapPointerDown())
    expect(menu()).toBeNull()
    expect(pedidos()).toEqual([])
  })

  // O ponto do menu é px de mundo da cena em que o dedo estava: noutra cena,
  // o mesmo x/y cai noutro lugar. O menu não pode sobreviver à troca.
  it('mudar de cena (scene.changed) fecha o menu aberto', () => {
    tocarLongo(120, 130, 200, 150)
    expect(menu()).not.toBeNull()
    act(() => socket.receive({ type: 'scene.changed', by: 'master' }))
    expect(menu()).toBeNull()
    // O mapa da cena nova chega logo atrás: o menu continua fechado e nada foi pedido.
    act(() => socket.receive({ type: 'snapshot', rev: 2, map: createEmptyMap('m2', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] }))
    expect(menu()).toBeNull()
    expect(pedidos()).toEqual([])
  })

  it('voltar ao lobby fecha o menu: de volta ao jogo, ele não reabre com o ponto de antes', () => {
    tocarLongo(120, 130, 200, 150)
    expect(menu()).not.toBeNull()
    act(() => socket.receive({ type: 'lobby.waiting' }))
    act(() => socket.receive({ type: 'snapshot', rev: 2, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] }))
    expect(connection.getState().status).toBe('playing')
    expect(menu()).toBeNull()
    expect(pedidos()).toEqual([])
  })

  it('reconectar fecha o menu: o jogo que volta não traz o menu de antes', () => {
    tocarLongo(120, 130, 200, 150)
    expect(menu()).not.toBeNull()
    act(() => connection.reconnect())
    expect(connection.getState().status).toBe('connecting')
    const novo = sockets[1]
    if (novo === undefined) throw new Error('reconectar deveria abrir um socket novo')
    act(() => {
      novo.open()
      novo.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Fabi' })
      novo.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    })
    expect(connection.getState().status).toBe('playing')
    expect(menu()).toBeNull()
    expect(novo.sent.filter((m) => JSON.stringify(m).includes('"point.action"'))).toEqual([])
  })

  it('outro jogador andando (snapshot da mesma cena) não fecha o menu', () => {
    tocarLongo(120, 130, 200, 150)
    act(() => socket.receive({ type: 'snapshot', rev: 2, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] }))
    expect(menu()).not.toBeNull()
    escolher('Escutar')
    expect(pedidos()).toEqual([{ type: 'point.action', action: 'escutar', x: 120, y: 130 }])
  })
})

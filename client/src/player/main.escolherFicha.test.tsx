import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlayerConnection, type PlayerConnection, type SocketLike } from './playerConnection'

/**
 * QUEM CHEGA ESCOLHE A PRÓPRIA FICHA, na tela de espera (main.tsx): as fichas
 * livres viram botões, tocar num manda o pedido ao mestre e a tela diz em que
 * pé ele está. Sem ficha livre, a espera de sempre.
 */

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_COLOR: 0x3b82f6,
  PlayerView: () => null,
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
    act(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) })))
  }
}

let Session: (typeof import('./main'))['Session']

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
  await act(async () => {
    Session = (await import('./main')).Session
  })
})

describe('tela de espera: escolher a própria ficha', () => {
  let container: HTMLDivElement
  let root: Root
  let connection: PlayerConnection
  let socket: FakeSocket

  beforeEach(() => {
    const sockets: FakeSocket[] = []
    connection = createPlayerConnection({
      url: 'ws://host/ws',
      code: 'ABC123',
      name: 'Hugo',
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
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Hugo' })
    socket.receive({ type: 'lobby.waiting' })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<Session connection={connection} code="ABC123" typedName="Hugo" hostName="Hugo" onLeave={vi.fn()} onQuit={vi.fn()} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    connection.close()
  })

  const botoesDeFicha = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-label="Fichas livres"] button'))
  const status = () => container.querySelector('.pe-seat-status')?.textContent ?? null
  const pedidos = () => socket.sent.filter((m) => JSON.stringify(m).includes('"seat.claim"'))

  it('sem ficha livre: só a espera de sempre, sem lista', () => {
    expect(container.textContent).toContain('Aguardando o mestre atribuir um personagem.')
    expect(botoesDeFicha()).toEqual([])
    socket.receive({ type: 'seat.options', tokens: [] })
    expect(botoesDeFicha()).toEqual([])
  })

  it('as fichas livres viram botões; tocar num manda o pedido e a tela diz que espera o mestre', () => {
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-bruna', name: 'Bruna' }, { tokenId: 't-kael', name: 'Kael' }] })
    expect(container.textContent).toContain('Escolha sua ficha')
    expect(botoesDeFicha().map((b) => b.textContent)).toEqual(['Bruna', 'Kael'])
    const kael = botoesDeFicha().find((b) => b.textContent === 'Kael')
    if (kael === undefined) throw new Error('Kael deveria virar botão')
    act(() => kael.click())
    expect(pedidos()).toEqual([{ type: 'seat.claim', tokenId: 't-kael' }])
    socket.receive({ type: 'seat.claim.state', state: 'pending' })
    expect(status()).toBe('Pedido enviado: Kael. Aguardando o mestre confirmar.')
    // Um pedido por vez: a lista some enquanto o mestre decide.
    expect(botoesDeFicha()).toEqual([])
  })

  it('recusado: a tela diz, e a lista volta para escolher outra', () => {
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    act(() => botoesDeFicha()[0]?.click())
    socket.receive({ type: 'seat.claim.state', state: 'denied' })
    expect(status()).toBe('O mestre não confirmou Kael. Escolha outra ficha ou aguarde.')
    expect(botoesDeFicha().map((b) => b.textContent)).toEqual(['Kael'])
  })

  it('a ficha deixou de estar livre: a tela diz, e a lista volta', () => {
    socket.receive({ type: 'seat.options', tokens: [{ tokenId: 't-kael', name: 'Kael' }] })
    act(() => botoesDeFicha()[0]?.click())
    socket.receive({ type: 'seat.claim.state', state: 'unavailable' })
    expect(status()).toBe('Kael não está mais livre. Escolha outra ficha.')
    expect(botoesDeFicha()).toHaveLength(1)
  })
})

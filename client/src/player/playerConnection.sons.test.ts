/**
 * SONS AO VIVO, fatia F4, lado do jogador: o `playerConnection` só é a porta
 * de entrada. Cada `som.*` do mestre passa pelo parser e chega a quem ouve
 * (`ouvirSons`); quem toca de verdade é a F5. Malformada some calada. A tela da
 * mesa também ouve (decisão do usuário de 23/10: a TV toca) e, além do `join` e
 * do `ping`, só pode mandar o `som.falhou`.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SomHostMessage } from '../net/protocol'
import { createPlayerConnection, TABLE_SCREEN_NAME, type SocketLike } from './playerConnection'

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

function conectar(role?: 'table') {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: role === 'table' ? TABLE_SCREEN_NAME : 'Ana',
    storage: null,
    ...(role === 'table' ? { role, tableKey: 'chave' } : {}),
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const socket = sockets[0]
  if (socket === undefined) throw new Error('socket não criado')
  socket.open()
  socket.receive({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok', name: 'Ana' })
  socket.sent.length = 0
  const ouvidos: SomHostMessage[] = []
  const parar = connection.ouvirSons((msg) => ouvidos.push(msg))
  return { connection, socket, ouvidos, parar }
}

const ID = `${'d'.repeat(64)}.m4a`
const TOCAR = { type: 'som.tocar', instancia: 'som-1', fonte: { tipo: 'arquivo', midia: ID }, volume: 0.4, loop: true, deslocamentoS: 7.5 }

describe('playerConnection: som.* chega a ouvirSons', () => {
  it('som.tocar chega como cópia limpa (o nome a mais cai fora)', () => {
    const { socket, ouvidos } = conectar()
    socket.receive({ ...TOCAR, nome: 'Grito do Lich' })
    expect(ouvidos).toEqual([TOCAR])
  })

  it('parar, parar tudo, volume e pré-carga também chegam, na ordem', () => {
    const { socket, ouvidos } = conectar()
    socket.receive({ type: 'som.parar', instancia: 'som-1', fadeMs: 150 })
    socket.receive({ type: 'som.volume', instancia: 'som-1', volume: 0.1 })
    socket.receive({ type: 'som.precarregar', midias: [ID] })
    socket.receive({ type: 'som.pararTudo' })
    expect(ouvidos.map((m) => m.type)).toEqual(['som.parar', 'som.volume', 'som.precarregar', 'som.pararTudo'])
  })

  it('malformada é ignorada sem derrubar nada, e a próxima boa ainda chega', () => {
    const { socket, ouvidos, connection } = conectar()
    const antes = connection.getState().status
    const tortas = [
      { ...TOCAR, volume: 2 },
      { ...TOCAR, volume: null },
      { ...TOCAR, instancia: '../x' },
      { ...TOCAR, fonte: { tipo: 'youtube', video: 'dQw4w9WgXcQ' } },
      { ...TOCAR, fonte: { tipo: 'arquivo', midia: 'C:/aventura/grito.mp3' } },
      { ...TOCAR, deslocamentoS: -3 },
      { type: 'som.parar' },
      { type: 'som.precarregar', midias: [] },
      { type: 'som.outra', instancia: 'som-1' },
    ]
    for (const torta of tortas) expect(() => socket.receive(torta)).not.toThrow()
    expect(ouvidos).toEqual([])
    expect(connection.getState().status).toBe(antes)
    socket.receive(TOCAR)
    expect(ouvidos).toEqual([TOCAR])
  })

  it('quem para de ouvir não recebe mais; vários ouvintes recebem cada um', () => {
    const { socket, connection, ouvidos, parar } = conectar()
    const outro = vi.fn()
    connection.ouvirSons(outro)
    parar()
    socket.receive(TOCAR)
    expect(ouvidos).toEqual([])
    expect(outro).toHaveBeenCalledWith(TOCAR)
  })

  it('a tela da mesa também ouve os sons', () => {
    const { socket, ouvidos } = conectar('table')
    socket.receive(TOCAR)
    expect(ouvidos).toEqual([TOCAR])
  })
})

describe('playerConnection: som.falhou', () => {
  it('sai conferido; motivo fora da lista ou instância torta não sai', () => {
    const { socket, connection } = conectar()
    expect(connection.informarSomFalhou('som-1', 'sem-gesto')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'som.falhou', instancia: 'som-1', motivo: 'sem-gesto' }])
    socket.sent.length = 0
    expect(connection.informarSomFalhou('../x', 'sem-gesto')).toBe(false)
    expect(socket.sent).toEqual([])
  })

  it('a tela da mesa pode contar que o som não soou nela (e continua sem mandar mais nada)', () => {
    const { socket, connection } = conectar('table')
    expect(connection.informarSomFalhou('som-1', 'sem-gesto')).toBe(true)
    expect(socket.sent).toEqual([{ type: 'som.falhou', instancia: 'som-1', motivo: 'sem-gesto' }])
    expect(connection.sendSignal(10, 10)).toBe(false)
    expect(socket.sent).toHaveLength(1)
  })
})

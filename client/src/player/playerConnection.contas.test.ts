/**
 * CONTAS DOS JOGADORES no cliente: a primeira entrada leva nome + PIN; o
 * segredo do aparelho que o mestre devolve fica no storage e passa a ser a
 * entrada (inclusive na volta de queda — o PIN não vai de novo); o aparelho
 * recusado é esquecido; quem entra só pelo nome não usa a conta lembrada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONTA_STORAGE_KEY,
  contaLembrada,
  createPlayerConnection,
  esquecerContaLembrada,
  reconnectDelayMs,
  type PlayerConnectionOptions,
  type SocketLike,
  type StorageLike,
} from './playerConnection'
import { rotuloDoNavegador } from './rotuloDoAparelho'

const SEGREDO = 'S'.repeat(43)

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
  drop(): void {
    this.readyState = 3
    this.onclose?.(new CloseEvent('close'))
  }
}

function memoria(): StorageLike & { dados: Map<string, string> } {
  const dados = new Map<string, string>()
  return {
    dados,
    getItem: (key) => dados.get(key) ?? null,
    setItem: (key, value) => {
      dados.set(key, value)
    },
    removeItem: (key) => {
      dados.delete(key)
    },
  }
}

function conectar(storage: StorageLike, conta: PlayerConnectionOptions['conta'], name = 'Ana') {
  const sockets: FakeSocket[] = []
  const connection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name,
    storage,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
    ...(conta === undefined ? {} : { conta }),
  })
  const ultimo = (): FakeSocket => {
    const socket = sockets.at(-1)
    if (socket === undefined) throw new Error('socket não criado')
    return socket
  }
  return { connection, sockets, ultimo }
}

const joinDe = (socket: FakeSocket): unknown => socket.sent.find((msg) => typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'join')

describe('playerConnection: entrar com a conta', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('primeira vez: nome + PIN + rótulo; o segredo fica guardado; a volta de queda vai com o aparelho, sem o PIN', () => {
    const storage = memoria()
    const { connection, sockets, ultimo } = conectar(storage, { pin: '2468', rotulo: 'Chrome no Android' })
    ultimo().open()
    expect(joinDe(ultimo())).toEqual({ type: 'join', code: 'ABC123', name: 'Ana', pin: '2468', deviceLabel: 'Chrome no Android' })
    ultimo().receive({ type: 'welcome', playerId: 'p1', resumeToken: 'resume-1', name: 'Ana' })
    ultimo().receive({ type: 'account.device', token: SEGREDO })
    expect(contaLembrada(storage)).toBe('Ana')
    expect(storage.getItem(CONTA_STORAGE_KEY)).toContain(SEGREDO)
    ultimo().drop()
    vi.advanceTimersByTime(reconnectDelayMs(1))
    expect(sockets).toHaveLength(2)
    ultimo().open()
    expect(joinDe(ultimo())).toEqual({ type: 'join', code: 'ABC123', name: 'Ana', device: SEGREDO })
    expect(JSON.stringify(ultimo().sent)).not.toContain('2468')
    connection.close()
  })

  it('aparelho lembrado: o join leva o segredo no lugar do PIN, com o nome da conta', () => {
    const storage = memoria()
    storage.setItem(CONTA_STORAGE_KEY, JSON.stringify({ nome: 'Ana', token: SEGREDO }))
    const { connection, ultimo } = conectar(storage, 'aparelho')
    ultimo().open()
    expect(joinDe(ultimo())).toEqual({ type: 'join', code: 'ABC123', name: 'Ana', device: SEGREDO })
    connection.close()
  })

  it('aparelho recusado pelo mestre: o segredo sai do storage e a tela mostra o erro, sem volta automática', () => {
    const storage = memoria()
    storage.setItem(CONTA_STORAGE_KEY, JSON.stringify({ nome: 'Ana', token: SEGREDO }))
    const { connection, sockets, ultimo } = conectar(storage, 'aparelho')
    ultimo().open()
    ultimo().receive({ type: 'account.refused', reason: 'device' })
    ultimo().drop()
    vi.advanceTimersByTime(60_000)
    expect(contaLembrada(storage)).toBeNull()
    expect(connection.getState()).toMatchObject({ status: 'error', error: 'account_device' })
    expect(sockets).toHaveLength(1)
    connection.close()
  })

  it('PIN errado: erro da conta (o mesmo de nome errado) e o aparelho continua sem segredo', () => {
    const storage = memoria()
    const { connection, ultimo } = conectar(storage, { pin: '0000', rotulo: '' })
    ultimo().open()
    expect(joinDe(ultimo())).toEqual({ type: 'join', code: 'ABC123', name: 'Ana', pin: '0000' })
    ultimo().receive({ type: 'account.refused', reason: 'invalid' })
    expect(connection.getState()).toMatchObject({ status: 'error', error: 'account_invalid' })
    expect(contaLembrada(storage)).toBeNull()
    connection.close()
  })

  it('entrar só pelo nome não usa a conta lembrada, nem guarda segredo que chegue', () => {
    const storage = memoria()
    storage.setItem(CONTA_STORAGE_KEY, JSON.stringify({ nome: 'Ana', token: SEGREDO }))
    const { connection, ultimo } = conectar(storage, undefined, 'Bia')
    ultimo().open()
    expect(joinDe(ultimo())).toEqual({ type: 'join', code: 'ABC123', name: 'Bia' })
    ultimo().receive({ type: 'account.device', token: 'T'.repeat(43) })
    expect(storage.getItem(CONTA_STORAGE_KEY)).toContain(SEGREDO)
    connection.close()
  })

  it('conta sem PIN, sem aparelho e sem sessão para retomar não entra pelo nome', () => {
    const { connection, ultimo } = conectar(memoria(), 'aparelho')
    ultimo().open()
    expect(joinDe(ultimo())).toBeUndefined()
    expect(connection.getState()).toMatchObject({ status: 'error', error: 'account_device' })
    connection.close()
  })

  it('"Sair" esquece a conta; segredo torto no storage vale como nenhum', () => {
    const storage = memoria()
    storage.setItem(CONTA_STORAGE_KEY, JSON.stringify({ nome: 'Ana', token: SEGREDO }))
    esquecerContaLembrada(storage)
    expect(storage.dados.has(CONTA_STORAGE_KEY)).toBe(false)
    storage.setItem(CONTA_STORAGE_KEY, JSON.stringify({ nome: 'Ana', token: 'curto' }))
    expect(contaLembrada(storage)).toBeNull()
    storage.setItem(CONTA_STORAGE_KEY, '{')
    expect(contaLembrada(storage)).toBeNull()
  })
})

describe('rótulo do aparelho', () => {
  it('navegador e sistema, do userAgent; o iPad que se diz Mac é reconhecido pelo toque', () => {
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0'
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
    expect(rotuloDoNavegador(android)).toBe('Chrome no Android')
    expect(rotuloDoNavegador(iphone)).toBe('Safari no iPhone')
    expect(rotuloDoNavegador(edge)).toBe('Edge no Windows')
    expect(rotuloDoNavegador(ipad, true)).toBe('Safari no iPad')
    expect(rotuloDoNavegador(ipad)).toBe('Safari no Mac')
    expect(rotuloDoNavegador('')).toBe('Navegador')
  })
})

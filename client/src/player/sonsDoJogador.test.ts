import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SomId } from '../lib/sons/receitas'
import { addToken, addWall, createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Wall } from '../types/map'
import { createPlayerConnection, type PlayerConnection, type PlayerState, type SocketLike } from './playerConnection'
import { instalarSonsDoJogador, SILENCIO_DA_CHEGADA_MS } from './sonsDoJogador'

/**
 * SONS DO JOGADOR instalados na conexão: o que toca e o que fica calado.
 * Primeiro com uma conexão de mentira (relógio e estado na mão); depois com a
 * conexão DE VERDADE e as mensagens do host, na ordem em que ele manda a
 * entrada (`net/hostSession.ts`, `entryOutbound`): é aí que a queda, o
 * "Reconectar" e a volta do lobby reenviam recado e alarme já vistos.
 */

const VISAO_TODA: RegionPoint[][] = [
  [
    { x: -1000, y: -1000 },
    { x: 2000, y: -1000 },
    { x: 2000, y: 2000 },
    { x: -1000, y: 2000 },
  ],
]

function porta(id: string, aberta: boolean): Wall {
  return { id, x1: 100, y1: 0, x2: 100, y2: 50, blocksLight: true, blocksMove: true, door: { open: aberta, locked: false, kind: 'normal' } }
}

function mapaComPorta(id: string, aberta: boolean): MapData {
  return addWall(createEmptyMap(id, id, 10, 10, 50), porta('p1', aberta))
}

function semDestravar(): () => void {
  return () => {}
}

function relogioNaMao() {
  let agora = 0
  return {
    agora: () => agora,
    andar: (ms: number) => {
      agora += ms
    },
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Conexão de mentira: o teste manda no estado e no relógio
// ───────────────────────────────────────────────────────────────────────────

function conexaoFalsa(inicial: PlayerState) {
  let estado = inicial
  const ouvintes = new Set<() => void>()
  return {
    getState: () => estado,
    subscribe(ouvinte: () => void): () => void {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
    mudar(patch: Partial<PlayerState>): void {
      estado = { ...estado, ...patch }
      for (const ouvinte of ouvintes) ouvinte()
    },
    /** Avisa sem mudar nada (o `useSyncExternalStore` e outros ouvintes recebem avisos assim). */
    avisarSemMudar(): void {
      for (const ouvinte of ouvintes) ouvinte()
    },
    quantosOuvem: () => ouvintes.size,
  }
}

const JOGANDO: PlayerState = { status: 'playing', rev: 3, sceneEpoch: 1, vision: VISAO_TODA }

describe('instalarSonsDoJogador (conexão de mentira)', () => {
  it('toca "item" na segunda notificação; a função devolvida tira a inscrição e o destravamento', () => {
    const conexao = conexaoFalsa(JOGANDO)
    const tocar = vi.fn<(id: SomId) => unknown>()
    const parar = vi.fn()
    const destravar = vi.fn((_alvo: EventTarget) => parar)
    const alvo = new EventTarget()
    const relogio = relogioNaMao()
    const desinstalar = instalarSonsDoJogador(conexao, { tocar, alvoDoGesto: alvo, destravar, agora: relogio.agora })
    expect(destravar).toHaveBeenCalledWith(alvo)
    expect(conexao.quantosOuvem()).toBe(1)

    conexao.mudar({ laser: undefined })
    expect(tocar).not.toHaveBeenCalled()
    conexao.mudar({ item: { id: 3, phase: 'taken', nome: 'Chave' } })
    expect(tocar.mock.calls).toEqual([['item']])

    desinstalar()
    expect(conexao.quantosOuvem()).toBe(0)
    expect(parar).toHaveBeenCalledTimes(1)
    conexao.mudar({ item: { id: 4, phase: 'taken', nome: 'Lanterna' } })
    expect(tocar).toHaveBeenCalledTimes(1)
  })

  it('aviso repetido sem mudança de estado não toca nada', () => {
    const conexao = conexaoFalsa(JOGANDO)
    const tocar = vi.fn<(id: SomId) => unknown>()
    instalarSonsDoJogador(conexao, { tocar, destravar: semDestravar, agora: relogioNaMao().agora })
    conexao.avisarSemMudar()
    conexao.avisarSemMudar()
    expect(tocar).not.toHaveBeenCalled()
  })

  it('ao entrar no jogo, a rajada que vem atrás do recorte fica calada; passado o silêncio, o novo toca', () => {
    const conexao = conexaoFalsa({ status: 'connecting', rev: -1, sceneEpoch: 0 })
    const tocar = vi.fn<(id: SomId) => unknown>()
    const relogio = relogioNaMao()
    instalarSonsDoJogador(conexao, { tocar, destravar: semDestravar, agora: relogio.agora })
    conexao.mudar({ status: 'playing', rev: 3, vision: VISAO_TODA })
    relogio.andar(100)
    conexao.mudar({ alarm: { id: 'a1', text: 'Fogo!' } })
    relogio.andar(SILENCIO_DA_CHEGADA_MS - 100 - 1)
    conexao.mudar({ diceRolls: [{ id: 'd1', from: 'Bia', count: 1, sides: 6, modifier: 0, results: [4], total: 4, at: 1 }] })
    expect(tocar).not.toHaveBeenCalled()
    relogio.andar(1)
    conexao.mudar({ alarm: { id: 'a2', text: 'Desabamento!' } })
    expect(tocar.mock.calls).toEqual([['aviso']])
  })

  it('a passagem é o único som da chegada: o que vem logo atrás dela fica calado', () => {
    const conexao = conexaoFalsa({ ...JOGANDO, map: mapaComPorta('m1', false) })
    const tocar = vi.fn<(id: SomId) => unknown>()
    const relogio = relogioNaMao()
    instalarSonsDoJogador(conexao, { tocar, destravar: semDestravar, agora: relogio.agora })
    conexao.mudar({ sceneEpoch: 2 })
    relogio.andar(200)
    conexao.mudar({ travel: { id: 9, phase: 'arrived' }, map: mapaComPorta('m2', false) })
    conexao.mudar({ alarm: { id: 'a1', text: 'Fogo!' } })
    expect(tocar.mock.calls).toEqual([['passagem']])
    relogio.andar(SILENCIO_DA_CHEGADA_MS)
    conexao.mudar({ map: mapaComPorta('m2', true) })
    expect(tocar.mock.calls).toEqual([['passagem'], ['portaAbre']])
  })

  it('tocador que lança não derruba a conexão (o ouvinte roda dentro do setState dela)', () => {
    const conexao = conexaoFalsa(JOGANDO)
    const tocar = vi.fn<(id: SomId) => unknown>(() => {
      throw new Error('sem áudio')
    })
    instalarSonsDoJogador(conexao, { tocar, destravar: semDestravar, agora: relogioNaMao().agora })
    expect(() => conexao.mudar({ item: { id: 3, phase: 'taken', nome: 'Chave' } })).not.toThrow()
    expect(() => conexao.mudar({ item: { id: 4, phase: 'taken', nome: 'Chave' } })).not.toThrow()
    expect(tocar).toHaveBeenCalledTimes(2)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Conexão de verdade, host de mentira (só o socket é falso)
// ───────────────────────────────────────────────────────────────────────────

class FakeSocket implements SocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(): void {}
  close(): void {
    this.readyState = 3
  }
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
  /** O Wi-Fi piscou: o navegador fecha o socket. */
  drop(): void {
    this.readyState = 3
    this.onclose?.(new CloseEvent('close'))
  }
}

const RECADO = { id: 'n1', text: 'Não acendam as velas.', at: 1_000 }
const ALARME = { type: 'scene.alarm', id: 'a1', text: 'O sino tocou!' }

function rolagem(id: string) {
  return { id, from: 'Bia', count: 1, sides: 6, modifier: 0, results: [4], total: 4, at: 2_000 }
}

/** `map` vai para o fio como JSON: pode faltar campo, como num recorte de verdade. */
function snapshot(rev: number, map: Partial<MapData>, ownTokens: string[] = []) {
  return { type: 'snapshot', rev, map, vision: VISAO_TODA, ownTokens, concealed: [] }
}

/** Mesa montada: a conexão de verdade, os sons instalados ANTES do socket abrir (como em `main.tsx`). */
function mesa() {
  const sockets: FakeSocket[] = []
  const connection: PlayerConnection = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: 'Ana',
    storage: null,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const tocar = vi.fn<(id: SomId) => unknown>()
  const relogio = relogioNaMao()
  const desinstalar = instalarSonsDoJogador(connection, { tocar, destravar: semDestravar, agora: relogio.agora })
  const ultimo = (): FakeSocket => {
    const socket = sockets.at(-1)
    if (socket === undefined) throw new Error('nenhum socket aberto')
    return socket
  }
  /** O que o host manda a quem entra jogando, na ordem de `entryOutbound`: recorte, caderno, recado da cena, alarme. */
  const entrada = (rev: number, entreMensagens = 0) => {
    const socket = ultimo()
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' })
    for (const msg of [snapshot(rev, mapaComPorta('m1', false)), { type: 'notes.book', notes: [RECADO] }, { type: 'scene.note', ...RECADO }, ALARME]) {
      socket.receive(msg)
      relogio.andar(entreMensagens)
    }
  }
  return { connection, tocar, relogio, desinstalar, ultimo, entrada }
}

describe('instalarSonsDoJogador com a conexão de verdade', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('entrar com recado e alarme na cena não toca nada', () => {
    const { connection, tocar, entrada } = mesa()
    entrada(1)
    expect(connection.getState().alarm?.id).toBe('a1')
    expect(connection.getState().note?.id).toBe('n1')
    expect(tocar).not.toHaveBeenCalled()
  })

  it('queda do Wi-Fi: a volta reenvia recado e alarme, mesmo devagar, e nada toca de novo', () => {
    const { connection, tocar, relogio, ultimo, entrada } = mesa()
    entrada(1)
    relogio.andar(SILENCIO_DA_CHEGADA_MS * 2)
    // O jogador fechou o cartão do recado antes da queda: a volta o reabre.
    connection.dismissNote()
    ultimo().drop()
    expect(connection.getState().reconnecting).toBeDefined()
    vi.advanceTimersByTime(1_000)
    // Rede lenta: cada mensagem da volta chega depois do silêncio da chegada; só o "já visto" segura.
    entrada(2, SILENCIO_DA_CHEGADA_MS * 2)
    expect(connection.getState().reconnecting).toBeUndefined()
    expect(connection.getState().note?.id).toBe('n1')
    expect(tocar).not.toHaveBeenCalled()
  })

  it('"Reconectar" (apaga recado e alarme da tela) e a volta do lobby não tocam o alarme já visto', () => {
    const { connection, tocar, relogio, ultimo, entrada } = mesa()
    entrada(1)
    relogio.andar(SILENCIO_DA_CHEGADA_MS * 2)
    connection.reconnect()
    expect(connection.getState().alarm).toBeUndefined()
    entrada(2, SILENCIO_DA_CHEGADA_MS * 2)
    expect(connection.getState().alarm?.id).toBe('a1')

    // O mestre tirou a ficha dele da cena (lobby) e devolveu: o host reenvia o alarme que ainda vale.
    ultimo().receive({ type: 'lobby.waiting' })
    relogio.andar(SILENCIO_DA_CHEGADA_MS * 2)
    ultimo().receive(snapshot(3, mapaComPorta('m1', false)))
    relogio.andar(SILENCIO_DA_CHEGADA_MS * 2)
    ultimo().receive(ALARME)
    expect(tocar).not.toHaveBeenCalled()

    // Controle: o que é NOVO de verdade toca.
    ultimo().receive({ type: 'scene.alarm', id: 'a2', text: 'Desabamento!' })
    expect(tocar.mock.calls).toEqual([['aviso']])
  })

  it('no jogo: dado, item, porta e recado novos tocam; a troca de cena toca a passagem uma vez só', () => {
    const { tocar, relogio, ultimo, entrada } = mesa()
    entrada(1)
    relogio.andar(SILENCIO_DA_CHEGADA_MS * 2)
    const socket = ultimo()

    socket.receive({ type: 'dice.rolled', roll: rolagem('r1') })
    socket.receive({ type: 'pin.take.answer', answer: 'taken', nome: 'Chave de latão' })
    socket.receive(snapshot(2, mapaComPorta('m1', true)))
    socket.receive({ type: 'scene.note', id: 'n2', text: 'Ouviram passos?', at: 3_000 })
    expect(tocar.mock.calls).toEqual([['dado'], ['item'], ['portaAbre'], ['aviso']])
    tocar.mockClear()

    // `scene.changed` e, logo atrás, o recorte do mapa novo (com outra porta) e o alarme de lá.
    relogio.andar(SILENCIO_DA_CHEGADA_MS * 2)
    socket.receive({ type: 'scene.changed', by: 'master' })
    socket.receive(snapshot(3, mapaComPorta('m2', true)))
    socket.receive({ type: 'scene.alarm', id: 'a9', text: 'Fumaça no corredor' })
    expect(tocar.mock.calls).toEqual([['passagem']])
  })

  it('escada para outro piso da mesma cena toca a passagem', () => {
    const { tocar, relogio, ultimo, entrada } = mesa()
    entrada(1)
    relogio.andar(SILENCIO_DA_CHEGADA_MS * 2)
    const base = createEmptyMap('m1', 'm1', 10, 10, 50)
    const ficha = { id: 'eu', characterId: null, name: 'Ana', x: 25, y: 25, size: 1, image: null }
    ultimo().receive(snapshot(2, addToken(base, ficha), ['eu']))
    ultimo().receive(snapshot(3, addToken(base, { ...ficha, piso: 1 }), ['eu']))
    expect(tocar.mock.calls).toEqual([['passagem']])
  })

  it('recorte sem o campo walls (o host pode mandar assim): não lança e o som seguinte toca', () => {
    const { tocar, relogio, ultimo, entrada } = mesa()
    entrada(1)
    relogio.andar(SILENCIO_DA_CHEGADA_MS * 2)
    const semParedes: Partial<MapData> = { ...mapaComPorta('m1', true) }
    delete semParedes.walls
    expect(() => ultimo().receive(snapshot(2, semParedes))).not.toThrow()
    ultimo().receive({ type: 'dice.rolled', roll: rolagem('r2') })
    expect(tocar.mock.calls).toEqual([['dado']])
  })
})

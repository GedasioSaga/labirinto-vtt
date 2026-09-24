/**
 * Jogador e host de verdade, ligados por um socket de mentira que só entrega
 * quando o teste manda (`escoa`): a rede é assíncrona, e a edição otimista só
 * existe porque a resposta demora.
 *
 * - SÓ O QUE MUDOU: depois da primeira tela, o que chega é `patch`, sem foto,
 *   e a tela montada com eles é a mesma que a tela inteira daria.
 * - Mensagem perdida no caminho: o `patch` seguinte não encaixa, o jogador
 *   pede a tela inteira (`view.resync`) e volta a ver o que o mestre vê.
 * - Foto recusada pelo intervalo mínimo: a tela volta para a foto que vale.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult } from '../net/hostSession'
import { createPlayerConnection, type PlayerState, type SocketLike } from './playerConnection'

const CODE = 'ABC123'
const FOTO = `data:image/webp;base64,${'C'.repeat(20_000)}`
const FOTO_A = 'data:image/png;base64,QUFB'
const FOTO_B = 'data:image/png;base64,QkJC'

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

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, imageData: FOTO }
}

function mesa() {
  let agora = 0
  let n = 0
  const host = createHostSession({ code: CODE, visionRadius: 500, now: () => agora, randomId: () => `id-${(n += 1)}` })
  let mapa: MapData = { ...createEmptyMap('m', 'M', 30, 30, 40), tokens: [ficha('ana', 100, 100), ficha('npc', 300, 100), ficha('bia', 200, 200)] }
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
  const recebidas: string[] = []
  let perderProxima = false

  const entrega = (r: HostResult): void => {
    for (const { clientId, msg } of r.outbound) {
      if (clientId !== 'c-ana') continue
      const texto = JSON.stringify(msg)
      if (perderProxima && (msg.type === 'patch' || msg.type === 'snapshot')) {
        // Fila do cliente cheia no transporte: a tela some sem aviso.
        perderProxima = false
        continue
      }
      recebidas.push(texto)
      socket.recebe(texto)
    }
  }

  /** O que o jogador mandou chega ao host; o que o host responde chega ao jogador. Igual ao hostBridge. */
  const escoa = (): void => {
    while (socket.saida.length > 0) {
      const texto = socket.saida.shift()
      if (texto === undefined) break
      const r = host.handleMessage('c-ana', texto, mapa)
      entrega(r)
      const { applyMove, applyTokenEdit } = r
      if (applyMove !== undefined) mapa = { ...mapa, tokens: mapa.tokens.map((t) => (t.id === applyMove.tokenId ? { ...t, x: applyMove.x, y: applyMove.y } : t)) }
      if (applyTokenEdit !== undefined && typeof applyTokenEdit.image === 'string') {
        const image = applyTokenEdit.image
        mapa = { ...mapa, tokens: mapa.tokens.map((t) => (t.id === applyTokenEdit.tokenId ? { ...t, image: null, imageData: image } : t)) }
      }
      if (applyMove !== undefined || applyTokenEdit !== undefined) entrega(host.broadcast(mapa))
    }
  }

  const moveNpc = (x: number): void => {
    mapa = { ...mapa, tokens: mapa.tokens.map((t) => (t.id === 'npc' ? { ...t, x } : t)) }
    entrega(host.broadcast(mapa))
  }

  socket.open()
  escoa()
  let playerId: string | undefined
  for (const texto of recebidas) {
    const msg: unknown = JSON.parse(texto)
    if (typeof msg === 'object' && msg !== null && 'playerId' in msg && typeof msg.playerId === 'string') playerId = msg.playerId
  }
  if (playerId === undefined) throw new Error('sem welcome')
  host.assignToken(playerId, 'ana')
  entrega(host.broadcast(mapa))

  return {
    conexao,
    host,
    recebidas,
    escoa,
    moveNpc,
    avanca: (ms: number) => (agora += ms),
    perdeProxima: () => (perderProxima = true),
    reenviaTudo: () => {
      host.forgetView('c-ana')
      entrega(host.broadcast(mapa))
    },
  }
}

function tela(state: PlayerState): unknown {
  return JSON.parse(JSON.stringify({ map: state.map, vision: state.vision, explored: state.explored, ownTokens: state.ownTokens, concealed: state.concealed }))
}

function fichaNaTela(state: PlayerState, id: string): Token | undefined {
  return state.map?.tokens.find((t) => t.id === id)
}

describe('jogador que aplica só o que mudou', () => {
  it('depois da primeira tela só chegam patches sem foto, e a tela montada é a mesma que a inteira', () => {
    const m = mesa()
    expect(m.conexao.getState().status).toBe('playing')
    const depoisDaPrimeira = m.recebidas.length

    for (const x of [140, 180, 220]) {
      expect(m.conexao.requestMove('ana', x, 100)).toBe(true)
      m.escoa()
    }
    m.moveNpc(340)

    const novas = m.recebidas.slice(depoisDaPrimeira).map((t): unknown => JSON.parse(t))
    const telas = novas.filter((msg) => typeof msg === 'object' && msg !== null && 'rev' in msg)
    expect(telas.length).toBe(4)
    expect(telas.every((msg) => typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'patch')).toBe(true)
    expect(m.recebidas.slice(depoisDaPrimeira).join('')).not.toContain('data:image')
    expect(fichaNaTela(m.conexao.getState(), 'ana')?.x).toBe(220)
    expect(fichaNaTela(m.conexao.getState(), 'npc')?.x).toBe(340)
    expect(fichaNaTela(m.conexao.getState(), 'npc')?.imageData).toBe(FOTO)

    const montada = tela(m.conexao.getState())
    m.reenviaTudo()
    expect(m.recebidas.at(-1)).toContain('"type":"snapshot"')
    expect(tela(m.conexao.getState())).toEqual(montada)
  })

  it('patch perdido no caminho: o seguinte não encaixa, o jogador pede a tela inteira e volta a ver o NPC onde ele está', () => {
    const m = mesa()
    m.perdeProxima()
    m.moveNpc(340)
    expect(fichaNaTela(m.conexao.getState(), 'npc')?.x).toBe(300)

    m.moveNpc(380)
    // O patch de 380 parte de uma tela que o jogador não tem: não entra.
    expect(fichaNaTela(m.conexao.getState(), 'npc')?.x).toBe(300)
    m.escoa()
    expect(m.recebidas.at(-1)).toContain('"type":"snapshot"')
    expect(fichaNaTela(m.conexao.getState(), 'npc')?.x).toBe(380)

    m.moveNpc(420)
    expect(m.recebidas.at(-1)).toContain('"type":"patch"')
    expect(fichaNaTela(m.conexao.getState(), 'npc')?.x).toBe(420)
  })

  it('foto A aceita, foto B 300 ms depois descartada pelo host: a tela do jogador volta para a A', () => {
    const m = mesa()
    expect(m.conexao.setOwnTokenPhoto('ana', FOTO_A)).toBe(true)
    m.escoa()
    expect(fichaNaTela(m.conexao.getState(), 'ana')?.imageData).toBe(FOTO_A)

    m.avanca(300)
    expect(m.conexao.setOwnTokenPhoto('ana', FOTO_B)).toBe(true)
    // Otimista: o jogador vê a B antes de o host responder.
    expect(fichaNaTela(m.conexao.getState(), 'ana')?.imageData).toBe(FOTO_B)
    m.escoa()
    expect(fichaNaTela(m.conexao.getState(), 'ana')?.imageData).toBe(FOTO_A)
  })
})

// @vitest-environment node
/**
 * ENTRAR PELO LOBBY ("Entrar na mesa agora") no host, de ponta a ponta: a
 * sala publicada (`salaNoLobby.ts`, com o `pedir` da R1 trocado por um falso)
 * dá a chave e o relógio do Lobby à ponte (`regrasDoBilhete`, como o App
 * liga), e o `join` com o bilhete assinado por essa chave entra na conta certa
 * pelo `joinWithAccount`, mesmo com "Só com conta". Ambiente `node` (WebCrypto
 * sem DOM), como o `bilhete.test.ts`. Contas inventadas (One Piece).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArquivoDeContas, PinGuardado } from '../lib/contasDosJogadores'
import { createEmptyMap } from '../lib/mapFactory'
import { assinarBilhete, novaChaveDaSala } from '../lib/nuvem/bilhete'
import { novoPersonagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { useToastStore } from '../stores/toastStore'
import { criarPortaDasContas } from './entradaComConta'
import { createHostBridge, type HostBridge } from './hostBridge'
import { createHostSession, type HostWorld } from './hostSession'
import type { PedidoDaR1 } from './nuvem/comandosDaR1'
import { criarSalaNoLobby } from './nuvem/salaNoLobby'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.10:7777/player', 'http://127.0.0.1:7777/player'], qrSvg: '<svg/>' }
/** O relógio do Lobby uma hora à frente: sem a diferença guardada da resposta de `/sala`, o bilhete pareceria do futuro. */
const DESVIO_DO_LOBBY_MS = 60 * 60_000
/** O bilhete nunca confere PIN. */
const PIN_QUALQUER: PinGuardado = { algoritmo: 'PBKDF2-SHA256', iteracoes: 600_000, sal: 'AAAAAAAAAAAAAAAAAAAAAA==', hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }
const LIRIO = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Lírio'), id: 'pers_lirio', dono: 'conta_ana' }

const world = (): HostWorld => ({
  open: {
    sceneId: 'cena-a',
    name: 'Salão',
    map: { ...createEmptyMap('mapa-a', 'A', 40, 10, 50), tokens: [{ id: 'ficha-lirio', characterId: LIRIO.id, name: 'Lírio', x: 200, y: 200, size: 1, image: null }] },
  },
  background: [],
  rpg: { sistema: SISTEMA_ONE_PIECE, personagens: [LIRIO] },
})

let aberta: HostBridge | null = null

afterEach(async () => {
  await aberta?.stop()
  aberta = null
})

async function mesaNoLobby() {
  useToastStore.setState({ toasts: [] })
  const arquivo: ArquivoDeContas = { soComConta: true, contas: [{ id: 'conta_ana', nome: 'Ana', pin: PIN_QUALQUER, aparelhos: [], criada: 1 }] }
  const porta = criarPortaDasContas({
    prontas: async () => undefined,
    ler: () => arquivo,
    alterar: async () => {
      throw new Error('o bilhete não grava nada em contas.json')
    },
  })
  const chave = novaChaveDaSala()
  const agoraNoLobby = () => Date.now() + DESVIO_DO_LOBBY_MS
  const pedidos: PedidoDaR1[] = []
  let campanha: string | null = 'camp_rota_das_ilhas'
  const sala = criarSalaNoLobby({
    pedir: async (pedido) => {
      pedidos.push(pedido)
      return pedido.rota === 'abrirSala' ? { chave, agora: agoraNoLobby(), expiraEm: agoraNoLobby() + 600_000 } : null
    },
    campanhaId: async () => campanha,
    repetir: () => () => undefined,
  })
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    contas: porta,
    regrasDoBilhete: () => sala.regrasDoBilhete(),
  })
  aberta = bridge
  // O caminho do App: a ponte abre a sala, e a sala vai ao Lobby com o código e os endereços dela.
  const room = await bridge.start()
  await sala.abrir(room.code, room.urls)
  const sentTo = (clientId: string) =>
    invoke.mock.calls.filter((call) => call[0] === 'net_send').flatMap((call) => {
      const args = call[1]
      return typeof args === 'object' && args !== null && 'clientId' in args && 'msg' in args && args.clientId === clientId ? [args.msg] : []
    })
  const kicked = (clientId: string) => invoke.mock.calls.some((call) => call[0] === 'net_kick' && JSON.stringify(call[1]) === JSON.stringify({ clientId }))
  // O que a página do jogador manda (`playerConnection`, B5b): código, o nome do bilhete e o bilhete, sem PIN nem aparelho.
  const joinComBilhete = (clientId: string, bilhete: string) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload: { clientId, msg: { type: 'join', code: ROOM.code, name: 'Ana do Lobby', ticket: bilhete } } })
  }
  const bilheteDaAna = () => assinarBilhete(chave, { sala: ROOM.code, contaId: 'conta_ana', nome: 'Ana do Lobby' }, agoraNoLobby())
  return {
    bridge,
    sala,
    pedidos,
    sentTo,
    kicked,
    joinComBilhete,
    bilheteDaAna,
    tirarPastaDoLobby: () => {
      campanha = null
    },
  }
}

const tipoDe = (msg: unknown): unknown => (typeof msg === 'object' && msg !== null && 'type' in msg ? msg.type : undefined)

describe('hostBridge: entrar pelo Lobby com o bilhete', () => {
  it('o bilhete válido entra na conta certa, sem account_required nem segredo de aparelho; o mesmo bilhete de novo é recusado e a conexão cai', async () => {
    const { bridge, pedidos, sentTo, kicked, joinComBilhete, bilheteDaAna } = await mesaNoLobby()
    // Só a rede local foi ao Lobby: o 127.0.0.1 ficou de fora.
    expect(pedidos).toEqual([
      { rota: 'abrirSala', campanhaId: 'camp_rota_das_ilhas', corpo: { codigo: ROOM.code, enderecos: [{ tipo: 'lan', url: 'http://192.168.0.10:7777/player' }] } },
    ])
    const bilhete = await bilheteDaAna()

    joinComBilhete('c1', bilhete)
    await vi.waitFor(() => expect(sentTo('c1').map(tipoDe)).toContain('welcome'), { timeout: 5000 })
    const tipos = sentTo('c1').map(tipoDe)
    expect(tipos[0]).toBe('welcome')
    expect(tipos).not.toContain('error')
    expect(tipos).not.toContain('account.refused')
    expect(tipos).not.toContain('account.device')
    expect(kicked('c1')).toBe(false)
    // O nome que vale é o da conta no app, e a ficha da conta veio junto.
    expect(bridge.players().find((p) => p.clientId === 'c1')).toMatchObject({ name: 'Ana', status: 'playing', tokenIds: ['ficha-lirio'] })

    joinComBilhete('c2', bilhete)
    await vi.waitFor(() => expect(kicked('c2')).toBe(true), { timeout: 5000 })
    expect(sentTo('c2')).toEqual([{ type: 'account.refused', reason: 'invalid' }])
  })

  it('a pasta saiu do Lobby: a sala sai junto e o bilhete vira unavailable; e o join com bilhete que chegue direto à sessão nunca entra pelo nome', async () => {
    const { sala, pedidos, sentTo, kicked, joinComBilhete, bilheteDaAna, tirarPastaDoLobby } = await mesaNoLobby()
    const bilhete = await bilheteDaAna()
    tirarPastaDoLobby()
    await sala.reconferir()
    expect(pedidos.map((pedido) => pedido.rota)).toEqual(['abrirSala', 'fecharSala'])
    expect(sala.regrasDoBilhete()).toBeNull()

    joinComBilhete('c1', bilhete)
    await vi.waitFor(() => expect(kicked('c1')).toBe(true), { timeout: 5000 })
    expect(sentTo('c1')).toEqual([{ type: 'account.refused', reason: 'unavailable' }])

    // Defesa em profundidade: a sessão sozinha, sem a ponte conferir, recusa o bilhete.
    const sessao = createHostSession({ code: ROOM.code, visionRadius: 5 })
    const resposta = sessao.handleMessage('c9', { type: 'join', code: ROOM.code, name: 'Ana do Lobby', ticket: bilhete }, world())
    expect(resposta.outbound.map((saida) => saida.msg)).toEqual([{ type: 'account.refused', reason: 'unavailable' }])
    expect(sessao.listPlayers()).toEqual([])
  })
})

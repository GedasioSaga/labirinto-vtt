import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import { useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import type { MapData, Token } from '../../types/map'
import { createPlayerConnection, type PlayerConnection, type StorageLike } from '../../player/playerConnection'
import { criarSocketDoCanal } from '../../player/visaoDeTeste/socketDoCanal'
import { PILHA_DO_EDITOR } from '../avisosDaPonte'
import { createHostBridge, type InvokeFn } from '../hostBridge'
import { singleSceneWorld } from '../hostSession'
import { criarParDeCanais, type Canal } from './canal'
import type { JanelaDeTeste } from './janela'
import { lerMensagemDoHost } from './protocoloDoCanal'
import { criarControladorDaVisao, fichasParaTeste, PRAZO_DA_PRIMEIRA_RESPOSTA_MS, type ControladorDaVisao } from './visaoDeTeste'

/**
 * VISÃO DE JOGADOR de ponta a ponta, sem React: o controlador com a ponte de
 * teste de verdade (`createHostBridge`), o canal em memória e, do outro lado,
 * o cliente do jogador de verdade (`createPlayerConnection`) sobre o socket do
 * canal — o mesmo caminho da janela de teste, só sem a tela.
 *
 * O que não pode acontecer nunca: o teste aparecer na mesa de verdade. Zero
 * avisos na pilha do editor, nenhuma escrita nas stores, e a ponte da sala
 * real sem mandar nada a ninguém.
 */

const GRADE = 50
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null }
const SEVERA: Token = { id: 'tok-severa', characterId: null, name: 'Severa', x: 225, y: 125, size: 1, image: null, npc: true }

function memoria(): StorageLike {
  const itens = new Map<string, string>()
  return {
    getItem: (k) => itens.get(k) ?? null,
    setItem: (k, v) => {
      itens.set(k, v)
    },
    removeItem: (k) => {
      itens.delete(k)
    },
  }
}

/** A janela de teste sem tela: fala o protocolo do canal e monta o cliente do jogador a cada geração. */
function janelaSemTela(canal: Canal, sessao: string) {
  const conexoes: PlayerConnection[] = []
  let proxima = 1
  canal.ouvir((dado) => {
    const mensagem = lerMensagemDoHost(dado, sessao)
    if (mensagem === null) return
    if (mensagem.tipo === 'ping') canal.enviar({ de: 'janela', tipo: 'pong', sessao })
    if (mensagem.tipo !== 'config') return
    conexoes.at(-1)?.close()
    const { geracao, codigo, nome } = mensagem
    conexoes.push(
      createPlayerConnection({
        url: 'teste://visao',
        code: codigo,
        name: nome,
        createSocket: () => {
          const conexao = proxima
          proxima += 1
          return criarSocketDoCanal({ canal, sessao, geracao, conexao, modo: () => 'olhar' })
        },
        storage: memoria(),
        aceitaGzip: false,
      }),
    )
  })
  canal.enviar({ de: 'janela', tipo: 'ola', sessao })
  return {
    conexao: (): PlayerConnection => {
      const atual = conexoes.at(-1)
      if (atual === undefined) throw new Error('a janela ainda não recebeu o config')
      return atual
    },
    quantas: () => conexoes.length,
  }
}

describe('Visão de jogador — controlador + ponte de teste + cliente de verdade', () => {
  let mapa: MapData
  let canalDoHost: Canal
  let canalDaJanela: Canal
  let sessaoAberta: string | null
  let janelaFalsa: { abrir: Mock<JanelaDeTeste['abrir']>; fechar: Mock<JanelaDeTeste['fechar']>; mostrar: Mock<JanelaDeTeste['mostrar']> }
  let controlador: ControladorDaVisao
  const escritasNasStores = vi.fn()

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    mapa = { ...createEmptyMap('m-visao', 'Salão', 10, 10, GRADE), tokens: [ANA, SEVERA] }
    ;[canalDoHost, canalDaJanela] = criarParDeCanais()
    sessaoAberta = null
    janelaFalsa = {
      abrir: vi.fn(async (sessao: string) => {
        sessaoAberta = sessao
      }),
      fechar: vi.fn(async () => {}),
      mostrar: vi.fn(async () => true),
    }
    const janela: JanelaDeTeste = { abrir: janelaFalsa.abrir, fechar: janelaFalsa.fechar, mostrar: janelaFalsa.mostrar, desligar: () => {} }
    vi.spyOn(useMapStore, 'setState').mockImplementation(escritasNasStores)
    vi.spyOn(useAdventureStore, 'setState').mockImplementation(escritasNasStores)
    escritasNasStores.mockClear()
    controlador = criarControladorDaVisao({
      getMap: () => mapa,
      getWorld: () => singleSceneWorld(mapa),
      avisos: PILHA_DO_EDITOR,
      abrirCanal: () => canalDoHost,
      criarJanela: () => janela,
    })
    controlador.definirFichas(fichasParaTeste(mapa.tokens, new Map([[ANA.id, 'Bia']])), null)
  })

  afterEach(() => {
    controlador.fechar()
    vi.restoreAllMocks()
    vi.useRealTimers()
    useToastStore.setState({ toasts: [] })
  })

  async function abrirJanela(tokenId: string) {
    controlador.abrir(tokenId)
    await vi.waitFor(() => expect(sessaoAberta).not.toBeNull())
    if (sessaoAberta === null) throw new Error('a janela não abriu')
    return janelaSemTela(canalDaJanela, sessaoAberta)
  }

  it('entra pela mesa-semente com a ficha como própria, recebe a edição do mestre e acaba com room.closed — sem nada na mesa de verdade', async () => {
    // A sala de verdade aberta ao lado, com o transporte dela espionado.
    const invokeReal = vi.fn<InvokeFn>(async (cmd) => (cmd === 'net_start_room' ? { code: 'REAL22', urls: [], qrSvg: '' } : undefined))
    const ponteReal = createHostBridge({ invoke: invokeReal, listen: async () => () => {}, getMap: () => mapa, applyMove: vi.fn(), applyDoor: vi.fn() })
    await ponteReal.start()

    const janela = await abrirJanela(ANA.id)
    expect(controlador.estado()).toEqual({ aberta: true, ficha: expect.objectContaining({ id: ANA.id, dono: 'Bia' }) })

    await vi.waitFor(() => expect(janela.conexao().getState().ownTokens).toEqual([ANA.id]))
    const estado = janela.conexao().getState()
    expect(estado.status).toBe('playing')
    expect(estado.map?.tokens.map((t) => t.id)).toContain(SEVERA.id)

    // O mestre move a NPC no editor: o App avisa as pontes, e a de teste manda a tela nova.
    mapa = { ...mapa, tokens: [ANA, { ...SEVERA, x: 175, y: 175 }] }
    controlador.ponte()?.notifyMapChanged()
    ponteReal.notifyMapChanged()
    await vi.waitFor(() => expect(janela.conexao().getState().map?.tokens.find((t) => t.id === SEVERA.id)?.x).toBe(175))

    controlador.fechar()
    await vi.waitFor(() => expect(janela.conexao().getState().status).toBe('closed'))
    expect(janelaFalsa.fechar).toHaveBeenCalledTimes(1)
    expect(controlador.estado()).toEqual({ aberta: false, ficha: null })
    expect(controlador.ponte()).toBeNull()

    // A mesa de verdade não soube de nada.
    expect(useToastStore.getState().toasts).toEqual([])
    expect(escritasNasStores).not.toHaveBeenCalled()
    expect(invokeReal.mock.calls.map(([cmd]) => cmd)).toEqual(['net_start_room'])
    expect(ponteReal.players()).toEqual([])
    await ponteReal.stop()
  })

  it('no Olhar, o pedido de mover que escape da tela morre na guarda do socket: o host nem fica sabendo', async () => {
    const tiposQueChegaram: string[] = []
    canalDoHost.ouvir((dado) => {
      if (typeof dado !== 'object' || dado === null || Reflect.get(dado, 'tipo') !== 'msg') return
      const texto: unknown = Reflect.get(dado, 'data')
      if (typeof texto === 'string') tiposQueChegaram.push(String(Reflect.get(JSON.parse(texto), 'type')))
    })
    const janela = await abrirJanela(ANA.id)
    await vi.waitFor(() => expect(janela.conexao().getState().ownTokens).toEqual([ANA.id]))

    janela.conexao().requestMove(ANA.id, 175, 125)
    janela.conexao().sendSignal(150, 150)
    await new Promise((resolve) => setTimeout(resolve, 120))

    expect(tiposQueChegaram).toContain('join')
    expect(tiposQueChegaram).not.toContain('token.move')
    expect(tiposQueChegaram).not.toContain('signal')
    expect(escritasNasStores).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('Trocar ficha: a mesma janela recomeça com a ficha nova, que passa a ser a própria', async () => {
    const janela = await abrirJanela(ANA.id)
    await vi.waitFor(() => expect(janela.conexao().getState().ownTokens).toEqual([ANA.id]))

    controlador.abrir(SEVERA.id)
    await vi.waitFor(() => expect(janela.quantas()).toBe(2))
    await vi.waitFor(() => expect(janela.conexao().getState().ownTokens).toEqual([SEVERA.id]))

    expect(janelaFalsa.abrir).toHaveBeenCalledTimes(1)
    expect(janelaFalsa.mostrar).toHaveBeenCalled()
    expect(controlador.estado().ficha?.id).toBe(SEVERA.id)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('janela que nunca responde: o teste fecha sozinho no prazo', async () => {
    vi.useFakeTimers()
    controlador.abrir(ANA.id)
    await vi.advanceTimersByTimeAsync(PRAZO_DA_PRIMEIRA_RESPOSTA_MS + 5_000)

    expect(controlador.estado().aberta).toBe(false)
    expect(janelaFalsa.fechar).toHaveBeenCalledTimes(1)
  })

  it('o "Fechar" da barra da janela fecha o teste', async () => {
    await abrirJanela(ANA.id)
    if (sessaoAberta === null) throw new Error('a janela não abriu')
    canalDaJanela.enviar({ de: 'janela', tipo: 'pedir-fechar', sessao: sessaoAberta })

    await vi.waitFor(() => expect(controlador.estado().aberta).toBe(false))
    expect(janelaFalsa.fechar).toHaveBeenCalledTimes(1)
  })
})

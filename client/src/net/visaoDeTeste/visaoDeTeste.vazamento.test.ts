import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../../lib/mapFactory'
import { hostWorldOf, useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import type { MapData, Pin, Stair, Token, Wall } from '../../types/map'
import { createPlayerConnection, type PlayerConnection, type StorageLike } from '../../player/playerConnection'
import { criarSocketDoCanal } from '../../player/visaoDeTeste/socketDoCanal'
import { PILHA_DO_EDITOR } from '../avisosDaPonte'
import type { HostBridgeDeps } from '../hostBridge'
import { criarParDeCanais, type Canal } from './canal'
import type { JanelaDeTeste } from './janela'
import { lerMensagemDoHost } from './protocoloDoCanal'
import type { ModoDoTeste } from './tipos'
import { criarControladorDaVisao, fichasParaTeste, type ControladorDaVisao } from './visaoDeTeste'

/**
 * VISÃO DE JOGADOR — VAZAMENTO ZERO no Jogar. O jogador de teste age de
 * verdade (o cliente do jogador sobre o canal em memória, sem a guarda do
 * Olhar) e a ponte de teste lê o mundo das stores DE VERDADE, como o App liga.
 * Andar, porta, mochila, bilhete, piso e caravana aparecem na janela, e nada
 * disso chega ao editor: nenhuma escrita nas stores, nenhuma chamada aos
 * escritores do jogo de verdade, o mapa serializado idêntico.
 */

/** Toda ponte que o controlador monta: o que ela recebe de escritor é o que ela pode gravar. */
const pontes = vi.hoisted((): { deps: HostBridgeDeps[] } => ({ deps: [] }))

vi.mock('../hostBridge', async (importOriginal) => {
  const real = await importOriginal<typeof import('../hostBridge')>()
  return {
    ...real,
    createHostBridge: (deps: HostBridgeDeps) => {
      pontes.deps.push(deps)
      return real.createHostBridge(deps)
    },
  }
})

const GRADE = 50
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null }
const BIA: Token = { id: 'tok-bia', characterId: null, name: 'Bia', x: 325, y: 325, size: 1, image: null }
/** Porta logo abaixo de onde a Ana para (175, 125): ao alcance dela. */
const PORTA: Wall = { id: 'porta', x1: 150, y1: 175, x2: 200, y2: 175, blocksLight: false, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
/** A parede que o mestre arrasta no meio do teste. */
const PAREDE: Wall = { id: 'parede', x1: 400, y1: 50, x2: 400, y2: 150, blocksLight: true, blocksMove: true, door: null }
const CHAVE: Pin = { ...buildPin('pino-chave', { x: 225, y: 125 }, 'exclamacao'), item: { nome: 'Chave de ferro', livre: true } }
/** Escada passando por onde a Ana para: dali ela sobe ao 1º piso. */
const ESCADA: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 175, y1: 100, x2: 175, y2: 150 }], stepWidth: 40, levaAoPiso: 1 }

const DESTINO = { x: 175, y: 125 }

function salao(): MapData {
  return { ...createEmptyMap('m-salao', 'Salão', 10, 10, GRADE), tokens: [ANA], walls: [PORTA, PAREDE], pins: [CHAVE], stairs: [ESCADA] }
}

/** Mapa-mundi com a Ana e a Bia longe uma da outra: a caravana as junta. */
function continente(): MapData {
  return { ...createEmptyMap('m-mundo', 'Continente', 20, 20, GRADE), worldMap: true, tokens: [ANA, BIA] }
}

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

/** A janela de teste sem tela, no modo pedido: fala o protocolo do canal e monta o cliente do jogador a cada geração. */
function janelaSemTela(canal: Canal, sessao: string, modo: ModoDoTeste) {
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
          return criarSocketDoCanal({ canal, sessao, geracao, conexao, modo: () => modo })
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
  }
}

function fichaNaJanela(conexao: PlayerConnection, tokenId: string): Token | undefined {
  return conexao.getState().map?.tokens.find((t) => t.id === tokenId)
}

/** O que o editor tem agora, serializado: as duas stores que o jogo de verdade grava. */
function editorSerializado(): string {
  const { adventure, activeSceneId, cache, dirty } = useAdventureStore.getState()
  const { map, past, future } = useMapStore.getState()
  return JSON.stringify({ map, past, future, adventure, activeSceneId, cache, dirty })
}

/** Um espião qualquer (`vi.fn` ou `vi.spyOn`), só para contar as chamadas. */
interface Contavel {
  mock: { calls: readonly unknown[] }
}

/** Os escritores do jogo de verdade que a ponte de teste nunca pode receber. */
const ESCRITORES_DO_JOGO_DE_VERDADE = [
  'applyTransfer',
  'applyCabine',
  'applyChamadaDeCabine',
  'unlockAndOpenDoor',
  'hideToken',
  'setPinPassage',
  'removeToken',
  'restoreToken',
  'saveTable',
  'saveExploration',
  'appendChat',
  'deleteChat',
  'onTravelLogChange',
  'onGoToScene',
  'onGoToPoint',
  'onPointActionGo',
] as const

describe('Visão de jogador no Jogar — vazamento zero para o editor', () => {
  let canalDaJanela: Canal
  let sessaoAberta: string | null
  let controlador: ControladorDaVisao
  const fecharJanela = vi.fn(async () => {})
  let espioes: Record<string, Contavel> = {}
  let pararDeAssinar: (() => void)[] = []

  /** Quantas vezes cada espião foi chamado; o esperado é zero em todos. */
  function chamadas(): Record<string, number> {
    return Object.fromEntries(Object.entries(espioes).map(([nome, espiao]) => [nome, espiao.mock.calls.length]))
  }

  const nenhumaChamada = (): Record<string, number> => Object.fromEntries(Object.keys(espioes).map((nome) => [nome, 0]))

  /**
   * Espiões em toda escrita que o jogo de verdade faria: as actions do
   * jogador, o `setState` de fora e os assinantes das duas stores (que pegam o
   * `set` de dentro de QUALQUER action). Nenhum impede nada: o que vazasse
   * gravaria de verdade, e o mapa serializado também acusaria.
   */
  function espionar(): void {
    const mudancaNoMapa = vi.fn()
    const mudancaNaAventura = vi.fn()
    pararDeAssinar = [useMapStore.subscribe(mudancaNoMapa), useAdventureStore.subscribe(mudancaNaAventura)]
    espioes = {
      'useMapStore.setState': vi.spyOn(useMapStore, 'setState'),
      'useAdventureStore.setState': vi.spyOn(useAdventureStore, 'setState'),
      applyPlayerChange: vi.spyOn(useMapStore.getState(), 'applyPlayerChange'),
      applyPlayerChangeToBackgroundScene: vi.spyOn(useAdventureStore.getState(), 'applyPlayerChangeToBackgroundScene'),
      transferToken: vi.spyOn(useAdventureStore.getState(), 'transferToken'),
      'assinante do mapa': mudancaNoMapa,
      'assinante da aventura': mudancaNaAventura,
    }
  }

  /** O controlador como o App o cria: o mundo vem das stores de verdade. */
  function novoControlador(): ControladorDaVisao {
    const novo = criarControladorDaVisao({
      getMap: () => useMapStore.getState().map,
      getWorld: () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map),
      avisos: PILHA_DO_EDITOR,
      // Um par novo a cada abertura: fechar o teste fecha o lado do host.
      abrirCanal: () => {
        const [doHost, daJanela] = criarParDeCanais()
        canalDaJanela = daJanela
        return doHost
      },
      criarJanela: (): JanelaDeTeste => ({
        abrir: async (sessao) => {
          sessaoAberta = sessao
        },
        fechar: fecharJanela,
        mostrar: async () => true,
        desligar: () => {},
      }),
    })
    novo.definirFichas(fichasParaTeste(useMapStore.getState().map.tokens, new Map()), null)
    return novo
  }

  /** Abre a janela em Jogar e espera o jogador de teste com a ficha (no mapa-mundi ele não a recebe: a caravana é do mestre). */
  async function jogarCom(tokenId: string) {
    controlador.abrir(tokenId)
    await vi.waitFor(() => expect(sessaoAberta).not.toBeNull())
    if (sessaoAberta === null) throw new Error('a janela não abriu')
    const janela = janelaSemTela(canalDaJanela, sessaoAberta, 'jogar')
    await vi.waitFor(() => expect(janela.conexao().getState().status).toBe('playing'))
    await vi.waitFor(() => expect(controlador.ponte()?.players()[0]?.tokenIds).toEqual([tokenId]))
    return janela
  }

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    useAdventureStore.setState({ cache: {}, dirty: {} })
    useMapStore.getState().loadMap(salao())
    pontes.deps = []
    sessaoAberta = null
    fecharJanela.mockClear()
    controlador = novoControlador()
  })

  afterEach(() => {
    controlador.fechar()
    for (const parar of pararDeAssinar) parar()
    pararDeAssinar = []
    espioes = {}
    vi.restoreAllMocks()
    useToastStore.setState({ toasts: [] })
  })

  it('andar, porta, pegar item, bilhete e piso aparecem na janela; o editor não recebe nada', async () => {
    const antes = editorSerializado()
    espionar()
    const janela = await jogarCom(ANA.id)
    const conexao = janela.conexao()

    expect(conexao.requestMove(ANA.id, DESTINO.x, DESTINO.y)).toBe(true)
    await vi.waitFor(() => expect(fichaNaJanela(conexao, ANA.id)).toMatchObject(DESTINO))

    expect(conexao.toggleDoor(PORTA.id)).toBe(true)
    await vi.waitFor(() => expect(conexao.getState().map?.walls.find((w) => w.id === PORTA.id)?.door?.open).toBe(true))

    expect(conexao.takePin(CHAVE.id)).toBe(true)
    await vi.waitFor(() => expect(fichaNaJanela(conexao, ANA.id)?.mochila).toEqual([{ id: CHAVE.id, nome: 'Chave de ferro' }]))
    expect(conexao.getState().map?.pins.map((p) => p.id)).not.toContain(CHAVE.id)

    expect(conexao.placeMark({ tipo: 'bilhete', texto: 'Passei por aqui' })).toBe(true)
    await vi.waitFor(() => expect(conexao.getState().map?.marcas?.map((m) => m.texto)).toEqual(['Passei por aqui']))

    expect(conexao.changeFloor(ANA.id, ESCADA.id)).toBe(true)
    await vi.waitFor(() => expect(fichaNaJanela(conexao, ANA.id)?.piso).toBe(1))

    // Nenhuma escrita: nem pelas actions de jogador, nem por `setState`, nem pelo `set` de dentro de action nenhuma.
    expect(chamadas()).toEqual(nenhumaChamada())
    expect(editorSerializado()).toBe(antes)
    // Os avisos que só relatam ("Ana abriu a porta", o bilhete, o item) são calados no teste.
    expect(useToastStore.getState().toasts).toEqual([])

    // A ponte de teste não tem escritor do jogo de verdade: passar de cena, cabine, mesa, explorado e chat são recusados por ela.
    expect(pontes.deps.length).toBeGreaterThan(0)
    for (const deps of pontes.deps) {
      for (const escritor of ESCRITORES_DO_JOGO_DE_VERDADE) expect(deps[escritor], escritor).toBeUndefined()
    }
  })

  it('caravana no mapa-mundi: quem segue a ficha arrastada pelo mestre anda só no teste', async () => {
    useMapStore.getState().loadMap(continente())
    controlador = novoControlador()
    const janela = await jogarCom(ANA.id)
    const ponte = controlador.ponte()
    const jogador = ponte?.players()[0]
    if (ponte === null || jogador === undefined) throw new Error('o jogador de teste deveria estar na ponte')
    const deps = pontes.deps.at(-1)
    if (deps?.getWorld === undefined) throw new Error('a ponte de teste deveria ler o mundo')
    const lerMundoDoTeste = deps.getWorld
    const biaNoTeste = () => lerMundoDoTeste().open.map.tokens.find((t) => t.id === BIA.id)

    // O jogador de teste passa a ter as duas fichas: a caravana se forma, só no teste.
    ponte.assignToken(jogador.playerId, BIA.id)
    await vi.waitFor(() => expect(biaNoTeste()).toMatchObject({ x: ANA.x, y: ANA.y }))

    // O mestre arrasta a Ana no editor (escrita DELE) e o App avisa as pontes.
    useMapStore.getState().setTokenPosition(ANA.id, 525, 525)
    const antes = editorSerializado()
    espionar()
    ponte.notifyMapChanged()
    await vi.waitFor(() => expect(biaNoTeste()).toMatchObject({ x: 525, y: 525 }))

    expect(useMapStore.getState().map.tokens.find((t) => t.id === BIA.id)).toMatchObject({ x: BIA.x, y: BIA.y })
    expect(chamadas()).toEqual(nenhumaChamada())
    expect(editorSerializado()).toBe(antes)
    expect(janela.conexao().getState().status).toBe('playing')
  })

  it('Jogar e mestre juntos: a ficha anda só na janela, a parede do mestre chega nela, e o fantasma segue a ficha até fechar', async () => {
    const avisos = vi.fn()
    const pararDeOuvir = controlador.assinar(avisos)
    const janela = await jogarCom(ANA.id)
    const conexao = janela.conexao()
    expect(controlador.estado().fantasma ?? null).toBeNull()
    avisos.mockClear()

    conexao.requestMove(ANA.id, DESTINO.x, DESTINO.y)
    await vi.waitFor(() => expect(controlador.estado().fantasma).toEqual({ tokenId: ANA.id, mapId: 'm-salao', ...DESTINO }))
    expect(fichaNaJanela(conexao, ANA.id)).toMatchObject(DESTINO)
    // O editor continua com a Ana no lugar de verdade.
    expect(useMapStore.getState().map.tokens.find((t) => t.id === ANA.id)).toMatchObject({ x: ANA.x, y: ANA.y })
    // Um passo, um aviso: o broadcast lê o mundo várias vezes, o editor re-renderiza uma.
    expect(avisos).toHaveBeenCalledTimes(1)

    // O mestre arrasta a parede no editor; o App avisa as pontes.
    useMapStore.getState().loadMap({ ...useMapStore.getState().map, walls: [PORTA, { ...PAREDE, x1: 450, x2: 450 }] })
    controlador.ponte()?.notifyMapChanged()
    await vi.waitFor(() => expect(conexao.getState().map?.walls.find((w) => w.id === PAREDE.id)?.x1).toBe(450))
    // As duas mudanças na janela: a parede do mestre e a Ana do teste.
    expect(fichaNaJanela(conexao, ANA.id)).toMatchObject(DESTINO)
    // O fantasma não mudou de lugar: nenhum aviso a mais.
    expect(avisos).toHaveBeenCalledTimes(1)

    controlador.fechar()
    expect(controlador.estado()).toEqual({ aberta: false, ficha: null })
    expect(controlador.estado().fantasma ?? null).toBeNull()
    pararDeOuvir()

    // Reabrir começa do mundo de verdade: a Ana onde o editor a tem, sem fantasma.
    sessaoAberta = null
    const deNovo = await jogarCom(ANA.id)
    await vi.waitFor(() => expect(fichaNaJanela(deNovo.conexao(), ANA.id)).toMatchObject({ x: ANA.x, y: ANA.y }))
    expect(controlador.estado().fantasma ?? null).toBeNull()
  })
})

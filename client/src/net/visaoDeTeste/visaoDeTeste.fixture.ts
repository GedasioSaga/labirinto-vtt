import { expect, vi } from 'vitest'
import { ADVENTURE_VERSION, type Adventure } from '../../lib/adventure'
import { createEmptyMap } from '../../lib/mapFactory'
import { hostWorldOf, useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import type { MapData, Pin, Token, Wall } from '../../types/map'
import { createPlayerConnection, type PlayerConnection, type PlayerConnectionOptions, type StorageLike } from '../../player/playerConnection'
import { criarSocketDoCanal } from '../../player/visaoDeTeste/socketDoCanal'
import { PILHA_DO_EDITOR } from '../avisosDaPonte'
import { criarParDeCanais, type Canal } from './canal'
import type { JanelaDeTeste } from './janela'
import { lerMensagemDoHost } from './protocoloDoCanal'
import type { ModoDoTeste } from './tipos'
import { criarControladorDaVisao, fichasParaTeste, type ControladorDaVisao } from './visaoDeTeste'

/**
 * Bancada dos testes da VISÃO DE JOGADOR de ponta a ponta: o controlador como
 * o App o liga (o mundo vem das stores DE VERDADE), o canal em memória e, do
 * outro lado, o cliente do jogador de verdade (`createPlayerConnection`) sobre
 * o socket do canal — a janela de teste, só sem a tela.
 */

export function memoria(): StorageLike {
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

export interface JanelaSemTela {
  conexao(): PlayerConnection
  /** O `type` de cada mensagem do jogo que chegou à janela, na ordem, com o mapa quando é snapshot. */
  recebidas(): readonly { type: string; mapId?: string }[]
  /** A janela foi minimizada (`true`) ou voltou: o aviso que a página manda no `visibilitychange`. */
  visibilidade(oculta: boolean): void
}

/** O que importa de uma mensagem do jogo para os testes: o tipo e, no snapshot, de que mapa ele é. */
function resumo(msg: object): { type: string; mapId?: string } {
  const type = 'type' in msg && typeof msg.type === 'string' ? msg.type : '?'
  const map = 'map' in msg && typeof msg.map === 'object' && msg.map !== null ? msg.map : null
  const mapId = map !== null && 'id' in map && typeof map.id === 'string' ? map.id : undefined
  return mapId === undefined ? { type } : { type, mapId }
}

/**
 * A janela de teste sem tela, no modo pedido: fala o protocolo do canal e monta
 * o cliente do jogador a cada geração. `conta`: o cliente tenta entrar com a
 * conta (CONTAS DOS JOGADORES), como um jogador de verdade faria.
 */
export function janelaSemTela(canal: Canal, sessao: string, modo: ModoDoTeste, conta?: PlayerConnectionOptions['conta']): JanelaSemTela {
  const conexoes: PlayerConnection[] = []
  const recebidas: { type: string; mapId?: string }[] = []
  let proxima = 1
  canal.ouvir((dado) => {
    const mensagem = lerMensagemDoHost(dado, sessao)
    if (mensagem === null) return
    if (mensagem.tipo === 'ping') canal.enviar({ de: 'janela', tipo: 'pong', sessao })
    if (mensagem.tipo === 'msg') recebidas.push(resumo(mensagem.msg))
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
        ...(conta === undefined ? {} : { conta }),
      }),
    )
  })
  canal.enviar({ de: 'janela', tipo: 'ola', sessao })
  return {
    conexao: () => {
      const atual = conexoes.at(-1)
      if (atual === undefined) throw new Error('a janela ainda não recebeu o config')
      return atual
    },
    recebidas: () => recebidas,
    visibilidade: (oculta) => canal.enviar({ de: 'janela', tipo: 'visibilidade', sessao, oculta }),
  }
}

export function fichaNaJanela(conexao: PlayerConnection, tokenId: string): Token | undefined {
  return conexao.getState().map?.tokens.find((t) => t.id === tokenId)
}

/** O que o editor tem agora, serializado: as duas stores que o jogo de verdade grava. */
export function editorSerializado(): string {
  const { adventure, activeSceneId, cache, dirty } = useAdventureStore.getState()
  const { map, past, future } = useMapStore.getState()
  return JSON.stringify({ map, past, future, adventure, activeSceneId, cache, dirty })
}

export interface Bancada {
  controlador: ControladorDaVisao
  /** Abre a janela em Jogar na ficha e espera o jogador de teste com ela. */
  jogarCom(tokenId: string): Promise<JanelaSemTela>
}

/** O controlador como o App o cria, com a lista das fichas da cena aberta. */
export function criarBancada(): Bancada {
  let canalDaJanela: Canal | null = null
  let sessaoAberta: string | null = null
  const controlador = criarControladorDaVisao({
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
      fechar: async () => {},
      mostrar: async () => true,
      desligar: () => {},
    }),
  })
  controlador.definirFichas(fichasParaTeste(useMapStore.getState().map.tokens, new Map()), null)
  return {
    controlador,
    async jogarCom(tokenId) {
      sessaoAberta = null
      controlador.abrir(tokenId)
      await vi.waitFor(() => expect(sessaoAberta).not.toBeNull())
      if (sessaoAberta === null || canalDaJanela === null) throw new Error('a janela não abriu')
      const janela = janelaSemTela(canalDaJanela, sessaoAberta, 'jogar')
      await vi.waitFor(() => expect(janela.conexao().getState().status).toBe('playing'))
      await vi.waitFor(() => expect(controlador.ponte()?.players()[0]?.tokenIds).toEqual([tokenId]))
      return janela
    },
  }
}

/*
 * MESA DE DUAS CENAS: o editor aberto no Laboratório, o Pátio de fundo. A Ana
 * está ao alcance de tudo o que ela pede: a porta trancada logo abaixo, o pino
 * que pede à direita (com a transição da porta), o pino trancado à esquerda e
 * a banca logo acima.
 */

export const GRADE = 50
export const CENA_LAB = 'cena-lab'
export const CENA_PATIO = 'cena-patio'
export const MAPA_LAB = 'mapa-lab'
export const MAPA_PATIO = 'mapa-patio'

export const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 175, y: 125, size: 1, image: null }
export const PORTA_TRANCADA: Wall = {
  id: 'porta-trancada',
  x1: 150,
  y1: 175,
  x2: 200,
  y2: 175,
  blocksLight: false,
  blocksMove: true,
  door: { open: false, locked: true, kind: 'normal' },
}
export const PINO_QUE_PEDE: Pin = {
  id: 'porta-lab',
  x: 225,
  y: 125,
  kind: 'viagem',
  description: 'Porta de aço',
  image: null,
  destino: { sceneId: CENA_PATIO, pinId: 'porta-patio' },
  transicao: { id: 'porta' },
}
export const PINO_TRANCADO: Pin = {
  id: 'grade-lab',
  x: 125,
  y: 125,
  kind: 'viagem',
  description: 'Grade',
  image: null,
  destino: { sceneId: CENA_PATIO, pinId: 'grade-patio' },
  passagem: 'trancada',
}
export const BANCA: Pin = {
  id: 'banca',
  x: 175,
  y: 75,
  kind: 'exclamacao',
  description: 'Botica',
  image: null,
  loja: [{ id: 'xarope', nome: 'Xarope de tosse', preco: '1 moeda', estoque: 3 }],
}

function laboratorio(): MapData {
  return { ...createEmptyMap(MAPA_LAB, 'Laboratório', 20, 10, GRADE), tokens: [ANA], walls: [PORTA_TRANCADA], pins: [PINO_QUE_PEDE, PINO_TRANCADO, BANCA] }
}

function patio(): MapData {
  const volta = (id: string, x: number, pinId: string): Pin => ({ id, x, y: 275, kind: 'viagem', description: id, image: null, destino: { sceneId: CENA_LAB, pinId } })
  return { ...createEmptyMap(MAPA_PATIO, 'Pátio', 20, 10, GRADE), pins: [volta('porta-patio', 525, PINO_QUE_PEDE.id), volta('grade-patio', 725, PINO_TRANCADO.id)] }
}

const AVENTURA: Adventure = {
  version: ADVENTURE_VERSION,
  id: 'av-visao',
  name: 'Visão',
  startSceneId: CENA_LAB,
  scenes: [
    { id: CENA_LAB, name: 'Laboratório', file: 'lab/map.json' },
    { id: CENA_PATIO, name: 'Pátio', file: 'patio/map.json' },
  ],
}

/** Põe a mesa de duas cenas nas stores de verdade, como o editor a teria aberta. */
export function carregarMesaDeDuasCenas(): void {
  useMapStore.getState().loadMap(laboratorio())
  useAdventureStore.setState({
    adventure: AVENTURA,
    activeSceneId: CENA_LAB,
    cache: { [CENA_PATIO]: { status: 'ok', map: patio(), past: [], future: [], camera: null } },
    dirty: {},
  })
}

/** Volta as stores ao mapa solto, sem aventura. */
export function semAventura(): void {
  useAdventureStore.setState({ adventure: null, activeSceneId: null, cache: {}, dirty: {} })
}

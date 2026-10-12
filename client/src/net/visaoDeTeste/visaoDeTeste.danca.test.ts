import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../../lib/mapFactory'
import { minigamePadrao } from '../../lib/pins'
import { hostWorldOf, useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import type { MapData, Pin, Token, Wall } from '../../types/map'
import { PILHA_DO_EDITOR } from '../avisosDaPonte'
import type { DancaPlacarFinal } from '../protocoloDaDanca'
import { criarParDeCanais, type Canal } from './canal'
import type { JanelaDeTeste } from './janela'
import type { ModoDoTeste } from './tipos'
import { criarControladorDaVisao, fichasParaTeste, type ControladorDaVisao } from './visaoDeTeste'
import { editorSerializado, janelaSemTela, semAventura } from './visaoDeTeste.fixture'

/**
 * MINIGAME DE DANÇA na VISÃO DE JOGADOR: o mestre testa a dança sozinho. A
 * ponte de teste conta ao editor quem está na janela (`jogadores`) e a dança
 * dela (`danca`); o convite, o Pronto, o começo e o fim correm pela ponte de
 * TESTE (no Olhar também: o mestre chamou de propósito), e o desfecho abre a
 * porta ligada só na camada do teste. O mapa do editor não muda.
 */

const GRADE = 50
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null }
/** A porta que a dança abre, trancada, logo abaixo da Ana (à vista dela). */
const PORTA: Wall = { id: 'porta-ziza', x1: 100, y1: 175, x2: 150, y2: 175, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }
const PINO: Pin = { ...buildPin('pino-danca', { x: 225, y: 125 }, 'minigame'), portaLigada: PORTA.id, minigame: minigamePadrao() }
const PASSOU: DancaPlacarFinal = { precisao: 0.9, letra: 'A', falhou: false, perfeito: 50, bom: 8, ok: 2, errou: 1, comboMax: 40, segOk: 0, segTotal: 0 }

function salao(): MapData {
  return { ...createEmptyMap('m-danca', 'Salão', 10, 10, GRADE), tokens: [ANA], walls: [PORTA], pins: [PINO] }
}

describe('Visão de jogador — a dança testada sozinho', () => {
  let canalDaJanela: Canal | null
  let sessaoAberta: string | null
  let controlador: ControladorDaVisao

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    semAventura()
    useMapStore.getState().loadMap(salao())
    canalDaJanela = null
    sessaoAberta = null
    controlador = criarControladorDaVisao({
      getMap: () => useMapStore.getState().map,
      getWorld: () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map),
      avisos: PILHA_DO_EDITOR,
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
  })

  afterEach(() => {
    controlador.fechar()
    vi.restoreAllMocks()
    useToastStore.setState({ toasts: [] })
  })

  async function abrirJanela(modo: ModoDoTeste) {
    controlador.abrir(ANA.id)
    await vi.waitFor(() => expect(sessaoAberta).not.toBeNull())
    if (sessaoAberta === null || canalDaJanela === null) throw new Error('a janela não abriu')
    const janela = janelaSemTela(canalDaJanela, sessaoAberta, modo)
    await vi.waitFor(() => expect(janela.conexao().getState().status).toBe('playing'))
    return { janela, sessao: sessaoAberta, canal: canalDaJanela }
  }

  it.each<ModoDoTeste>(['olhar', 'jogar'])('no %s: convite, Pronto, começo e fim pela ponte de teste; a porta abre só no teste', async (modo) => {
    const antes = editorSerializado()
    const { janela, sessao, canal } = await abrirJanela(modo)
    const conexao = janela.conexao()

    // O editor sabe quem está na janela: o jogador de teste, com o nome com que entrou.
    await vi.waitFor(() => expect(controlador.estado().jogadores).toEqual([{ playerId: expect.any(String), name: 'Ana' }]))
    const estadoSemDanca = controlador.estado()
    expect(estadoSemDanca.danca).toBeNull()
    // Nada mudou: a mesma referência (o `getSnapshot` do `useSyncExternalStore`).
    expect(controlador.estado()).toBe(estadoSemDanca)
    const playerId = estadoSemDanca.jogadores[0]?.playerId ?? ''

    expect(controlador.ponte()?.convidarParaDanca(PINO.id, [playerId])).toEqual({ ok: true, sessao: expect.any(String), convidados: 1 })
    await vi.waitFor(() =>
      expect(controlador.estado().danca).toMatchObject({ fase: 'convite', pinId: PINO.id, participantes: [{ playerId, status: 'convidado' }] }),
    )
    expect(controlador.estado()).not.toBe(estadoSemDanca)

    // A janela recebe o convite e marca Pronto: no Olhar também chega ao host de teste.
    await vi.waitFor(() => expect(conexao.getState().danca).toBeDefined())
    expect(conexao.dancaPronto('diversao')).toBe(true)
    await vi.waitFor(() => expect(controlador.estado().danca?.participantes[0]?.status).toBe('pronto'))

    expect(controlador.ponte()?.comecarDanca()).toBe(true)
    await vi.waitFor(() => expect(conexao.dancaFim(PASSOU)).toBe(true))
    await vi.waitFor(() => expect(controlador.estado().danca).toMatchObject({ fase: 'fim', desfecho: { todosPassaram: true, portaAberta: true } }))

    // A porta ligada abriu NA JANELA (a camada do teste)…
    await vi.waitFor(() => expect(conexao.getState().map?.walls.find((w) => w.id === PORTA.id)?.door).toMatchObject({ open: true, locked: false }))
    // …e o editor continua com ela trancada: nada da dança chegou às stores.
    expect(useMapStore.getState().map.walls.find((w) => w.id === PORTA.id)?.door).toEqual(PORTA.door)
    expect(editorSerializado()).toBe(antes)

    // Recarregar a janela é uma geração nova: a dança da ponte de antes sai do painel.
    canal.enviar({ de: 'janela', tipo: 'ola', sessao })
    await vi.waitFor(() => expect(controlador.estado().danca).toBeNull())

    controlador.fechar()
    expect(controlador.estado()).toEqual({ aberta: false, ficha: null, danca: null, jogadores: [] })
  })
})

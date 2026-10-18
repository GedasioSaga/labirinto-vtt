import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPin, createEmptyMap } from '../../lib/mapFactory'
import { minigamePadraoDo } from '../../lib/pins'
import type { MinigamePesca } from '../../minigames/pesca/tipos'
import { hostWorldOf, useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import type { MapData, Pin, Token } from '../../types/map'
import { PILHA_DO_EDITOR } from '../avisosDaPonte'
import type { PeixeNoCesto } from '../protocoloDaPesca'
import { criarParDeCanais, type Canal } from './canal'
import type { JanelaDeTeste } from './janela'
import type { ModoDoTeste } from './tipos'
import { criarControladorDaVisao, fichasParaTeste, type ControladorDaVisao } from './visaoDeTeste'
import { editorSerializado, janelaSemTela, semAventura } from './visaoDeTeste.fixture'

/**
 * VISÃO DE JOGADOR — a pesca testada sozinho. O painel do pino lê a pesca da
 * ponte de TESTE (`pesca`); o convite, o Pronto, os lances e o cesto correm
 * por ela, no Olhar e no Jogar. No pino de "Jogador toca no pino", o jogador
 * de teste encostado pede e entra sozinho. Nada chega às stores do editor.
 * Foi a falta deste encaixe que fez a dança "não deixar iniciar" na primeira versão.
 */

const GRADE = 50
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null }
const TRUTA: PeixeNoCesto = { peixe: 'truta', cm: 31, estrelas: 2, perfeito: false, bau: false }

function pinoDePesca(entrada: MinigamePesca['entrada']): Pin {
  const pesca = minigamePadraoDo('pesca')
  if (pesca.jogo !== 'pesca') throw new Error('o padrão da pesca tem de ser pesca')
  return { ...buildPin('pino-pesca', { x: 175, y: 125 }, 'minigame'), minigame: { ...pesca, entrada } }
}

function lago(entrada: MinigamePesca['entrada']): MapData {
  return { ...createEmptyMap('m-lago', 'Lago', 10, 10, GRADE), tokens: [ANA], pins: [pinoDePesca(entrada)] }
}

describe('Visão de jogador — a pesca testada sozinho', () => {
  let canalDaJanela: Canal | null
  let sessaoAberta: string | null
  let controlador: ControladorDaVisao

  function montar(mapa: MapData) {
    useToastStore.setState({ toasts: [] })
    semAventura()
    useMapStore.getState().loadMap(mapa)
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
  }

  beforeEach(() => montar(lago('mestre')))

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

  it.each<ModoDoTeste>(['olhar', 'jogar'])('no %s, mestre chama: convite, Pronto, lance e cesto pela ponte de teste', async (modo) => {
    const antes = editorSerializado()
    const { janela, sessao, canal } = await abrirJanela(modo)
    const conexao = janela.conexao()
    await vi.waitFor(() => expect(controlador.estado().jogadores).toHaveLength(1))
    const semPesca = controlador.estado()
    expect(semPesca.pesca).toEqual([])
    const playerId = semPesca.jogadores[0]?.playerId ?? ''

    expect(controlador.ponte()?.convidarParaPesca('pino-pesca', [playerId])).toEqual({ ok: true, sessao: expect.any(String), convidados: 1 })
    await vi.waitFor(() => expect(controlador.estado().pesca).toMatchObject([{ pinId: 'pino-pesca', participantes: [{ playerId, status: 'convidado' }] }]))

    await vi.waitFor(() => expect(conexao.getState().pesca).toBeDefined())
    expect(conexao.prontoPesca('normal')).toBe(true)
    await vi.waitFor(() => expect(controlador.estado().pesca[0]?.participantes[0]?.status).toBe('pescando'))
    expect(conexao.lancePesca({ lance: 1, resultado: 'pegou', peixe: TRUTA })).toBe(true)
    expect(conexao.fimPesca()).toBe(true)
    await vi.waitFor(() => expect(controlador.estado().pesca[0]?.participantes[0]).toMatchObject({ status: 'terminou', cesto: [TRUTA], maior: TRUTA }))
    // Nada da pesca chegou às stores do editor.
    expect(editorSerializado()).toBe(antes)

    // Recarregar a janela é uma geração nova: a pesca da ponte de antes sai do painel.
    canal.enviar({ de: 'janela', tipo: 'ola', sessao })
    await vi.waitFor(() => expect(controlador.estado().pesca).toEqual([]))
  })

  it('jogador toca no pino: o jogador de teste encostado pede e entra sozinho', async () => {
    controlador.fechar()
    montar(lago('pino'))
    const { janela } = await abrirJanela('jogar')
    const conexao = janela.conexao()
    await vi.waitFor(() => expect(conexao.getState().map?.pins.find((p) => p.id === 'pino-pesca')?.minigameVisivel).toEqual({ jogo: 'pesca', entrada: 'pino' }))
    expect(conexao.pedirPesca('pino-pesca')).toBe(true)
    await vi.waitFor(() => expect(conexao.getState().pesca?.convite.lago).toBe('Poço Afogado'))
    await vi.waitFor(() => expect(controlador.estado().pesca).toMatchObject([{ entrada: 'pino', participantes: [{ status: 'convidado' }] }]))
  })
})

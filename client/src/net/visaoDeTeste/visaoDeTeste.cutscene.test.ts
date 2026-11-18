import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import { hostWorldOf, useAdventureStore } from '../../stores/adventureStore'
import { useCutscenesStore, type Cutscene } from '../../stores/cutscenesStore'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import type { MapData, Token } from '../../types/map'
import { PILHA_DO_EDITOR } from '../avisosDaPonte'
import { lugarDaRedeDaCutscene, redeDaCutscene, registrarRedeDaCutscene, type RedeDaCutscene } from '../redeDaCutscene'
import { criarParDeCanais, type Canal } from './canal'
import type { JanelaDeTeste } from './janela'
import { criarControladorDaVisao, fichasParaTeste, type ControladorDaVisao } from './visaoDeTeste'
import { janelaSemTela, semAventura, type JanelaSemTela } from './visaoDeTeste.fixture'

/**
 * CUTSCENE EM VÍDEO no MODO TREINO (18/11/2026, pedido do mestre: "dá para
 * testar no modo treino"): a janela da Visão de jogador conta como jogador.
 * Com ela aberta, "Tocar para todos" toca nela (o teste ganha da sala), o
 * vídeo vem do disco do mestre, "Parar para todos" o tira, e chegar ao fim
 * NÃO marca a cutscene como exibida nem a manda à Galeria.
 */

const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null }
const BASE = 'http://asset.localhost/C%3A%2Fappdata%2Fmidia%2F'
const VIDEO = `${'ab'.repeat(32)}.webm`
const CUTSCENE: Cutscene = { id: 'cut_farol', titulo: 'Ruínas do farol', video: VIDEO, tamanho: 1024, naGaleria: true, exibida: false }

function sala(): MapData {
  return { ...createEmptyMap('m-cut', 'Sala', 10, 10, 50), tokens: [ANA] }
}

function redeDaMesa(): RedeDaCutscene {
  return { tocar: vi.fn<RedeDaCutscene['tocar']>(() => 'ok'), tocarAgora: vi.fn(), parar: vi.fn() }
}

describe('Visão de jogador — a cutscene em vídeo no modo treino', () => {
  let canalDaJanela: Canal | null
  let sessaoAberta: string | null
  let controlador: ControladorDaVisao
  let tirarDaMesa: () => void

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    useCutscenesStore.setState({ lista: [{ ...CUTSCENE }], carregada: true, exibicao: null, exibicaoDoTeste: null })
    semAventura()
    useMapStore.getState().loadMap(sala())
    canalDaJanela = null
    sessaoAberta = null
    tirarDaMesa = () => undefined
    controlador = criarControladorDaVisao({
      getMap: () => useMapStore.getState().map,
      getWorld: () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map),
      avisos: PILHA_DO_EDITOR,
      baseDaMidia: () => BASE,
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
    tirarDaMesa()
    vi.restoreAllMocks()
    useToastStore.setState({ toasts: [] })
  })

  async function abrirJanela(): Promise<JanelaSemTela> {
    controlador.abrir(ANA.id)
    await vi.waitFor(() => expect(sessaoAberta).not.toBeNull())
    if (sessaoAberta === null || canalDaJanela === null) throw new Error('a janela não abriu')
    const janela = janelaSemTela(canalDaJanela, sessaoAberta, 'jogar')
    await vi.waitFor(() => expect(janela.conexao().getState().status).toBe('playing'))
    return janela
  }

  it('com o teste aberto, "Tocar para todos" toca na janela, do disco, e "Parar para todos" tira; fechar devolve à sala', async () => {
    const mesa = redeDaMesa()
    tirarDaMesa = registrarRedeDaCutscene(mesa)
    const janela = await abrirJanela()
    expect(lugarDaRedeDaCutscene()).toBe('teste')

    expect(redeDaCutscene()?.tocar({ cutsceneId: CUTSCENE.id, video: VIDEO, titulo: CUTSCENE.titulo })).toBe('ok')
    // Só uma tela (a do teste), pronta na hora: a mesa larga e o vídeo toca do disco, sem blob.
    await vi.waitFor(() => expect(janela.conexao().getState().cutsceneVideo?.largouEm).toBeDefined())
    expect(janela.conexao().getState().cutsceneVideo).toMatchObject({ url: `${BASE}${VIDEO}`, pct: 100 })
    expect(useCutscenesStore.getState().exibicaoDoTeste).toMatchObject({ cutsceneId: CUTSCENE.id, fase: 'tocando' })
    expect(useCutscenesStore.getState().exibicao).toBeNull()
    expect(mesa.tocar).not.toHaveBeenCalled()

    redeDaCutscene()?.parar()
    await vi.waitFor(() => expect(janela.conexao().getState().cutsceneVideo).toBeUndefined())
    expect(useCutscenesStore.getState().exibicaoDoTeste).toBeNull()

    controlador.fechar()
    await vi.waitFor(() => expect(lugarDaRedeDaCutscene()).toBe('sala'))
    expect(redeDaCutscene()).toBe(mesa)
  })

  it('o vídeo que chega ao fim na janela de teste não marca "já tocou" nem manda à Galeria', async () => {
    const janela = await abrirJanela()
    redeDaCutscene()?.tocar({ cutsceneId: CUTSCENE.id, video: VIDEO, titulo: CUTSCENE.titulo })
    await vi.waitFor(() => expect(janela.conexao().getState().cutsceneVideo?.largouEm).toBeDefined())
    const exibicao = janela.conexao().getState().cutsceneVideo?.exibicao
    if (exibicao === undefined) throw new Error('o vídeo não chegou à janela')

    janela.conexao().terminarCutsceneVideo(exibicao)
    // A única tela terminou: a exibição do teste fecha sozinha.
    await vi.waitFor(() => expect(useCutscenesStore.getState().exibicaoDoTeste).toBeNull())
    expect(useCutscenesStore.getState().lista).toEqual([CUTSCENE])
  })
})

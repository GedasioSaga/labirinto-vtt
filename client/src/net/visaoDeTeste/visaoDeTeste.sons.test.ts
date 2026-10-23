import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import { hostWorldOf, useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import type { MapData, Token } from '../../types/map'
import { PILHA_DO_EDITOR } from '../avisosDaPonte'
import { redeDosSons, registrarRedeDosSons, type RedeDosSons } from '../ponteDosSons'
import { criarParDeCanais, type Canal } from './canal'
import type { JanelaDeTeste } from './janela'
import { criarControladorDaVisao, fichasParaTeste, type ControladorDaVisao } from './visaoDeTeste'
import { janelaSemTela, semAventura } from './visaoDeTeste.fixture'

/**
 * SONS AO VIVO na VISÃO DE JOGADOR (revisão da F4): a sala de teste é local e
 * abre a própria ponte do mestre. Ela não pode se registrar como a rede dos
 * sons: roubaria o som da mesa de verdade ao abrir e, ao fechar, deixaria a
 * mesa sem rede (`redeDosSons: false` no `createHostBridge` da Visão).
 */

const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null }

function sala(): MapData {
  return { ...createEmptyMap('m-sons', 'Sala', 10, 10, 50), tokens: [ANA] }
}

function redeDaMesa(): RedeDosSons {
  return {
    tocarSomAoVivo: vi.fn<RedeDosSons['tocarSomAoVivo']>(() => ({ ok: true, enviados: 0 })),
    pararSomAoVivo: vi.fn<RedeDosSons['pararSomAoVivo']>(() => 0),
    pararTodosOsSons: vi.fn<RedeDosSons['pararTodosOsSons']>(() => 0),
    volumeDoSom: vi.fn<RedeDosSons['volumeDoSom']>(() => 0),
    precarregarSonsAoVivo: vi.fn<RedeDosSons['precarregarSonsAoVivo']>(() => 0),
    falhasDoSom: vi.fn<RedeDosSons['falhasDoSom']>(() => 0),
    midiasDeSomLiberadas: vi.fn<RedeDosSons['midiasDeSomLiberadas']>(() => []),
    // A rede ganhou a pasta da aventura na F5 (coberta em ponteDosSons.pasta.test.ts).
    mudarPastaDosSons: vi.fn<RedeDosSons['mudarPastaDosSons']>(),
  }
}

describe('Visão de jogador — a rede dos sons continua sendo a da mesa', () => {
  let canalDaJanela: Canal | null
  let sessaoAberta: string | null
  let controlador: ControladorDaVisao
  let tirarDaMesa: () => void

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    semAventura()
    useMapStore.getState().loadMap(sala())
    canalDaJanela = null
    sessaoAberta = null
    tirarDaMesa = () => undefined
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
    tirarDaMesa()
    vi.restoreAllMocks()
    useToastStore.setState({ toasts: [] })
  })

  it('abrir a sala de teste não toma a rede da mesa, e fechar não a deixa sem rede', async () => {
    const mesa = redeDaMesa()
    tirarDaMesa = registrarRedeDosSons(mesa)
    controlador.abrir(ANA.id)
    await vi.waitFor(() => expect(sessaoAberta).not.toBeNull())
    if (sessaoAberta === null || canalDaJanela === null) throw new Error('a janela não abriu')
    const janela = janelaSemTela(canalDaJanela, sessaoAberta, 'jogar')
    // A ponte de teste abriu a sala dela e o jogador de teste entrou.
    await vi.waitFor(() => expect(janela.conexao().getState().status).toBe('playing'))
    expect(redeDosSons()).toBe(mesa)
    controlador.fechar()
    await vi.waitFor(() => expect(janela.conexao().getState().status).not.toBe('playing'))
    expect(redeDosSons()).toBe(mesa)
  })
})

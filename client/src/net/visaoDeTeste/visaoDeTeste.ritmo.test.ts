import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import type { MapData, Wall } from '../../types/map'
import { BROADCAST_THROTTLE_MS } from '../hostBridge'
import { INTERVALO_DO_BROADCAST_DE_TESTE_MS } from './visaoDeTeste'
import { ANA, criarBancada, semAventura, type Bancada, type JanelaSemTela } from './visaoDeTeste.fixture'

/**
 * VISÃO DE JOGADOR — o recorte do jogador de teste roda no thread do editor
 * (`visaoDeTeste.bench.ts`: ~50 ms por broadcast com 990 paredes à vista).
 * Por isso as edições do mestre chegam à janela de teste num intervalo maior
 * que o da sala, e não chegam enquanto a janela está escondida; quando ela
 * volta, um broadcast leva tudo o que mudou.
 */

const PAREDE: Wall = { id: 'parede', x1: 400, y1: 50, x2: 400, y2: 150, blocksLight: true, blocksMove: true, door: null }

function salao(): MapData {
  return { ...createEmptyMap('m-salao', 'Salão', 10, 10, 50), tokens: [ANA], walls: [PAREDE] }
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Quantos recortes (snapshot ou patches) a janela recebeu até agora. */
const recortes = (janela: JanelaSemTela) => janela.recebidas().filter((m) => m.type === 'snapshot' || m.type === 'view.patches').length

/** O mestre arrasta a parede para `x` no editor, e o App avisa a ponte de teste. */
function mestreArrasta(bancada: Bancada, x: number): void {
  useMapStore.setState({ map: { ...useMapStore.getState().map, walls: [{ ...PAREDE, x1: x, x2: x }] } })
  bancada.controlador.ponte()?.notifyMapChanged()
}

const paredeNaJanela = (janela: JanelaSemTela) => janela.conexao().getState().map?.walls.find((w) => w.id === PAREDE.id)?.x1

describe('Visão de jogador: o broadcast do teste e o thread do editor', () => {
  let bancada: Bancada

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    semAventura()
    useMapStore.getState().loadMap(salao())
    bancada = criarBancada()
  })

  afterEach(() => {
    bancada.controlador.fechar()
  })

  it('a edição do mestre chega à janela no intervalo do teste, mais espaçado que o da sala', async () => {
    expect(INTERVALO_DO_BROADCAST_DE_TESTE_MS).toBeGreaterThan(BROADCAST_THROTTLE_MS)
    const janela = await bancada.jogarCom(ANA.id)
    const antes = recortes(janela)

    mestreArrasta(bancada, 450)
    // Passado o intervalo da sala, a janela de teste ainda não recebeu nada.
    await esperar(BROADCAST_THROTTLE_MS * 2)
    expect(recortes(janela)).toBe(antes)
    await vi.waitFor(() => expect(paredeNaJanela(janela)).toBe(450))
  })

  it('janela escondida: a edição do mestre não sai; quando ela volta, chega de uma vez', async () => {
    const janela = await bancada.jogarCom(ANA.id)
    janela.visibilidade(true)
    await esperar(0)
    const antes = recortes(janela)

    mestreArrasta(bancada, 450)
    mestreArrasta(bancada, 500)
    await esperar(INTERVALO_DO_BROADCAST_DE_TESTE_MS * 2)
    expect(recortes(janela)).toBe(antes)
    expect(paredeNaJanela(janela)).toBe(PAREDE.x1)

    janela.visibilidade(false)
    await vi.waitFor(() => expect(paredeNaJanela(janela)).toBe(500))
    // Um recorte só, com a parede onde o mestre a deixou.
    expect(recortes(janela)).toBe(antes + 1)
  })
})

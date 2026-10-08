import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agruparAvisos, deixarTodos } from '../../components/caixaDeAvisos'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore, type ToastMessage } from '../../stores/toastStore'
import type { Pin, Stair } from '../../types/map'
import { PILHA_DO_EDITOR } from '../avisosDaPonte'
import { GRUPO_DO_TESTE, PREFIXO_DO_TESTE } from './avisosDeTeste'
import {
  ANA,
  BANCA,
  carregarMesaDeDuasCenas,
  criarBancada,
  editorSerializado,
  fichaNaJanela,
  MAPA_LAB,
  MAPA_PATIO,
  PINO_QUE_PEDE,
  semAventura,
  type Bancada,
} from './visaoDeTeste.fixture'

/**
 * VISÃO DE JOGADOR — os PEDIDOS DO TESTE no editor. O jogador de teste (o
 * cliente de verdade, no Jogar) pede; o pedido chega à pilha do editor marcado
 * "Teste ·", na caixa própria "Pedidos do teste", fora da caixa dos pedidos da
 * mesa; o mestre responde ali como responderia a um jogador de verdade, e a
 * resposta vai só à janela de teste. Fechar o teste tira da tela o que ainda
 * esperava.
 */

const naCaixaDoTeste = (): ToastMessage[] => useToastStore.getState().toasts.filter((t) => t.grupo === GRUPO_DO_TESTE)

/** O pedido do teste que espera o mestre agora, sozinho na caixa. */
async function pedidoNaCaixa(): Promise<ToastMessage> {
  await vi.waitFor(() => expect(naCaixaDoTeste()).toHaveLength(1))
  const [pedido] = naCaixaDoTeste()
  if (pedido === undefined) throw new Error('o pedido do teste deveria estar na caixa')
  return pedido
}

/** Como o botão da linha (`Toast.tsx`): tira o aviso da tela e responde. */
function responder(pedido: ToastMessage, rotulo: string): void {
  const acao = pedido.actions?.find((a) => a.label === rotulo)
  if (acao === undefined) throw new Error(`o pedido não tem "${rotulo}"`)
  useToastStore.getState().dismiss(pedido.id)
  acao.run()
}

describe('Visão de jogador: os pedidos do teste chegam ao editor e o mestre responde', () => {
  let bancada: Bancada

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    carregarMesaDeDuasCenas()
    bancada = criarBancada()
  })

  afterEach(() => {
    bancada.controlador.fechar()
    semAventura()
    useToastStore.setState({ toasts: [] })
  })

  it('pedido no pino: "Teste · Ana quer passar" na caixa do teste; "Deixar ir" leva a Ana ao Pátio só na janela, com a transição', async () => {
    const antes = editorSerializado()
    const janela = await bancada.jogarCom(ANA.id)
    const conexao = janela.conexao()

    expect(conexao.requestTravel(PINO_QUE_PEDE.id)).toBe(true)
    const pedido = await pedidoNaCaixa()
    expect(pedido.text).toBe(`${PREFIXO_DO_TESTE}Ana quer passar por Porta de aço → Pátio`)
    expect(pedido.sempreEmCaixa).toBe(true)
    expect(pedido.actions?.map((a) => a.label)).toEqual(['Deixar ir', 'Não'])

    responder(pedido, 'Deixar ir')
    await vi.waitFor(() => expect(conexao.getState().map?.id).toBe(MAPA_PATIO))
    // Primeiro o "Você chegou" (a transição toca nele), depois o snapshot da cena nova.
    const tipos = janela.recebidas()
    const chegou = tipos.findIndex((m) => m.type === 'scene.changed')
    expect(chegou).toBeGreaterThanOrEqual(0)
    expect(tipos.slice(chegou + 1).some((m) => m.type === 'snapshot' && m.mapId === MAPA_PATIO)).toBe(true)
    expect(conexao.getState().transicao?.escolha).toEqual({ id: 'porta' })
    expect(fichaNaJanela(conexao, ANA.id)).toBeDefined()
    // O editor mostra o fantasma no Pátio; as stores ficam iguais.
    expect(bancada.controlador.estado().fantasma).toMatchObject({ tokenId: ANA.id, mapId: MAPA_PATIO })
    expect(editorSerializado()).toBe(antes)
    expect(useMapStore.getState().map.tokens).toEqual([ANA])
    // Nenhum aviso da mesa: o "Ana entrou em Pátio" do teste é calado.
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('"Não": a janela lê a recusa do mestre e a Ana fica onde estava', async () => {
    const janela = await bancada.jogarCom(ANA.id)
    const conexao = janela.conexao()
    expect(conexao.requestTravel(PINO_QUE_PEDE.id)).toBe(true)
    responder(await pedidoNaCaixa(), 'Não')
    await vi.waitFor(() => expect(janela.recebidas().map((m) => m.type)).toContain('pin.travel.denied'))
    await vi.waitFor(() => expect(conexao.getState().travel?.phase).toBe('denied'))
    expect(conexao.getState().map?.id).toBe(MAPA_LAB)
    expect(bancada.controlador.estado().fantasma ?? null).toBeNull()
  })

  it('a caixa do teste é outra: o "Deixar todos" dos pedidos da mesa nunca responde um pedido do teste', async () => {
    const janela = await bancada.jogarCom(ANA.id)
    expect(janela.conexao().requestTravel(PINO_QUE_PEDE.id)).toBe(true)
    await pedidoNaCaixa()
    // Um pedido da mesa de verdade, como a ponte da sala o põe.
    const deixarBia = vi.fn()
    PILHA_DO_EDITOR.push('instrucao', 'Bia quer passar por Porta → Cripta', null, {
      actions: [{ label: 'Deixar ir', run: deixarBia, emLote: true }],
      grupo: 'Pedidos',
    })

    const caixas = agruparAvisos(useToastStore.getState().toasts).flatMap((item) => (item.tipo === 'caixa' ? [item] : []))
    expect(caixas.map((c) => [c.grupo, c.toasts.length])).toEqual([[GRUPO_DO_TESTE, 1]])
    // A da mesa, sozinha, é o aviso de sempre; com mais um pedido dela vira a caixa "Pedidos (2)", sem o do teste.
    PILHA_DO_EDITOR.push('instrucao', 'Caio quer passar por Porta → Cripta', null, { actions: [{ label: 'Deixar ir', run: deixarBia, emLote: true }], grupo: 'Pedidos' })
    const daMesa = agruparAvisos(useToastStore.getState().toasts).find((item) => item.tipo === 'caixa' && item.grupo === 'Pedidos')
    if (daMesa === undefined || daMesa.tipo !== 'caixa') throw new Error('a caixa da mesa deveria existir')
    expect(daMesa.toasts.every((t) => !t.text.startsWith(PREFIXO_DO_TESTE))).toBe(true)

    deixarTodos(daMesa.toasts, (id) => useToastStore.getState().dismiss(id))
    expect(deixarBia).toHaveBeenCalledTimes(2)
    // O pedido do teste continua esperando o mestre, e a Ana não saiu do lugar.
    expect(naCaixaDoTeste()).toHaveLength(1)
    expect(janela.conexao().getState().map?.id).toBe(MAPA_LAB)
  })

  it('chamar o mestre: "Teste · Ana: Ajuda" na caixa do teste, e o "Visto" chega só à janela', async () => {
    const janela = await bancada.jogarCom(ANA.id)
    const conexao = janela.conexao()
    expect(conexao.raiseHand('ajuda')).toBe(true)
    const chamado = await pedidoNaCaixa()
    expect(chamado.text).toBe(`${PREFIXO_DO_TESTE}Ana: Ajuda`)
    responder(chamado, 'Visto')
    await vi.waitFor(() => expect(conexao.getState().call?.phase).toBe('seen'))
  })

  it('compra na banca: "Vender" põe o xarope na mochila da Ana só na janela; a banca do editor não muda', async () => {
    const antes = editorSerializado()
    const janela = await bancada.jogarCom(ANA.id)
    const conexao = janela.conexao()
    expect(conexao.buy(BANCA.id, 'xarope')).toBe(true)
    const compra = await pedidoNaCaixa()
    expect(compra.text.startsWith(`${PREFIXO_DO_TESTE}Ana quer Xarope de tosse`)).toBe(true)
    responder(compra, 'Vender')
    await vi.waitFor(() => expect(fichaNaJanela(conexao, ANA.id)?.mochila?.map((item) => item.nome)).toEqual(['Xarope de tosse']))
    expect(editorSerializado()).toBe(antes)
    expect(useMapStore.getState().map.pins.find((p) => p.id === BANCA.id)?.loja).toEqual(BANCA.loja)
  })

  it('escada para outra cena (passagem livre, sem pedido): a Ana passa só na janela, com a transição da escada', async () => {
    // O pino que pede vira a boca de uma escada livre: a mesma ida ao Pátio, sem perguntar ao mestre.
    const escada: Stair = { id: 'escada-lab', shape: 'straight', direction: 'down', segments: [{ x1: 225, y1: 100, x2: 225, y2: 150 }], stepWidth: 40, transicao: { id: 'escada-pedra-descendo' } }
    const lab = useMapStore.getState().map
    const bocaDaEscada: Pin = { ...PINO_QUE_PEDE, passagem: 'livre', escadaId: escada.id }
    useMapStore.getState().loadMap({ ...lab, stairs: [escada], pins: lab.pins.map((p) => (p.id === PINO_QUE_PEDE.id ? bocaDaEscada : p)) })
    const antes = editorSerializado()

    const janela = await bancada.jogarCom(ANA.id)
    const conexao = janela.conexao()
    expect(conexao.requestTravel(PINO_QUE_PEDE.id)).toBe(true)
    await vi.waitFor(() => expect(conexao.getState().map?.id).toBe(MAPA_PATIO))
    expect(conexao.getState().transicao?.escolha).toEqual({ id: 'escada-pedra-descendo' })
    expect(naCaixaDoTeste()).toEqual([])
    expect(bancada.controlador.estado().fantasma).toMatchObject({ tokenId: ANA.id, mapId: MAPA_PATIO })
    expect(editorSerializado()).toBe(antes)
  })

  it('fechar o teste com um pedido esperando tira o pedido da tela', async () => {
    const janela = await bancada.jogarCom(ANA.id)
    expect(janela.conexao().requestTravel(PINO_QUE_PEDE.id)).toBe(true)
    await pedidoNaCaixa()
    bancada.controlador.fechar()
    expect(naCaixaDoTeste()).toEqual([])
    expect(useToastStore.getState().toasts).toEqual([])
  })
})

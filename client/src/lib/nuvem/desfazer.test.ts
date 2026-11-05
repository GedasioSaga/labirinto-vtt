import { describe, expect, it } from 'vitest'
import { MOEDAS_MAX } from '../troca'
import {
  AGORA,
  campanhaDeTeste,
  docDe,
  enviar,
  F_NAMI,
  ficha,
  guardada,
  mesa,
  MESTRE_NO_SITE,
  NAMI,
  NAMI_NO_PC,
  op,
  pedirDesfazer,
  TANGERINA,
  ZORO_NO_SITE,
} from './campanha.fixture'
import { estaDesfeita, mudancaInversa } from './desfazer'

/**
 * DESFAZER (plano do Lobby §5.3, aceite da N2; testes liberados: desfazer).
 * A volta sai só da op gravada; passa pelo mesmo detector de conflito; cada
 * um desfaz o seu e o mestre desfaz qualquer um; desfazer o desfazer refaz.
 */

const HP = ['recursos', 'hp']
const QTD_TANGERINA = ['mochila', 'vaga_tangerina', 'quantidade']

let pedidos = 0
function novoId(): string {
  pedidos += 1
  return `desfaz_${pedidos}`
}

describe('desfazer', () => {
  it('sem mudança depois: volta o campo e grava a volta no log, apontando a op desfeita', () => {
    const campanha = mesa()
    const mudar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })
    enviar(campanha, NAMI_NO_PC, [mudar])
    const novoOpId = novoId()
    expect(pedirDesfazer(campanha, NAMI_NO_PC, { opId: mudar.opId, novoOpId }).respostas).toEqual([{ t: 'ack', opId: novoOpId, rev: 2 }])
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(300)
    expect(campanha.todasAsOps()[1]).toMatchObject({ opId: novoOpId, desfaz: mudar.opId, caminho: HP, acao: 'definir', valor: 300, antes: 250, baseRev: 1, autorNome: 'Nami' })
    expect(estaDesfeita(campanha, mudar)).toBe(true)
  })

  it('com mudança depois: conflito "Depois disso, o Mestre mudou"; a confirmação (id novo) desfaz', () => {
    const campanha = mesa()
    const mudar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })
    enviar(campanha, NAMI_NO_PC, [mudar])
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 200, baseRev: 1 })])
    const primeiro = novoId()
    expect(pedirDesfazer(campanha, NAMI_NO_PC, { opId: mudar.opId, novoOpId: primeiro }).respostas).toEqual([
      { t: 'conflito', opId: primeiro, valorAtual: 200, quem: 'Mestre', quando: AGORA, revAtual: 2 },
    ])
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(200)
    const confirmar = novoId()
    expect(pedirDesfazer(campanha, NAMI_NO_PC, { opId: mudar.opId, novoOpId: confirmar, confirmar: true }).respostas).toEqual([{ t: 'ack', opId: confirmar, rev: 3 }])
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(300)
  })

  it('pedido forjado com caminho e valor diferentes usa só a op alvo', () => {
    const campanha = mesa()
    const mudar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })
    enviar(campanha, NAMI_NO_PC, [mudar])
    const forjado = { opId: mudar.opId, novoOpId: novoId(), fichaId: 'pers_zoro', caminho: ['notaDoMestre'], acao: 'definir', valor: 'invadi' }
    expect(pedirDesfazer(campanha, NAMI_NO_PC, forjado).respostas[0]).toMatchObject({ t: 'ack' })
    expect(campanha.todasAsOps()[1]).toMatchObject({ fichaId: F_NAMI, caminho: HP, valor: 300 })
    expect(docDe(campanha, F_NAMI)).not.toHaveProperty('notaDoMestre')
  })

  it('o mestre desfaz a mudança de outro; o jogador não desfaz a de outro', () => {
    const campanha = mesa()
    const daNami = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })
    enviar(campanha, NAMI_NO_PC, [daNami])
    expect(pedirDesfazer(campanha, ZORO_NO_SITE, { opId: daNami.opId, novoOpId: novoId() }).respostas[0]).toMatchObject({ t: 'negado', motivo: 'sem-permissao' })
    expect(pedirDesfazer(campanha, MESTRE_NO_SITE, { opId: daNami.opId, novoOpId: novoId() }).respostas[0]).toMatchObject({ t: 'ack' })
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(300)

    const doMestre = op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 100, baseRev: 2 })
    enviar(campanha, MESTRE_NO_SITE, [doMestre])
    expect(pedirDesfazer(campanha, NAMI_NO_PC, { opId: doMestre.opId, novoOpId: novoId() }).respostas[0]).toMatchObject({
      t: 'negado',
      motivo: 'sem-permissao',
      detalhe: 'Só o mestre desfaz a mudança de outra pessoa',
    })
  })

  it('o mesmo pedido de novo (mesmo novoOpId) recebe a mesma resposta e não grava duas vezes', () => {
    const campanha = mesa()
    const comer = op(NAMI_NO_PC, F_NAMI, QTD_TANGERINA, 'somar', { delta: -1 })
    enviar(campanha, NAMI_NO_PC, [comer])
    const pedido = { opId: comer.opId, novoOpId: novoId() }
    const primeira = pedirDesfazer(campanha, NAMI_NO_PC, pedido).respostas
    expect(pedirDesfazer(campanha, NAMI_NO_PC, pedido).respostas).toEqual(primeira)
    expect(campanha.todasAsOps()).toHaveLength(2)
    expect(docDe(campanha, F_NAMI).mochila).toEqual([TANGERINA])
  })
})

describe('desfazer o desfazer e nada a desfazer', () => {
  it('já desfeita = nada-a-desfazer; desfazer o desfazer refaz; depois a original desfaz de novo', () => {
    const campanha = mesa()
    const mudar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })
    enviar(campanha, NAMI_NO_PC, [mudar])
    const volta = novoId()
    pedirDesfazer(campanha, NAMI_NO_PC, { opId: mudar.opId, novoOpId: volta })
    expect(pedirDesfazer(campanha, NAMI_NO_PC, { opId: mudar.opId, novoOpId: novoId() }).respostas[0]).toMatchObject({ t: 'negado', motivo: 'nada-a-desfazer' })
    const refazer = pedirDesfazer(campanha, NAMI_NO_PC, { opId: volta, novoOpId: novoId() })
    expect(refazer.respostas[0]).toMatchObject({ t: 'ack' })
    expect(refazer.violacoes).toBe(0)
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(250)
    expect(estaDesfeita(campanha, mudar)).toBe(false)
    expect(pedirDesfazer(campanha, NAMI_NO_PC, { opId: mudar.opId, novoOpId: novoId() }).respostas[0]).toMatchObject({ t: 'ack' })
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(300)
  })

  it('item que outro já tirou: "já foi tirado", nada a gravar', () => {
    const campanha = mesa()
    const mais = op(NAMI_NO_PC, F_NAMI, QTD_TANGERINA, 'somar', { delta: 2 })
    enviar(campanha, NAMI_NO_PC, [mais])
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, ['mochila', 'vaga_tangerina'], 'apagar', { baseRev: 1 })])
    const resultado = pedirDesfazer(campanha, NAMI_NO_PC, { opId: mais.opId, novoOpId: novoId() })
    expect(resultado.respostas[0]).toMatchObject({ t: 'negado', motivo: 'nada-a-desfazer', detalhe: 'Já foi tirado' })
    expect(resultado.gravacoes.ops).toEqual([])
    expect(resultado.violacoes).toBe(0)
  })

  it('o campo já está como a volta deixaria: nada a gravar', () => {
    const campanha = mesa()
    const mudar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })
    enviar(campanha, NAMI_NO_PC, [mudar])
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 300, baseRev: 1 })])
    expect(pedirDesfazer(campanha, NAMI_NO_PC, { opId: mudar.opId, novoOpId: novoId() }).respostas[0]).toMatchObject({ t: 'negado', motivo: 'nada-a-desfazer' })
  })

  it('criar que foi eco (a coisa já existia) não tem volta: desfazer não apaga o que é de outro', () => {
    const campanha = mesa()
    const eco = op(NAMI_NO_PC, F_NAMI, ['mochila', 'vaga_tangerina'], 'criar', { valor: { ...TANGERINA } })
    enviar(campanha, NAMI_NO_PC, [eco])
    expect(pedirDesfazer(campanha, NAMI_NO_PC, { opId: eco.opId, novoOpId: novoId() }).respostas[0]).toMatchObject({ t: 'negado', motivo: 'nada-a-desfazer' })
    expect(docDe(campanha, F_NAMI).mochila).toEqual([TANGERINA])
  })
})

describe('a volta de cada ação', () => {
  it('somar volta somando o contrário (a soma de outro no meio continua)', () => {
    const campanha = mesa()
    const mais = op(NAMI_NO_PC, F_NAMI, ['moedas'], 'somar', { delta: 30 })
    enviar(campanha, NAMI_NO_PC, [mais])
    // A mesma pessoa, no mesmo aparelho, gastou depois: a volta soma -30 por cima.
    enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, ['moedas'], 'somar', { delta: -5, baseRev: 1 })])
    expect(pedirDesfazer(campanha, NAMI_NO_PC, { opId: mais.opId, novoOpId: novoId() }).respostas[0]).toMatchObject({ t: 'ack' })
    expect(docDe(campanha, F_NAMI).moedas).toBe(95)
  })

  it('soma cortada pelo teto volta definindo o antes', () => {
    const campanha = campanhaDeTeste([guardada(ficha(F_NAMI, { dono: NAMI.contaId, moedas: MOEDAS_MAX - 10 }))])
    const mais = op(NAMI_NO_PC, F_NAMI, ['moedas'], 'somar', { delta: 100 })
    enviar(campanha, NAMI_NO_PC, [mais])
    expect(docDe(campanha, F_NAMI).moedas).toBe(MOEDAS_MAX)
    expect(mudancaInversa(campanha.todasAsOps()[0])).toEqual({ fichaId: F_NAMI, caminho: ['moedas'], acao: 'definir', valor: MOEDAS_MAX - 10 })
    pedirDesfazer(campanha, NAMI_NO_PC, { opId: mais.opId, novoOpId: novoId() })
    expect(docDe(campanha, F_NAMI).moedas).toBe(MOEDAS_MAX - 10)
  })

  it('apagar o cartão volta recriando-o igual; criar o item volta tirando', () => {
    const campanha = mesa()
    const clima = docDe(campanha, F_NAMI).abas.tecnicas[0]
    const apagar = op(NAMI_NO_PC, F_NAMI, ['abas', 'tecnicas', 'cart_clima'], 'apagar')
    const bolinho = op(NAMI_NO_PC, F_NAMI, ['mochila', 'vaga_bolinho'], 'criar', { valor: { id: 'vaga_bolinho', nome: 'Bolinho' } })
    enviar(campanha, NAMI_NO_PC, [apagar, bolinho])
    pedirDesfazer(campanha, NAMI_NO_PC, { opId: apagar.opId, novoOpId: novoId() })
    pedirDesfazer(campanha, NAMI_NO_PC, { opId: bolinho.opId, novoOpId: novoId() })
    expect(docDe(campanha, F_NAMI)).toMatchObject({ abas: { tecnicas: [clima] }, mochila: [TANGERINA] })
  })

  it('campo que não existia volta a não existir', () => {
    const campanha = mesa()
    const escolha = op(NAMI_NO_PC, F_NAMI, ['escolhas', 'origem'], 'definir', { valor: 'east-blue' })
    enviar(campanha, NAMI_NO_PC, [escolha])
    pedirDesfazer(campanha, NAMI_NO_PC, { opId: escolha.opId, novoOpId: novoId() })
    expect(docDe(campanha, F_NAMI).escolhas).toEqual({})
  })
})

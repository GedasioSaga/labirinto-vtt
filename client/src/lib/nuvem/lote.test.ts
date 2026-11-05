import { describe, expect, it } from 'vitest'
import {
  AGORA,
  docDe,
  enviar,
  F_DO_MESTRE,
  F_NAMI,
  F_ZORO,
  mesa,
  MESTRE_NO_APP,
  MESTRE_NO_SITE,
  NAMI,
  NAMI_NO_PC,
  op,
  TANGERINA,
  ZORO,
  ZORO_NO_SITE,
} from './campanha.fixture'
import { LIMITES } from './limites'
import { processarLote } from './lote'
import type { Op } from './tipos'

/**
 * PROCESSAR LOTE (plano do Lobby §5.2-5.4, aceite da N2; testes liberados:
 * mescla). Op por op; tudo ou nada só com `atomico`; o mesmo `opId` de novo
 * recebe a mesma resposta; toda op recebe resposta, nenhuma some.
 */

const HP = ['recursos', 'hp']
const QTD_TANGERINA = ['mochila', 'vaga_tangerina', 'quantidade']

/** A troca da mesa: Nami dá 1 Tangerina ao Zoro e ele paga 10 moedas. Gerada junto (um lote só), tudo ou nada. */
function troca(loteId = 'lote_troca'): Op[] {
  const tudoOuNada = { atomico: true, loteId } as const
  return [
    op(MESTRE_NO_APP, F_NAMI, QTD_TANGERINA, 'somar', { delta: -1, ...tudoOuNada }),
    op(MESTRE_NO_APP, F_ZORO, ['mochila', 'vaga_tangerina_zoro'], 'criar', { valor: { id: 'vaga_tangerina_zoro', nome: 'Tangerina' }, ...tudoOuNada }),
    op(MESTRE_NO_APP, F_ZORO, ['moedas'], 'somar', { delta: -10, ...tudoOuNada }),
    op(MESTRE_NO_APP, F_NAMI, ['moedas'], 'somar', { delta: 10, ...tudoOuNada }),
  ]
}

describe('tudo ou nada', () => {
  function mesaComMoedasDoZoro() {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_ZORO, ['moedas'], 'somar', { delta: 50 })])
    return campanha
  }

  it('lote atômico com 1 conflito recusa tudo: nada muda, todas guardadas para decidir', () => {
    const campanha = mesaComMoedasDoZoro()
    // O mestre, no site, mexe na Tangerina depois da base da troca: só a primeira op bate.
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, QTD_TANGERINA, 'somar', { delta: 1, baseRev: 1 })])
    const antesDaTroca = [docDe(campanha, F_NAMI), docDe(campanha, F_ZORO)]
    const lote = troca().map((pendente) => ({ ...pendente, baseRev: 1 }))
    const { respostas, revAtual } = enviar(campanha, MESTRE_NO_APP, lote)
    expect(respostas.map((resposta) => resposta.t)).toEqual(['conflito', 'conflito', 'conflito', 'conflito'])
    expect(respostas[0]).toMatchObject({ opId: lote[0].opId, valorAtual: 4, quem: 'Mestre' })
    expect(respostas[0]).not.toHaveProperty('porCausaDe')
    for (const resposta of respostas.slice(1)) expect(resposta).toMatchObject({ porCausaDe: lote[0].opId, quem: 'Mestre' })
    expect(respostas[2]).toMatchObject({ valorAtual: 50 })
    expect([docDe(campanha, F_NAMI), docDe(campanha, F_ZORO)]).toEqual(antesDaTroca)
    expect(revAtual).toBe(2)
    expect(campanha.todasAsRecusadas().map((recusada) => recusada.opId)).toEqual(lote.map((pendente) => pendente.opId))
  })

  it('o mesmo lote sem atomico aplica o resto e recusa só a que bateu', () => {
    const campanha = mesaComMoedasDoZoro()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, QTD_TANGERINA, 'somar', { delta: 1, baseRev: 1 })])
    const lote = troca().map(({ atomico: _tudoOuNada, ...solta }) => ({ ...solta, baseRev: 1 }))
    expect(enviar(campanha, MESTRE_NO_APP, lote).respostas.map((resposta) => resposta.t)).toEqual(['conflito', 'ack', 'ack', 'ack'])
    expect(docDe(campanha, F_NAMI)).toMatchObject({ moedas: 110, mochila: [{ quantidade: 4 }] })
    expect(docDe(campanha, F_ZORO)).toMatchObject({ moedas: 40, mochila: [{ id: 'vaga_tangerina_zoro' }] })
  })

  it('a troca que cabe entra inteira, numa rev por op', () => {
    const campanha = mesaComMoedasDoZoro()
    const lote = troca().map((pendente) => ({ ...pendente, baseRev: 1 }))
    expect(enviar(campanha, MESTRE_NO_APP, lote).respostas).toEqual(lote.map((pendente, indice) => ({ t: 'ack', opId: pendente.opId, rev: 2 + indice })))
    expect(docDe(campanha, F_NAMI)).toMatchObject({ moedas: 110, mochila: [{ quantidade: 2 }] })
  })

  it('tudo ou nada com uma irmã ilegível (sem id): nenhuma entra', () => {
    const campanha = mesaComMoedasDoZoro()
    const [primeira, ...resto] = troca().map((pendente) => ({ ...pendente, baseRev: 1 }))
    const { opId: _semId, ...ilegivel } = primeira
    const { respostas, violacoes } = enviar(campanha, MESTRE_NO_APP, [ilegivel, ...resto])
    expect(respostas.map((resposta) => resposta.t)).toEqual(['negado', 'negado', 'negado'])
    // Só a ilegível é violação; as irmãs caíram por tabela.
    expect(violacoes).toBe(1)
    expect(campanha.todasAsOps()).toHaveLength(1)
  })

  it('tudo ou nada com uma op negada (moedas que não existem): nenhuma entra', () => {
    const campanha = mesa()
    // Zoro sem moedas: pagar 10 é recusado pela ficha de agora, e a troca inteira volta.
    const { respostas } = enviar(campanha, MESTRE_NO_APP, troca())
    expect(respostas.map((resposta) => [resposta.t, resposta.t === 'negado' ? resposta.motivo : ''])).toEqual([
      ['negado', 'acima-do-teto'],
      ['negado', 'acima-do-teto'],
      ['negado', 'acima-do-teto'],
      ['negado', 'acima-do-teto'],
    ])
    expect(respostas[0]).toMatchObject({ detalhe: expect.stringMatching(/junto/) })
    expect(docDe(campanha, F_NAMI).mochila).toEqual([TANGERINA])
    expect(campanha.todasAsOps()).toEqual([])
  })

  it('a irmã que bate depois de outra já ensaiada: rev e valor de ANTES do grupo, e o "Usar a minha" entra', () => {
    const campanha = mesaComMoedasDoZoro()
    // O app paga 10 moedas do Zoro à Nami sem ter visto a rev 1: a Nami entra no ensaio, o Zoro bate, o ensaio é descartado.
    const pagamento = { atomico: true, loteId: 'lote_pagamento' } as const
    const lote = [op(MESTRE_NO_APP, F_NAMI, ['moedas'], 'somar', { delta: 10, ...pagamento }), op(MESTRE_NO_APP, F_ZORO, ['moedas'], 'somar', { delta: -10, ...pagamento })]
    expect(enviar(campanha, MESTRE_NO_APP, lote).respostas).toEqual([
      { t: 'conflito', opId: lote[0].opId, quem: 'Mestre', quando: AGORA, revAtual: 1, valorAtual: 100, porCausaDe: lote[1].opId },
      { t: 'conflito', opId: lote[1].opId, quem: 'Mestre', quando: AGORA, revAtual: 1, valorAtual: 50 },
    ])
    expect(campanha.revAtual()).toBe(1)
    expect(campanha.todasAsRecusadas().map((recusada) => recusada.resposta.revAtual)).toEqual([1, 1])
    // "Usar a minha" das duas (§5.2): op nova com baseRev = revAtual e resolve = o opId recusado.
    const usarAMinha = { atomico: true, loteId: 'lote_usar_a_minha', baseRev: 1 } as const
    const resolvido = enviar(campanha, MESTRE_NO_APP, [
      op(MESTRE_NO_APP, F_NAMI, ['moedas'], 'somar', { delta: 10, resolve: lote[0].opId, ...usarAMinha }),
      op(MESTRE_NO_APP, F_ZORO, ['moedas'], 'somar', { delta: -10, resolve: lote[1].opId, ...usarAMinha }),
    ])
    expect(resolvido.respostas.map((resposta) => resposta.t)).toEqual(['ack', 'ack'])
    expect(resolvido.violacoes).toBe(0)
    expect([docDe(campanha, F_NAMI).moedas, docDe(campanha, F_ZORO).moedas]).toEqual([110, 40])
  })

  it('o valor do conflito é o de antes do grupo, mesmo com uma irmã que mexeu no mesmo caminho', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, ['mochila', 'vaga_tangerina', 'nome'], 'definir', { valor: 'Tangerina doce' })])
    // Sem ter visto a rev 1: tirar 1 da pilha não sobrepõe o nome (entra no ensaio); tirar a vaga inteira bate com ele.
    const pagamento = { atomico: true, loteId: 'lote_pagamento' } as const
    const lote = [op(MESTRE_NO_APP, F_NAMI, QTD_TANGERINA, 'somar', { delta: -1, ...pagamento }), op(MESTRE_NO_APP, F_NAMI, ['mochila', 'vaga_tangerina'], 'apagar', pagamento)]
    const respostas = enviar(campanha, MESTRE_NO_APP, lote).respostas
    expect(respostas[0]).toMatchObject({ t: 'conflito', revAtual: 1, valorAtual: 3, porCausaDe: lote[1].opId })
    expect(respostas[1]).toMatchObject({ t: 'conflito', revAtual: 1, valorAtual: { ...TANGERINA, nome: 'Tangerina doce' } })
    expect(docDe(campanha, F_NAMI).mochila).toEqual([{ ...TANGERINA, nome: 'Tangerina doce' }])
  })

  it('duas trocas no mesmo frame, cada uma com o seu lote: o conflito de uma não derruba a outra', () => {
    const campanha = mesaComMoedasDoZoro()
    const lote = [
      op(MESTRE_NO_APP, F_NAMI, HP, 'definir', { valor: 250, baseRev: 1, atomico: true, loteId: 'lote_L1' }),
      op(MESTRE_NO_APP, F_NAMI, ['moedas'], 'somar', { delta: 5, baseRev: 1, atomico: true, loteId: 'lote_L1' }),
      op(MESTRE_NO_APP, F_ZORO, ['moedas'], 'somar', { delta: -10, atomico: true, loteId: 'lote_L2' }),
    ]
    const { respostas } = enviar(campanha, MESTRE_NO_APP, lote)
    expect(respostas.map((resposta) => resposta.t)).toEqual(['ack', 'ack', 'conflito'])
    expect(respostas[2]).not.toHaveProperty('porCausaDe')
    expect(docDe(campanha, F_NAMI)).toMatchObject({ recursos: { hp: 250 }, moedas: 105 })
    expect(campanha.todasAsRecusadas().map((recusada) => recusada.opId)).toEqual([lote[2].opId])
  })

  it('a irmã atômica de lote ilegível fica no grupo em que está: nenhuma entra pela metade', () => {
    const campanha = mesaComMoedasDoZoro()
    const [primeira, segunda, ...resto] = troca().map((pendente) => ({ ...pendente, baseRev: 1 }))
    const { loteId: _semLote, ...semLote } = segunda
    const { respostas } = enviar(campanha, MESTRE_NO_APP, [primeira, semLote, ...resto])
    expect(respostas.map((resposta) => resposta.t)).toEqual(['negado', 'negado', 'negado', 'negado'])
    expect(campanha.todasAsOps()).toHaveLength(1)
  })
})

describe('reenvio com o mesmo opId', () => {
  it('aceito: a mesma resposta, a mesma rev, nada gravado de novo', () => {
    const campanha = mesa()
    const mudar = op(NAMI_NO_PC, F_NAMI, ['moedas'], 'somar', { delta: 5 })
    const primeira = enviar(campanha, NAMI_NO_PC, [mudar]).respostas
    expect(enviar(campanha, NAMI_NO_PC, [mudar]).respostas).toEqual(primeira)
    expect(campanha.todasAsOps()).toHaveLength(1)
    // `somar` não é idempotente: só o opId impede a soma dobrada.
    expect(docDe(campanha, F_NAMI).moedas).toBe(105)
  })

  it('recusado: o mesmo conflito, mesmo com a ficha mudada depois', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 250 })])
    const daNami = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280 })
    const primeira = enviar(campanha, NAMI_NO_PC, [daNami]).respostas
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 100, baseRev: 1 })])
    expect(enviar(campanha, NAMI_NO_PC, [daNami]).respostas).toEqual(primeira)
    expect(campanha.todasAsRecusadas()).toHaveLength(1)
  })

  it('o mesmo opId vindo de outra pessoa não revela nada da op alheia', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 250 })])
    const daNami = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280 })
    enviar(campanha, NAMI_NO_PC, [daNami])
    const copiada = op(ZORO_NO_SITE, F_ZORO, HP, 'definir', { valor: 1, opId: daNami.opId })
    expect(enviar(campanha, ZORO_NO_SITE, [copiada]).respostas).toEqual([{ t: 'negado', opId: daNami.opId, motivo: 'sem-permissao', detalhe: expect.any(String) }])
  })

  it('aceita e reenviada depois que o jogador declarado saiu (o ack se perdeu): a mesma resposta, não negado', () => {
    const campanha = mesa()
    const daSala = op(MESTRE_NO_APP, F_ZORO, HP, 'definir', { valor: 1, autorDeclarado: ZORO.contaId })
    const primeira = enviar(campanha, MESTRE_NO_APP, [daSala]).respostas
    expect(primeira).toEqual([{ t: 'ack', opId: daSala.opId, rev: 1 }])
    campanha.mudarMembro({ ...ZORO, estado: 'removido' })
    expect(enviar(campanha, MESTRE_NO_APP, [daSala]).respostas).toEqual(primeira)
    // Op nova declarando quem saiu continua negada.
    const nova = op(MESTRE_NO_APP, F_ZORO, HP, 'definir', { valor: 2, baseRev: 1, autorDeclarado: ZORO.contaId })
    expect(enviar(campanha, MESTRE_NO_APP, [nova]).respostas[0]).toMatchObject({ t: 'negado', motivo: 'sem-permissao' })
    expect(campanha.todasAsOps()).toHaveLength(1)
  })

  it('aceita e reenviada por quem saiu da campanha: a mesma resposta; op nova dele continua negada', () => {
    const campanha = mesa()
    const mudar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })
    const primeira = enviar(campanha, NAMI_NO_PC, [mudar]).respostas
    campanha.mudarMembro({ ...NAMI, estado: 'removido' })
    expect(enviar(campanha, NAMI_NO_PC, [mudar]).respostas).toEqual(primeira)
    expect(enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1, baseRev: 1 })]).respostas[0]).toMatchObject({ t: 'negado', motivo: 'sem-permissao' })
  })

  it('declarar como autor quem fez a op alheia não devolve a resposta dela (só o app do mestre declara)', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_DO_MESTRE, ['notaDoMestre'], 'definir', { valor: 'Segredo da ilha' })])
    const doApp = op(MESTRE_NO_APP, F_DO_MESTRE, ['notaDoMestre'], 'definir', { valor: 'Outro' })
    expect(enviar(campanha, MESTRE_NO_APP, [doApp]).respostas[0]).toMatchObject({ t: 'conflito', valorAtual: 'Segredo da ilha' })
    const forjada = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1, opId: doApp.opId, autorDeclarado: 'mestre' })
    expect(enviar(campanha, NAMI_NO_PC, [forjada]).respostas).toEqual([{ t: 'negado', opId: doApp.opId, motivo: 'sem-permissao', detalhe: expect.any(String) }])
  })

  it('resolve só cita a recusada do mesmo autor', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 250 })])
    const daNami = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280 })
    enviar(campanha, NAMI_NO_PC, [daNami])
    const alheia = op(ZORO_NO_SITE, F_ZORO, HP, 'definir', { valor: 1, resolve: daNami.opId })
    expect(enviar(campanha, ZORO_NO_SITE, [alheia]).respostas[0]).toMatchObject({ t: 'negado', motivo: 'sem-permissao' })
  })
})

describe('o que fica no log', () => {
  it('criar item empilhável que já está na mochila grava a SOMA (é ela que entra no histórico e no desfazer)', () => {
    const campanha = mesa()
    const mais = op(NAMI_NO_PC, F_NAMI, ['mochila', 'vaga_nova'], 'criar', { valor: { id: 'vaga_nova', nome: 'Tangerina', itemId: 'item_tangerina', empilhavel: true, quantidade: 2 } })
    expect(enviar(campanha, NAMI_NO_PC, [mais]).respostas[0]).toMatchObject({ t: 'ack', rev: 1 })
    expect(campanha.todasAsOps()[0]).toMatchObject({ opId: mais.opId, caminho: QTD_TANGERINA, acao: 'somar', delta: 2, antes: 3 })
    expect(campanha.todasAsOps()[0]).not.toHaveProperty('valor')
    expect(docDe(campanha, F_NAMI).mochila).toEqual([{ ...TANGERINA, quantidade: 5 }])
  })

  it('a op gravada leva autor, origem, hora do servidor e o antes', () => {
    const campanha = mesa()
    const mudar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })
    enviar(campanha, NAMI_NO_PC, [mudar], AGORA + 5)
    expect(campanha.todasAsOps()[0]).toEqual({
      ...mudar,
      rev: 1,
      antes: 300,
      autorContaId: 'conta_nami',
      autorNome: 'Nami',
      origem: 'site',
      atestadoPeloApp: false,
      quando: AGORA + 5,
    })
    expect(campanha.ficha(F_NAMI)).toMatchObject({ rev: 1, apagada: false })
  })

  it('eco (criar o que já existe) é aceito sem mudar a ficha', () => {
    const campanha = mesa()
    const cartaoDeNovo = op(NAMI_NO_PC, F_NAMI, ['abas', 'tecnicas', 'cart_clima'], 'criar', { valor: { id: 'cart_clima', nome: 'Clima-Tact', campos: { dano: '1d6' }, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] } })
    const antes = docDe(campanha, F_NAMI)
    expect(enviar(campanha, NAMI_NO_PC, [cartaoDeNovo]).respostas[0]).toMatchObject({ t: 'ack' })
    expect(docDe(campanha, F_NAMI)).toEqual(antes)
  })
})

describe('nada some em silêncio', () => {
  it('toda op com id recebe resposta; a torta não derruba as outras; sem id conta como violação', () => {
    const campanha = mesa()
    const boa = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })
    const objetoNoTexto = op(NAMI_NO_PC, F_NAMI, ['nome'], 'definir', { valor: { nome: 'x' } })
    const semBase = { ...op(NAMI_NO_PC, F_NAMI, ['descricao'], 'definir', { valor: 'x' }), baseRev: 'zero' }
    const resultado = enviar(campanha, NAMI_NO_PC, [objetoNoTexto, { lixo: true }, semBase, boa, null])
    expect(resultado.respostas.map((resposta) => [resposta.opId, resposta.t])).toEqual([
      [objetoNoTexto.opId, 'negado'],
      [semBase.opId, 'negado'],
      [boa.opId, 'ack'],
    ])
    expect(resultado.violacoes).toBe(4)
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(250)
  })

  it('lote acima de 50 ops é frame torto: nenhuma entra, todas negadas', () => {
    const campanha = mesa()
    const lote = Array.from({ length: LIMITES.opsPorLote + 1 }, () => op(NAMI_NO_PC, F_NAMI, ['moedas'], 'somar', { delta: 1 }))
    const resultado = processarLote(campanha, NAMI_NO_PC, lote, AGORA)
    expect(resultado.respostas).toHaveLength(LIMITES.opsPorLote + 1)
    expect(new Set(resultado.respostas.map((resposta) => resposta.t === 'negado' && resposta.motivo))).toEqual(new Set(['acima-do-teto']))
    expect(resultado.gravacoes.ops).toEqual([])
    expect(resultado.violacoes).toBe(1)
  })

  it('mudança grande demais para o fio é negada antes de gravar', () => {
    const campanha = mesa()
    // 1.000 ids de 30 letras: cabe no teto da ordem, não no teto da op (24 KiB).
    const ids = Array.from({ length: 1000 }, (_, indice) => `cart_${String(indice).padStart(25, '0')}`)
    const ordem = op(NAMI_NO_PC, F_NAMI, ['abas', 'tecnicas', '#ordem'], 'ordenar', { valor: ids })
    expect(enviar(campanha, NAMI_NO_PC, [ordem]).respostas[0]).toMatchObject({ t: 'negado', motivo: 'acima-do-teto' })
  })
})

import { describe, expect, it } from 'vitest'
import { golpesDeHabilidade } from '../../components/batalha/dadosDoMenu'
import type { Personagem } from '../personagem'
import { APLAUSO, FULL, GRANDE_CHIFRE, HIBRIDO, jimboy, LANCAMENTO, may, QUEBRA_QUEIXO, RAPID_DASH, SAI_DAI_RIN, sistema } from './fichasDaFatiaB.testkit'
import { lancarGolpe, textoDoGolpe, type ContextoDoGolpe } from './golpe'
import { danoDaTecnica } from './leituraDaTecnica'
import { motivoDasRespostasDoCartao, rotulosDasRespostas } from './mecanicasAMao'
import { efeitosDasFormasLigadas } from './transformacao'
import { novaCarta, type TurnosDaCena } from './turnos'

/**
 * Conserto das fichas F2, fatia B (Saga, Jimboy Segundo, May D. Ark): as
 * contas e o lançamento com os cartões REAIS da pasta da mesa (ids, fórmulas,
 * ação, custo e tempo copiados do rpg.json de 08/11; descrições de fora) e os
 * atributos reais. Lei: docs/auditoria-fichas/respostas-do-grilling.md.
 */

describe('as contas das técnicas (a fórmula da mecânica à mão, com as respostas)', () => {
  it('Quebra-Queixo: sem ponto vital Força + 40 = 60; com ponto vital, × 1,5 = 90 (forma base)', () => {
    const ctx = { personagem: jimboy, sistema, arma: null }
    expect(danoDaTecnica(QUEBRA_QUEIXO, ctx)).toMatchObject({ tipo: 'valor', valor: 60 })
    expect(danoDaTecnica(QUEBRA_QUEIXO, ctx, { vital: 'nao' })).toMatchObject({ tipo: 'valor', valor: 60 })
    expect(danoDaTecnica(QUEBRA_QUEIXO, ctx, { vital: 'sim' })).toMatchObject({ tipo: 'valor', valor: 90 })
  })

  it('Grande Chifre soma por quadrado empurrado (100 / 135 / 151) e o Aplauso dá (Força + 100) × 2 = 340', () => {
    const ctx = { personagem: may, sistema, arma: null }
    expect(danoDaTecnica(GRANDE_CHIFRE, ctx, { quadrados: '1', parede: 'nao' })).toMatchObject({ tipo: 'valor', valor: 100 })
    expect(danoDaTecnica(GRANDE_CHIFRE, ctx, { quadrados: '2', parede: 'nao' })).toMatchObject({ tipo: 'valor', valor: 135 })
    expect(danoDaTecnica(GRANDE_CHIFRE, ctx, { quadrados: '3', parede: 'sim' })).toMatchObject({ tipo: 'valor', valor: 151 })
    expect(danoDaTecnica(APLAUSO, ctx)).toMatchObject({ tipo: 'valor', valor: 340 })
  })
})

describe('o menu e a mira (as perguntas na hora, o selo da tabela)', () => {
  it('May: o Grande Chifre pergunta quadrados e parede, abre em 100 sem selo e traz 135/151 e o Atordoado por resposta; o Lançamento traz Aéreo 1', () => {
    const golpes = golpesDeHabilidade(may, sistema, undefined, null, null)
    const chifre = golpes.find((golpe) => golpe.cartaoId === GRANDE_CHIFRE.id)
    expect(chifre?.perguntas?.map((pergunta) => pergunta.chave)).toEqual(['quadrados', 'parede'])
    expect(chifre?.dano.valor).toBe(100)
    expect(chifre?.selo).toBeUndefined()
    expect(chifre?.respostasMudam?.map((regra) => [regra.valor, regra.dano?.valor ?? null, regra.selo?.nome ?? null])).toEqual([
      ['2', 135, null],
      ['3', 151, null],
      ['sim', null, 'Atordoado'],
    ])
    expect(golpes.find((golpe) => golpe.cartaoId === LANCAMENTO.id)?.selo).toMatchObject({ nome: 'Aéreo', turnos: 1 })
  })

  it('Jimboy: o Quebra-Queixo abre em 60 (sem ponto vital) e a resposta torta é recusada pelo host', () => {
    const quebra = golpesDeHabilidade(jimboy, sistema, undefined, null, null).find((golpe) => golpe.cartaoId === QUEBRA_QUEIXO.id)
    expect(quebra?.dano.valor).toBe(60)
    expect(quebra?.respostasMudam?.[0]?.dano?.valor).toBe(90)
    expect(motivoDasRespostasDoCartao(QUEBRA_QUEIXO.id, { vital: 'talvez' })).toBe('Resposta fora das opções: Acertou ponto vital?')
    expect(rotulosDasRespostas(GRANDE_CHIFRE.id, { quadrados: '3', parede: 'sim' })).toEqual(['3 quadrados', 'Bateu na parede? Sim'])
  })
})

/** Jimboy (com as formas pedidas) contra a May, na vez dele. */
function contexto(personagem: Personagem, alvo: Personagem): { ctx: ContextoDoGolpe; alvoToken: string } {
  const carta = novaCarta('tok_jimboy', personagem.id, personagem.nome)
  const outra = novaCarta('tok_may', alvo.id, alvo.nome)
  const turnos: TurnosDaCena = { cartas: [carta, outra], vez: carta.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
  const ctx: ContextoDoGolpe = { turnos, carta, personagem, sistema, regras: null, autor: { tipo: 'mestre' }, personagens: [personagem, alvo], personagemDoToken: (tokenId) => (tokenId === 'tok_jimboy' ? personagem.id : tokenId === 'tok_may' ? alvo.id : undefined) }
  return { ctx, alvoToken: 'tok_may' }
}

describe('o lançamento no host', () => {
  it('Rapid Dash no Full (80): dois golpes, o 1º sem perfurar e o 2º com 40 perfurante, cada um esperando a reação dele', () => {
    const { ctx, alvoToken } = contexto({ ...jimboy, cartoesAtivos: [FULL.id] }, may)
    const lancado = lancarGolpe(ctx, { tipo: 'habilidade', cartaoId: RAPID_DASH.id, armaId: null, alvos: [{ tokenId: alvoToken, dano: 80 }], surpresa: false, perfurante: true, custo: null, acao: null }, { golpe: 'golpe_1', linha: 'linha_1', segundo: { golpe: 'golpe_2', linha: 'linha_2' } })
    expect(lancado.golpe?.perfurante).toBe(false)
    expect(lancado.golpe?.alvos[0]).toMatchObject({ dano: 80, podeReagir: true })
    expect(lancado.segundo).toMatchObject({ id: 'golpe_2', linhaId: 'linha_2', perfurante: true, nome: 'Rapid Dash (2º golpe)' })
    expect(lancado.segundo?.alvos[0]).toMatchObject({ dano: 40, podeReagir: true })
    // Sem os ids da 2ª parte (o duelo do Lobby), sai um golpe só, como antes.
    expect(lancarGolpe(ctx, { tipo: 'habilidade', cartaoId: RAPID_DASH.id, armaId: null, alvos: [{ tokenId: alvoToken, dano: 80 }], surpresa: false, perfurante: true, custo: null, acao: null }, { golpe: 'g', linha: 'l' }).segundo).toBeUndefined()
  })

  it('Sai Dai Rin (257 no Híbrido): Paralisado 2 no alvo e o Jimboy perde 200 de HP além do SP; a Full anda +2 casas', () => {
    const noHibrido = { ...jimboy, recursos: { ...jimboy.recursos, sp: 200 }, cartoesAtivos: [HIBRIDO.id] }
    expect(danoDaTecnica(SAI_DAI_RIN, { personagem: noHibrido, sistema, arma: null })).toMatchObject({ tipo: 'valor', valor: 257 })
    const { ctx, alvoToken } = contexto(noHibrido, may)
    const lancado = lancarGolpe(ctx, { tipo: 'habilidade', cartaoId: SAI_DAI_RIN.id, armaId: null, alvos: [{ tokenId: alvoToken, dano: 257 }], surpresa: false, perfurante: true, custo: null, acao: null }, { golpe: 'golpe_1', linha: 'linha_1' })
    expect(lancado.golpe?.selo).toMatchObject({ nome: 'Paralisado', turnos: 2 })
    expect(lancado.custo).toEqual([
      { parte: 'recurso', chave: 'sp', valor: 95 },
      { parte: 'recurso', chave: 'hp', valor: 800 },
    ])
    expect(textoDoGolpe(lancado.golpe ?? fail(), (tokenId) => tokenId)).toContain('Overload')
    expect(efeitosDasFormasLigadas({ ...jimboy, cartoesAtivos: [FULL.id] }, sistema).deslocamentoAMais).toBe(2)
  })
})

function fail(): never {
  throw new Error('sem golpe')
}

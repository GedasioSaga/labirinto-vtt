/**
 * Registro e Desfazer (docs/planos/dbt-batalha.md, seção 14): só a última
 * linha de pé; o jogador só a dele, sem d20 e de tipo permitido; a ficha
 * volta pelo delta sobre o valor de agora.
 */
import { describe, expect, it } from 'vitest'
import { novoPersonagem, type Personagem } from '../../personagem'
import { SISTEMA_DRAGON_BALL } from '../sistemaDragonBall'
import { nucleoInicial } from './motor'
import { ajustesParaDesfazer, comLinhaDBT, partesDaFichaDBT, podeDesfazerDBT } from './registro'
import { REGISTRO_DBT_MAX, type AutorDBT, type LinhaDBT, type TipoDaLinhaDBT } from './tipos'

const MESTRE: AutorDBT = { tipo: 'mestre' }
const ANA: AutorDBT = { tipo: 'jogador', playerId: 'ana', nome: 'Ana' }
const BETO: AutorDBT = { tipo: 'jogador', playerId: 'beto', nome: 'Beto' }
const NUCLEO = nucleoInicial([], {}, new Map(), () => 'id')

function linha(id: string, autor: AutorDBT, tipo: TipoDaLinhaDBT, comD20 = false): LinhaDBT {
  return {
    id,
    seq: 1,
    quando: 0,
    rodada: 1,
    autor,
    tipo,
    texto: id,
    detalhes: [],
    textoPublico: id,
    detalhesPublicos: [],
    envolve: { tokenIds: [], personagemIds: [] },
    comD20,
    reversao: { nucleo: NUCLEO, fichas: [] },
  }
}

function comPv(personagem: Personagem, pv: number): Personagem {
  return { ...personagem, recursos: { ...personagem.recursos, pv } }
}

describe('podeDesfazerDBT', () => {
  it('só a última linha de pé (LIFO)', () => {
    const registro = [linha('a', MESTRE, 'acao'), linha('b', MESTRE, 'acao')]
    expect(podeDesfazerDBT(registro[0], MESTRE, registro)).toBe(false)
    expect(podeDesfazerDBT(registro[1], MESTRE, registro)).toBe(true)
    const comBDesfeita = [registro[0], { ...registro[1], desfeita: { por: 'Mestre', quando: 1 } }]
    expect(podeDesfazerDBT(comBDesfeita[0], MESTRE, comBDesfeita)).toBe(true)
  })

  it('o jogador não desfaz linha com d20', () => {
    const registro = [linha('a', ANA, 'acao', true)]
    expect(podeDesfazerDBT(registro[0], ANA, registro)).toBe(false)
    expect(podeDesfazerDBT(registro[0], MESTRE, registro)).toBe(true)
  })

  it('o jogador só desfaz a linha dele, de movimento, voo, transformação, ação ou ficha', () => {
    const voo = [linha('a', ANA, 'voo')]
    expect(podeDesfazerDBT(voo[0], ANA, voo)).toBe(true)
    expect(podeDesfazerDBT(voo[0], BETO, voo)).toBe(false)
    const reacao = [linha('b', ANA, 'reacao')]
    expect(podeDesfazerDBT(reacao[0], ANA, reacao)).toBe(false)
  })

  it('o registro guarda no máximo REGISTRO_DBT_MAX linhas', () => {
    let registro: LinhaDBT[] = []
    for (let i = 0; i < REGISTRO_DBT_MAX + 5; i += 1) registro = comLinhaDBT(registro, linha(`l${i}`, MESTRE, 'acao'))
    expect(registro).toHaveLength(REGISTRO_DBT_MAX)
    expect(registro[0].id).toBe('l5')
  })
})

describe('desfazer na ficha', () => {
  // Com o máximo gravado, como a ficha da batalha fica (o ajuste grava o máximo antes de mexer no atual).
  // Sem ele a ficha é de um número só, e o máximo mostrado anda junto com o atual (`valorDaParte`).
  const novo = novoPersonagem(SISTEMA_DRAGON_BALL, 'jogador', 'Goku')
  const goku: Personagem = { ...novo, maximos: { ...novo.maximos, pv: 60 } }

  it('PV 50 -> 30: desfazer volta a 50', () => {
    const partes = partesDaFichaDBT(comPv(goku, 50), comPv(goku, 30))
    expect(partes).toEqual([{ parte: 'recurso', chave: 'pv', de: 50, para: 30 }])
    expect(ajustesParaDesfazer(comPv(goku, 30), partes)).toEqual([{ parte: 'recurso', chave: 'pv', valor: 50 }])
  })

  it('o que mudou depois fica: PV 30 virou 25 à mão, desfazer o -20 dá 45', () => {
    const partes = partesDaFichaDBT(comPv(goku, 50), comPv(goku, 30))
    expect(ajustesParaDesfazer(comPv(goku, 25), partes)).toEqual([{ parte: 'recurso', chave: 'pv', valor: 45 }])
  })
})

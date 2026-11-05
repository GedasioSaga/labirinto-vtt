/**
 * MOCHILA NA FICHA — os bonecos de uma ficha mudam num mapa (`lib/mochila/transicao.ts`,
 * correção C1; decisões do usuário de 05/11/2026): ligar um boneco que carrega
 * coisas SOMA na ficha, com aviso; ficha de vários bonecos no mesmo mapa deixa
 * cada um com a sua mochila; o último que fica herda a da ficha sem perder a
 * dele. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { CarriedItem, Token } from '../../types/map'
import { ITEM_QUANTIDADE_MAX } from '../items'
import { novoPersonagem, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { MOEDAS_MAX } from '../troca'
import { acertarBonecosDasFichas, avisosDoAcerto } from './transicao'

function ficha(id: string, nome: string, extra: Partial<Personagem> = {}): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome), id, ...extra }
}

function boneco(id: string, characterId: string | null, extra: Partial<Token> = {}): Token {
  return { id, characterId, name: id, x: 0, y: 0, size: 1, image: null, ...extra }
}

/** A Poção do acervo: empilha, então a mesma Poção em duas vagas soma numa só. */
const POCAO_DA_FICHA: CarriedItem = { id: 'vaga_pocao_ficha', itemId: 'acervo_pocao', nome: 'Poção', empilhavel: true }
const DUAS_POCOES_DO_BONECO: CarriedItem = { id: 'vaga_pocao_boneco', itemId: 'acervo_pocao', nome: 'Poção', empilhavel: true, quantidade: 2 }
const CORDA: CarriedItem = { id: 'vaga_corda', nome: 'Corda' }
const FACA: CarriedItem = { id: 'vaga_faca', nome: 'Faca' }
const ESPADA: CarriedItem = { id: 'vaga_espada', nome: 'Espada' }

/** "Poção x3", "Corda x1": o que o mestre vê na mochila. */
function itens(mochila: readonly CarriedItem[] | undefined): string[] {
  return (mochila ?? []).map((item) => `${item.nome} x${item.quantidade ?? 1}`)
}

function doId<T extends { id: string }>(lista: readonly T[], id: string): T {
  const achado = lista.find((item) => item.id === id)
  if (achado === undefined) throw new Error(`sem ${id}`)
  return achado
}

describe('ligar um boneco que carrega coisas a uma ficha', () => {
  it('2 Poções e 30 moedas do boneco + a ficha do Zoro com 1 Poção e 10 = 3 Poções e 40, e o aviso diz o que entrou', () => {
    const fichas = [ficha('p_zoro', 'Zoro', { mochila: [POCAO_DA_FICHA], moedas: 10 }), ficha('p_luffy', 'Luffy')]
    const vendedor = boneco('t_vendedor', null, { mochila: [CORDA] })
    const antes = [boneco('t_marujo', null, { name: 'Marujo', mochila: [DUAS_POCOES_DO_BONECO], moedas: 30 }), vendedor]
    const depois = [{ ...antes[0], characterId: 'p_zoro' }, vendedor]
    const acerto = acertarBonecosDasFichas(fichas, antes, depois)
    const zoro = doId(acerto.personagens, 'p_zoro')
    expect([itens(zoro.mochila), zoro.moedas]).toEqual([['Poção x3'], 40])
    // A pilha soma na vaga da ficha: uma Poção só, não duas vagas.
    expect(zoro.mochila?.[0].id).toBe('vaga_pocao_ficha')
    // O boneco mostra a ficha, e o Luffy e o NPC sem ficha ficam como estavam.
    const marujo = doId(acerto.tokens, 't_marujo')
    expect([itens(marujo.mochila), marujo.moedas]).toEqual([['Poção x3'], 40])
    expect(doId(acerto.personagens, 'p_luffy')).toBe(fichas[1])
    expect(doId(acerto.tokens, 't_vendedor')).toBe(vendedor)
    expect(avisosDoAcerto(acerto)).toEqual(['Poção ×2 e 30 moedas do boneco Marujo foram para a mochila de Zoro.'])
  })

  it('ficha nova (nasce vazia) ligada a um boneco que carregava coisas nasce com elas', () => {
    const fichas = [ficha('p_nami', 'Nami')]
    const antes = [boneco('t_nami', null, { mochila: [CORDA], moedas: 12 })]
    const acerto = acertarBonecosDasFichas(fichas, antes, [{ ...antes[0], characterId: 'p_nami' }])
    expect([acerto.personagens[0].mochila, acerto.personagens[0].moedas]).toEqual([[CORDA], 12])
    expect(avisosDoAcerto(acerto)).toEqual(['Corda e 12 moedas do boneco t_nami foram para a mochila de Nami.'])
  })

  it('boneco de mãos vazias: nada entra (a MESMA lista de fichas), e ele passa a mostrar a ficha', () => {
    const fichas = [ficha('p_zoro', 'Zoro', { mochila: [ESPADA] })]
    const antes = [boneco('t_zoro', null)]
    const acerto = acertarBonecosDasFichas(fichas, antes, [{ ...antes[0], characterId: 'p_zoro' }])
    expect(acerto.personagens).toBe(fichas)
    expect(itens(acerto.tokens[0].mochila)).toEqual(['Espada x1'])
    expect(avisosDoAcerto(acerto)).toEqual([])
  })

  it('boneco que mostrava o Luffy ligado ao Zoro: a mochila era do Luffy, não entra no Zoro', () => {
    const fichas = [ficha('p_luffy', 'Luffy', { mochila: [CORDA] }), ficha('p_zoro', 'Zoro', { mochila: [ESPADA] })]
    const antes = [boneco('t_1', 'p_luffy', { mochila: [CORDA] })]
    const acerto = acertarBonecosDasFichas(fichas, antes, [{ ...antes[0], characterId: 'p_zoro' }])
    expect(acerto.personagens).toBe(fichas)
    expect(itens(acerto.tokens[0].mochila)).toEqual(['Espada x1'])
  })

  it('a mesma vaga no boneco e na ficha (cópia de quem a mostrava) não dobra: fica a maior quantidade', () => {
    const fichas = [ficha('p_zoro', 'Zoro', { mochila: [{ ...POCAO_DA_FICHA, quantidade: 3 }], moedas: 1 })]
    const antes = [boneco('t_copia', null, { mochila: [{ ...POCAO_DA_FICHA, quantidade: 2 }, CORDA] })]
    const acerto = acertarBonecosDasFichas(fichas, antes, [{ ...antes[0], characterId: 'p_zoro' }])
    expect(itens(acerto.personagens[0].mochila)).toEqual(['Poção x3', 'Corda x1'])
  })

  it('a pilha que passa do teto abre outra vaga, e as moedas acima do teto da bolsa aparecem no aviso', () => {
    const fichas = [ficha('p_zoro', 'Zoro', { mochila: [{ ...POCAO_DA_FICHA, quantidade: ITEM_QUANTIDADE_MAX - 1 }], moedas: MOEDAS_MAX - 5 })]
    const antes = [boneco('t_rico', null, { name: 'Rico', mochila: [DUAS_POCOES_DO_BONECO], moedas: 8 })]
    const acerto = acertarBonecosDasFichas(fichas, antes, [{ ...antes[0], characterId: 'p_zoro' }])
    expect(itens(acerto.personagens[0].mochila)).toEqual([`Poção x${ITEM_QUANTIDADE_MAX}`, 'Poção x1'])
    expect(acerto.personagens[0].moedas).toBe(MOEDAS_MAX)
    expect(avisosDoAcerto(acerto)[0]).toContain('3 não couberam')
  })
})

describe('desligar e o Ctrl+Z de um "ligar"', () => {
  it('desligar o boneco que mostrava a ficha: ele fica sem nada, a ficha guarda tudo, e o aviso diz isso', () => {
    const fichas = [ficha('p_zoro', 'Zoro', { mochila: [ESPADA], moedas: 7 })]
    const antes = [boneco('t_zoro', 'p_zoro', { name: 'Zoro', mochila: [ESPADA], moedas: 7 })]
    const acerto = acertarBonecosDasFichas(fichas, antes, [{ ...antes[0], characterId: null }])
    expect(acerto.personagens).toBe(fichas)
    expect([acerto.tokens[0].mochila, acerto.tokens[0].moedas]).toEqual([undefined, undefined])
    expect(avisosDoAcerto(acerto)).toEqual(['O boneco Zoro não mostra mais a ficha de Zoro: a mochila e a bolsa continuam na ficha.'])
  })

  it('Ctrl+Z do "ligar" (o boneco volta com as 2 Poções de antes): a ficha não perde, e o boneco não fica com cópia', () => {
    const fichas = [ficha('p_zoro', 'Zoro', { mochila: [{ ...POCAO_DA_FICHA, quantidade: 3 }] })]
    const ligado = boneco('t_marujo', 'p_zoro', { mochila: [{ ...POCAO_DA_FICHA, quantidade: 3 }] })
    const desfeito = boneco('t_marujo', null, { mochila: [DUAS_POCOES_DO_BONECO] })
    const acerto = acertarBonecosDasFichas(fichas, [ligado], [desfeito])
    expect(acerto.personagens).toBe(fichas)
    expect(acerto.tokens[0].mochila).toBeUndefined()
    // E o Ctrl+Y: o boneco chega sem nada de seu, a ficha fica com 3 (não 5).
    const refeito = acertarBonecosDasFichas(fichas, acerto.tokens, [ligado])
    expect(itens(refeito.personagens[0].mochila)).toEqual(['Poção x3'])
  })
})

describe('ficha com vários bonecos no mesmo mapa (os Marinheiros)', () => {
  const marinheiro = ficha('p_marinheiro', 'Marinheiro', { mochila: [FACA] })
  const tres = [
    boneco('t_m1', 'p_marinheiro', { name: 'Marinheiro 1', mochila: [{ ...POCAO_DA_FICHA, id: 'vaga_m1' }] }),
    boneco('t_m2', 'p_marinheiro', { mochila: [CORDA] }),
    boneco('t_m3', 'p_marinheiro', { moedas: 5 }),
  ]
  const vendedor = boneco('t_vendedor', null, { mochila: [CORDA] })

  it('três Marinheiros mantêm cada um a sua: trocar a ordem ou mexer um não muda nada', () => {
    const fichas = [marinheiro]
    const antes = [...tres, vendedor]
    const reordenado = [tres[2], tres[0], { ...tres[1], x: 64 }, vendedor]
    const acerto = acertarBonecosDasFichas(fichas, antes, reordenado)
    expect(acerto.personagens).toBe(fichas)
    expect(acerto.tokens).toBe(reordenado)
  })

  it('tirar dois: o último herda a mochila da ficha SOMADA com a dele (nada some), e o NPC sem ficha fica igual', () => {
    const fichas = [marinheiro]
    const acerto = acertarBonecosDasFichas(fichas, [...tres, vendedor], [tres[0], vendedor])
    expect(itens(acerto.personagens[0].mochila)).toEqual(['Faca x1', 'Poção x1'])
    expect(itens(acerto.tokens[0].mochila)).toEqual(['Faca x1', 'Poção x1'])
    expect(acerto.tokens[1]).toBe(vendedor)
    expect(avisosDoAcerto(acerto)).toEqual(['Poção do boneco Marinheiro 1 foi para a mochila de Marinheiro.'])
  })

  it('tirar um só (de 3 para 2): continuam vários, nada muda', () => {
    const fichas = [marinheiro]
    const depois = [tres[0], tres[2]]
    const acerto = acertarBonecosDasFichas(fichas, tres, depois)
    expect(acerto.personagens).toBe(fichas)
    expect(acerto.tokens).toBe(depois)
  })

  it('de 1 para 2 (duplicar o Luffy): os dois deixam de mostrar a ficha, que guarda tudo; de volta a 1, nada dobra', () => {
    const fichas = [ficha('p_luffy', 'Luffy', { mochila: [POCAO_DA_FICHA], moedas: 10 })]
    const original = boneco('t_luffy', 'p_luffy', { name: 'Luffy', mochila: [POCAO_DA_FICHA], moedas: 10 })
    const copia = { ...original, id: 't_luffy_2' }
    const dois = acertarBonecosDasFichas(fichas, [original], [original, copia])
    expect(dois.personagens).toBe(fichas)
    expect(dois.tokens.map((t) => [t.mochila, t.moedas])).toEqual([
      [undefined, undefined],
      [undefined, undefined],
    ])
    expect(avisosDoAcerto(dois)).toEqual(['Luffy tem 2 bonecos neste mapa: cada um tem a sua mochila. A mochila e a bolsa da ficha continuam nela e voltam quando ficar um boneco só.'])
    // A cópia sai (apagada, ou o Ctrl+Z): o original volta a mostrar a ficha, com 1 Poção e 10 moedas — não 2 e 20.
    const um = acertarBonecosDasFichas(fichas, dois.tokens, [original])
    expect(um.personagens).toBe(fichas)
    expect([itens(um.tokens[0].mochila), um.tokens[0].moedas]).toEqual([['Poção x1'], 10])
  })

  it('de 1 para 2 ligando um boneco que carrega coisas: ele fica com as dele, e o outro deixa de mostrar a ficha', () => {
    const fichas = [ficha('p_marinheiro', 'Marinheiro', { mochila: [FACA] })]
    const primeiro = boneco('t_m1', 'p_marinheiro', { mochila: [FACA] })
    const segundo = boneco('t_m2', null, { mochila: [CORDA], moedas: 3 })
    const acerto = acertarBonecosDasFichas(fichas, [primeiro, segundo], [primeiro, { ...segundo, characterId: 'p_marinheiro' }])
    expect(acerto.personagens).toBe(fichas)
    expect(acerto.tokens.map((t) => [itens(t.mochila), t.moedas])).toEqual([
      [[], undefined],
      [['Corda x1'], 3],
    ])
  })
})

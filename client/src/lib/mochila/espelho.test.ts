/**
 * MOCHILA NA FICHA — depois da migração (`lib/mochila/espelho.ts`, fatia A2):
 * a troca entre duas fichas e a ficha que nasce depois. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { CarriedItem, Token } from '../../types/map'
import type { ItemChange } from '../items'
import { novoPersonagem, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { payCoinsChange } from '../troca'
import { fichaQueNasceDoBoneco, mudancaNasFichas } from './espelho'
import { juntarMochilas } from './juncao'

function ficha(id: string, nome: string, extra: Partial<Personagem> = {}): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome), id, ...extra }
}

function boneco(id: string, characterId: string | null, extra: Partial<Token> = {}): Token {
  return { id, characterId, name: id, x: 0, y: 0, size: 1, image: null, ...extra }
}

const POCAO: CarriedItem = { id: 'vaga_pocao', nome: 'Poção' }
const CORDA: CarriedItem = { id: 'vaga_corda', nome: 'Corda' }

describe('troca entre duas fichas', () => {
  it('mexe nas DUAS fichas: a Poção e as moedas saem de uma e entram na outra', () => {
    const luffy = ficha('p_luffy', 'Luffy', { mochila: [POCAO, CORDA], moedas: 100 })
    const zoro = ficha('p_zoro', 'Zoro', { moedas: 5 })
    const bonecoDoLuffy = boneco('t_luffy', 'p_luffy', { mochila: [POCAO, CORDA], moedas: 100 })
    const bonecoDoZoro = boneco('t_zoro', 'p_zoro', { moedas: 5 })
    const pagamento = payCoinsChange(bonecoDoLuffy, bonecoDoZoro, 30)
    if (pagamento === null) throw new Error('o Luffy tem 100 moedas: pagar 30 ao Zoro tinha de valer')
    const troca: ItemChange = {
      mochilas: [
        { tokenId: 't_luffy', mochila: [CORDA] },
        { tokenId: 't_zoro', mochila: [POCAO] },
      ],
      bolsas: pagamento.bolsas,
    }
    const depois = mudancaNasFichas([luffy, zoro], [bonecoDoLuffy, bonecoDoZoro], troca)
    expect(depois.map((personagem) => [personagem.nome, personagem.mochila, personagem.moedas])).toEqual([
      ['Luffy', [CORDA], 70],
      ['Zoro', [POCAO], 35],
    ])
  })

  it('a ficha que esvazia perde a chave (ausente === vazia), como o boneco', () => {
    const luffy = ficha('p_luffy', 'Luffy', { mochila: [POCAO], moedas: 30 })
    const depois = mudancaNasFichas([luffy], [boneco('t_luffy', 'p_luffy')], { mochilas: [{ tokenId: 't_luffy', mochila: [] }], bolsas: [{ tokenId: 't_luffy', moedas: 0 }] })
    expect('mochila' in depois[0]).toBe(false)
    expect('moedas' in depois[0]).toBe(false)
  })

  it('NPC sem ficha fica intocado: a mudança no boneco dele não mexe em ficha nenhuma', () => {
    const luffy = ficha('p_luffy', 'Luffy', { mochila: [POCAO] })
    const lista = [luffy]
    const depois = mudancaNasFichas(lista, [boneco('t_luffy', 'p_luffy'), boneco('t_vendedor', null)], { mochilas: [{ tokenId: 't_vendedor', mochila: [CORDA] }], bolsas: [{ tokenId: 't_vendedor', moedas: 999 }] })
    expect(depois).toBe(lista)
    expect(depois[0]).toBe(luffy)
  })
})

describe('ficha nova depois da migração', () => {
  it('nasce com a mochila e a bolsa do boneco ligado', () => {
    // A pasta migrou com o Luffy; a Nami é criada depois e ligada a um boneco que já carregava coisas.
    const migrada = juntarMochilas([ficha('p_luffy', 'Luffy')], [{ origem: { mapa: 'Vila Nova', cena: '', gravadaEm: 1 }, bonecos: [{ characterId: 'p_luffy', mochila: [POCAO] }] }])
    expect(migrada.personagens[0].mochila).toEqual([POCAO])
    const nami = ficha('p_nami', 'Nami')
    const nasceu = fichaQueNasceDoBoneco(nami, boneco('t_nami', 'p_nami', { mochila: [CORDA], moedas: 12 }))
    expect([nasceu.mochila, nasceu.moedas]).toEqual([[CORDA], 12])
  })

  it('ficha que já tem mochila não é nova: o boneco não a sobrescreve', () => {
    const nami = ficha('p_nami', 'Nami', { mochila: [POCAO] })
    expect(fichaQueNasceDoBoneco(nami, boneco('t_nami', 'p_nami', { mochila: [CORDA] }))).toBe(nami)
  })

  it('boneco de mãos vazias: nasce vazia (a mesma ficha, sem chave nova)', () => {
    const nami = ficha('p_nami', 'Nami')
    expect(fichaQueNasceDoBoneco(nami, boneco('t_nami', 'p_nami'))).toBe(nami)
  })
})

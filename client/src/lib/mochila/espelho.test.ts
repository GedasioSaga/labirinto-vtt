/**
 * MOCHILA NA FICHA — depois da migração (`lib/mochila/espelho.ts`, fatia A2):
 * a troca entre duas fichas, o espelho e a recuperação. A ficha que nasce
 * de um boneco e a de vários bonecos estão em `transicao.test.ts`. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { CarriedItem, MapData, Token } from '../../types/map'
import type { ItemChange } from '../items'
import { createEmptyMap } from '../mapFactory'
import { novoPersonagem, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { payCoinsChange } from '../troca'
import { fichasComOsBonecos, mapaComAsFichas, mapaSemOEspelho, mudancaNasFichas, passosComAsFichas } from './espelho'

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

  it('ficha ligada a vários bonecos na cena: a mudança fica nos bonecos, como na migração; a outra ficha muda', () => {
    const bandido = ficha('p_bandido', 'Bandido')
    const luffy = ficha('p_luffy', 'Luffy')
    const bonecos = [boneco('t_bandido_1', 'p_bandido'), boneco('t_bandido_2', 'p_bandido'), boneco('t_luffy', 'p_luffy')]
    // O Luffy toma a Poção do Bandido 1.
    const roubo: ItemChange = { mochilas: [{ tokenId: 't_bandido_1', mochila: [] }, { tokenId: 't_luffy', mochila: [POCAO] }], bolsas: [{ tokenId: 't_bandido_1', moedas: 0 }] }
    const depois = mudancaNasFichas([bandido, luffy], bonecos, roubo)
    expect(depois[0]).toBe(bandido)
    expect(depois[1].mochila).toEqual([POCAO])
  })
})

describe('o espelho: a ficha vence o boneco (fatia A3)', () => {
  function mapa(bonecos: Token[]): MapData {
    return { ...createEmptyMap('map_goa', 'Reino de Goa', 20, 16, 64), tokens: bonecos }
  }

  it('o boneco ligado mostra a mochila e a bolsa da ficha; a Poção velha do boneco não volta para a ficha', () => {
    const luffy = ficha('p_luffy', 'Luffy', { mochila: [CORDA], moedas: 20 })
    const antes = mapa([boneco('t_luffy', 'p_luffy', { mochila: [POCAO, CORDA], moedas: 50 })])
    const depois = mapaComAsFichas(antes, [luffy])
    expect([depois.tokens[0].mochila, depois.tokens[0].moedas]).toEqual([[CORDA], 20])
    expect(luffy.mochila).toEqual([CORDA])
  })

  it('ficha vazia esvazia o boneco, sem deixar a chave (ausente === vazia)', () => {
    const depois = mapaComAsFichas(mapa([boneco('t_luffy', 'p_luffy', { mochila: [POCAO], moedas: 50 })]), [ficha('p_luffy', 'Luffy')])
    expect('mochila' in depois.tokens[0]).toBe(false)
    expect('moedas' in depois.tokens[0]).toBe(false)
  })

  it('NPC sem ficha, ficha de fora da lista e ficha de vários bonecos ficam como estão: o MESMO mapa', () => {
    const antes = mapa([
      boneco('t_vendedor', null, { mochila: [POCAO] }),
      boneco('t_estranho', 'p_de_outra_pasta', { mochila: [POCAO] }),
      boneco('t_bandido_1', 'p_bandido', { mochila: [POCAO] }),
      boneco('t_bandido_2', 'p_bandido'),
    ])
    expect(mapaComAsFichas(antes, [ficha('p_bandido', 'Bandido', { mochila: [CORDA] })])).toBe(antes)
  })

  it('ficha de vários bonecos: o boneco que mostra a ficha INTEIRA é cópia e fica sem nada; o que tem a sua fica com ela', () => {
    const luffy = ficha('p_luffy', 'Luffy', { mochila: [POCAO], moedas: 10 })
    const proprio = boneco('t_luffy_goa', 'p_luffy', { mochila: [CORDA] })
    // O passo do desfazer em que a travessia pôs o Luffy que chegou, com a cópia, ao lado do Luffy de lá.
    const passo = mapa([boneco('t_luffy_sky', 'p_luffy', { mochila: [POCAO], moedas: 10 }), proprio, boneco('t_vendedor', null, { mochila: [POCAO], moedas: 10 })])
    const [espelhado] = passosComAsFichas([passo], [luffy])
    expect(espelhado.tokens.map((t) => [t.mochila, t.moedas])).toEqual([
      [undefined, undefined],
      [[CORDA], undefined],
      [[POCAO], 10],
    ])
    expect(espelhado.tokens[1]).toBe(proprio)
  })

  it('já igual (mesmos itens em outra lista, quantidade 1 escrita ou não), e nos passos do desfazer: a MESMA referência', () => {
    const luffy = ficha('p_luffy', 'Luffy', { mochila: [{ ...POCAO }], moedas: 7 })
    const antes = mapa([boneco('t_luffy', 'p_luffy', { mochila: [{ ...POCAO, quantidade: 1 }], moedas: 7 })])
    expect(mapaComAsFichas(antes, [luffy])).toBe(antes)
    const passos = [antes, antes]
    expect(passosComAsFichas(passos, [luffy])).toBe(passos)
  })
})

describe('o que sai do mapa e pode voltar (Ctrl+C, Ctrl+X, "Guardar ficha"): sem a cópia da ficha', () => {
  const mapa = (bonecos: Token[]): MapData => ({ ...createEmptyMap('map_sky', 'Sky Lagoon', 20, 16, 64), tokens: bonecos })

  it('o boneco que mostra a ficha sai sem nada; NPC sem ficha, ficha de fora da lista e ficha de vários bonecos levam o que é deles', () => {
    const fichas = [ficha('p_luffy', 'Luffy', { mochila: [POCAO], moedas: 10 }), ficha('p_bandido', 'Bandido')]
    const vendedor = boneco('t_vendedor', null, { mochila: [CORDA] })
    const estranho = boneco('t_estranho', 'p_de_outra_pasta', { mochila: [CORDA] })
    const bandidos = [boneco('t_bandido_1', 'p_bandido', { mochila: [POCAO] }), boneco('t_bandido_2', 'p_bandido', { moedas: 4 })]
    const copiado = mapaSemOEspelho(mapa([boneco('t_luffy', 'p_luffy', { mochila: [POCAO], moedas: 10 }), vendedor, estranho, ...bandidos]), fichas)
    expect('mochila' in copiado.tokens[0] || 'moedas' in copiado.tokens[0]).toBe(false)
    expect(copiado.tokens.slice(1)).toEqual([vendedor, estranho, ...bandidos])
    expect(copiado.tokens[1]).toBe(vendedor)
  })

  it('nada a tirar (o boneco já vazio, ou nenhuma ficha na lista): o MESMO mapa', () => {
    const vazio = mapa([boneco('t_luffy', 'p_luffy')])
    expect(mapaSemOEspelho(vazio, [ficha('p_luffy', 'Luffy')])).toBe(vazio)
    const comPocao = mapa([boneco('t_luffy', 'p_luffy', { mochila: [POCAO] })])
    expect(mapaSemOEspelho(comPocao, [])).toBe(comPocao)
  })
})

describe('o boneco vence a ficha: recuperação', () => {
  const ESPADA: CarriedItem = { id: 'vaga_espada', nome: 'Espada' }
  const cenaCom = (id: string, bonecos: Token[]): MapData => ({ ...createEmptyMap(id, id, 10, 10, 64), tokens: bonecos })

  it('recuperação: o boneco do mapa recuperado devolve a Poção e a bolsa à ficha do disco; o mapa aberto (o primeiro) vale', () => {
    const fichas = [ficha('p_luffy', 'Luffy', { mochila: [CORDA] }), ficha('p_zoro', 'Zoro')]
    const aberto = cenaCom('sky', [boneco('t_luffy', 'p_luffy', { mochila: [CORDA, POCAO], moedas: 9 })])
    const deFundo = cenaCom('goa', [boneco('t_luffy_goa', 'p_luffy', { mochila: [CORDA] }), boneco('t_zoro', 'p_zoro', { mochila: [ESPADA] })])
    const novas = fichasComOsBonecos(fichas, [aberto, deFundo])
    expect(novas.map((p) => [p.mochila, p.moedas])).toEqual([
      [[CORDA, POCAO], 9],
      [[ESPADA], undefined],
    ])
  })

  it('recuperação: NPC sem ficha, ficha de vários bonecos e boneco já igual à ficha não mudam nada: a MESMA lista', () => {
    const fichas = [ficha('p_luffy', 'Luffy', { mochila: [CORDA] }), ficha('p_bandido', 'Bandido')]
    const recuperado = cenaCom('sky', [
      boneco('t_luffy', 'p_luffy', { mochila: [{ ...CORDA }] }),
      boneco('t_vendedor', null, { mochila: [POCAO] }),
      boneco('t_bandido_1', 'p_bandido', { mochila: [ESPADA] }),
      boneco('t_bandido_2', 'p_bandido'),
    ])
    expect(fichasComOsBonecos(fichas, [recuperado])).toBe(fichas)
  })
})

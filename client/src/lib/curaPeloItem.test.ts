/**
 * A CURA TIRA O VENENO (16/11/2026, regra em `lib/curaPeloItem.ts`, decisão
 * do Claude sobre a resposta "Turnos" do mestre): usar um consumível que cura
 * tira o Envenenado (pastilha e prazo); o Lento fica; o +PV à mão do mestre
 * não tira nada. Os números são os padrões da armadilha (cobra: Envenenado
 * 3 x 4; aranha: Lento 2). Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { CarriedItem, Token } from '../types/map'
import { aplicarAjustes, NOME_DO_MESTRE } from './ajusteDaFicha'
import { curarPeloItem, itemQueCura, itemQueSeUsa, usarItemNaFicha } from './curaPeloItem'
import { fichaTemCondicao } from './condicaoPorNome'
import { novoPersonagem } from './personagem'
import { porCondicaoNaFicha, prazoDaCondicao } from './prazoDaCondicao'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'
import { recursoDeVida, vidaDoPersonagem } from './vidaDaFicha'

const POCAO: CarriedItem = { id: 'vaga_pocao', itemId: 'item_pocao', nome: 'Poção de maré', descricao: 'Cura 2d6 de Vida. Gosto de alga.', categoria: 'Consumível', quantidade: 2, empilhavel: true }
const PAO: CarriedItem = { id: 'vaga_pao', nome: 'Pão', categoria: 'Consumível' }

function ficha(extra: Partial<Token> = {}): Token {
  return { id: 't-brann', characterId: 'p-brann', name: 'Brann', x: 125, y: 125, size: 1, image: null, ...extra }
}

/** Picado pela cobra (Envenenado 3 x 4) e pela aranha (Lento 2). */
function picado(mochila: CarriedItem[]): Token {
  const cobra = porCondicaoNaFicha(ficha({ mochila }), 'Envenenado', [], { turnos: 3, porVez: 4 })
  return porCondicaoNaFicha(cobra, 'Lento', [], { turnos: 2 })
}

describe('a cura pelo item tira o Envenenado', () => {
  it('Poção usada: o Envenenado sai (pastilha e prazo), o Lento fica com o prazo dele, e a pilha perde 1 por uso', () => {
    const uso = usarItemNaFicha(picado([POCAO, PAO]), POCAO.id)
    if (uso === null) throw new Error('a Poção não estava na mochila')
    expect(uso.curou).toEqual(['Envenenado'])
    expect(fichaTemCondicao(uso.token, 'Envenenado')).toBe(false)
    expect(prazoDaCondicao(uso.token, 'Envenenado')).toBeNull()
    expect(uso.token.conditions).toEqual(['lento'])
    expect(prazoDaCondicao(uso.token, 'Lento')).toEqual({ nome: 'Lento', turnos: 2 })
    // 2 viram 1 (o campo some: ausente = 1); a 2ª Poção esvazia a vaga e o Pão fica.
    const { quantidade: _duas, ...umaPocao } = POCAO
    expect(uso.mochila).toEqual([umaPocao, PAO])
    const segunda = usarItemNaFicha(uso.token, POCAO.id)
    expect(segunda?.mochila).toEqual([PAO])
    expect(segunda?.curou).toEqual([])
  })

  it('o Lento sozinho não sai com cura; o Pão (não cura) e o +PV à mão do mestre não tiram o Envenenado', () => {
    const aranha = porCondicaoNaFicha(ficha(), 'Lento', [], { turnos: 2 })
    expect(curarPeloItem(aranha)).toBe(aranha)
    const veneno = picado([PAO])
    const comPao = usarItemNaFicha(veneno, PAO.id)
    expect(comPao?.curou).toEqual([])
    expect(comPao === null ? false : fichaTemCondicao(comPao.token, 'Envenenado')).toBe(true)
    // O +PV do mestre mexe na ficha de personagem; a ficha do mapa (onde mora o veneno) não passa por ele.
    const recurso = recursoDeVida(SISTEMA_ONE_PIECE)
    if (recurso === null) throw new Error('o sistema do teste não tem vida')
    const base = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Brann')
    const brann = { ...base, id: 'p-brann', recursos: { ...base.recursos, [recurso.id]: 20 }, maximos: { ...base.maximos, [recurso.id]: 60 } }
    const curado = aplicarAjustes(brann, SISTEMA_ONE_PIECE, [{ parte: 'recurso', chave: recurso.id, valor: 30 }], NOME_DO_MESTRE, 0)
    expect(vidaDoPersonagem(curado, recurso)?.atual).toBe(30)
    expect(fichaTemCondicao(veneno, 'Envenenado')).toBe(true)
    expect(prazoDaCondicao(veneno, 'Envenenado')?.turnos).toBe(3)
  })
})

describe('o que conta como cura, e o selo da batalha', () => {
  it('cura pelo nome ou pela descrição; a Poção sem qualificativo cura, a de força não; "curta" não é cura', () => {
    const cura = (nome: string, descricao?: string): boolean => itemQueCura(descricao === undefined ? { nome } : { nome, descricao })
    expect([cura('Poção'), cura('Porção'), cura('Antídoto'), cura('Kit Médico'), cura('Bandagem', 'Recupera 10 PV.'), cura('Erva', 'Um curativo do mato.')]).toEqual([true, true, true, true, true, true])
    expect([cura('Poção de força', 'Dobra a Força por 1 turno.'), cura('Pão'), cura('Corda curta'), cura('Garrucha', 'Arma de fogo.')]).toEqual([false, false, false, false])
    expect([itemQueSeUsa(PAO), itemQueSeUsa({ nome: 'Garrucha', categoria: 'Arma' }), itemQueSeUsa({ nome: 'Antídoto' })]).toEqual([true, false, true])
  })

  it('o selo da batalha segura a pastilha: sai só o prazo; ficha sem nenhum campo opcional não quebra', () => {
    const veneno = porCondicaoNaFicha(ficha(), 'Envenenado', [], { turnos: 3, porVez: 4 })
    const segurada = curarPeloItem(veneno, new Set(['envenenado']))
    expect(fichaTemCondicao(segurada, 'Envenenado')).toBe(true)
    expect(segurada.prazosDasCondicoes).toBeUndefined()
    // Sem condição, sem prazo, sem mochila: nada a usar nem a curar.
    const nua = ficha()
    expect(curarPeloItem(nua)).toBe(nua)
    expect(usarItemNaFicha(nua, 'vaga_que_nao_existe')).toBeNull()
    // A última vaga usada: o campo mochila sai da ficha (ausente === vazia).
    const soAntidoto = usarItemNaFicha(ficha({ mochila: [{ id: 'vaga_antidoto', nome: 'Antídoto' }] }), 'vaga_antidoto')
    expect(soAntidoto?.token.mochila).toBeUndefined()
    expect(soAntidoto?.curou).toEqual([])
  })
})

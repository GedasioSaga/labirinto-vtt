/** F6, itens numa fonte só (ARMAS-FONTE-UNICA §9): a cópia que já segue segue sozinha; o conflito espera o mestre. */
import { describe, expect, it } from 'vitest'
import type { CarriedItem, EfeitoDoItem } from '../../types/map'
import type { Personagem } from '../personagem'
import { comAEscolhaDasCopias, comAsCopiasQueSeguem, ensaiarCopias, itensComOEfeitoMudado } from './efeitoNasCopias'

const cura = (quanto: number): EfeitoDoItem => ({ mecanica: { versao: 1, acao: 'simples', alvo: { quem: 'aliados', forma: { tipo: 'um' } }, efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { fixo: quanto }, emQuem: 'alvo' }] }, gasta: 'um', onde: 'sempre' })
const POCAO = { id: 'item_pocao', nome: 'Poção', efeito: cura(100) }
const CORDA = { id: 'item_corda', nome: 'Corda' }
const ficha = (id: string, mochila: CarriedItem[]): Personagem => ({ id, nome: id, mochila }) as unknown as Personagem // só id, nome e mochila importam aqui (fixture de teste)

describe('as cópias do item nas mochilas', () => {
  it('a vaga com efeito velho segue sozinha; a dada sem efeito, a de coisa sem efeito, a solta e a de coisa apagada ficam', () => {
    const aira = ficha('Aira', [
      { id: 'v1', nome: 'Poção', itemId: 'item_pocao', efeito: cura(50), efeitoResumo: 'velha' },
      { id: 'v2', nome: 'Poção', itemId: 'item_pocao' },
      { id: 'v3', nome: 'Corda', itemId: 'item_corda', efeito: cura(10) },
      { id: 'v4', nome: 'Poção' },
      { id: 'v5', nome: 'Mapa', itemId: 'item_apagado', efeito: cura(5) },
    ])
    expect(ensaiarCopias([aira], [POCAO, CORDA]).map((copia) => [copia.vagaId, copia.caso])).toEqual([['v1', 'segue'], ['v2', 'semEfeitoNaCopia'], ['v3', 'semEfeitoNaFonte']])
    const [depois] = comAsCopiasQueSeguem([aira], [POCAO, CORDA])
    expect(depois?.mochila?.map((vaga) => vaga.efeito)).toEqual([POCAO.efeito, undefined, cura(10), undefined, cura(5)])
    // Segunda rodada: nada mais a seguir, a mesma ficha.
    expect(comAsCopiasQueSeguem(depois === undefined ? [] : [depois], [POCAO, CORDA])[0]).toBe(depois)
  })

  it('o mestre escolhe: Seguir o Acervo dá o efeito; Separar tira só a ligação; salvar acha só a coisa cujo efeito mudou', () => {
    const alexei = ficha('Alexei', [{ id: 'v1', nome: 'Poção', itemId: 'item_pocao', quantidade: 2 }])
    expect(comAEscolhaDasCopias([alexei], POCAO, 'acervo')[0]?.mochila?.[0]).toMatchObject({ itemId: 'item_pocao', efeito: POCAO.efeito, quantidade: 2 })
    expect(comAEscolhaDasCopias([alexei], POCAO, 'separar')[0]?.mochila?.[0]).toEqual({ id: 'v1', nome: 'Poção', quantidade: 2 })
    const novaPocao = { ...POCAO, efeito: cura(120) }
    expect(itensComOEfeitoMudado([POCAO, CORDA], [novaPocao, { ...CORDA, nome: 'Corda longa' }])).toEqual([novaPocao])
  })
})

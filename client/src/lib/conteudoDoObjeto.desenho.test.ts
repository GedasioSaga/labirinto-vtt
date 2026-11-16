/**
 * O DESENHO EM LINHAS (`Prop.mobiliaDesenho: 'linhas'`, MT12) do barril e da
 * caixa atravessa o minigame inteiro: quebrar (vira o barril quebrado ou a
 * caixa quebrada), Salvar, abrir de novo e "Fechar e repor" (o da ficha do
 * objeto, `updateProp` com tipo, tamanho e conteúdo) devolve o móvel em
 * linhas. A peça quebrada é peça nova e sai com textura enquanto quebrada
 * (`desenhaEmLinhas`), mas o campo fica guardado nela para o repor.
 */
import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { objetoAberto, objetoReposto } from './conteudoDoObjeto'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { criarMovel } from './mobilia'
import { desenhaEmLinhas } from './mobilia/desenhoDoMovel'

const GRADE = 50

/** Salvar e abrir de novo: o mesmo caminho do disco (`serializeMap` e `deserializeMap`). */
function salvarEReabrir(prop: Prop): Prop {
  const reaberto = deserializeMap(serializeMap({ ...createEmptyMap('m', 'Mapa', 20, 20, GRADE), props: [prop] })).props[0]
  if (reaberto === undefined) throw new Error('o objeto sumiu do mapa reaberto')
  return reaberto
}

/** O "Fechar e repor" da ficha do objeto: o mesmo patch de `ConteudoDoObjetoFicha` sobre o objeto do mapa. */
function reporPelaFicha(prop: Prop): Prop {
  const reposto = objetoReposto(prop)
  return { ...prop, conteudo: reposto.conteudo, mobilia: reposto.mobilia, width: reposto.width, height: reposto.height }
}

describe('o desenho em linhas no barril e na caixa do minigame', () => {
  it('quebrar, Salvar, abrir e "Fechar e repor" devolvem o barril e a caixa em linhas', () => {
    for (const tipo of ['barril', 'caixa'] as const) {
      const inteiro: Prop = { ...criarMovel(tipo, { x: 130, y: 90 }, GRADE, `m_${tipo}`), mobiliaDesenho: 'linhas', conteudo: { itens: [], moedas: 12, armadilha: null } }
      expect(desenhaEmLinhas(inteiro)).toBe(true)
      const quebrado = objetoAberto(inteiro, 'Diego', 1000)
      expect(quebrado.mobilia).not.toBe(tipo)
      expect(quebrado.mobiliaDesenho).toBe('linhas')
      const reaberto = salvarEReabrir(quebrado)
      expect(reaberto.mobiliaDesenho).toBe('linhas')
      // As duas portas do repor: a pura e a da ficha; o móvel volta inteiro e em linhas, também depois de outro Salvar.
      expect(objetoReposto(reaberto)).toEqual(inteiro)
      const pelaFicha = salvarEReabrir(reporPelaFicha(reaberto))
      expect(pelaFicha).toEqual(inteiro)
      expect(desenhaEmLinhas(pelaFicha)).toBe(true)
    }
  })

  it('o barril sem desenho gravado (o padrão, com textura) continua sem o campo no caminho inteiro', () => {
    const inteiro: Prop = { ...criarMovel('barril', { x: 130, y: 90 }, GRADE, 'm_barril') }
    const volta = salvarEReabrir(reporPelaFicha(salvarEReabrir(objetoAberto(inteiro, '', 0))))
    expect('mobiliaDesenho' in volta).toBe(false)
    expect(volta.mobilia).toBe('barril')
    expect([volta.width, volta.height]).toEqual([inteiro.width, inteiro.height])
  })
})

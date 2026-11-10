// @vitest-environment node
/** Pedido de 09/11/2026 (item 6): "Urso 1", "Urso 2" para fichas de mesmo nome. Dados inventados; no máximo 2 testes. */
import { describe, expect, it } from 'vitest'
import { nomesNumerados } from './nomesNumerados'

describe('nomes numerados das fichas de mesmo nome', () => {
  it('os repetidos ganham número na ordem do mapa; o nome único fica como está', () => {
    const rotulos = nomesNumerados([
      { id: 'a', nome: 'Urso' },
      { id: 'b', nome: 'Sapo Curandeiro' },
      { id: 'c', nome: 'urso ' },
      { id: 'd', nome: 'Urso' },
    ])
    expect([...rotulos]).toEqual([
      ['a', 'Urso 1'],
      ['b', 'Sapo Curandeiro'],
      ['c', 'urso 2'],
      ['d', 'Urso 3'],
    ])
  })

  it('ficha sem nome vira "Ficha", numerada se houver mais de uma', () => {
    expect([...nomesNumerados([{ id: 'a', nome: '' }, { id: 'b', nome: '  ' }, { id: 'c', nome: 'Javali' }]).values()]).toEqual(['Ficha 1', 'Ficha 2', 'Javali'])
  })
})

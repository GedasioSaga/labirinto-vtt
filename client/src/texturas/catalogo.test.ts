/**
 * O AGRUPAMENTO POR FORMA da biblioteca: texturas que são formas de uma mesma
 * (as Lajotas Clara e Escura) viram UM cartão no painel; as outras ficam
 * sozinhas, na ordem da lista.
 */
import { describe, expect, it } from 'vitest'
import { agruparPorForma, listarTexturas, type TexturaDoCatalogo } from './catalogo'

function textura(id: string, forma?: { grupo: string; nome: string }): TexturaDoCatalogo {
  return { id, nome: id.toUpperCase(), escala: 32, cor: () => 0, origem: 'embutida', ...(forma ? { forma } : {}) }
}

describe('agruparPorForma', () => {
  it('a biblioteca embutida: as Lajotas viram um cartão de duas formas, o resto fica de uma', () => {
    const grupos = agruparPorForma(listarTexturas())
    const lajotas = grupos.find((g) => g.grupo === 'lajotas')
    expect(lajotas?.nome).toBe('Lajotas de pedra')
    expect(lajotas?.formas.map((t) => t.id)).toEqual(['lajotas', 'lajotas-escuras'])
    expect(grupos.filter((g) => g.formas.length > 1)).toHaveLength(1)
    expect(grupos.map((g) => g.formas[0].id)).toEqual(['areia', 'duna', 'grama', 'floresta', 'bosque', 'pinheiros', 'chao-de-floresta', 'pantano', 'terra', 'pedra', 'neve', 'conves', 'lajotas'])
  })

  it('mantém a ordem da lista: o grupo fica onde a sua primeira forma aparece', () => {
    const grupos = agruparPorForma([textura('a'), textura('b1', { grupo: 'b', nome: 'Um' }), textura('c'), textura('b2', { grupo: 'b', nome: 'Dois' })])
    expect(grupos.map((g) => [g.grupo, g.formas.map((t) => t.id)])).toEqual([
      ['a', ['a']],
      ['b', ['b1', 'b2']],
      ['c', ['c']],
    ])
    // O nome do cartão é o da primeira forma.
    expect(grupos[1].nome).toBe('B1')
  })

  it('textura sem forma nunca entra num grupo, mesmo com o id igual ao nome de um', () => {
    const grupos = agruparPorForma([textura('x1', { grupo: 'x', nome: 'Um' }), textura('x')])
    expect(grupos.map((g) => g.formas.map((t) => t.id))).toEqual([['x1'], ['x']])
  })

  it('lista vazia, nenhum grupo', () => {
    expect(agruparPorForma([])).toEqual([])
  })
})

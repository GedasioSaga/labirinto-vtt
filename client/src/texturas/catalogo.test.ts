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
  it('a biblioteca embutida: as Lajotas viram cartão de três formas, o Campo de quatro, o Chão de metal de quatro, a Base militar de cinco, os Pisos de madeira de sete, os de cerâmica de sete, os de pedra de dez, o resto fica de uma', () => {
    const grupos = agruparPorForma(listarTexturas())
    const lajotas = grupos.find((g) => g.grupo === 'lajotas')
    expect(lajotas?.nome).toBe('Lajotas de pedra')
    expect(lajotas?.formas.map((t) => t.id)).toEqual(['lajotas', 'lajotas-escuras', 'piso-de-masmorra'])
    const campo = grupos.find((g) => g.grupo === 'grama')
    expect(campo?.nome).toBe('Campo')
    expect(campo?.formas.map((t) => t.id)).toEqual(['grama', 'grama-amarela', 'grama-morta', 'grama-escura'])
    const metal = grupos.find((g) => g.grupo === 'chao-de-metal')
    expect(metal?.nome).toBe('Chão de metal')
    expect(metal?.formas.map((t) => t.forma?.nome)).toEqual(['Placas', 'Chapa xadrez', 'Grade', 'Painéis de nave'])
    // Os três cartões de 14/11/2026 ("texturas novas de madeira, pedra, base militar").
    const madeira = grupos.find((g) => g.grupo === 'pisos-de-madeira')
    expect(madeira?.nome).toBe('Pisos de madeira')
    expect(madeira?.formas.map((t) => t.forma?.nome)).toEqual(['Assoalho claro', 'Tábua envernizada', 'Taco em espinha', 'Parquê em cesta', 'Madeira velha', 'Troncos', 'Tábuas com frestas'])
    const pedra = grupos.find((g) => g.grupo === 'pisos-de-pedra')
    expect(pedra?.nome).toBe('Pisos de pedra')
    // As Pedras com lama (15/11/2026) entraram no fim do cartão; o Mármore negro e a Moldura entalhada (lote das referências) depois delas.
    expect(pedra?.formas.map((t) => t.forma?.nome)).toEqual(['Paralelepípedo', 'Mármore', 'Pedra com musgo', 'Laje de templo', 'Rocha de caverna', 'Basalto em colunas', 'Pedras com lama', 'Mármore negro', 'Moldura entalhada', 'Ladrilho azulado'])
    const militar = grupos.find((g) => g.grupo === 'base-militar')
    expect(militar?.nome).toBe('Base militar')
    expect(militar?.formas.map((t) => t.forma?.nome)).toEqual(['Concreto', 'Asfalto com faixa', 'Lona camuflada', 'Piso de borracha', 'Chapa de pouso'])
    // Os Pisos de cerâmica (lote das referências, 15/11/2026): sete formas, o Azulejo verde é a padrão.
    const ceramica = grupos.find((g) => g.grupo === 'pisos-de-ceramica')
    expect(ceramica?.nome).toBe('Pisos de cerâmica')
    expect(ceramica?.formas.map((t) => t.forma?.nome)).toEqual(['Azulejo verde', 'Azulejo branco', 'Losangos bege', 'Losangos amarelos', 'Escamas cinza', 'Estrelinhas', 'Bolinhas pretas'])
    // O Tabuleiro (onda 1 da arte) e a Rua e calçada (onda 2, 28/11/2026) são o oitavo e o nono cartão de várias formas.
    // A Neve (onda 3, L08: Fofa, Pisada e Gelo de lago) é o décimo.
    expect(grupos.filter((g) => g.formas.length > 1)).toHaveLength(10)
    // O Cascalho (CHÃO E CAMINHO, 12/11/2026) é cartão de uma forma, depois da Terra; os três de 14/11/2026 no fim;
    // depois deles, os do lote das referências: os Pisos de cerâmica, o Linóleo verde e a Rua de tijolos.
    expect(grupos.map((g) => g.formas[0].id)).toEqual(['areia', 'duna', 'grama', 'floresta', 'bosque', 'pinheiros', 'chao-de-floresta', 'pantano', 'terra', 'terra-rachada', 'cascalho', 'pedra', 'neve', 'conves', 'lajotas', 'calcamento', 'chao-de-metal', 'assoalho-claro', 'paralelepipedo', 'concreto', 'azulejo-verde', 'linoleo-verde', 'rua-de-tijolos', 'tijolo-de-cela', 'granito-salpicado', 'lajeado-poligonal', 'tabuleiro-marmore', 'chao-de-mina', 'tijolo-de-esgoto', 'calcada-em-leque', 'terra-arada', 'cinzas', 'basalto-com-brasa'])
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

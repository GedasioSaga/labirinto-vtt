/**
 * LIVRO DE REGRAS na ficha: de qual catálogo cada aba escolhe, como o item
 * escolhido vira cartão NOVO (por valor), e o resumo que vai ao jogador no
 * lugar do livro inteiro.
 */
import { describe, expect, it } from 'vitest'
import { abaTemCatalogo, cartaoDoCatalogo, catalogoDaAba, itensDaAba, resumoDoLivro, sistemaSemLivro, temLivro } from './livroDeRegras'
import { abaDoSistema, type AbaDoSistema, type SistemaDeRpg } from './sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'

function aba(id: string): AbaDoSistema {
  const achada = abaDoSistema(SISTEMA_ONE_PIECE, id)
  if (achada === undefined) throw new Error(`aba ${id} não existe`)
  return achada
}

describe('escolher do livro: a aba e o catálogo', () => {
  it('perícias, vantagens e desvantagens escolhem do catálogo de mesmo nome; as outras abas não', () => {
    expect(['habilidades', 'pericias', 'vantagens', 'desvantagens', 'transformacoes', 'racas'].map(catalogoDaAba)).toEqual([null, 'pericias', 'vantagens', 'desvantagens', null, null])
    expect(itensDaAba(SISTEMA_ONE_PIECE.catalogos, 'pericias')).toHaveLength(47)
    expect(itensDaAba(SISTEMA_ONE_PIECE.catalogos, 'habilidades')).toEqual([])
    expect(itensDaAba(undefined, 'pericias')).toEqual([])
  })

  it('pelo resumo, o jogador sabe quais abas escolhem antes de o livro chegar', () => {
    const resumo = resumoDoLivro(SISTEMA_ONE_PIECE)
    expect(abaTemCatalogo(resumo, 'vantagens')).toBe(true)
    expect(abaTemCatalogo(resumo, 'habilidades')).toBe(false)
    expect(abaTemCatalogo({ capitulos: 3, catalogos: ['racas'] }, 'pericias')).toBe(false)
    expect(abaTemCatalogo(null, 'pericias')).toBe(false)
  })
})

describe('escolher do livro: o cartão copiado', () => {
  it('perícia: nome, descrição no campo de descrição e os atributos, num cartão de id novo', () => {
    const caca = SISTEMA_ONE_PIECE.catalogos?.pericias.find((p) => p.nome === 'Caça')
    if (caca === undefined) throw new Error('Caça não está no catálogo')
    const um = cartaoDoCatalogo(aba('pericias'), SISTEMA_ONE_PIECE, caca)
    const outro = cartaoDoCatalogo(aba('pericias'), SISTEMA_ONE_PIECE, caca)
    expect(um).toMatchObject({ nome: 'Caça', campos: { descricao: caca.descricao }, atributos: caca.atributos, extras: [], modificadores: [], subcartoes: [], imagem: null })
    expect(um.atributos.length).toBeGreaterThan(0)
    expect(um.id).not.toBe(outro.id)
  })

  it('vantagem: a descrição e o efeito, cada um no campo de mesmo id (o Efeito em destaque)', () => {
    const item = { nome: 'Acrobata', descricao: 'Circo.', efeito: 'Vantagem em Acrobacia.' }
    expect(cartaoDoCatalogo(aba('vantagens'), SISTEMA_ONE_PIECE, item)).toMatchObject({ nome: 'Acrobata', campos: { descricao: 'Circo.', efeito: 'Vantagem em Acrobacia.' }, atributos: [] })
  })

  it('texto vazio não vira campo; atributo que o sistema não tem não entra; aba sem atributos não guarda nenhum', () => {
    const pericia = { nome: 'Nova', descricao: '', atributos: ['forca', 'magia'] }
    expect(cartaoDoCatalogo(aba('pericias'), SISTEMA_ONE_PIECE, pericia)).toMatchObject({ campos: {}, atributos: ['forca'] })
    expect(cartaoDoCatalogo(aba('vantagens'), SISTEMA_ONE_PIECE, pericia).atributos).toEqual([])
  })

  it('aba sem campo "descricao": a descrição vai ao primeiro parágrafo do cartão', () => {
    const outra: AbaDoSistema = { id: 'vantagens', nome: 'Dons', item: 'Dom', vazio: '', campos: [{ id: 'texto', rotulo: 'Texto', forma: 'paragrafo' }] }
    expect(cartaoDoCatalogo(outra, SISTEMA_ONE_PIECE, { nome: 'Sorte', descricao: 'Muita.', efeito: '+1' }).campos).toEqual({ texto: 'Muita.' })
  })
})

describe('o livro na mesa: resumo e sistema sem livro', () => {
  it('o resumo do One Piece: 14 capítulos e os 5 catálogos', () => {
    expect(resumoDoLivro(SISTEMA_ONE_PIECE)).toEqual({ capitulos: 14, catalogos: ['pericias', 'vantagens', 'desvantagens', 'racas', 'oficios'] })
    expect(temLivro(SISTEMA_ONE_PIECE)).toBe(true)
  })

  it('sistema sem livro nem catálogo: sem resumo', () => {
    const semLivro = sistemaSemLivro(SISTEMA_ONE_PIECE)
    expect(resumoDoLivro(semLivro)).toBeNull()
    expect(temLivro(semLivro)).toBe(false)
  })

  it('o sistema sem livro tem todo o resto, e é muito menor', () => {
    const semLivro: SistemaDeRpg = sistemaSemLivro(SISTEMA_ONE_PIECE)
    expect('livro' in semLivro || 'catalogos' in semLivro).toBe(false)
    expect(semLivro.abas).toBe(SISTEMA_ONE_PIECE.abas)
    expect(JSON.stringify(semLivro).length * 10).toBeLessThan(JSON.stringify(SISTEMA_ONE_PIECE).length)
  })
})

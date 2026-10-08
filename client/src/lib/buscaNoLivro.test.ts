/**
 * BUSCA DO LIVRO: acha sem ligar para acento nem maiúscula, nos capítulos e
 * nos catálogos, e mostra o trecho do ORIGINAL (com acento) em volta do achado.
 */
import { describe, expect, it } from 'vitest'
import { BUSCA_MAX_POR_GRUPO, buscarNoLivro, filtrarItens, indexarLivro, indexarTexto, normalizarParaBusca, partesComDestaque } from './buscaNoLivro'
import type { CapituloDoLivro, CatalogosDoSistema } from './sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'

const LIVRO: CapituloDoLivro[] = [
  { id: 'combate', titulo: 'Ações de combate', ordem: 1, texto: '## AÇÃO COMPLETA\nUma **ação completa** exige o turno todo.\n\nAção bônus: rápida.' },
  { id: 'pericias', titulo: 'Perícias', ordem: 2, texto: 'Cada perícia ajuda numa rolagem.\nA PERÍCIA certa reduz a CD.' },
]
const CATALOGOS: CatalogosDoSistema = {
  pericias: [{ nome: 'Caça', descricao: 'Rastrear presas na mata.', atributos: ['percepcao'] }],
  vantagens: [{ nome: 'Acrobata', descricao: 'Equilíbrio de circo.', efeito: 'Vantagem em testes de Acrobacia.' }],
  desvantagens: [{ nome: 'Amnésia', descricao: 'Esquece tudo.', efeito: 'Desvantagem em Intuição.' }],
  racas: [{ nome: 'Ogro', descricao: 'Gigantes antigos.' }],
  oficios: [{ nome: 'Médico' }],
}

describe('busca: normalização', () => {
  it('sem acento, minúsculo, espaços juntos', () => {
    expect(normalizarParaBusca('  AÇÃO   Bônus\n\nÉpica ')).toBe('acao bonus epica')
  })

  it('o índice lembra de onde veio cada unidade do texto normalizado, emoji incluído', () => {
    const indexado = indexarTexto('Ação\n\n  İ 😀 fim')
    expect(indexado.normalizado).toBe('acao i 😀 fim')
    expect(indexado.posicoes).toHaveLength(indexado.normalizado.length)
    // "fim" começa depois do emoji (2 unidades) no original.
    expect(indexado.posicoes[indexado.normalizado.indexOf('fim')]).toBe('Ação\n\n  İ 😀 '.length)
  })
})

describe('busca: no livro', () => {
  const indice = indexarLivro(LIVRO, CATALOGOS)

  it('"pericia" acha "Perícias" (título primeiro) e conta as ocorrências sem acento nem maiúscula', () => {
    const resultado = buscarNoLivro(indice, 'pericia')
    expect(resultado.capitulos.map((a) => [a.capitulo.id, a.noTitulo, a.ocorrencias])).toEqual([['pericias', true, 2]])
  })

  it('o trecho mostrado é o do original, com acento, e ignora a marcação', () => {
    const [achado] = buscarNoLivro(indice, 'acao completa').capitulos
    expect(achado?.trecho?.achado).toBe('AÇÃO COMPLETA')
    expect(achado?.trecho?.depois).toContain('Uma ação completa exige')
  })

  it('a frase atravessa quebra de linha', () => {
    expect(buscarNoLivro(indice, 'turno todo. acao bonus').capitulos.map((a) => a.capitulo.id)).toEqual(['combate'])
  })

  it('acha nos catálogos pelo nome e pelo texto (descrição ou efeito), nome primeiro', () => {
    const resultado = buscarNoLivro(indice, 'ACROBA')
    expect(resultado.itens.map((a) => [a.chave, a.item.nome, a.noNome])).toEqual([['vantagens', 'Acrobata', true]])
    expect(buscarNoLivro(indice, 'intuicao').itens.map((a) => a.item.nome)).toEqual(['Amnésia'])
    expect(buscarNoLivro(indice, 'gigantes').itens.map((a) => a.chave)).toEqual(['racas'])
  })

  it('consulta curta demais não busca; consulta sem achado devolve vazio', () => {
    expect(buscarNoLivro(indice, ' a ')).toEqual({ consulta: '', capitulos: [], itens: [] })
    expect(buscarNoLivro(indice, 'zzzz')).toMatchObject({ consulta: 'zzzz', capitulos: [], itens: [] })
  })

  it(`no máximo ${BUSCA_MAX_POR_GRUPO} achados por grupo`, () => {
    const muitos = Array.from({ length: BUSCA_MAX_POR_GRUPO + 10 }, (_, i) => ({ id: `c${i}`, titulo: `C${i}`, ordem: i, texto: 'dano' }))
    expect(buscarNoLivro(indexarLivro(muitos, undefined), 'dano').capitulos).toHaveLength(BUSCA_MAX_POR_GRUPO)
  })

  it('no livro do One Piece: "akuma" acha o capítulo da Akuma no Mi; "furtividade" acha a perícia', () => {
    const op = indexarLivro(SISTEMA_ONE_PIECE.livro ?? [], SISTEMA_ONE_PIECE.catalogos)
    expect(buscarNoLivro(op, 'akuma').capitulos[0]?.capitulo.id).toBe('akuma-no-mi')
    expect(buscarNoLivro(op, 'FURTIVIDADE').itens.some((a) => a.chave === 'pericias' && a.item.nome === 'Furtividade')).toBe(true)
  })
})

describe('busca: destaque e filtro', () => {
  it('as partes com destaque recompõem o texto, com os achados marcados no original', () => {
    const partes = partesComDestaque('Perícia, pericia e PERÍCIA.', 'pericia')
    expect(partes.map((p) => p.texto).join('')).toBe('Perícia, pericia e PERÍCIA.')
    expect(partes.filter((p) => p.achado).map((p) => p.texto)).toEqual(['Perícia', 'pericia', 'PERÍCIA'])
  })

  it('o filtro do catálogo: quem casa no nome vem antes de quem casa no texto', () => {
    const itens = [
      { nome: 'Sorte', descricao: 'Nada de caça.' },
      { nome: 'Caça', descricao: 'Rastrear.' },
    ]
    expect(filtrarItens(itens, 'caca').map((i) => i.nome)).toEqual(['Caça', 'Sorte'])
    expect(filtrarItens(itens, '').map((i) => i.nome)).toEqual(['Sorte', 'Caça'])
  })
})

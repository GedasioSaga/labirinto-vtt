import { describe, expect, it } from 'vitest'
import { lerSistemaDeRpg, lerSistemaDoTexto, rankDoValor, rotuloDoRank, serializarSistema, type SistemaDeRpg } from './sistemaDeRpg'
import { ID_ONE_PIECE, SISTEMA_ONE_PIECE } from './sistemaOnePiece'

/**
 * SISTEMA DE RPG: o rank do One Piece tem que bater com o projeto-rpg-v2
 * (src-tauri/src/domain/rank.rs), e o arquivo de sistema importado é lido com
 * tolerância — o que estiver torto sai, o que não dá para usar é recusado.
 */

function rankOnePiece(atributoId: string, valor: number): number | null {
  const atributo = SISTEMA_ONE_PIECE.atributos.find((candidato) => candidato.id === atributoId)
  if (atributo === undefined) throw new Error(`atributo ${atributoId} não existe no One Piece`)
  return rankDoValor(atributo.rank, valor)
}

/**
 * Pares [valor, rank] tirados à mão de rank.rs: o valor logo abaixo e logo no
 * limiar de cada ponta, um do meio e o teto. Cada linha é um `if valor < N`
 * de lá, lida sem passar pela tabela do código.
 */
const PONTAS: Record<string, [number, number][]> = {
  forca: [[0, 1], [39, 1], [40, 2], [89, 2], [90, 3], [319, 4], [320, 5], [1724, 7], [1725, 8], [2699, 9], [2700, 10], [99999, 10]],
  agilidade: [[32, 1], [33, 2], [59, 2], [60, 3], [314, 6], [315, 7], [949, 9], [950, 10]],
  percepcao: [[29, 1], [30, 2], [129, 3], [130, 4], [1124, 8], [1125, 9], [1499, 9], [1500, 10]],
  resistencia: [[-5, 0], [0, 0], [1, 1], [39, 1], [40, 2], [1619, 6], [1620, 7], [8249, 9], [8250, 10]],
  intuicao: [[29, 1], [30, 2], [274, 5], [275, 6], [359, 6], [360, 7], [1214, 9], [1215, 10]],
  espirito: [[0, 0], [1, 1], [34, 1], [35, 2], [1059, 9], [1060, 10], [1589, 10], [1590, 11], [2384, 11], [2385, 12], [2499, 12], [2500, 13], [10000, 13]],
  carisma: [[19, 1], [20, 2], [54, 2], [55, 3], [471, 8], [472, 9], [699, 9], [700, 10]],
  determinacao: [[15, 1], [16, 2], [194, 6], [195, 7], [659, 9], [660, 10], [1589, 10], [1590, 11], [2499, 12], [2500, 13]],
}

describe('rank do One Piece (rank.rs)', () => {
  it('tem os oito atributos na ordem da ficha, com as abreviações de lá', () => {
    expect(SISTEMA_ONE_PIECE.atributos.map((atributo) => atributo.id)).toEqual([
      'forca',
      'agilidade',
      'percepcao',
      'resistencia',
      'intuicao',
      'espirito',
      'carisma',
      'determinacao',
    ])
    expect(SISTEMA_ONE_PIECE.atributos.map((atributo) => atributo.abreviacao).join(' ')).toBe('FOR AGI PER RES INT ESP CAR DET')
  })

  for (const [atributo, pares] of Object.entries(PONTAS)) {
    it(`${atributo}: bate nas pontas de cada faixa`, () => {
      for (const [valor, rank] of pares) expect(rankOnePiece(atributo, valor), `${atributo} ${valor}`).toBe(rank)
    })
  }

  it('os casos dos testes de rank.rs', () => {
    expect(rankOnePiece('forca', 39)).toBe(1)
    expect(rankOnePiece('forca', 40)).toBe(2)
    expect(rankOnePiece('resistencia', 0)).toBe(0)
    expect(rankOnePiece('resistencia', 1)).toBe(1)
    expect(rankOnePiece('agilidade', 949)).toBe(9)
    expect(rankOnePiece('agilidade', 950)).toBe(10)
    expect(rankOnePiece('espirito', 2499)).toBe(12)
    expect(rankOnePiece('espirito', 2500)).toBe(13)
    expect(rankOnePiece('determinacao', 15)).toBe(1)
    expect(rankOnePiece('determinacao', 16)).toBe(2)
  })

  it('atributo sem tabela ou valor que não é número não tem rank', () => {
    expect(rankDoValor(undefined, 100)).toBeNull()
    expect(rankDoValor({ inicial: 1, limiares: [10] }, Number.NaN)).toBeNull()
  })

  it('o chip diz R e o número', () => {
    expect(rotuloDoRank(7)).toBe('R7')
    expect(rotuloDoRank(0)).toBe('R0')
  })

  it('raças, ofícios, recursos e abas do projeto-rpg-v2', () => {
    expect(SISTEMA_ONE_PIECE.escolhas.find((escolha) => escolha.id === 'raca')?.opcoes).toEqual(['Humano', 'Skypean', 'Tritão', 'Lunariano', 'Ogro', 'Mink'])
    expect(SISTEMA_ONE_PIECE.escolhas.find((escolha) => escolha.id === 'oficio')?.opcoes).toHaveLength(10)
    expect(SISTEMA_ONE_PIECE.recursos.map((recurso) => recurso.nome)).toEqual(['HP', 'SP', 'Escudo'])
    expect(SISTEMA_ONE_PIECE.abas.map((aba) => aba.nome)).toEqual(['Habilidades', 'Perícias', 'Vantagens', 'Desvantagens', 'Transformações'])
    const habilidades = SISTEMA_ONE_PIECE.abas[0]
    expect(habilidades.campos.filter((campo) => campo.forma === 'linha').map((campo) => campo.rotulo)).toEqual(['Ação', 'Efeito', 'Custo', 'Tempo', 'Dano'])
  })
})

describe('lerSistemaDeRpg', () => {
  it('o One Piece embutido passa pela leitura sem perder nada (o formato é o mesmo de um arquivo)', () => {
    const lido = lerSistemaDoTexto(serializarSistema(SISTEMA_ONE_PIECE))
    expect(lido).toEqual({ ok: true, sistema: SISTEMA_ONE_PIECE })
  })

  it('recusa com a razão o que não dá para usar', () => {
    expect(lerSistemaDoTexto('{nao é json')).toMatchObject({ ok: false })
    expect(lerSistemaDeRpg([])).toMatchObject({ ok: false })
    expect(lerSistemaDeRpg({ id: '../fora', nome: 'X', atributos: [{ id: 'a' }] })).toMatchObject({ ok: false, erro: expect.stringContaining('id') })
    expect(lerSistemaDeRpg({ id: 'x', nome: '  ', atributos: [{ id: 'a' }] })).toMatchObject({ ok: false, erro: expect.stringContaining('nome') })
    expect(lerSistemaDeRpg({ id: 'x', nome: 'X', atributos: [] })).toMatchObject({ ok: false, erro: expect.stringContaining('atributo') })
    expect(lerSistemaDeRpg({ formato: 9, id: 'x', nome: 'X', atributos: [{ id: 'a' }] })).toMatchObject({ ok: false, erro: expect.stringContaining('formato 9') })
  })

  it('tolera o torto: item sem id sai, repetido sai, tabela torta vira "sem rank", tom e forma desconhecidos voltam ao padrão', () => {
    const lido = lerSistemaDeRpg({
      id: 'casa',
      nome: 'Sistema da Casa',
      cor: 'vermelho',
      atributos: [
        { id: 'for', nome: 'Força', rank: { inicial: 1, limiares: [30, 10, 20] } },
        { id: 'for', nome: 'Repetida' },
        { nome: 'Sem id' },
        { id: 'des', nome: 'Destreza', rank: { inicial: 1, limiares: [10, 'muito'] } },
      ],
      recursos: [{ id: 'pv', nome: 'PV', tom: 'roxo' }],
      escolhas: [{ id: 'classe', rotulo: 'Classe', opcoes: ['Guerreiro', '', 'Guerreiro', 3] }],
      abas: [
        { id: 'magias', nome: 'Magias', campos: [{ id: 'nivel', rotulo: 'Nível', forma: 'enorme' }], extras: 'sim', subcartoes: { aba: 'inexistente', rotulo: 'X' } },
      ],
    })
    if (!lido.ok) throw new Error(lido.erro)
    const sistema: SistemaDeRpg = lido.sistema
    expect(sistema.cor).toBe('#7a6a52')
    expect(sistema.atributos.map((atributo) => atributo.id)).toEqual(['for', 'des'])
    expect(sistema.atributos[0].rank).toEqual({ inicial: 1, limiares: [10, 20, 30] })
    expect(sistema.atributos[1].rank).toBeUndefined()
    expect(sistema.atributos[1].abreviacao).toBe('DES')
    expect(sistema.recursos).toEqual([{ id: 'pv', nome: 'PV', tom: 'neutro' }])
    expect(sistema.escolhas[0].opcoes).toEqual(['Guerreiro'])
    expect(sistema.abas[0]).toEqual({ id: 'magias', nome: 'Magias', item: 'Magias', vazio: 'Nada em Magias.', campos: [{ id: 'nivel', rotulo: 'Nível', forma: 'linha' }] })
  })

  it('o id do One Piece é o que a aventura grava', () => {
    expect(SISTEMA_ONE_PIECE.id).toBe(ID_ONE_PIECE)
  })
})

/**
 * LIVRO DE REGRAS no formato do sistema: leitura tolerante (o torto sai, o
 * sistema fica), tetos de tamanho, e o livro do One Piece com os totais que a
 * migration 0013 do projeto-rpg-v2 promete (47 perícias = 35 + 12; 30
 * vantagens; 47 desvantagens).
 */
import { describe, expect, it } from 'vitest'
import { PERSONAGEM_ROTULO_MAX, PERSONAGEM_TEXTO_MAX } from '../net/protocoloDoPersonagem'
import {
  CAPITULO_TEXTO_MAX,
  CAPITULO_TITULO_MAX,
  CATALOGO_ITENS_MAX,
  CATALOGO_NOME_MAX,
  CATALOGO_TEXTO_MAX,
  CATALOGOS_TEXTO_TOTAL_MAX,
  catalogosDoArquivo,
  idValido,
  LIVRO_CAPITULOS_MAX,
  LIVRO_TEXTO_TOTAL_MAX,
  lerSistemaDeRpg,
  lerSistemaDoTexto,
  livroDoArquivo,
  serializarSistema,
  type SistemaDeRpg,
} from './sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'

const BASE = { id: 'teste', nome: 'Teste', atributos: [{ id: 'forca', nome: 'Força' }, { id: 'agilidade', nome: 'Agilidade' }] }
const ATRIBUTOS = new Set(['forca', 'agilidade'])

function ler(extra: Record<string, unknown>): SistemaDeRpg {
  const lido = lerSistemaDeRpg({ ...BASE, ...extra })
  if (!lido.ok) throw new Error(lido.erro)
  return lido.sistema
}

describe('livro no formato: capítulos', () => {
  it('lê os capítulos em ordem de sumário; sem `ordem` vale a posição no arquivo', () => {
    const livro = livroDoArquivo([
      { id: 'b', titulo: 'B', ordem: 2, texto: 'bê' },
      { id: 'a', titulo: 'A', ordem: 1, texto: 'á' },
      { id: 'c', titulo: 'C', texto: 'cê' },
    ])
    expect(livro?.map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(livro?.find((c) => c.id === 'c')?.ordem).toBe(3)
  })

  it('capítulo sem id válido ou repetido sai; título vazio vira o id; o resto fica', () => {
    const livro = livroDoArquivo([{ titulo: 'sem id' }, { id: '../fora', texto: 'x' }, { id: 'um', titulo: '', texto: 'primeiro' }, { id: 'um', titulo: 'Outro', texto: 'segundo' }, 'lixo', null])
    expect(livro).toEqual([{ id: 'um', titulo: 'um', ordem: 3, texto: 'primeiro' }])
  })

  it('nada aproveitável, ou não-lista, é "sem livro"', () => {
    expect(livroDoArquivo([])).toBeUndefined()
    expect(livroDoArquivo([{ titulo: 'sem id' }])).toBeUndefined()
    expect(livroDoArquivo({ id: 'x' })).toBeUndefined()
    expect(livroDoArquivo('texto')).toBeUndefined()
  })

  it('título e texto acima do teto são cortados, sem partir emoji ao meio', () => {
    const [capitulo] = livroDoArquivo([{ id: 'grande', titulo: 't'.repeat(CAPITULO_TITULO_MAX + 50), texto: `${'a'.repeat(CAPITULO_TEXTO_MAX - 1)}😀resto` }]) ?? []
    expect(capitulo?.titulo).toHaveLength(CAPITULO_TITULO_MAX)
    // O emoji (2 unidades) começaria na última posição: sai inteiro, em vez de deixar meia letra.
    expect(capitulo?.texto).toHaveLength(CAPITULO_TEXTO_MAX - 1)
    expect(capitulo?.texto.endsWith('a')).toBe(true)
  })

  it(`no máximo ${LIVRO_CAPITULOS_MAX} capítulos e ${LIVRO_TEXTO_TOTAL_MAX} caracteres no livro todo`, () => {
    const muitos = Array.from({ length: LIVRO_CAPITULOS_MAX + 20 }, (_, i) => ({ id: `c${i}`, titulo: `C${i}`, texto: 'x' }))
    expect(livroDoArquivo(muitos)).toHaveLength(LIVRO_CAPITULOS_MAX)
    const pesados = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, texto: 'y'.repeat(CAPITULO_TEXTO_MAX) }))
    const lidos = livroDoArquivo(pesados) ?? []
    expect(lidos.reduce((n, c) => n + c.texto.length, 0)).toBeLessThanOrEqual(LIVRO_TEXTO_TOTAL_MAX)
    expect(lidos.map((c) => c.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'])
  })
})

describe('livro no formato: catálogos', () => {
  it('perícia guarda só atributos que o sistema tem; vantagem e desvantagem guardam o efeito', () => {
    const catalogos = catalogosDoArquivo(
      {
        pericias: [{ nome: 'Atletismo', descricao: 'Correr.', atributos: ['forca', 'carisma', '__proto__', 'forca', 7] }],
        vantagens: [{ nome: 'Acrobata', descricao: 'Equilíbrio.', efeito: 'Vantagem em Acrobacia.' }],
        desvantagens: [{ nome: 'Amnésia', efeito: 3 }],
      },
      ATRIBUTOS,
    )
    expect(catalogos?.pericias).toEqual([{ nome: 'Atletismo', descricao: 'Correr.', atributos: ['forca'] }])
    expect(catalogos?.vantagens).toEqual([{ nome: 'Acrobata', descricao: 'Equilíbrio.', efeito: 'Vantagem em Acrobacia.' }])
    expect(catalogos?.desvantagens).toEqual([{ nome: 'Amnésia', descricao: '', efeito: '' }])
    expect(catalogos?.racas).toEqual([])
  })

  it('raça e ofício: descrição só quando há', () => {
    const catalogos = catalogosDoArquivo({ racas: [{ nome: 'Humano', descricao: 'Comum.' }, { nome: 'Ogro', descricao: '  ' }], oficios: [{ nome: 'Médico' }] }, ATRIBUTOS)
    expect(catalogos?.racas).toEqual([{ nome: 'Humano', descricao: 'Comum.' }, { nome: 'Ogro' }])
    expect(catalogos?.oficios).toEqual([{ nome: 'Médico' }])
  })

  it('item sem nome sai; nome repetido (sem ligar para maiúscula) fica só o primeiro', () => {
    const catalogos = catalogosDoArquivo({ vantagens: [{ descricao: 'sem nome' }, { nome: 'Sorte', efeito: '1' }, { nome: 'SORTE', efeito: '2' }, 'lixo'] }, ATRIBUTOS)
    expect(catalogos?.vantagens.map((v) => v.efeito)).toEqual(['1'])
  })

  it('os tetos do item são os do cartão da ficha: o escolhido sempre cabe no "Salvar" do jogador', () => {
    expect(CATALOGO_NOME_MAX).toBe(PERSONAGEM_ROTULO_MAX)
    expect(CATALOGO_TEXTO_MAX).toBe(PERSONAGEM_TEXTO_MAX)
    const catalogos = catalogosDoArquivo({ vantagens: [{ nome: 'n'.repeat(500), descricao: 'd'.repeat(20_000), efeito: 'e'.repeat(20_000) }] }, ATRIBUTOS)
    const [item] = catalogos?.vantagens ?? []
    expect(item?.nome).toHaveLength(CATALOGO_NOME_MAX)
    expect(item?.descricao).toHaveLength(CATALOGO_TEXTO_MAX)
    expect(item?.efeito).toHaveLength(CATALOGO_TEXTO_MAX)
  })

  it(`no máximo ${CATALOGO_ITENS_MAX} itens por catálogo e ${CATALOGOS_TEXTO_TOTAL_MAX} caracteres em todos`, () => {
    const muitos = Array.from({ length: CATALOGO_ITENS_MAX + 30 }, (_, i) => ({ nome: `P${i}` }))
    expect(catalogosDoArquivo({ pericias: muitos }, ATRIBUTOS)?.pericias).toHaveLength(CATALOGO_ITENS_MAX)
    const pesados = Array.from({ length: 100 }, (_, i) => ({ nome: `V${i}`, descricao: 'd'.repeat(CATALOGO_TEXTO_MAX), efeito: 'e'.repeat(CATALOGO_TEXTO_MAX) }))
    const lidos = catalogosDoArquivo({ vantagens: pesados }, ATRIBUTOS)?.vantagens ?? []
    expect(lidos.reduce((n, v) => n + v.nome.length + v.descricao.length + v.efeito.length, 0)).toBeLessThanOrEqual(CATALOGOS_TEXTO_TOTAL_MAX)
    expect(lidos.length).toBeLessThan(100)
  })

  it('tudo vazio, ou não-objeto, é "sem catálogo"', () => {
    expect(catalogosDoArquivo({}, ATRIBUTOS)).toBeUndefined()
    expect(catalogosDoArquivo({ pericias: [] }, ATRIBUTOS)).toBeUndefined()
    expect(catalogosDoArquivo([], ATRIBUTOS)).toBeUndefined()
  })
})

describe('livro no sistema', () => {
  it('livro e catálogos tortos não recusam o sistema: ele só fica sem eles', () => {
    const sistema = ler({ livro: 'não é lista', catalogos: 42 })
    expect(sistema.livro).toBeUndefined()
    expect(sistema.catalogos).toBeUndefined()
    expect('livro' in sistema).toBe(false)
  })

  it('o sistema com livro vai e volta pelo arquivo igual', () => {
    const lido = lerSistemaDoTexto(serializarSistema(SISTEMA_ONE_PIECE))
    expect(lido.ok && lido.sistema).toEqual(SISTEMA_ONE_PIECE)
  })
})

describe('One Piece: o livro portado do projeto-rpg-v2', () => {
  const { livro, catalogos } = SISTEMA_ONE_PIECE

  it('14 capítulos: as notas de regra que lá viram "REGRAS DO SISTEMA", na mesma ordem', () => {
    expect(livro?.map((c) => c.titulo)).toEqual([
      'Mecânicas',
      'Status',
      'Ações de combate',
      'Ofícios',
      'Perícias',
      'Vantagens',
      'Desvantagens',
      'Akuma no Mi',
      'Raça: Humano',
      'Raça: Skypean',
      'Raça: Tritão',
      'Raça: Lunariano',
      'Raça: Ogro',
      'Raça: Mink',
    ])
    for (const capitulo of livro ?? []) {
      expect(idValido(capitulo.id)).toBe(true)
      expect(capitulo.texto.length).toBeGreaterThan(500)
    }
  })

  it('catálogos: 47 perícias (35 + 12 da 0013), 30 vantagens, 47 desvantagens, 6 raças, 10 ofícios', () => {
    expect(catalogos?.pericias).toHaveLength(47)
    expect(catalogos?.vantagens).toHaveLength(30)
    expect(catalogos?.desvantagens).toHaveLength(47)
    expect(catalogos?.racas.map((r) => r.nome)).toEqual(SISTEMA_ONE_PIECE.escolhas.find((e) => e.id === 'raca')?.opcoes)
    expect(catalogos?.oficios.map((o) => o.nome)).toEqual(SISTEMA_ONE_PIECE.escolhas.find((e) => e.id === 'oficio')?.opcoes)
  })

  it('as 12 perícias novas da migration 0013 estão lá, e toda perícia responde a um atributo do sistema', () => {
    const nomes = new Set(catalogos?.pericias.map((p) => p.nome))
    const novas = ['Criação de Projéteis', 'Meteorologia', 'Natação', 'Pintura', 'Sedução', 'Veterinária', 'Zoologia', 'Cirurgia', 'Lógica', 'Química', 'Criptografia', 'Instrumentos Musicais']
    expect(novas.filter((nova) => !nomes.has(nova))).toEqual([])
    const ids = new Set(SISTEMA_ONE_PIECE.atributos.map((a) => a.id))
    for (const pericia of catalogos?.pericias ?? []) {
      expect(pericia.atributos.length).toBeGreaterThan(0)
      expect(pericia.atributos.every((id) => ids.has(id))).toBe(true)
    }
  })

  it('nada passa dos tetos: o livro embutido é lido pelo leitor de arquivo sem perder nada', () => {
    const lido = lerSistemaDeRpg(JSON.parse(serializarSistema(SISTEMA_ONE_PIECE)))
    expect(lido.ok && lido.sistema.livro).toEqual(livro)
    expect(lido.ok && lido.sistema.catalogos).toEqual(catalogos)
  })
})

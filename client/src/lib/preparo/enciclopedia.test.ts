/**
 * PRELÚDIO F2b: a busca do Ctrl+K, o "Citado em" e as árvores da Enciclopédia
 * e da Escrita. Dados inventados (o repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { IndiceDeCitacoes, arvoreDe, buscar, ehDaEscrita, entradaDaBusca, verbeteNovo } from './enciclopedia'
import type { TextoRico, TipoDeVerbete, Verbete } from './tipos'

type Pedaco = string | { readonly mencao: string; readonly rotulo: string }

function texto(...pedacos: Pedaco[]): TextoRico {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: pedacos.map((pedaco) => (typeof pedaco === 'string' ? { type: 'text', text: pedaco } : { type: 'mencao', attrs: { verbeteId: pedaco.mencao, rotulo: pedaco.rotulo } })),
      },
    ],
  }
}

interface Molde {
  readonly id: string
  readonly tipo?: TipoDeVerbete
  readonly titulo: string
  readonly apelidos?: readonly string[]
  readonly corpo?: TextoRico
  readonly paiId?: string
  readonly ordem?: number
  readonly quadroId?: string
}

function verbete({ id, tipo = 'personagem', titulo, apelidos = [], corpo, paiId, ordem, quadroId }: Molde): Verbete {
  const novo = verbeteNovo(tipo, titulo, { campanhas: ['camp-teste'], paiId, ordem }, () => id)
  const [forma] = novo.formas
  const secoes = forma === undefined ? [] : forma.secoes.map((secao, indice) => (indice === 0 && corpo !== undefined ? { ...secao, texto: corpo } : secao))
  const extras = quadroId === undefined ? novo.extras : { ...novo.extras, quadroId }
  return { ...novo, apelidos: [...apelidos], formas: forma === undefined ? [] : [{ ...forma, secoes }], ...(extras === undefined ? {} : { extras }) }
}

const porId = (lista: readonly Verbete[]) => new Map(lista.map((item) => [item.id, item]))

describe('buscar', () => {
  it('acha sem acento nem caixa e devolve o trecho como foi escrito', () => {
    const vila = verbete({ id: 'vb-vila', tipo: 'lugar', titulo: 'Vila do Vento', corpo: texto('Na praça mora o ferreiro Sebastião Corvo, que forja âncoras para o porto.') })
    const [achado] = buscar([entradaDaBusca(vila)], 'SEBASTIAO')
    expect(achado).toMatchObject({ id: 'vb-vila', onde: 'texto' })
    expect(achado?.trecho?.achado).toBe('Sebastião')
    expect(achado?.trecho?.antes).toBe('Na praça mora o ferreiro ')
    expect(achado?.trecho?.depois).toBe(' Corvo, que forja âncoras para o porto.')
    // Todas as palavras precisam estar lá, em qualquer ordem.
    expect(buscar([entradaDaBusca(vila)], 'ancoras ferreiro')).toHaveLength(1)
    expect(buscar([entradaDaBusca(vila)], 'ancoras dragao')).toHaveLength(0)
  })

  it('põe título que começa antes de título que contém, depois apelido, depois texto', () => {
    const entradas = [
      verbete({ id: 'vb-texto', titulo: 'Aurora', corpo: texto('Fala sempre da maré baixa.') }),
      verbete({ id: 'vb-apelido', titulo: 'Bruna', apelidos: ['Senhora da Maré'] }),
      verbete({ id: 'vb-contem', titulo: 'Cais da Maré' }),
      verbete({ id: 'vb-comeca', titulo: 'Maré Vermelha' }),
    ].map((item) => entradaDaBusca(item))
    expect(buscar(entradas, 'mare').map((achado) => [achado.id, achado.onde])).toEqual([
      ['vb-comeca', 'titulo'],
      ['vb-contem', 'titulo'],
      ['vb-apelido', 'apelido'],
      ['vb-texto', 'texto'],
    ])
    expect(buscar(entradas, '   ')).toEqual([])
  })
})

describe('IndiceDeCitacoes', () => {
  it('acrescenta e tira quem cita conforme o texto muda', () => {
    const alvo = verbete({ id: 'vb-alvo', titulo: 'Capitã Lume' })
    const citador = verbete({ id: 'vb-citador', titulo: 'Diário', corpo: texto('Conheci ', { mencao: 'vb-alvo', rotulo: 'Capitã Lume' }, ' ontem.') })
    const indice = new IndiceDeCitacoes([alvo, citador])
    expect(indice.citadoEm('vb-alvo')).toEqual(['vb-citador'])
    indice.atualizar(verbete({ id: 'vb-citador', titulo: 'Diário', corpo: texto('Não conheci ninguém.') }))
    expect(indice.citadoEm('vb-alvo')).toEqual([])
  })

  it('ignora o verbete que menciona a si mesmo', () => {
    const sozinho = verbete({ id: 'vb-eco', titulo: 'Eco', corpo: texto('Eu sou ', { mencao: 'vb-eco', rotulo: 'Eco' }) })
    expect(new IndiceDeCitacoes([sozinho]).citadoEm('vb-eco')).toEqual([])
  })
})

describe('arvoreDe', () => {
  it('ordena as irmãs pela ordem do Grimório e, sem ela, pelo título', () => {
    const lista = [
      verbete({ id: 'pg-raiz', tipo: 'pagina', titulo: 'Caderno' }),
      verbete({ id: 'pg-z', tipo: 'pagina', titulo: 'Zebra', paiId: 'pg-raiz' }),
      verbete({ id: 'pg-b', tipo: 'pagina', titulo: 'Beta', paiId: 'pg-raiz', ordem: 2 }),
      verbete({ id: 'pg-a', tipo: 'pagina', titulo: 'Alfa', paiId: 'pg-raiz' }),
      verbete({ id: 'pg-c', tipo: 'pagina', titulo: 'Gama', paiId: 'pg-raiz', ordem: 1 }),
    ]
    const [raiz] = arvoreDe(lista)
    expect(raiz?.filhos.map((no) => no.verbete.id)).toEqual(['pg-c', 'pg-b', 'pg-a', 'pg-z'])
  })

  it('não trava nem some com laço ou pai que não existe: viram raízes', () => {
    const lista = [
      verbete({ id: 'vb-a', tipo: 'lugar', titulo: 'Ilha A', paiId: 'vb-b' }),
      verbete({ id: 'vb-b', tipo: 'lugar', titulo: 'Ilha B', paiId: 'vb-a' }),
      verbete({ id: 'vb-orfa', tipo: 'lugar', titulo: 'Ilha Órfã', paiId: 'vb-apagado' }),
      verbete({ id: 'vb-dentro', tipo: 'lugar', titulo: 'Gruta', paiId: 'vb-a' }),
    ]
    const arvore = arvoreDe(lista)
    expect(arvore.map((no) => no.verbete.id)).toEqual(['vb-a', 'vb-b', 'vb-orfa'])
    expect(arvore[0]?.filhos.map((no) => no.verbete.id)).toEqual(['vb-dentro'])
  })
})

describe('ehDaEscrita', () => {
  it('fica com o caderno livre e deixa de fora a página de sessão e a de quadro', () => {
    const lista = [
      verbete({ id: 'pg-caderno', tipo: 'pagina', titulo: 'Ideias' }),
      verbete({ id: 'pg-sub', tipo: 'pagina', titulo: 'Sobre o mar', paiId: 'pg-caderno' }),
      verbete({ id: 'vb-sessao', tipo: 'sessao', titulo: 'Sessão 1' }),
      verbete({ id: 'pg-da-sessao', tipo: 'pagina', titulo: 'Roteiro', paiId: 'vb-sessao' }),
      verbete({ id: 'pg-quadro', tipo: 'pagina', titulo: 'Quadro do porto', quadroId: 'qd-porto' }),
      verbete({ id: 'pg-no-quadro', tipo: 'pagina', titulo: 'Pista', paiId: 'pg-quadro' }),
    ]
    const mapa = porId(lista)
    const daEscrita = lista.filter((item) => ehDaEscrita(item, mapa)).map((item) => item.id)
    expect(daEscrita).toEqual(['pg-caderno', 'pg-sub'])
  })

  it('mantém na Escrita a página cuja sessão foi apagada', () => {
    const solta = verbete({ id: 'pg-solta', tipo: 'pagina', titulo: 'Sobrou', paiId: 'vb-sessao-apagada' })
    expect(ehDaEscrita(solta, porId([solta]))).toBe(true)
  })
})

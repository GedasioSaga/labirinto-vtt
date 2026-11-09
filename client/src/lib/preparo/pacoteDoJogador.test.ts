/**
 * PRELÚDIO F2c: o filtro do revelado (o pacote do jogador) e o arquivo do
 * revelado. Testes liberados com casos completos (resposta do mestre, 08/11):
 * aqui um erro é segredo vazado. Dados inventados (o repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { montarPacoteDoJogador, type NoDoPacote, type PacoteDoJogador } from './pacoteDoJogador'
import { alvoDaForma, alvoDaLigacao, alvoDaSecao, alvoDoVerbete, comRevelacoes, paraDe, revelacoesPorAlvo, reveladoVazio, type ParaQuem } from './revelado'
import type { AlvoDaRevelacao, Forma, Ligacao, Revelacao, Revelado, Secao, TextoRico, TipoDeVerbete, Verbete } from './tipos'

const SEGREDO = 'SEGREDO-XYZ'
const MAR = 'camp-mar'
const OUTRA = 'camp-outra'
const ANA = 'conta-ana'
const BIA = 'conta-bia'
const QUANDO = '2026-11-09T12:00:00.000Z'

const midia = (letra: string, extensao = 'png') => `midia/${letra.repeat(64)}.${extensao}`

// ─── Montagem dos dados ──────────────────────────────────────────────────────

const doc = (...blocos: unknown[]): TextoRico => ({ type: 'doc', content: blocos })
const p = (...filhos: unknown[]) => ({ type: 'paragraph', content: filhos })
const t = (text: string, marks?: unknown[]) => (marks === undefined ? { type: 'text', text } : { type: 'text', text, marks })
const mencao = (verbeteId: string, rotulo: string) => ({ type: 'mencao', attrs: { verbeteId, rotulo } })

function secao(id: string, titulo: string, texto: TextoRico, opcoes: { segredo?: boolean; extras?: Record<string, unknown> } = {}): Secao {
  const base: Secao = { id, titulo, texto, segredo: opcoes.segredo ?? false }
  return opcoes.extras === undefined ? base : { ...base, extras: opcoes.extras }
}

function forma(id: string, nome: string, secoes: Secao[], opcoes: Partial<Pick<Forma, 'retrato' | 'resumo' | 'imagens'>> = {}): Forma {
  const base: Forma = { id, nome, resumo: opcoes.resumo ?? '', secoes, imagens: opcoes.imagens ?? [] }
  return opcoes.retrato === undefined ? base : { ...base, retrato: opcoes.retrato }
}

interface MoldeDoVerbete {
  readonly id: string
  readonly titulo: string
  readonly tipo?: TipoDeVerbete
  readonly campanhas?: string[]
  readonly formas?: Forma[]
  readonly apelidos?: string[]
  readonly paiId?: string
  readonly formato?: number
  readonly resto?: Partial<Verbete>
}

function verbete({ id, titulo, tipo = 'personagem', campanhas = [MAR], formas = [], apelidos = [], paiId, formato = 1, resto = {} }: MoldeDoVerbete): Verbete {
  const lista = formas.length > 0 ? formas : [forma(`${id}-f`, titulo, [])]
  const base: Verbete = { formato, id, tipo, titulo, apelidos, campanhas, formas: lista, formaAtivaId: lista[0]?.id ?? '', ...resto }
  return paiId === undefined ? base : { ...base, paiId }
}

function revelacao(alvo: AlvoDaRevelacao, para: ParaQuem, extras?: Record<string, unknown>): Revelacao {
  const base: Revelacao = { alvo, para: para === 'todos' ? 'todos' : [...para], quando: QUANDO }
  return extras === undefined ? base : { ...base, extras }
}

function revelado(...revelacoes: Revelacao[]): Revelado {
  return { formato: 1, revelacoes }
}

function ligacao(id: string, de: string, para: string, opcoes: Partial<Pick<Ligacao, 'tipo' | 'notas' | 'segredo'>> = {}): Ligacao {
  return { id, de, para, tipo: opcoes.tipo ?? 'aliado', notas: opcoes.notas ?? '', segredo: opcoes.segredo ?? false }
}

/** Todos os nós de um texto do pacote, em profundidade. */
function nosDe(nos: readonly NoDoPacote[]): NoDoPacote[] {
  return nos.flatMap((no) => ('content' in no ? [no, ...nosDe(no.content)] : [no]))
}

function verbeteNoPacote(pacote: PacoteDoJogador, id: string) {
  return pacote.verbetes.find((outro) => outro.id === id)
}

// ─── O teste de vazamento ────────────────────────────────────────────────────

/**
 * Uma campanha inventada com SEGREDO-XYZ em todo lugar que não pode sair:
 * bloco, seção de segredo, seção não revelada, forma oculta (nome, resumo,
 * retrato, seção, legenda), apelido, extras, ligação com ficha, nome de
 * arquivo, alt, title e caminho antigo da imagem, rótulo velho da menção, id de
 * verbete oculto, ligação com a mesa, ligações (secreta, com ponta oculta, não
 * revelada), nó e marca desconhecidos, link javascript, sessão, outra
 * campanha, formato mais novo, revelação com chave desconhecida e alvo sem escopo.
 */
function campanhaComSegredos() {
  const capitao = verbete({
    id: 'vb-capitao',
    titulo: 'Capitão Nuvem',
    apelidos: [`${SEGREDO} apelido`],
    resto: {
      extras: { notaDoMestre: `${SEGREDO} extras do verbete` },
      liga: { fichas: [{ pastaId: `${SEGREDO}-pasta`, personagemId: `${SEGREDO}-ficha` }], cenas: [{ chave: `${SEGREDO}-mapa`, sceneId: 'cena-1' }] },
      cartaz: { recompensas: [{ valor: 1000, moeda: 'berries', quando: 'arco 1' }], situacao: 'vivo', crime: `${SEGREDO} crime` },
      organizacao: [`${SEGREDO} organização`],
    },
    formas: [
      forma(
        'forma-1',
        'Capitão Nuvem',
        [
          secao(
            'secao-a',
            'Descrição',
            doc(
              p(t('Texto VISIVEL '), mencao('vb-imediato', `${SEGREDO} rótulo antigo`), t(' e '), mencao(`vb-${SEGREDO}`, 'Sombra'), t(' e '), mencao('vb-apagado', 'Fantasma')),
              p(t('Rumo a '), { type: 'ligacaoMesa', attrs: { alvo: { chave: `${SEGREDO}-mapa`, sceneId: 'cena-2', pinoId: `${SEGREDO}-pino` }, rotulo: `${SEGREDO} pino` } }),
              { type: 'segredo', content: [p(t(`${SEGREDO} bloco `), mencao('vb-imediato', 'Imediato Brisa'))] },
              { type: 'image', attrs: { midia: midia('c'), alt: `${SEGREDO} alt`, title: `${SEGREDO} title`, rel: `Imagens/${SEGREDO}.png`, legenda: 'Figura VISIVEL', largura: 320 } },
              { type: 'image', attrs: { midia: `midia/${SEGREDO}.png`, legenda: 'arquivo com nome' } },
              p(t('link perigoso', [{ type: 'link', attrs: { href: `javascript:alert('${SEGREDO}')`, target: '_blank' } }])),
              p(t(`${SEGREDO} marca desconhecida`, [{ type: 'segredoNaLinha' }])),
              { type: 'notaDoMestre', content: [p(t(`${SEGREDO} nó desconhecido`))] },
            ),
          ),
          secao('secao-b', 'Anotações', doc(p(t(`${SEGREDO} seção de segredo`))), { segredo: true }),
          secao('secao-c', 'História', doc(p(t(`${SEGREDO} seção não revelada`)))),
          secao('secao-d', 'Extra', doc(p(t(`${SEGREDO} seção com chave desconhecida`))), { extras: { soParaAlguns: true } }),
        ],
        {
          retrato: midia('a'),
          resumo: 'Resumo VISIVEL',
          imagens: [
            { midia: midia('b'), legenda: 'Legenda VISIVEL' },
            { midia: `midia/${SEGREDO}.png`, legenda: 'nome de arquivo' },
          ],
        },
      ),
      // O mesmo id de forma e de seção do Imediato: revelar a dele não revela esta.
      forma('forma-2', `${SEGREDO} forma`, [secao('secao-x', `${SEGREDO} título`, doc(p(t(`${SEGREDO} seção de forma oculta`))))], {
        retrato: midia('d'),
        resumo: `${SEGREDO} resumo`,
        imagens: [{ midia: midia('e'), legenda: `${SEGREDO} legenda` }],
      }),
    ],
  })
  const imediato = verbete({
    id: 'vb-imediato',
    titulo: 'Imediato Brisa',
    formas: [forma('forma-2', 'Imediato Brisa', [secao('secao-x', 'Quem é', doc(p(t('Brisa VISIVEL '), mencao('vb-capitao', 'Capitão Nuvem'))))])],
  })
  const oculto = verbete({
    id: `vb-${SEGREDO}`,
    titulo: 'Sombra',
    formas: [forma('forma-s', 'Sombra', [secao('secao-s', 'Plano', doc(p(t(`${SEGREDO} oculto `), mencao('vb-capitao', 'Capitão Nuvem'))))])],
  })
  const ilha = verbete({ id: `vb-${SEGREDO}-ilha`, titulo: 'Ilha', tipo: 'lugar' })
  const porto = verbete({ id: 'vb-porto', titulo: 'Porto VISIVEL', tipo: 'lugar', paiId: `vb-${SEGREDO}-ilha` })
  const sessao = verbete({ id: 'vb-sessao', titulo: `${SEGREDO} sessão`, tipo: 'sessao' })
  const deOutra = verbete({ id: 'vb-de-outra', titulo: `${SEGREDO} outra campanha`, campanhas: [OUTRA] })
  const futuro = verbete({ id: 'vb-futuro', titulo: `${SEGREDO} formato novo`, formato: 2 })

  const verbetes = [capitao, imediato, oculto, ilha, porto, sessao, deOutra, futuro]
  const ligacoes = [
    ligacao('lig-1', 'vb-capitao', 'vb-imediato', { notas: 'Ligação VISIVEL' }),
    ligacao('lig-2', 'vb-capitao', 'vb-imediato', { notas: `${SEGREDO} ligação de segredo`, segredo: true }),
    ligacao('lig-3', 'vb-capitao', `vb-${SEGREDO}`, { notas: `${SEGREDO} ponta oculta` }),
    ligacao('lig-4', 'vb-capitao', 'vb-imediato', { tipo: `${SEGREDO} tipo`, notas: `${SEGREDO} não revelada` }),
  ]
  const doMar = revelado(
    revelacao(alvoDoVerbete('vb-capitao'), 'todos'),
    revelacao(alvoDaForma('vb-capitao', 'forma-1'), 'todos'),
    revelacao(alvoDaSecao('vb-capitao', 'forma-1', 'secao-a'), 'todos'),
    revelacao(alvoDaSecao('vb-capitao', 'forma-1', 'secao-b'), 'todos'),
    revelacao(alvoDaSecao('vb-capitao', 'forma-1', 'secao-d'), 'todos'),
    revelacao(alvoDaSecao('vb-capitao', 'forma-2', 'secao-x'), 'todos'),
    revelacao(alvoDoVerbete('vb-imediato'), [ANA]),
    revelacao(alvoDaForma('vb-imediato', 'forma-2'), [ANA]),
    revelacao(alvoDaSecao('vb-imediato', 'forma-2', 'secao-x'), 'todos'),
    revelacao(alvoDoVerbete('vb-porto'), 'todos'),
    revelacao(alvoDaForma('vb-porto', 'vb-porto-f'), 'todos'),
    revelacao(alvoDoVerbete('vb-sessao'), 'todos'),
    revelacao(alvoDoVerbete('vb-de-outra'), 'todos'),
    revelacao(alvoDoVerbete('vb-futuro'), 'todos'),
    revelacao(alvoDaLigacao('lig-1'), 'todos'),
    revelacao(alvoDaLigacao('lig-2'), 'todos'),
    revelacao(alvoDaLigacao('lig-3'), 'todos'),
    // Chave desconhecida (um prazo de uma versão mais nova): não vale.
    revelacao(alvoDoVerbete(`vb-${SEGREDO}`), 'todos', { ate: '2020-01-01' }),
    // Forma sem o verbete no alvo: não vale (senão revelaria a "forma-2" de todo mundo).
    revelacao({ tipo: 'forma', id: 'forma-2' }, 'todos'),
  )
  return { verbetes, ligacoes, doMar }
}

describe('pacote do jogador: nenhum segredo sai', () => {
  const { verbetes, ligacoes, doMar } = campanhaComSegredos()
  const contas = [null, ANA, BIA, 'conta-que-nao-existe']
  // Cada campanha com o arquivo dela: na outra, o Capitão (que não é dela) revelado a todos.
  const doOutra = revelado(revelacao(alvoDoVerbete('vb-capitao'), 'todos'), revelacao(alvoDaForma('vb-capitao', 'forma-1'), 'todos'))
  const arquivos: ReadonlyArray<readonly [string, Revelado]> = [
    [MAR, doMar],
    [OUTRA, doOutra],
  ]
  const pacotes = arquivos.flatMap(([campanhaId, arquivo]) =>
    [arquivo, null, reveladoVazio()].flatMap((revelado) => contas.map((contaId) => montarPacoteDoJogador({ campanhaId, contaId, verbetes, revelado, ligacoes }))),
  )

  it('o texto de teste está mesmo em cada lugar perigoso da entrada', () => {
    const entrada = JSON.stringify({ verbetes, ligacoes, doMar })
    expect(entrada.split(SEGREDO).length - 1).toBeGreaterThanOrEqual(40)
  })

  it('SEGREDO-XYZ não aparece em nenhum pacote, de nenhum jogador, de nenhuma campanha', () => {
    expect(pacotes).toHaveLength(2 * 3 * 4)
    for (const pacote of pacotes) expect(JSON.stringify(pacote)).not.toContain(SEGREDO)
  })

  it('o revelado chega: o teste de cima não passa por pacote vazio', () => {
    const daAna = JSON.stringify(montarPacoteDoJogador({ campanhaId: MAR, contaId: ANA, verbetes, revelado: doMar, ligacoes }))
    for (const visivel of ['Texto VISIVEL', 'Figura VISIVEL', 'Legenda VISIVEL', 'Resumo VISIVEL', 'Brisa VISIVEL', 'Ligação VISIVEL', 'Porto VISIVEL', 'Sombra', 'Fantasma']) {
      expect(daAna).toContain(visivel)
    }
  })

  it('só sobem as imagens reveladas, e só pelo caminho do conteúdo', () => {
    const daAna = montarPacoteDoJogador({ campanhaId: MAR, contaId: ANA, verbetes, revelado: doMar, ligacoes })
    expect(daAna.midias).toEqual([midia('a'), midia('b'), midia('c')])
  })
})

// ─── O que cada um vê ────────────────────────────────────────────────────────

describe('pacote do jogador: quem vê o quê', () => {
  const { verbetes, ligacoes, doMar } = campanhaComSegredos()
  const pacoteDe = (contaId: string | null) => montarPacoteDoJogador({ campanhaId: MAR, contaId, verbetes, revelado: doMar, ligacoes })

  it('tudo nasce oculto: sem revelação, o pacote sai vazio', () => {
    const vazio = montarPacoteDoJogador({ campanhaId: MAR, contaId: ANA, verbetes, revelado: reveladoVazio(), ligacoes })
    expect(vazio).toEqual({ formato: 1, campanhaId: MAR, contaId: ANA, verbetes: [], ligacoes: [], midias: [] })
  })

  it('revelado a fulano: só fulano vê; o jogador qualquer e os outros não', () => {
    expect(pacoteDe(ANA).verbetes.map((v) => v.id)).toEqual(['vb-capitao', 'vb-imediato', 'vb-porto'])
    expect(pacoteDe(BIA).verbetes.map((v) => v.id)).toEqual(['vb-capitao', 'vb-porto'])
    expect(pacoteDe(null).verbetes.map((v) => v.id)).toEqual(['vb-capitao', 'vb-porto'])
  })

  it('revelar a forma de um verbete não revela a forma de mesmo id de outro', () => {
    const capitao = verbeteNoPacote(pacoteDe(ANA), 'vb-capitao')
    expect(capitao?.formas.map((f) => f.id)).toEqual(['forma-1'])
    expect(verbeteNoPacote(pacoteDe(ANA), 'vb-imediato')?.formas.map((f) => f.id)).toEqual(['forma-2'])
  })

  it('a seção sai só revelada, sem segredo e sem chave desconhecida; a forma leva nome, retrato, resumo e galeria', () => {
    const [forma1] = verbeteNoPacote(pacoteDe(BIA), 'vb-capitao')?.formas ?? []
    expect(forma1).toMatchObject({ id: 'forma-1', nome: 'Capitão Nuvem', retrato: midia('a'), resumo: 'Resumo VISIVEL', imagens: [{ midia: midia('b'), legenda: 'Legenda VISIVEL' }] })
    expect(forma1?.secoes.map((s) => s.id)).toEqual(['secao-a'])
  })

  it('verbete revelado sem forma revelada: só o nome e o tipo', () => {
    const so = montarPacoteDoJogador({ campanhaId: MAR, contaId: null, verbetes, revelado: revelado(revelacao(alvoDoVerbete('vb-capitao'), 'todos')) })
    expect(so.verbetes).toEqual([{ id: 'vb-capitao', tipo: 'personagem', titulo: 'Capitão Nuvem', formas: [], citadoEm: [] }])
  })

  it('o verbete sai sem apelidos, campanhas, ligação com ficha, cartaz e extras', () => {
    const capitao = verbeteNoPacote(pacoteDe(ANA), 'vb-capitao')
    expect(Object.keys(capitao ?? {}).sort()).toEqual(['citadoEm', 'formas', 'id', 'tipo', 'titulo'])
  })

  it('o pai só vai junto quando também está no pacote', () => {
    expect(verbeteNoPacote(pacoteDe(ANA), 'vb-porto')?.paiId).toBeUndefined()
    const comPai = montarPacoteDoJogador({
      campanhaId: MAR,
      contaId: ANA,
      verbetes,
      revelado: comRevelacoes(doMar, [{ alvo: alvoDoVerbete(`vb-${SEGREDO}-ilha`), para: 'todos' }], QUANDO),
    })
    expect(verbeteNoPacote(comPai, 'vb-porto')?.paiId).toBe(`vb-${SEGREDO}-ilha`)
  })

  it('sessão, outra campanha e formato mais novo nunca saem, mesmo revelados', () => {
    const ids = pacoteDe(ANA).verbetes.map((v) => v.id)
    for (const fora of ['vb-sessao', 'vb-de-outra', 'vb-futuro']) expect(ids).not.toContain(fora)
  })
})

describe('pacote do jogador: o texto', () => {
  const { verbetes, ligacoes, doMar } = campanhaComSegredos()
  const textoDoCapitao = (contaId: string | null) => {
    const pacote = montarPacoteDoJogador({ campanhaId: MAR, contaId, verbetes, revelado: doMar, ligacoes })
    return nosDe(verbeteNoPacote(pacote, 'vb-capitao')?.formas[0]?.secoes[0]?.texto.content ?? [])
  }

  it('menção a quem o jogador vê fica menção, com o nome de agora (nunca o rótulo velho)', () => {
    expect(textoDoCapitao(ANA)).toContainEqual({ type: 'mencao', attrs: { verbeteId: 'vb-imediato', rotulo: 'Imediato Brisa' } })
  })

  it('menção a quem o jogador não vê vira texto puro com o nome, sem o id; a apagada fica com o nome guardado', () => {
    const daBia = textoDoCapitao(BIA)
    expect(daBia.filter((no) => no.type === 'mencao')).toEqual([])
    expect(daBia).toContainEqual({ type: 'text', text: 'Imediato Brisa' })
    expect(daBia).toContainEqual({ type: 'text', text: 'Sombra' })
    expect(daBia).toContainEqual({ type: 'text', text: 'Fantasma' })
  })

  it('bloco de segredo, ligação com a mesa, nó e marca desconhecidos somem; o link perigoso perde o link e fica o texto', () => {
    const tipos = new Set(textoDoCapitao(ANA).map((no) => no.type))
    expect([...tipos].sort()).toEqual(['image', 'mencao', 'paragraph', 'text'])
    expect(textoDoCapitao(ANA)).toContainEqual({ type: 'text', text: 'link perigoso' })
    expect(textoDoCapitao(ANA)).toContainEqual({ type: 'text', text: 'Rumo a ' })
  })

  it('a imagem do texto sai só com o caminho do conteúdo e a legenda', () => {
    expect(textoDoCapitao(ANA).filter((no) => no.type === 'image')).toEqual([{ type: 'image', attrs: { midia: midia('c'), legenda: 'Figura VISIVEL', largura: 320, align: null } }])
  })

  it('link http, https e mailto ficam; o resto do link não', () => {
    const comLinks = verbete({
      id: 'vb-links',
      titulo: 'Links',
      formas: [
        forma('fl', 'Links', [
          secao('sl', '', doc(p(t('a', [{ type: 'link', attrs: { href: 'https://example.com/x', class: 'x' } }, { type: 'bold' }]), t('b', [{ type: 'link', attrs: { href: 'file:///C:/segredo.txt' } }])))),
        ]),
      ],
    })
    const pacote = montarPacoteDoJogador({
      campanhaId: MAR,
      contaId: null,
      verbetes: [comLinks],
      revelado: revelado(revelacao(alvoDoVerbete('vb-links'), 'todos'), revelacao(alvoDaForma('vb-links', 'fl'), 'todos'), revelacao(alvoDaSecao('vb-links', 'fl', 'sl'), 'todos')),
    })
    expect(nosDe(pacote.verbetes[0]?.formas[0]?.secoes[0]?.texto.content ?? []).filter((no) => no.type === 'text')).toEqual([
      { type: 'text', text: 'a', marks: [{ type: 'link', attrs: { href: 'https://example.com/x' } }, { type: 'bold' }] },
      { type: 'text', text: 'b' },
    ])
  })

  it('"Citado em" só com quem o jogador vê, e só pela menção que sobrou', () => {
    expect(verbeteNoPacote(montarPacoteDoJogador({ campanhaId: MAR, contaId: ANA, verbetes, revelado: doMar }), 'vb-capitao')?.citadoEm).toEqual(['vb-imediato'])
    expect(verbeteNoPacote(montarPacoteDoJogador({ campanhaId: MAR, contaId: BIA, verbetes, revelado: doMar }), 'vb-capitao')?.citadoEm).toEqual([])
    // A menção do Capitão ao Imediato está também dentro do bloco de segredo: ela não conta, só a do texto comum.
    expect(verbeteNoPacote(montarPacoteDoJogador({ campanhaId: MAR, contaId: ANA, verbetes, revelado: doMar }), 'vb-imediato')?.citadoEm).toEqual(['vb-capitao'])
  })

  it('a menção só no bloco de segredo não cita', () => {
    const semComum = revelado(
      revelacao(alvoDoVerbete('vb-oculto-cita'), 'todos'),
      revelacao(alvoDaForma('vb-oculto-cita', 'fo'), 'todos'),
      revelacao(alvoDaSecao('vb-oculto-cita', 'fo', 'so'), 'todos'),
      revelacao(alvoDoVerbete('vb-alvo'), 'todos'),
    )
    const quemCita = verbete({ id: 'vb-oculto-cita', titulo: 'Quem cita', formas: [forma('fo', 'Quem cita', [secao('so', '', doc({ type: 'segredo', content: [p(mencao('vb-alvo', 'Alvo'))] }))])] })
    const alvo = verbete({ id: 'vb-alvo', titulo: 'Alvo' })
    expect(verbeteNoPacote(montarPacoteDoJogador({ campanhaId: MAR, contaId: null, verbetes: [quemCita, alvo], revelado: semComum }), 'vb-alvo')?.citadoEm).toEqual([])
  })
})

describe('pacote do jogador: ligações', () => {
  const { verbetes, ligacoes, doMar } = campanhaComSegredos()

  it('só a revelada, sem segredo e com as duas pontas no pacote', () => {
    expect(montarPacoteDoJogador({ campanhaId: MAR, contaId: ANA, verbetes, revelado: doMar, ligacoes }).ligacoes).toEqual([
      { id: 'lig-1', de: 'vb-capitao', para: 'vb-imediato', tipo: 'aliado', notas: 'Ligação VISIVEL' },
    ])
    expect(montarPacoteDoJogador({ campanhaId: MAR, contaId: BIA, verbetes, revelado: doMar, ligacoes }).ligacoes).toEqual([])
  })
})

// ─── O arquivo do revelado ───────────────────────────────────────────────────

describe('revelado: o arquivo', () => {
  it('revelar troca a revelação do alvo, ocultar apaga, e o resto fica como está', () => {
    const estranha = revelacao(alvoDoVerbete('vb-x'), 'todos', { ate: 'amanhã' })
    const inicio = revelado(revelacao(alvoDoVerbete('vb-a'), 'todos'), estranha)
    const depois = comRevelacoes(
      inicio,
      [
        { alvo: alvoDoVerbete('vb-a'), para: [BIA, ANA, ANA] },
        { alvo: alvoDaSecao('vb-a', 'f', 's'), para: 'todos' },
        { alvo: alvoDaSecao('vb-a', 'f', 's'), para: null },
        { alvo: alvoDaForma('vb-a', 'f'), para: [] },
      ],
      QUANDO,
    )
    expect(depois.revelacoes).toEqual([estranha, { alvo: alvoDoVerbete('vb-a'), para: [ANA, BIA], quando: QUANDO }])
    expect(paraDe(revelacoesPorAlvo(depois), alvoDoVerbete('vb-a'))).toEqual([ANA, BIA])
    expect(paraDe(revelacoesPorAlvo(depois), alvoDoVerbete('vb-x'))).toBeNull()
  })

  it('formato mais novo não revela nada; repetida, vale a última; alvo torto lança', () => {
    expect(revelacoesPorAlvo({ formato: 2, revelacoes: [revelacao(alvoDoVerbete('vb-a'), 'todos')] }).size).toBe(0)
    const repetida = revelado(revelacao(alvoDoVerbete('vb-a'), 'todos'), revelacao(alvoDoVerbete('vb-a'), []))
    expect(paraDe(revelacoesPorAlvo(repetida), alvoDoVerbete('vb-a'))).toBeNull()
    expect(() => comRevelacoes(reveladoVazio(), [{ alvo: { tipo: 'secao', id: 's', verbeteId: 'vb-a' }, para: 'todos' }], QUANDO)).toThrow()
  })
})

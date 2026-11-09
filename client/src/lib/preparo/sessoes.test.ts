/**
 * PRELÚDIO F4: as sessões sem tela (o Revelar hoje, o "O que aconteceu" que
 * vira evento e os links do roteiro para a mesa). No máximo 2 casos por
 * situação; dados inventados (o repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { alvoDaForma, alvoDaSecao, alvoDoVerbete, revelacoesPorAlvo, reveladoVazio } from './revelado'
import { alvoDaMesa, alvosParaRevelar, comEvento, eventoDoAcontecimento, ligacoesDaMesa, ordemDaProximaSessao, semEvento, sessoesEmOrdem, situacaoDoItem, tempoVazio } from './sessoes'
import type { Forma, Revelacao, TextoRico, Verbete } from './tipos'

const VAZIO: TextoRico = { type: 'doc', content: [] }

function forma(id: string, secoes: { id: string; segredo?: boolean }[]): Forma {
  return { id, nome: id, resumo: '', imagens: [], secoes: secoes.map((secao) => ({ id: secao.id, titulo: secao.id, texto: VAZIO, segredo: secao.segredo ?? false })) }
}

function verbete(id: string, titulo: string, opcoes: Partial<Verbete> = {}): Verbete {
  const formas = opcoes.formas ?? [forma(`${id}-f`, [])]
  return { formato: 1, id, tipo: 'personagem', titulo, apelidos: [], campanhas: ['camp-ilha'], formas, formaAtivaId: formas[0]?.id ?? '', ...opcoes }
}

/** O revelado com estes alvos para todos, já por alvo (como o Prelúdio lê do disco). */
function reveladoPara(...alvos: Revelacao['alvo'][]): ReadonlyMap<string, Revelacao> {
  return reveladoCom(...alvos.map((alvo): [Revelacao['alvo'], Revelacao['para']] => [alvo, 'todos']))
}

function reveladoCom(...pares: [Revelacao['alvo'], Revelacao['para']][]): ReadonlyMap<string, Revelacao> {
  return revelacoesPorAlvo({ ...reveladoVazio(), revelacoes: pares.map(([alvo, para]) => ({ alvo, para, quando: '2026-11-09T12:00:00.000Z' })) })
}

describe('Revelar hoje', () => {
  const vigia = verbete('vb-vigia', 'Vigia do Farol', { formas: [forma('fa', [{ id: 's-comum' }, { id: 's-oculta', segredo: true }]), forma('fb', [{ id: 's-outra' }])] })

  it('revela o verbete, a forma e as seções comuns de uma vez; a seção de segredo nunca', () => {
    expect(alvosParaRevelar(vigia, {})).toEqual([alvoDoVerbete('vb-vigia'), alvoDaForma('vb-vigia', 'fa'), alvoDaSecao('vb-vigia', 'fa', 's-comum')])
    expect(alvosParaRevelar(vigia, { formaId: 'fb' })).toEqual([alvoDoVerbete('vb-vigia'), alvoDaForma('vb-vigia', 'fb'), alvoDaSecao('vb-vigia', 'fb', 's-outra')])
  })

  it('diz se o item está oculto, revelado ou só em parte; o resto é só o que falta', () => {
    expect(situacaoDoItem(vigia, { para: 'todos' }, reveladoPara())).toEqual({ t: 'oculto' })
    expect(situacaoDoItem(vigia, { para: 'todos' }, reveladoPara(alvoDoVerbete('vb-vigia')))).toEqual({
      t: 'parte',
      para: 'todos',
      faltam: [alvoDaForma('vb-vigia', 'fa'), alvoDaSecao('vb-vigia', 'fa', 's-comum')],
    })
    const tudo = reveladoPara(alvoDoVerbete('vb-vigia'), alvoDaForma('vb-vigia', 'fa'), alvoDaSecao('vb-vigia', 'fa', 's-comum'))
    expect(situacaoDoItem(vigia, { para: 'todos' }, tudo)).toEqual({ t: 'revelado', para: 'todos' })
  })

  it('público diferente do item nunca passa por "em parte": vira "outro", e diz se o item tiraria o acesso de alguém', () => {
    // Revelado só à Ana no verbete (F2c), com a seção ainda oculta; o item pede todos.
    const soAna = reveladoCom([alvoDoVerbete('vb-vigia'), ['conta-ana']], [alvoDaForma('vb-vigia', 'fa'), ['conta-ana']])
    expect(situacaoDoItem(vigia, { para: 'todos' }, soAna)).toEqual({ t: 'outro', para: ['conta-ana'], emParte: true, estreita: false })
    // O inverso: revelado a todos, o item pede só a Ana; e cada parte com um público.
    const misturado = reveladoCom([alvoDoVerbete('vb-vigia'), 'todos'], [alvoDaForma('vb-vigia', 'fa'), ['conta-ana']], [alvoDaSecao('vb-vigia', 'fa', 's-comum'), 'todos'])
    expect(situacaoDoItem(vigia, { para: ['conta-ana'] }, misturado)).toEqual({ t: 'outro', para: null, emParte: false, estreita: true })
  })
})

describe('O que aconteceu', () => {
  const sessao = verbete('vb-s3', 'Sessão 3', { tipo: 'sessao' })

  it('a linha vira evento com o mesmo id, sem data e com o nome da sessão', () => {
    expect(eventoDoAcontecimento({ id: 'ev-1', texto: '  O farol apagou  ' }, sessao)).toEqual({
      id: 'ev-1',
      titulo: 'O farol apagou',
      quando: { era: '', ano: 0, rotulo: 'Sessão 3' },
      verbetes: [],
      resumo: '',
      segredo: false,
      sessaoId: 'vb-s3',
    })
  })

  it('levar de novo troca o evento no lugar; tirar some com ele', () => {
    const primeiro = eventoDoAcontecimento({ id: 'ev-1', texto: 'O farol apagou' }, sessao)
    const segundo = eventoDoAcontecimento({ id: 'ev-2', texto: 'A balsa chegou' }, sessao)
    const tempo = comEvento(comEvento(tempoVazio(), primeiro), segundo)
    const trocado = comEvento(tempo, { ...primeiro, titulo: 'O farol apagou de vez' })
    expect(trocado.eventos.map((evento) => evento.titulo)).toEqual(['O farol apagou de vez', 'A balsa chegou'])
    expect(semEvento(trocado, 'ev-1').eventos.map((evento) => evento.id)).toEqual(['ev-2'])
  })
})

describe('Links do roteiro para a mesa', () => {
  it('lê cena, pino e ficha pelo id; o resto não é link', () => {
    expect(alvoDaMesa({ chave: 'ilha-velha', sceneId: 'cena-1' })).toEqual({ tipo: 'cena', chave: 'ilha-velha', sceneId: 'cena-1' })
    expect(alvoDaMesa({ chave: 'ilha-velha', sceneId: 'cena-1', pinoId: 'pino-9' })).toEqual({ tipo: 'cena', chave: 'ilha-velha', sceneId: 'cena-1', pinoId: 'pino-9' })
    expect(alvoDaMesa({ pastaId: 'pasta-1', personagemId: 'pj-2' })).toEqual({ tipo: 'ficha', pastaId: 'pasta-1', personagemId: 'pj-2' })
    for (const torto of [null, 'cena-1', { chave: 'ilha-velha' }, { pastaId: 3, personagemId: 'pj-2' }]) expect(alvoDaMesa(torto)).toBeNull()
  })

  it('acha os links do texto em ordem, sem repetir, também dentro do segredo', () => {
    const link = (alvo: unknown) => ({ type: 'ligacaoMesa', attrs: { alvo, rotulo: 'x' } })
    const texto: TextoRico = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [link({ chave: 'ilha-velha', sceneId: 'cena-1' }), link({ pastaId: 'pasta-1', personagemId: 'pj-2' })] },
        { type: 'segredo', content: [{ type: 'paragraph', content: [link({ chave: 'ilha-velha', sceneId: 'cena-1' }), link({ lixo: true })] }] },
      ],
    }
    expect(ligacoesDaMesa(texto)).toEqual([
      { tipo: 'cena', chave: 'ilha-velha', sceneId: 'cena-1' },
      { tipo: 'ficha', pastaId: 'pasta-1', personagemId: 'pj-2' },
    ])
  })
})

describe('Ordem das sessões', () => {
  it('sem ordem nem data vêm antes, pelo nome ("Sessão 2" antes de "Sessão 10"); depois a ordem gravada e a data do Grimório; só as da campanha', () => {
    const sessoes = [
      verbete('s10', 'Sessão 10', { tipo: 'sessao' }),
      verbete('s-nova', 'Aaa', { tipo: 'sessao', extras: { ordem: Date.parse('2026-11-09T10:00:00.000Z') } }),
      verbete('s-grimorio', 'Zzz', { tipo: 'sessao', extras: { criadoEm: '2026-10-01T20:00:00.000Z' } }),
      verbete('s2', 'Sessão 2', { tipo: 'sessao' }),
      verbete('s-fora', 'Sessão 1', { tipo: 'sessao', campanhas: ['camp-outra'] }),
      verbete('vb-vigia', 'Vigia'),
    ]
    expect(sessoesEmOrdem(sessoes, 'camp-ilha').map((sessao) => sessao.id)).toEqual(['s2', 's10', 's-grimorio', 's-nova'])
  })

  it('a sessão nova fica por último, de qualquer campanha, e renomear não a tira de lá', () => {
    const agora = Date.parse('2026-11-09T12:00:00.000Z')
    const antigas = [verbete('s9', 'Sessão 9', { tipo: 'sessao', extras: { criadoEm: '2026-11-01T20:00:00.000Z' } }), verbete('s-fora', 'Sessão 1', { tipo: 'sessao', campanhas: ['camp-outra'], extras: { ordem: agora + 5 } })]
    const ordem = ordemDaProximaSessao(antigas, agora)
    expect(ordem).toBe(agora + 6)
    const nova = verbete('s10', 'A Fuga', { tipo: 'sessao', extras: { ordem } })
    expect(sessoesEmOrdem([...antigas, nova], 'camp-ilha').map((sessao) => sessao.id)).toEqual(['s9', 's10'])
  })
})

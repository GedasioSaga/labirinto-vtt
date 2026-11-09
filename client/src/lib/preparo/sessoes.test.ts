/**
 * PRELÚDIO F4: as sessões sem tela (o Revelar hoje, o "O que aconteceu" que
 * vira evento e os links do roteiro para a mesa). No máximo 2 casos por
 * situação; dados inventados (o repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { alvoDaForma, alvoDaSecao, alvoDoVerbete, revelacoesPorAlvo, reveladoVazio } from './revelado'
import { alvoDaMesa, alvosParaRevelar, comEvento, eventoDoAcontecimento, ligacoesDaMesa, semEvento, sessoesEmOrdem, situacaoDoItem, tempoVazio } from './sessoes'
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
  return revelacoesPorAlvo({ ...reveladoVazio(), revelacoes: alvos.map((alvo) => ({ alvo, para: 'todos', quando: '2026-11-09T12:00:00.000Z' })) })
}

describe('Revelar hoje', () => {
  const vigia = verbete('vb-vigia', 'Vigia do Farol', { formas: [forma('fa', [{ id: 's-comum' }, { id: 's-oculta', segredo: true }]), forma('fb', [{ id: 's-outra' }])] })

  it('revela o verbete, a forma e as seções comuns de uma vez; a seção de segredo nunca', () => {
    expect(alvosParaRevelar(vigia, {})).toEqual([alvoDoVerbete('vb-vigia'), alvoDaForma('vb-vigia', 'fa'), alvoDaSecao('vb-vigia', 'fa', 's-comum')])
    expect(alvosParaRevelar(vigia, { formaId: 'fb' })).toEqual([alvoDoVerbete('vb-vigia'), alvoDaForma('vb-vigia', 'fb'), alvoDaSecao('vb-vigia', 'fb', 's-outra')])
  })

  it('diz se o item está oculto, revelado ou só em parte', () => {
    expect(situacaoDoItem(vigia, {}, reveladoPara())).toEqual({ t: 'oculto' })
    expect(situacaoDoItem(vigia, {}, reveladoPara(alvoDoVerbete('vb-vigia')))).toEqual({ t: 'parte', para: 'todos' })
    const tudo = reveladoPara(alvoDoVerbete('vb-vigia'), alvoDaForma('vb-vigia', 'fa'), alvoDaSecao('vb-vigia', 'fa', 's-comum'))
    expect(situacaoDoItem(vigia, {}, tudo)).toEqual({ t: 'revelado', para: 'todos' })
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
  it('a ordem gravada vem antes; sem ela, "Sessão 2" antes de "Sessão 10", e só as da campanha', () => {
    const sessoes = [
      verbete('s10', 'Sessão 10', { tipo: 'sessao' }),
      verbete('s2', 'Sessão 2', { tipo: 'sessao' }),
      verbete('s-zero', 'Prólogo', { tipo: 'sessao', extras: { ordem: 0 } }),
      verbete('s-fora', 'Sessão 1', { tipo: 'sessao', campanhas: ['camp-outra'] }),
      verbete('vb-vigia', 'Vigia'),
    ]
    expect(sessoesEmOrdem(sessoes, 'camp-ilha').map((sessao) => sessao.id)).toEqual(['s-zero', 's2', 's10'])
  })
})

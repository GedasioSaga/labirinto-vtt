/**
 * E3c: a linha do tempo por campanha sem tela. No máximo 2 casos por
 * situação; dados inventados (o repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { campanhaDaSessaoEm, linhaDaCampanha, SEM_CAMPANHA } from './linhaDoTempo'
import { comEvento, eventoDoAcontecimento, tempoVazio } from './sessoes'
import { ARQUIVO_DO_TEMPO, type Verbete } from './tipos'

function sessao(id: string, titulo: string, campanhas: string[]): Verbete {
  return { formato: 1, id, tipo: 'sessao', titulo, apelidos: [], campanhas, formas: [{ id: `${id}-f`, nome: id, resumo: '', imagens: [], secoes: [] }], formaAtivaId: `${id}-f` }
}

const SESSOES = new Map<string, Verbete>([
  ['vb-s1', sessao('vb-s1', 'Sessão 1: Chegada ao porto', ['camp-mar'])],
  ['vb-k1', sessao('vb-k1', 'Torneio, dia 1', ['camp-torneio'])],
])

describe('Linha do tempo por campanha', () => {
  it('o tempo.json de antes (sem campanha nenhuma) lê e grava igual, e nenhum evento some', () => {
    const doDisco = {
      formato: 1,
      eras: [{ id: 'era-reis', nome: 'Era dos Reis de Areia' }],
      faixas: [],
      eventos: [
        { id: 'ev-farol', titulo: 'O farol apagou', quando: { era: '', ano: 0, rotulo: 'Sessão 1: Chegada ao porto' }, verbetes: [], resumo: '', segredo: false, sessaoId: 'vb-s1' },
        { id: 'ev-fundacao', titulo: 'Fundação de Areia Alta', quando: { era: 'era-reis', ano: 1382 }, verbetes: [], resumo: '', segredo: false, nota: 'chave de uma versão mais nova' },
      ],
    }
    const lido = ARQUIVO_DO_TEMPO.molde.ler(doDisco, '')
    if (!lido.ok) throw new Error(lido.motivo)
    expect(ARQUIVO_DO_TEMPO.molde.gravar(lido.valor)).toEqual(doDisco)

    const campanhaDaSessao = campanhaDaSessaoEm(SESSOES)
    // O evento de sessão sem campanha gravada vai para a campanha da sessão, na bandeja; a era de antes fica em "Sem campanha".
    const doMar = linhaDaCampanha(lido.valor, 'camp-mar', campanhaDaSessao, true)
    expect(doMar.bandeja.map((evento) => evento.id)).toEqual(['ev-farol'])
    expect(doMar.eras).toEqual([])
    const semCampanha = linhaDaCampanha(lido.valor, SEM_CAMPANHA, campanhaDaSessao, true)
    expect(semCampanha.eras.map(({ era, anos }) => [era.id, anos.map(({ ano, eventos }) => [ano, eventos.map((evento) => evento.id)])])).toEqual([['era-reis', [[1382, ['ev-fundacao']]]]])
    expect(semCampanha.bandeja).toEqual([])
  })

  it('o evento mandado de uma sessão cai na bandeja da linha da campanha dela, e só dela', () => {
    const torneio = SESSOES.get('vb-k1')
    if (torneio === undefined) throw new Error('falta a sessão do torneio')
    const evento = eventoDoAcontecimento({ id: 'ev-androides', texto: 'Os androides se inscrevem' }, torneio)
    const tempo = comEvento({ ...tempoVazio(), eras: [{ id: 'era-kaio', nome: 'Torneios de Kaio', campanhaId: 'camp-torneio' }] }, evento)
    const campanhaDaSessao = campanhaDaSessaoEm(new Map())
    // Mesmo sem achar a sessão (apagada depois), a campanha gravada no evento vale.
    const doTorneio = linhaDaCampanha(tempo, 'camp-torneio', campanhaDaSessao, true)
    expect(doTorneio.bandeja.map((um) => um.id)).toEqual(['ev-androides'])
    expect(doTorneio.emOrdem).toEqual([])
    expect(linhaDaCampanha(tempo, 'camp-mar', campanhaDaSessao, true).bandeja).toEqual([])
  })
})

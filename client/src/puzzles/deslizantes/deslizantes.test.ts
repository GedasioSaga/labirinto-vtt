import { describe, expect, it } from 'vitest'
import { lerVistaDoPuzzle } from '../../net/protocoloDoPuzzle'
import { lerAcaoNoPuzzle } from '../leitor'
import { agirNoPuzzle, progressoInicial } from '../motor'
import { puzzleDoModelo } from '../padroes'
import { vistaDoPuzzle } from '../recorte'
import type { ContextoDoMotor, DeslizantesDoPuzzle, ProgressoDoPuzzle, Puzzle, QuemMexe } from '../tipos'
import { casasVizinhas, deslizantesPadrao, minimoDeLances, pecaVazia, temVolta } from './deslizantes'

/**
 * AS PEÇAS DESLIZANTES (28/11): só a peça vizinha da casa vazia desliza (o host
 * confere no tabuleiro de agora, então dois jogadores juntos não se atropelam);
 * a figura inteira, ou a peça-chave na saída, destrava o que o mestre escolheu;
 * o jogador recebe pelo fio onde cada peça está, nunca a semente do começo.
 */

const LARA: QuemMexe = { personagemId: 'p-lara', tokenId: 't-lara', nome: 'Lara' }
const BENTO: QuemMexe = { personagemId: 'p-bento', tokenId: 't-bento', nome: 'Bento' }

function contexto(quem: QuemMexe = LARA): ContextoDoMotor {
  let n = 0
  return { quem, agora: 1_700_000_000_000, modo: 'jogo', pecaDoAcervo: () => null, novoId: () => `novo-${++n}` }
}

function tabuleiro(mudar: Partial<DeslizantesDoPuzzle> = {}): Puzzle {
  const base = puzzleDoModelo('fonte')
  return { ...base, encaixes: [], futuro: { ...deslizantesPadrao(424242), ...mudar }, desfecho: { ...base.desfecho, abrePorta: true } }
}

function casasVistas(puzzle: Puzzle, progresso: ProgressoDoPuzzle): number[] {
  return vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso, mochila: [] }).deslizantes?.casas ?? []
}

function deslizar(puzzle: Puzzle, progresso: ProgressoDoPuzzle, peca: number, quem: QuemMexe = LARA) {
  return agirNoPuzzle(puzzle, progresso, [], { tipo: 'deslizar', peca }, contexto(quem))
}

describe('peças deslizantes', () => {
  it('só a peça vizinha da casa vazia desliza, e o segundo jogador vale pelo tabuleiro de agora', () => {
    const puzzle = tabuleiro({ lado: 3 })
    const progresso = progressoInicial(puzzle)
    const casas = casasVistas(puzzle, progresso)
    const vazia = casas.indexOf(pecaVazia(3))
    expect(temVolta(casas, 3)).toBe(true)

    // Uma peça longe da vazia não sai do lugar, e o tabuleiro fica como estava.
    const longe = casas.findIndex((peca, casa) => peca !== pecaVazia(3) && casa !== vazia && !casasVizinhas(casa, vazia, 3))
    const presa = deslizar(puzzle, progresso, casas[longe] ?? -1)
    expect(presa.efeitos).toEqual([{ tipo: 'recusado', motivo: 'peca_presa' }])
    expect(casasVistas(puzzle, presa.progresso)).toEqual(casas)

    // As duas vizinhas da vazia: a Lara desliza uma; a outra, que o Bento pediu ao mesmo tempo, já não é vizinha.
    const [daLara, doBento] = casas.flatMap((peca, casa) => (casasVizinhas(casa, vazia, 3) ? [peca] : []))
    if (daLara === undefined || doBento === undefined) throw new Error('a vazia nasceu sem duas vizinhas')
    const lance = deslizar(puzzle, progresso, daLara)
    const depois = casasVistas(puzzle, lance.progresso)
    expect(depois[vazia]).toBe(daLara)
    expect(depois[casas.indexOf(daLara)]).toBe(pecaVazia(3))
    expect(deslizar(puzzle, lance.progresso, doBento, BENTO).efeitos).toEqual([{ tipo: 'recusado', motivo: 'peca_presa' }])
    const vista = vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso: lance.progresso, mochila: [] }).deslizantes
    expect(vista?.lances).toBe(1)
    expect(vista?.ultimas).toEqual([{ peca: daLara, por: 'Lara' }])
  })

  it('a figura inteira resolve e abre a porta; no modo chave basta a peça-chave chegar à saída', () => {
    // A um lance da figura pronta: a última peça fora do lugar, na casa vazia.
    const puzzle = tabuleiro({ lado: 4 })
    const casas = Array.from({ length: 16 }, (_, casa) => casa)
    casas[14] = pecaVazia(4)
    casas[15] = 14
    const quase: ProgressoDoPuzzle = { ...progressoInicial(puzzle), deslizantes: { casas, lances: 7, ultimas: [] } }
    expect(minimoDeLances(casas, { modo: 'figura', lado: 4, chave: 0, alvo: 15 })).toEqual({ exato: true, lances: 1 })
    expect(deslizar(puzzle, quase, 12).efeitos).toEqual([{ tipo: 'recusado', motivo: 'peca_presa' }])
    const fim = deslizar(puzzle, quase, 14)
    expect(fim.progresso.resolvido).not.toBeNull()
    const entrega = fim.efeitos.find((efeito) => efeito.tipo === 'entregar')
    expect(entrega?.tipo === 'entregar' && entrega.desfecho.abrePorta).toBe(true)
    expect(deslizar(puzzle, fim.progresso, 13).efeitos).toEqual([{ tipo: 'recusado', motivo: 'resolvido' }])

    // Modo chave: a peça 0 ao lado da saída (a casa 8), com o resto fora do lugar.
    const comChave = tabuleiro({ lado: 3, modo: 'chave', chave: 0, alvo: 8 })
    const blocos = [7, 2, 1, 4, 3, 6, 5, 0, 8]
    const perto: ProgressoDoPuzzle = { ...progressoInicial(comChave), deslizantes: { casas: blocos, lances: 0, ultimas: [] } }
    expect(minimoDeLances(blocos, { modo: 'chave', lado: 3, chave: 0, alvo: 8 })).toEqual({ exato: true, lances: 1 })
    const saiu = deslizar(comChave, perto, 0)
    expect(saiu.efeitos.some((efeito) => efeito.tipo === 'resolveu')).toBe(true)
  })

  it('o tabuleiro vai pelo fio sem a semente, e o pedido de deslizar se lê de volta', () => {
    const puzzle = tabuleiro({ lado: 5, material: 'bronze', figura: 'mariposa' })
    const progresso = progressoInicial(puzzle)
    const vista = vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso, mochila: [] })
    const fio = JSON.parse(JSON.stringify(vista)) as Record<string, unknown>
    const lida = lerVistaDoPuzzle(fio)
    expect(lida?.encaixes).toEqual([])
    expect(lida?.deslizantes).toEqual(vista.deslizantes)
    expect(lida?.deslizantes?.casas).toHaveLength(25)
    expect(Object.keys(fio.deslizantes as object).sort()).toEqual(['alvo', 'casas', 'chave', 'figura', 'imagem', 'lado', 'lances', 'material', 'modo', 'ultimas'])
    expect(JSON.stringify(fio)).not.toMatch(/embaralho/)

    // Um tabuleiro torto (peça repetida) derruba a vista inteira, em vez de virar meia tela.
    const torto = { ...(fio.deslizantes as Record<string, unknown>), casas: [0, 0, ...vista.deslizantes!.casas.slice(2)] }
    expect(lerVistaDoPuzzle({ ...fio, deslizantes: torto })).toBeNull()

    expect(lerAcaoNoPuzzle({ tipo: 'deslizar', peca: 3 })).toEqual({ tipo: 'deslizar', peca: 3 })
    expect(lerAcaoNoPuzzle({ tipo: 'deslizar', peca: -1 })).toBeNull()
  })
})

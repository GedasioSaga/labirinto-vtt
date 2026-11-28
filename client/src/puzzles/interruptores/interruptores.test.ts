import { describe, expect, it } from 'vitest'
import { lerVistaDoPuzzle } from '../../net/protocoloDoPuzzle'
import { agirNoPuzzle, progressoInicial } from '../motor'
import { puzzleDoModelo } from '../padroes'
import { vistaDoPuzzle } from '../recorte'
import type { ContextoDoMotor, InterruptoresDoPuzzle, ProgressoDoPuzzle, Puzzle } from '../tipos'
import { interruptoresPadrao } from './interruptores'

/**
 * OS INTERRUPTORES COM ESTADO (28/11): cada alavanca vira o lampião dela e os
 * ligados pela regra; o painel resolve quando bate com o alvo e destrava o que o
 * mestre escolheu; o jogador recebe pelo fio só o que cada lampião mostra, nunca
 * quem vira quem. Semente fixa: o mesmo começo em toda rodada.
 */

const QUEM = { personagemId: 'p-lara', tokenId: 't-lara', nome: 'Lara' }

function contexto(): ContextoDoMotor {
  let n = 0
  return { quem: QUEM, agora: 1_700_000_000_000, modo: 'jogo', pecaDoAcervo: () => null, novoId: () => `novo-${++n}` }
}

function painel(mudar: Partial<InterruptoresDoPuzzle> = {}): Puzzle {
  const base = puzzleDoModelo('fonte')
  return { ...base, encaixes: [], futuro: { ...interruptoresPadrao(777), ...mudar }, desfecho: { ...base.desfecho, abrePorta: true } }
}

/** O que o jogador vê agora, pelo recorte. */
function luzesVistas(puzzle: Puzzle, progresso: ProgressoDoPuzzle): boolean[] {
  return vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso, mochila: [] }).interruptores?.luzes ?? []
}

function puxar(puzzle: Puzzle, progresso: ProgressoDoPuzzle, botao: number) {
  return agirNoPuzzle(puzzle, progresso, [], { tipo: 'apertar', botao }, contexto())
}

/** As luzes com os índices `virados` trocados. */
function virando(luzes: readonly boolean[], virados: readonly number[]): boolean[] {
  return luzes.map((acesa, i) => (virados.includes(i) ? !acesa : acesa))
}

describe('interruptores com estado', () => {
  it('a alavanca vira a dela e as ligadas pela regra (do lado, linha e coluna, a do mestre), e duas puxadas desfazem', () => {
    // 3 x 3, os do lado: a do meio vira a cruz pequena.
    const doLado = painel({ quantos: 9, ligacao: 'vizinhos' })
    const comeco = progressoInicial(doLado)
    const antes = luzesVistas(doLado, comeco)
    expect(antes).toHaveLength(9)
    const uma = puxar(doLado, comeco, 4)
    expect(luzesVistas(doLado, uma.progresso)).toEqual(virando(antes, [1, 3, 4, 5, 7]))
    expect(luzesVistas(doLado, puxar(doLado, uma.progresso, 4).progresso)).toEqual(antes)
    // A do canto vira ela e as duas encostadas.
    expect(luzesVistas(doLado, puxar(doLado, comeco, 0).progresso)).toEqual(virando(antes, [0, 1, 3]))

    // Linha e coluna: a do canto vira a linha e a coluna inteiras.
    const cruz = painel({ quantos: 9, ligacao: 'linha' })
    const daCruz = luzesVistas(cruz, progressoInicial(cruz))
    expect(luzesVistas(cruz, puxar(cruz, progressoInicial(cruz), 0).progresso)).toEqual(virando(daCruz, [0, 1, 2, 3, 6]))

    // A regra do mestre: a 3 leva a 1 junto (e só); a 1 vira só ela.
    const propria = painel({ quantos: 5, ligacao: 'propria', ligados: [[], [], [0], [], []] })
    const daPropria = luzesVistas(propria, progressoInicial(propria))
    expect(luzesVistas(propria, puxar(propria, progressoInicial(propria), 2).progresso)).toEqual(virando(daPropria, [0, 2]))
    expect(luzesVistas(propria, puxar(propria, progressoInicial(propria), 0).progresso)).toEqual(virando(daPropria, [0]))
  })

  it('bater com o desenho resolve na última puxada (não antes), entrega o desfecho com a porta e nunca castiga', () => {
    const desenho = [true, false, true, false, true, false]
    const puzzle = painel({ quantos: 6, ligacao: 'vizinhos', objetivo: 'desenho', desenho })
    let progresso = progressoInicial(puzzle)
    const comeco = luzesVistas(puzzle, progresso)
    expect(comeco).not.toEqual(desenho)

    // A solução por força bruta, com a regra contada aqui (2 x 3, os do lado), não a do motor.
    const doLado = (i: number) => [i, ...[i - 3, i + 3].filter((j) => j >= 0 && j < 6), ...(i % 3 > 0 ? [i - 1] : []), ...(i % 3 < 2 ? [i + 1] : [])]
    const solucao = Array.from({ length: 64 }, (_, mascara) => [0, 1, 2, 3, 4, 5].filter((i) => (mascara & (1 << i)) !== 0)).find((puxadas) => {
      const fim = puxadas.reduce((luzes, i) => virando(luzes, doLado(i)), comeco)
      return fim.every((acesa, i) => acesa === desenho[i])
    })
    expect(solucao).toBeDefined()

    const passos = solucao ?? []
    passos.forEach((alavanca, k) => {
      const passo = puxar(puzzle, progresso, alavanca)
      progresso = passo.progresso
      const ultimo = k === passos.length - 1
      expect(progresso.resolvido !== null).toBe(ultimo)
      if (ultimo) expect(passo.efeitos).toContainEqual(expect.objectContaining({ tipo: 'entregar', desfecho: expect.objectContaining({ abrePorta: true }) }))
    })
    expect(luzesVistas(puzzle, progresso)).toEqual(desenho)
    expect(progresso.erros).toBe(0)
    // Resolvido, o painel não mexe mais.
    expect(puxar(puzzle, progresso, 0).efeitos).toEqual([{ tipo: 'recusado', motivo: 'resolvido' }])
  })

  it('o fio leva ao jogador só o que cada lampião mostra (e a plaqueta, se o mestre a pôs), nunca a regra nem o começo', () => {
    const puzzle = painel({ quantos: 8, ligacao: 'propria', ligados: [[1], [2], [3], [], [], [], [], [0]], objetivo: 'desenho', desenho: [true, true, false, false, true, true, false, false] })
    const progresso = puxar(puzzle, progressoInicial(puzzle), 3).progresso
    const vista = vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso, mochila: [] })
    const fio = JSON.stringify(vista)
    expect(fio).not.toMatch(/ligados|ligacao|embaralho/)

    const lida = lerVistaDoPuzzle(JSON.parse(fio))
    expect(lida?.interruptores).toEqual({ material: 'latao', luzes: luzesVistas(puzzle, progresso), objetivo: 'desenho', desenho: [true, true, false, false, true, true, false, false] })
    expect(lida?.encaixes).toEqual([])
    expect(lida?.troca).toBeNull()

    // O desenho fora do painel fica com o mestre: o fio leva `null`.
    const escondido = { ...puzzle, futuro: { ...interruptoresPadrao(777), objetivo: 'desenho' as const, desenhoNoPainel: false } }
    expect(lerVistaDoPuzzle(JSON.parse(JSON.stringify(vistaDoPuzzle({ desafioId: 'd1', puzzle: escondido, progresso: progressoInicial(escondido), mochila: [] }))))?.interruptores?.desenho).toBeNull()
  })
})

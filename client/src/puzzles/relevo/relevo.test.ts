import { describe, expect, it } from 'vitest'
import { lerVistaDoPuzzle } from '../../net/protocoloDoPuzzle'
import type { CarriedItem } from '../../types/map'
import { agirNoPuzzle, progressoInicial } from '../motor'
import { vistaDoPuzzle } from '../recorte'
import type { ContextoDoMotor, EncaixeDoPuzzle, Puzzle } from '../tipos'
import { puzzleDoRelevo, visualDoRelevo } from './relevo'

/**
 * A REGRA DO PAINEL EM RELEVO (28/11): cada vão só aceita a SUA placa, a
 * última placa destrava o que o mestre escolheu, e o jogador recebe pelo fio o
 * mesmo painel (cena, metal, vãos e o que já foi posto). Tudo fixo: a cena, as
 * placas e os ids de item saem do código, sem sorteio.
 */

const QUEM = { personagemId: 'p-lara', tokenId: 't-lara', nome: 'Lara' }

function contexto(modo: ContextoDoMotor['modo'] = 'jogo'): ContextoDoMotor {
  let n = 0
  return { quem: QUEM, agora: 1_700_000_000_000, modo, pecaDoAcervo: () => null, novoId: () => `novo-${++n}` }
}

type EncaixeDePeca = Extract<EncaixeDoPuzzle, { jeito: 'peca' }>

/** O dragão de bronze com 4 placas faltando; a porta ligada abre no fim. */
function painel(): Puzzle {
  const puzzle = puzzleDoRelevo(visualDoRelevo('dragao', 'bronze'), 4)
  return { ...puzzle, desfecho: { ...puzzle.desfecho, abrePorta: true } }
}

function vaos(puzzle: Puzzle): EncaixeDePeca[] {
  return puzzle.encaixes.filter((encaixe): encaixe is EncaixeDePeca => encaixe.jeito === 'peca')
}

/** A mochila com uma vaga por placa, na ordem dos vãos: a vaga `placa-i` é a placa certa do vão i. */
function mochilaComAsPlacas(puzzle: Puzzle): CarriedItem[] {
  return vaos(puzzle).map((vao, i) => ({ id: `vaga-${i}`, nome: `Placa ${i}`, ...(vao.itemId === null ? {} : { itemId: vao.itemId }) }))
}

describe('painel em relevo', () => {
  it('o vão recusa a placa de outro vão e aceita a dele', () => {
    const puzzle = painel()
    const [primeiro, segundo] = vaos(puzzle)
    if (primeiro === undefined || segundo === undefined) throw new Error('o painel nasceu sem vãos')
    expect(primeiro.itemId).not.toBe(segundo.itemId)
    const mochila = mochilaComAsPlacas(puzzle)
    const progresso = progressoInicial(puzzle)

    const errada = agirNoPuzzle(puzzle, progresso, mochila, { tipo: 'por', encaixeId: primeiro.id, vagaId: 'vaga-1' }, contexto())
    expect(errada.efeitos).toEqual([{ tipo: 'recusado', motivo: 'nao_encaixa' }])
    expect(errada.mochila).toHaveLength(mochila.length)
    expect(errada.progresso.encaixes[primeiro.id]).toBeNull()

    const certa = agirNoPuzzle(puzzle, progresso, mochila, { tipo: 'por', encaixeId: primeiro.id, vagaId: 'vaga-0' }, contexto())
    expect(certa.efeitos.some((efeito) => efeito.tipo === 'recusado')).toBe(false)
    expect(certa.mochila.map((vaga) => vaga.id)).toEqual(['vaga-1', 'vaga-2', 'vaga-3'])
    expect(certa.progresso.resolvido).toBeNull()
  })

  it('a última placa completa o painel e abre a porta ligada', () => {
    const puzzle = painel()
    let progresso = progressoInicial(puzzle)
    let mochila = mochilaComAsPlacas(puzzle)
    const ctx = contexto()
    const efeitosDaUltima = vaos(puzzle).map((vao, i) => {
      const passo = agirNoPuzzle(puzzle, progresso, mochila, { tipo: 'por', encaixeId: vao.id, vagaId: `vaga-${i}` }, ctx)
      progresso = passo.progresso
      mochila = passo.mochila
      return passo.efeitos
    }).at(-1)

    expect(mochila).toEqual([])
    expect(progresso.resolvido).toEqual({ por: 'Lara', em: 1_700_000_000_000 })
    expect(efeitosDaUltima?.[0]).toEqual({ tipo: 'resolveu' })
    const entrega = efeitosDaUltima?.find((efeito) => efeito.tipo === 'entregar')
    expect(entrega?.tipo === 'entregar' && entrega.desfecho.abrePorta).toBe(true)
  })

  it('o jogador recebe pelo fio o mesmo painel, com a placa já posta', () => {
    const puzzle = painel()
    const [primeiro] = vaos(puzzle)
    if (primeiro === undefined) throw new Error('o painel nasceu sem vãos')
    const mochila = mochilaComAsPlacas(puzzle)
    const posta = agirNoPuzzle(puzzle, progressoInicial(puzzle), mochila, { tipo: 'por', encaixeId: primeiro.id, vagaId: 'vaga-0' }, contexto())

    const vista = vistaDoPuzzle({ desafioId: 'desafio-1', puzzle, progresso: posta.progresso, mochila: posta.mochila })
    const lida = lerVistaDoPuzzle(JSON.parse(JSON.stringify(vista)))

    expect(lida).not.toBeNull()
    expect(lida?.visual).toEqual({ tipo: 'relevo', cena: 'dragao', imagem: null, metal: 'bronze' })
    expect(lida?.encaixes.map((encaixe) => encaixe.placa)).toEqual(vaos(puzzle).map((vao) => vao.placa))
    expect(lida?.encaixes[0]?.posta).not.toBeNull()
    expect(lida?.encaixes.slice(1).every((encaixe) => encaixe.posta === null)).toBe(true)
    expect(lida?.contagem).toEqual({ postos: 1, total: 4 })
  })
})

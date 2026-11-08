/**
 * O PROTOCOLO DA LUTA DO LOBBY (Arena multijogador, fatia F4): o leitor
 * `luta.*` lê os frames na forma em que o site os manda (a mesma que a
 * fumaça `node lobby/nuvem/fumaca.mjs luta` mandou ao DO em 07/11/2026) e
 * recusa o torto sem lançar; o resumo do histórico de uma luta acabada leva o
 * vencedor, quem lutou em cada lado e o registro de quem assiste.
 */
import { describe, expect, it } from 'vitest'
import type { Personagem } from '../personagem'
import { arbitrarNaLuta } from './arbitroDaLuta'
import type { MotorDoDuelo } from './duelo'
import { LIA, SISTEMA_DO_TESTE, ze } from './fichasDeTreino.testkit'
import { criarLuta } from './luta'
import { lerPedidoDaLuta, resumoDaLuta } from './lutaDoLobby'
import { lutaParaOFio } from './vistaDaLuta'

const MOTOR: MotorDoDuelo = { sistema: SISTEMA_DO_TESTE, rolarD20: () => 10 }

function daConta(ficha: Personagem, contaId: string): Personagem {
  return { ...ficha, dono: contaId }
}

describe('protocolo luta.* (F4)', () => {
  it('lê os frames como o site manda e recusa o torto com o tipo e o id', () => {
    const convidados = [
      { contaId: 'conta_j01', papel: 'jogador', lado: 'a' },
      { contaId: 'conta_j03', papel: 'jogador', lado: 'b' },
      { contaId: 'mestre', papel: 'arbitro', lado: null },
      { contaId: 'conta_j08', papel: 'espectador', lado: null },
    ]
    expect(lerPedidoDaLuta({ t: 'luta.criar', modo: 'times', lados: ['a', 'b'], convidados, fichas: ['pers_j01'] })).toEqual({
      ok: true,
      pedido: { t: 'luta.criar', modo: 'times', lados: ['a', 'b'], convidados, fichas: ['pers_j01'] },
    })
    expect(lerPedidoDaLuta({ t: 'luta.aceitar', id: 'luta_1', lado: null, fichas: [] })).toEqual({ ok: true, pedido: { t: 'luta.aceitar', id: 'luta_1', lado: null, fichas: [] } })
    expect(lerPedidoDaLuta({ t: 'luta.arbitrar', id: 'luta_1', pedido: { tipo: 'desfazer', seq: 2 } })).toEqual({ ok: true, pedido: { t: 'luta.arbitrar', id: 'luta_1', pedido: { tipo: 'desfazer', seq: 2 } } })
    expect(lerPedidoDaLuta({ t: 'luta.historico', limite: 50 })).toEqual({ ok: true, pedido: { t: 'luta.historico', antesDe: null, limite: 20 } })
    expect(lerPedidoDaLuta({ t: 'luta.historico', id: 'luta_1' })).toEqual({ ok: true, pedido: { t: 'luta.historico', antesDe: null, limite: 20, id: 'luta_1' } })
    expect(lerPedidoDaLuta({ t: 'luta.lista' })).toEqual({ ok: true, pedido: { t: 'luta.lista' } })
    // Torto: tipo que não existe, lado fora das 12 letras, fichas acima do teto, árbitro sem seq.
    expect(lerPedidoDaLuta({ t: 'luta.voar' })).toEqual({ ok: false, pedido: 'luta' })
    expect(lerPedidoDaLuta({ t: 'luta.criar', modo: 'times', lados: ['a', 'z'], convidados, fichas: [] })).toEqual({ ok: false, pedido: 'luta.criar' })
    expect(lerPedidoDaLuta({ t: 'luta.aceitar', id: 'luta_1', lado: 'a', fichas: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'] })).toEqual({ ok: false, pedido: 'luta.aceitar', id: 'luta_1' })
    expect(lerPedidoDaLuta({ t: 'luta.arbitrar', id: 'luta_1', pedido: { tipo: 'pausar' } })).toEqual({ ok: false, pedido: 'luta.arbitrar', id: 'luta_1' })
  })

  it('o resumo da luta acabada leva o vencedor, quem lutou em cada lado e o registro de quem assiste', () => {
    const criada = criarLuta(
      {
        id: 'luta_resumo',
        modo: 'times',
        inscricoes: [
          { contaId: 'conta_ze', nome: 'Jogador Zé', papel: 'jogador', lado: 'a', fichas: [daConta(ze(60), 'conta_ze')] },
          { contaId: 'conta_lia', nome: 'Jogadora Lia', papel: 'jogador', lado: 'b', fichas: [daConta(LIA, 'conta_lia')] },
          { contaId: 'mestre', nome: 'Mestre', papel: 'arbitro', lado: null, fichas: [] },
        ],
      },
      MOTOR,
    )
    if (!criada.ok) throw new Error(`luta recusada: ${criada.motivo}`)
    expect(resumoDaLuta(criada.luta, 1000)).toBeNull()
    const encerrada = arbitrarNaLuta(criada.luta, MOTOR, 'mestre', { tipo: 'encerrar', seq: criada.luta.seq, vencedor: 'b' }, 2000)
    if (!encerrada.ok) throw new Error(`encerrar recusado: ${encerrada.motivo}`)
    const resumo = resumoDaLuta(encerrada.luta, 3000)
    expect(resumo).toEqual({
      id: 'luta_resumo',
      fim: 3000,
      modo: 'times',
      lados: [
        { lado: 'a', contas: [{ contaId: 'conta_ze', nome: 'Jogador Zé' }], fichas: ['Zé'] },
        { lado: 'b', contas: [{ contaId: 'conta_lia', nome: 'Jogadora Lia' }], fichas: ['Lia'] },
      ],
      vencedor: 'b',
      motivo: 'arbitro',
      rodadas: encerrada.luta.cena.turnos.rodada,
      registro: lutaParaOFio(encerrada.luta).registro,
    })
    // O árbitro não lutou: não aparece em lado nenhum.
    expect(resumo?.lados.flatMap((lado) => lado.contas.map((conta) => conta.contaId))).not.toContain('mestre')
  })
})

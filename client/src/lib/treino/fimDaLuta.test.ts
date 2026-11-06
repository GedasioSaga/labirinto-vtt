/**
 * O FIM DA LUTA DE TREINO (LOBBY v2, fatia T2; aceite em
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): vitória do Lado A, vitória
 * do Lado B, todos caídos e tempo. A luta derruba pela mesa em memória
 * (`ajustarPersonagem`), como a batalha faz, e cada cópia tem o id da vaga
 * (`treino_a1`, `treino_b2`): o mesmo inimigo duas vezes são dois lutadores.
 */
import { describe, expect, it } from 'vitest'
import { personagemDoArquivo, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { fimDaLuta, type TetosDaLuta } from './fimDaLuta'
import { criarMesaEmMemoria, montarLutadores, type EscolhaDaVaga, type MesaEmMemoria } from './mesaEmMemoria'

const TETOS: TetosDaLuta = { rodadas: 20, passos: 400 }
const NO_COMECO = { rodada: 1, passos: 0 }

function ficha(id: string, tipo: 'jogador' | 'npc', nome: string): Personagem {
  const lida = personagemDoArquivo({ id, tipo, nome, recursos: { hp: 100 }, maximos: { hp: 100 } })
  if (lida === null) throw new Error(`ficha ${id} inválida`)
  return lida
}

const ZE = ficha('pers_ze', 'jogador', 'Zé')
const LIA = ficha('pers_lia', 'jogador', 'Lia')
const MARINHEIRO = ficha('pers_marinheiro', 'npc', 'Marinheiro')

function mesaDe(escolhas: readonly EscolhaDaVaga[]): MesaEmMemoria {
  const montagem = montarLutadores(escolhas)
  if (!montagem.ok) throw new Error(`montagem recusada: lado ${montagem.lado} ${montagem.motivo}`)
  return criarMesaEmMemoria(SISTEMA_ONE_PIECE, montagem.lutadores)
}

/** A vida da cópia vai a 0 pela mesa, como o golpe da batalha. `false` = cópia que não existe. */
function derrubar(mesa: MesaEmMemoria, personagemId: string): boolean {
  return mesa.ajustarPersonagem(personagemId, (atual) => ({ ...atual, recursos: { ...atual.recursos, hp: 0 } }))
}

describe('fim da luta de treino', () => {
  it('vitória do Lado A: o único do Lado B cai (2×1)', () => {
    const mesa = mesaDe([
      { ficha: ZE, lado: 'a' },
      { ficha: LIA, lado: 'a' },
      { ficha: MARINHEIRO, lado: 'b' },
    ])
    expect(fimDaLuta(mesa, NO_COMECO, TETOS)).toBeNull()
    expect(derrubar(mesa, 'treino_b1')).toBe(true)
    expect(fimDaLuta(mesa, { rodada: 3, passos: 12 }, TETOS)).toEqual({ tipo: 'vitoria', vencedor: 'a' })
  })

  it('vitória do Lado B: o mesmo Marinheiro duas vezes no Lado A são dois lutadores; só acaba quando os dois caem', () => {
    const mesa = mesaDe([
      { ficha: MARINHEIRO, lado: 'a' },
      { ficha: ZE, lado: 'b' },
      { ficha: MARINHEIRO, lado: 'a' },
    ])
    expect(derrubar(mesa, 'treino_a1')).toBe(true)
    expect(fimDaLuta(mesa, { rodada: 2, passos: 5 }, TETOS)).toBeNull()
    expect(derrubar(mesa, 'treino_a2')).toBe(true)
    expect(fimDaLuta(mesa, { rodada: 2, passos: 6 }, TETOS)).toEqual({ tipo: 'vitoria', vencedor: 'b' })
  })

  it('todos caídos: os dois lados sem ninguém de pé é empate, mesmo já passado do teto', () => {
    const mesa = mesaDe([
      { ficha: ZE, lado: 'a' },
      { ficha: MARINHEIRO, lado: 'b' },
    ])
    expect(derrubar(mesa, 'treino_a1')).toBe(true)
    expect(derrubar(mesa, 'treino_b1')).toBe(true)
    expect(fimDaLuta(mesa, { rodada: TETOS.rodadas + 1, passos: TETOS.passos }, TETOS)).toEqual({ tipo: 'todosCaidos' })
  })

  it('tempo: os dois de pé, a rodada depois do teto ou os passos no teto acabam a luta; a última rodada ainda se joga', () => {
    const mesa = mesaDe([
      { ficha: ZE, lado: 'a' },
      { ficha: MARINHEIRO, lado: 'b' },
    ])
    expect(fimDaLuta(mesa, { rodada: TETOS.rodadas, passos: TETOS.passos - 1 }, TETOS)).toBeNull()
    expect(fimDaLuta(mesa, { rodada: TETOS.rodadas + 1, passos: 50 }, TETOS)).toEqual({ tipo: 'tempo', teto: 'rodadas' })
    expect(fimDaLuta(mesa, { rodada: 4, passos: TETOS.passos }, TETOS)).toEqual({ tipo: 'tempo', teto: 'passos' })
  })

  it('tempo: relógio torto (passos ou rodada NaN) acaba a luta em vez de deixá-la sem fim', () => {
    const mesa = mesaDe([
      { ficha: ZE, lado: 'a' },
      { ficha: MARINHEIRO, lado: 'b' },
    ])
    expect(fimDaLuta(mesa, { rodada: 3, passos: Number.NaN }, TETOS)).toEqual({ tipo: 'tempo', teto: 'passos' })
    expect(fimDaLuta(mesa, { rodada: Number.NaN, passos: 12 }, TETOS)).toEqual({ tipo: 'tempo', teto: 'rodadas' })
  })

  it('tempo: o golpe que derruba o último no passo do teto é vitória, não tempo', () => {
    const mesa = mesaDe([
      { ficha: ZE, lado: 'a' },
      { ficha: MARINHEIRO, lado: 'b' },
    ])
    expect(derrubar(mesa, 'treino_b1')).toBe(true)
    expect(fimDaLuta(mesa, { rodada: TETOS.rodadas + 1, passos: TETOS.passos }, TETOS)).toEqual({ tipo: 'vitoria', vencedor: 'a' })
  })
})

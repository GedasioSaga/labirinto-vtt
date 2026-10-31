/**
 * O PLACAR DO BONECO (defeito do passeio de 31/10/2026): 3 golpes deram 2
 * linhas (o esquivado sumiu) e "412 em 4 rodadas" contava a rodada recém-aberta.
 *
 * - Golpe resolvido no boneco aparece sempre, com 0 quando ele esquivou.
 *   O que ainda espera a reação dele não aparece (o número não existe ainda).
 * - Média = dano por rodada: o total dividido pelas rodadas que JÁ contam — as
 *   completas, mais a atual só depois que um golpe dela entrou no placar.
 */
import { describe, expect, it } from 'vitest'
import type { LinhaDoRegistro, Reversao } from '../batalha/registro'
import { placarDoBoneco, type ContextoDoPlacar, type NomeDoGolpe } from './placar'

const BONECO = 'p-boneco'
const TOKEN_DO_BONECO = 't-boneco'
const BRUNO = 't-bruno'

/** A linha de um golpe do Bruno no boneco; `hp` = quanto tirou (0 = esquivou: a ficha do boneco nem entra na reversão). */
function linhaDoGolpe(id: string, rodada: number, golpeId: string, hp: number): LinhaDoRegistro {
  const partes: Reversao[] = [{ tipo: 'golpe', golpeId }]
  if (hp > 0) partes.push({ tipo: 'ficha', personagemId: BONECO, partes: [{ parte: 'recurso', chave: 'hp', de: 1000, para: 1000 - hp }] })
  return {
    id,
    seq: Number(id.slice(1)),
    quando: 1_000,
    rodada,
    autor: { tipo: 'mestre' },
    tipo: 'golpe',
    texto: `Bruno usa Balmung em Judge`,
    envolve: { tokenIds: [BRUNO, TOKEN_DO_BONECO], personagemIds: [] },
    reversao: { tipo: 'composta', partes },
  }
}

function contexto(esperando: readonly string[] = []): ContextoDoPlacar {
  const golpes = new Map<string, NomeDoGolpe>(['g1', 'g2', 'g3', 'g4'].map((id) => [id, { nome: 'Balmung', atacanteTokenId: BRUNO, alvos: [TOKEN_DO_BONECO] }]))
  return {
    bonecoPersonagemId: BONECO,
    bonecoTokenId: TOKEN_DO_BONECO,
    idDaVida: 'hp',
    idDoEscudo: 'escudo',
    golpes,
    esperando: new Set(esperando),
    nomeDoToken: (tokenId) => (tokenId === BRUNO ? 'Bruno' : 'Ficha'),
  }
}

/** O passeio: R1 tirou 247, R2 tirou 165, R3 o boneco esquivou, e a rodada 4 acabou de abrir. */
const REGISTRO = [linhaDoGolpe('l1', 1, 'g1', 247), linhaDoGolpe('l2', 2, 'g2', 165), linhaDoGolpe('l3', 3, 'g3', 0)]

describe('placar do boneco', () => {
  it('o golpe esquivado aparece com 0: 3 golpes, 3 linhas', () => {
    const conta = placarDoBoneco(REGISTRO, contexto(), [], 4)
    expect(conta.golpes.map((golpe) => [golpe.rodada, golpe.golpe, golpe.total])).toEqual([
      [1, 'Balmung', 247],
      [2, 'Balmung', 165],
      [3, 'Balmung', 0],
    ])
  })

  it('a rodada recém-aberta não conta: 412 em 3 rodadas, média 137,33', () => {
    const conta = placarDoBoneco(REGISTRO, contexto(), [], 4)
    expect([conta.total, conta.rodadas]).toEqual([412, 3])
    expect(conta.mediaPorRodada).toBeCloseTo(412 / 3)
  })

  it('a rodada atual conta assim que um golpe dela entra no placar', () => {
    const conta = placarDoBoneco([...REGISTRO, linhaDoGolpe('l4', 4, 'g4', 88)], contexto(), [], 4)
    expect([conta.total, conta.rodadas, conta.mediaPorRodada]).toEqual([500, 4, 125])
  })

  it('o golpe que ainda espera a reação do boneco não aparece e não conta a rodada', () => {
    const conta = placarDoBoneco([...REGISTRO, linhaDoGolpe('l4', 4, 'g4', 0)], contexto(['g4']), [], 4)
    expect([conta.golpes.length, conta.rodadas]).toEqual([3, 3])
  })

  it('golpe em outra ficha (o boneco não é alvo) fica de fora', () => {
    const golpes = new Map<string, NomeDoGolpe>([['g9', { nome: 'Soco', atacanteTokenId: BRUNO, alvos: ['t-outro'] }]])
    const conta = placarDoBoneco([linhaDoGolpe('l9', 1, 'g9', 0)], { ...contexto(), golpes }, [], 1)
    expect(conta.golpes).toEqual([])
  })

  it('primeira rodada, nada ainda: 0 em 0 rodadas, média 0', () => {
    expect(placarDoBoneco([], contexto(), [], 1)).toEqual({ golpes: [], total: 0, rodadas: 0, mediaPorRodada: 0 })
  })
})

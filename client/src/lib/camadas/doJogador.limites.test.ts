/**
 * LEITURA DE `camadasDoJogador` NO JOGADOR: limites contra pacote torto ou
 * hostil (revisão da fatia 4). Lista com mais de 64 entradas, ou id com mais
 * de 40 caracteres, vale como ausente (a ordem padrão), como o id repetido.
 */
import { describe, expect, it } from 'vitest'
import type { CamadaDoJogador } from '../../types/map'
import { lerCamadasDoJogador } from './doJogador'
import { CAMADAS_PADRAO } from './padrao'

/** As 13 padrão mais `livres` camadas livres (id do formato da fatia 7: `livre_` + 8 hexa). */
function lista(livres: number): CamadaDoJogador[] {
  return [...CAMADAS_PADRAO.map((id) => ({ id })), ...Array.from({ length: livres }, (_, i): CamadaDoJogador => ({ id: `livre_${i.toString(16).padStart(8, '0')}` }))]
}

describe('lerCamadasDoJogador: tamanho da lista', () => {
  it('64 entradas (13 padrão e 51 livres) passam', () => {
    const boa = lista(51)
    expect(boa).toHaveLength(64)
    expect(lerCamadasDoJogador(boa)).toEqual(boa)
  })

  it('65 entradas: a lista inteira vale como ausente', () => {
    const grande = lista(52)
    expect(grande).toHaveLength(65)
    expect(lerCamadasDoJogador(grande)).toBeUndefined()
  })
})

describe('lerCamadasDoJogador: tamanho do id', () => {
  // Lista crua (o leitor recebe `unknown` da rede): a leitura é que decide se o id vale.
  const comId = (id: string): unknown => [{ id: 'salas' }, { id: 'livre_1fbcd429' }, { id }]

  it('id de 40 caracteres passa', () => {
    const id = `livre_${'a'.repeat(34)}`
    expect(id).toHaveLength(40)
    expect(lerCamadasDoJogador(comId(id))?.map((c) => c.id)).toEqual(['salas', 'livre_1fbcd429', id])
  })

  it('id de 41 caracteres: a lista inteira vale como ausente', () => {
    const id = `livre_${'a'.repeat(35)}`
    expect(id).toHaveLength(41)
    expect(lerCamadasDoJogador(comId(id))).toBeUndefined()
  })
})

describe('lerCamadasDoJogador: opacidade que não é número finito', () => {
  // O JSON não carrega Infinity nem NaN (vira null): o ramo `Number.isFinite`
  // só se alcança chamando o leitor direto, com o número de verdade.
  it('alfa Infinity: a lista inteira vale como ausente', () => {
    expect(lerCamadasDoJogador([{ id: 'salas' }, { id: 'chao', alfa: Number.POSITIVE_INFINITY }])).toBeUndefined()
  })

  it('alfa -Infinity e NaN: idem', () => {
    expect(lerCamadasDoJogador([{ id: 'salas', alfa: Number.NEGATIVE_INFINITY }])).toBeUndefined()
    expect(lerCamadasDoJogador([{ id: 'salas', alfa: Number.NaN }])).toBeUndefined()
  })
})

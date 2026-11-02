/**
 * Fim da batalha (docs/planos/dbt-batalha.md, seção 13): o exemplo da p. 107
 * (6 usos de técnica Rank C com 30 PK bloqueiam 9), o teto no máximo e a
 * vitória automática por EP.
 */
import { describe, expect, it } from 'vitest'
import { ladosDerrotados, mudancaDoFim, resumoDoFim, vitoriasAutomaticas } from './fim'
import type { FichaLida } from './leitura'
import { nucleoInicial } from './motor'
import type { NucleoDBT } from './tipos'

function fichaLida(personagemId: string, parcial: Partial<FichaLida> = {}): FichaLida {
  return {
    personagemId,
    nome: personagemId,
    jogador: true,
    atributos: { for: 10, des: 10, con: 10, int: 10, sab: 10, pod: 10, pre: 10 },
    epBase: 1,
    caBase: 12,
    pv: { atual: 40, max: 40 },
    pk: { atual: 30, max: 30 },
    pkBloqueadosDaFicha: 0,
    armaduraKiPorTurno: 0,
    rankMaximo: 'C',
    usosTransfMaximaDesdeDescanso: 0,
    choqueDisponivel: true,
    deslocamentoM: 9,
    tecnicas: [],
    transformacoes: [],
    movimentos: [],
    ...parcial,
  }
}

function nucleoCom(...ids: readonly { id: string; lado: string }[]): NucleoDBT {
  return nucleoInicial(
    ids.map(({ id, lado }) => ({ tokenId: id, personagemId: id, nome: id, lado, npc: lado !== 'pj' })),
    {},
    new Map(),
    () => 'id',
  )
}

describe('resumoDoFim (8.5.1)', () => {
  it('6 usos de técnica do rank máximo C com 30 PK: 9 PK bloqueados', () => {
    const nucleo = nucleoCom({ id: 'goku', lado: 'pj' })
    const comUsos: NucleoDBT = { ...nucleo, combatentes: { goku: { ...nucleo.combatentes.goku, usos: { ...nucleo.combatentes.goku.usos, tecnicaDeRankMaximo: 6 } } } }
    const [linha] = resumoDoFim(comUsos, new Map([['goku', fichaLida('goku')]]))
    expect(linha.pctTecnicas).toBe(30)
    expect(linha.pkBloqueados).toBe(9)
    expect(mudancaDoFim(linha).pkAtual).toBe(21)
  })

  it('sem exaustão: só o Ki bloqueado na hora (2º uso da forma máxima) conta', () => {
    const nucleo = nucleoCom({ id: 'goku', lado: 'pj' })
    const semExaustao: NucleoDBT = {
      ...nucleo,
      opcoes: { ...nucleo.opcoes, exaustao: false },
      combatentes: { goku: { ...nucleo.combatentes.goku, kiBloqueado: 4, usos: { ...nucleo.combatentes.goku.usos, tecnicaDeRankMaximo: 6, transfInferiores: [2] } } },
    }
    const [linha] = resumoDoFim(semExaustao, new Map([['goku', fichaLida('goku')]]))
    expect(linha.pkBloqueados).toBe(4)
  })

  it('nunca passa do PK máximo', () => {
    const nucleo = nucleoCom({ id: 'goku', lado: 'pj' })
    const muito: NucleoDBT = { ...nucleo, combatentes: { goku: { ...nucleo.combatentes.goku, usos: { ...nucleo.combatentes.goku.usos, tecnicaDeRankMaximo: 30 } } } }
    const [linha] = resumoDoFim(muito, new Map([['goku', fichaLida('goku', { pkBloqueadosDaFicha: 10 })]]))
    expect(linha.pkBloqueados).toBe(30)
    expect(mudancaDoFim(linha).pkAtual).toBe(0)
  })
})

describe('avisos', () => {
  it('EP 4 contra EP 2: vitória automática possível', () => {
    const nucleo = nucleoCom({ id: 'goku', lado: 'pj' }, { id: 'raditz', lado: 'npc' })
    const fichas = new Map([
      ['goku', fichaLida('goku', { epBase: 4 })],
      ['raditz', fichaLida('raditz', { epBase: 2 })],
    ])
    expect(vitoriasAutomaticas(nucleo, fichas)).toEqual([{ vencedorId: 'goku', perdedorId: 'raditz' }])
  })

  it('EP 3 contra EP 2: não', () => {
    const nucleo = nucleoCom({ id: 'goku', lado: 'pj' }, { id: 'raditz', lado: 'npc' })
    const fichas = new Map([
      ['goku', fichaLida('goku', { epBase: 3 })],
      ['raditz', fichaLida('raditz', { epBase: 2 })],
    ])
    expect(vitoriasAutomaticas(nucleo, fichas)).toEqual([])
  })

  it('lado sem ninguém de pé', () => {
    const nucleo = nucleoCom({ id: 'goku', lado: 'pj' }, { id: 'raditz', lado: 'npc' })
    const caido: NucleoDBT = { ...nucleo, combatentes: { ...nucleo.combatentes, raditz: { ...nucleo.combatentes.raditz, morte: { sucessos: 0, falhas: 0, situacao: 'inconsciente' } } } }
    expect(ladosDerrotados(caido)).toEqual(['npc'])
  })
})

/**
 * CONTRATO DO DRAGON BALL TALES — a leitura tolerante de `Personagem.dbt`
 * (disco e rede): o que é torto vira padrão, nada lança, tudo tem teto.
 */
import { describe, expect, it } from 'vitest'
import { ATRIBUTO_DA_PERICIA, IDS_DAS_PERICIAS, LIMITES_DBT, VERSAO_DA_FICHA_DBT, fichaDBTVazia, lerFichaDBT } from './modelo'

describe('lerFichaDBT', () => {
  it('a ficha vazia volta igual depois de ir ao JSON', () => {
    const vazia = fichaDBTVazia()
    expect(lerFichaDBT(JSON.parse(JSON.stringify(vazia)))).toEqual(vazia)
  })

  it('o que não é objeto, e a versão do futuro, ficam sem ficha', () => {
    for (const lixo of [null, undefined, 3, 'ficha', [], true]) expect(lerFichaDBT(lixo)).toBeNull()
    expect(lerFichaDBT({ versao: VERSAO_DA_FICHA_DBT + 1 })).toBeNull()
  })

  it('objeto sem nada (ficha antiga) abre como a vazia', () => {
    expect(lerFichaDBT({})).toEqual(fichaDBTVazia())
  })

  it('campo torto vira o padrão e número sai da faixa preso na borda', () => {
    const lida = lerFichaDBT({ pdl: -50, epInicial: 'dois', kiBloqueado: Number.NaN, raca: 42, ajustes: { ca: 3.6, pvMax: -10, nada: 5, st: 'x' } })
    expect(lida?.pdl).toBe(0)
    expect(lida?.epInicial).toBe(1)
    expect(lida?.kiBloqueado).toBe(0)
    expect(lida?.raca).toBe('')
    expect(lida?.ajustes).toEqual({ ca: 4, pvMax: 0 })
  })

  it('perícia desconhecida e repetida sai; aumento torto sai', () => {
    const lida = lerFichaDBT({
      periciasTreinadas: ['atletismo', 'voar', 'atletismo', 'sentido-de-ki'],
      aumentos: [{ marco: 1, atributo: 'for', pontos: 2 }, { marco: 1, atributo: 'sorte', pontos: 1 }, { marco: 0, atributo: 'des', pontos: 1 }, { marco: 2, atributo: 'des', pontos: 3 }],
    })
    expect(lida?.periciasTreinadas).toEqual(['atletismo', 'sentido-de-ki'])
    expect(lida?.aumentos).toEqual([{ marco: 1, atributo: 'for', pontos: 2 }])
  })

  it('id ausente ou repetido ganha um id da posição, e a transformação ativa órfã vira nenhuma', () => {
    const lida = lerFichaDBT({
      tecnicas: [{ id: 'a', nome: 'Kamehameha' }, { id: 'a', nome: 'Masenko' }, { nome: '' }],
      transformacoes: [{ id: 'ssj', nome: 'Super Saiyajin' }],
      transformacaoAtiva: 'ozaru',
    })
    expect(lida?.tecnicas.map((tecnica) => tecnica.id)).toEqual(['a', 'tec_2', 'tec_3'])
    expect(lida?.tecnicas[2]?.nome).toBe('Sem nome')
    expect(lida?.transformacaoAtiva).toBeNull()
    expect(lerFichaDBT({ transformacoes: [{ id: 'ssj' }], transformacaoAtiva: 'ssj' })?.transformacaoAtiva).toBe('ssj')
  })

  it('técnica: tipo dá o atributo padrão, rótulo sem id sai, faixa à mão só com os três números', () => {
    const lida = lerFichaDBT({
      tecnicas: [
        { tipo: 'magica', rank: 'Q', rotulos: [{ rotuloId: 'alcance-engolfante', pontosExtras: 2 }, { pontosExtras: 1 }], danoManual: { minimo: 11, medio: 22 } },
        { tipo: 'fisica', atributo: 'int', danoManual: { minimo: 11, medio: 22, completo: 44 }, kiManual: 11 },
      ],
    })
    const [magica, fisica] = lida?.tecnicas ?? []
    expect(magica?.atributo).toBe('pre')
    expect(magica?.rank).toBe('E')
    expect(magica?.rotulos).toEqual([{ rotuloId: 'alcance-engolfante', pontosExtras: 2, variavel: null, investimento: 0, nota: '' }])
    expect(magica?.danoManual).toBeNull()
    expect(fisica?.atributo).toBe('int')
    expect(fisica?.danoManual).toEqual({ minimo: 11, medio: 22, completo: 44 })
    expect(fisica?.kiManual).toBe(11)
  })

  it('texto e lista passam pelos tetos', () => {
    const lida = lerFichaDBT({
      historia: 'x'.repeat(LIMITES_DBT.historia + 50),
      talentos: Array.from({ length: LIMITES_DBT.talentos + 10 }, (_, i) => ({ id: `t${i}`, nome: 'Talento' })),
    })
    expect(lida?.historia.length).toBe(LIMITES_DBT.historia)
    expect(lida?.talentos.length).toBe(LIMITES_DBT.talentos)
  })

  it('npc só aparece quando veio, com ND opcional', () => {
    expect(lerFichaDBT({})).not.toHaveProperty('npc')
    expect(lerFichaDBT({ npc: { categoria: 'chefao', rank: 'Z', nd: 10 } })?.npc).toEqual({ nd: 10, categoria: 'chefao', rank: 'Z', passivas: [], prontoId: null })
    expect(lerFichaDBT({ npc: { categoria: 'deus' } })?.npc).toEqual({ nd: null, categoria: 'comum', rank: 'E', passivas: [], prontoId: null })
  })
})

describe('tabelas fixas do contrato', () => {
  it('toda perícia tem atributo', () => {
    for (const id of IDS_DAS_PERICIAS) expect(ATRIBUTO_DA_PERICIA[id]).toBeDefined()
  })
})

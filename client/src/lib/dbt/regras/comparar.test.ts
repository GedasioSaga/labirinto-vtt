/**
 * Comparar do Dragon Ball Tales: colunas com os derivados, chance de acerto e
 * dano esperado de cada técnica contra a CA do outro, e vitória automática.
 */
import { describe, expect, it } from 'vitest'
import { type PersonagemParaCompararDBT, compararPersonagens } from './comparar'
import { distribuicaoDoAtaque } from './dano'
import { ACUMULACAO, CATALOGO, ENGOLFANTE, RAJADA_CONTINUA, RANKS_DO_LIVRO, SOMATICA, VERBAL, atributosDeTeste, escolhido, fichaDeTeste, racaDeTeste, tecnicaDeTeste } from './livro.fixture'

const CONTEXTO = { ranks: RANKS_DO_LIVRO, rotulos: CATALOGO, vidaPorGolpe: null }
const SAIYAJIN = racaDeTeste('saiyajin', 12)

const KAMEHAMEHA = tecnicaDeTeste({
  id: 'kame',
  nome: 'Kamehameha',
  rank: 'B',
  rotulos: [escolhido(ENGOLFANTE), escolhido(ACUMULACAO), escolhido(RAJADA_CONTINUA), escolhido(SOMATICA), escolhido(VERBAL)],
})

function pessoa(id: string, epInicial: number, extra: Partial<PersonagemParaCompararDBT> = {}): PersonagemParaCompararDBT {
  return {
    id,
    nome: id,
    ficha: fichaDeTeste({ raca: 'saiyajin', epInicial, pdl: 10_000, tecnicas: [KAMEHAMEHA] }),
    atributos: atributosDeTeste({ int: 14, des: 12, con: 12, pod: 14 }),
    raca: SAIYAJIN,
    ...extra,
  }
}

describe('compararPersonagens', () => {
  it('colunas com PDL, EP, PV, PK, CA e ST', () => {
    const { colunas, avisos } = compararPersonagens([pessoa('goku', 2), pessoa('vegeta', 2)], CONTEXTO)
    expect(avisos).toEqual([])
    expect(colunas[0]).toMatchObject({ id: 'goku', pdl: 10_000, epBase: 2, epTotal: 2, pv: 84, pk: 29, ca: 13, stUsados: 8 })
  })

  it('chance de acerto e dano esperado da técnica contra a CA do outro', () => {
    const { colunas } = compararPersonagens([pessoa('goku', 2), pessoa('vegeta', 2)], CONTEXTO)
    const kame = colunas[0].tecnicas[0]
    expect(kame).toMatchObject({ nome: 'Kamehameha', ki: 11, faixa: { minimo: 11, medio: 22, completo: 44 }, acerto: 2, valida: true })
    expect(kame.contra).toHaveLength(1)
    const esperado = distribuicaoDoAtaque({ modificador: 2, extras: 0, epAtacante: 2, epAlvo: 2, caDoAlvo: 13, faixa: kame.faixa })
    expect(kame.contra[0]).toEqual({ alvoId: 'vegeta', ...esperado })
  })

  it('diferença de EP e vitória automática por par', () => {
    const { pares } = compararPersonagens([pessoa('goku', 4), pessoa('raditz', 2), pessoa('nappa', 3)], CONTEXTO)
    expect(pares).toEqual([
      { aId: 'goku', bId: 'raditz', diferencaDeEP: 2, vitoriaAutomatica: 'goku' },
      { aId: 'goku', bId: 'nappa', diferencaDeEP: 1, vitoriaAutomatica: null },
      { aId: 'raditz', bId: 'nappa', diferencaDeEP: -1, vitoriaAutomatica: null },
    ])
  })

  it('jogador compara só técnicas ativas; NPC compara todas', () => {
    const guardada = { ...KAMEHAMEHA, ativa: false }
    const jogador = pessoa('jogador', 1, { ficha: fichaDeTeste({ tecnicas: [guardada] }) })
    const npc = pessoa('npc', 1, { ficha: fichaDeTeste({ tecnicas: [guardada], npc: { nd: null, categoria: 'comum', rank: 'B', passivas: [], prontoId: null } }) })
    const { colunas } = compararPersonagens([jogador, npc], CONTEXTO)
    expect(colunas[0].tecnicas).toHaveLength(0)
    expect(colunas[1].tecnicas).toHaveLength(1)
  })

  it('fora de 2 a 4 personagens avisa; acima de 4 só os 4 primeiros entram', () => {
    expect(compararPersonagens([pessoa('so', 1)], CONTEXTO).avisos).toHaveLength(1)
    const cinco = ['a', 'b', 'c', 'd', 'e'].map((id) => pessoa(id, 1))
    const comparacao = compararPersonagens(cinco, CONTEXTO)
    expect(comparacao.colunas).toHaveLength(4)
    expect(comparacao.avisos[0]).toContain('1 ficou de fora')
  })
})

/**
 * Construtor de mecânicas, fatia C4: a peça `teste` lida e traduzida para a
 * disputa da F2 (a CD por número, por fórmula com "mod(Atributo)" e pela
 * Concentração). Dados inventados; no máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { Personagem } from '../../personagem'
import { combateVazio, type BonusDaBatalha } from '../combate'
import { cdDaDisputa, quemUsaVence, rolarDisputa } from '../disputa'
import { comADisputaNoUso, TEXTO_DO_ALVO_SEM_FICHA } from '../disputaNoUso'
import { ficha } from '../fichasDaFatiaB.testkit'
import type { GolpeLancado } from '../golpe'
import { modificadorDoTeste } from '../marca'
import { SISTEMA_ONE_PIECE } from '../../sistemaOnePiece'
import { lerMecanica, type MecanicaV1 } from './modelo'
import { disputaDoTeste } from './teste'

const sistema = SISTEMA_ONE_PIECE
const bardo = ficha('Bardo de Teste', { carisma: 40 }, { hp: 300, sp: 100, escudo: 0 }, {})
const usa = { personagem: bardo }

function comTeste(teste: unknown, extra: Record<string, unknown> = {}): ReturnType<typeof lerMecanica> {
  return lerMecanica({ versao: 1, acao: 'simples', alvo: { quem: 'inimigos', forma: { tipo: 'um' } }, teste, efeitos: [{ tipo: 'selo', nome: 'Encantado', duracao: 1 }], ...extra })
}

function pecas(lida: ReturnType<typeof lerMecanica>): MecanicaV1 {
  if (lida.tipo !== 'pecas') throw new Error(`a leitura recusou: ${JSON.stringify(lida)}`)
  return lida.mecanica
}

describe('a CD do teste', () => {
  it('"12 + mod(Carisma)" na ficha de quem usa; pela Concentração 11 / 14 / 17 / pega sem teste; sem vantagem nem "se passar" guardados', () => {
    const porFormula = pecas(comTeste({ tipo: 'resistencia', alvo: { atributo: 'espirito' }, cd: { formula: '12 + mod(Carisma)' } }))
    expect(porFormula.teste).toEqual({ tipo: 'resistencia', alvo: { atributo: 'espirito' }, cd: { formula: '12 + mod(Carisma)' }, sePassar: 'nada' })
    const disputa = disputaDoTeste(porFormula.teste)
    if (disputa === null || disputa.contra.tipo !== 'cd') throw new Error('o teste não virou disputa contra CD')
    expect(disputa).toMatchObject({ quando: 'uso', testa: 'alvo', rola: { atributoId: 'espirito' } })
    expect(cdDaDisputa(disputa.contra.cd, usa, sistema, 0)).toBe(12 + modificadorDoTeste(bardo, sistema, 'carisma'))

    const tabela = pecas(comTeste({ tipo: 'resistencia', alvo: { atributo: 'espirito' }, cd: { porCarga: [{ fixo: 11 }, { fixo: 14 }, { fixo: 17 }, 'automatico'] }, sePassar: 'devolveCusto' }))
    const daTabela = disputaDoTeste(tabela.teste)
    if (daTabela === null || daTabela.contra.tipo !== 'cd') throw new Error('a tabela não virou disputa contra CD')
    const { cd } = daTabela.contra
    expect([0, 1, 2, 3].map((carga) => cdDaDisputa(cd, usa, sistema, carga))).toEqual([11, 14, 17, 'acerta'])
    expect(daTabela.seQuemUsaPerde).toEqual({ devolveOCusto: true })
  })

  it('recusa teste em aliado e CD pela Concentração com dano que não multiplica; fórmula que não fecha = ninguém rola e não pega', () => {
    const teste = { tipo: 'resistencia', alvo: { atributo: 'espirito' }, cd: { fixo: 12 } }
    expect(comTeste(teste, { alvo: { quem: 'aliados', forma: { tipo: 'um' } } }).tipo).toBe('invalida')
    const semConcentracao = { base: { fixo: 50 }, multiplicadores: { concentracao: false, surpresa: true } }
    expect(comTeste({ ...teste, cd: { porCarga: [{ fixo: 11 }, { fixo: 14 }, { fixo: 17 }, 'automatico'] } }, { dano: semConcentracao }).tipo).toBe('invalida')

    const torta = disputaDoTeste(pecas(comTeste({ ...teste, cd: { formula: '12 + mod(Sorte)' } })).teste)
    if (torta === null) throw new Error('o teste não virou disputa')
    let rolou = false
    const resultado = rolarDisputa(torta, { testa: usa, usa, resiste: usa }, sistema, 0, () => {
      rolou = true
      return 1
    })
    expect([resultado.tipo, rolou, quemUsaVence(resultado, 'alvo')]).toEqual(['semCd', false, false])
  })
})

describe('revisão da C4', () => {
  it('a CD por fórmula não leva o "dano" dos selos nem a força do NPC: "12 + mod(Carisma)" = a CD digitada como número; o selo no Carisma continua valendo', () => {
    const npcForte: Personagem = { ...bardo, tipo: 'npc', combate: { forca: 2 } }
    const furia: BonusDaBatalha = { dano: [{ nome: 'Fúria', delta: 30 }] }
    const comFuria = { personagem: npcForte, bonus: furia }
    const esperada = 12 + modificadorDoTeste(npcForte, sistema, 'carisma', furia)
    const porFormula = cdDaDisputa({ tipo: 'expressao', formula: '12 + mod(Carisma)' }, comFuria, sistema, 0)
    const naTabela = cdDaDisputa({ tipo: 'porCarga', semCarga: { tipo: 'fixa', cd: esperada }, cargas: [{ expressao: '12 + mod(Carisma)' }] }, comFuria, sistema, 1)
    expect([porFormula, naTabela]).toEqual([esperada, esperada])

    const canto: BonusDaBatalha = { carisma: [{ nome: 'Canto', delta: 40 }] }
    const comCanto = cdDaDisputa({ tipo: 'expressao', formula: '12 + mod(Carisma)' }, { personagem: npcForte, bonus: canto }, sistema, 0)
    expect(comCanto).toBe(12 + modificadorDoTeste(npcForte, sistema, 'carisma', canto))
  })

  it('alvo sem ficha: na técnica montada pega sem rolar e a linha avisa o mestre; na disputa à mão da F2 (sem o aviso) fica como antes', () => {
    const montada = disputaDoTeste(pecas(comTeste({ tipo: 'resistencia', alvo: { atributo: 'espirito' }, cd: { fixo: 12 } })).teste)
    if (montada === null) throw new Error('o teste não virou disputa')
    const lancado: GolpeLancado = {
      golpe: { id: 'g1', linhaId: 'l1', cartaId: 'c-npc', rodada: 1, atacanteTokenId: 't-bardo', atacantePersonagemId: bardo.id, autor: { tipo: 'mestre' }, nome: 'Debuff com teste', surpresa: false, overload: false, perfurante: false, alvos: [{ tokenId: 't-generico', personagemId: null, dano: null, podeReagir: false }] },
      resolvidos: [],
      gasto: null,
      combate: null,
      custo: [],
      contraUsado: null,
      acao: 'simples',
      cargaUsada: 0,
    }
    let rolou = false
    const ctx = { usa, fichaDoAlvo: () => null, combateAntes: combateVazio(), sistema, carga: 0, rolarD20: () => { rolou = true; return 1 } }
    const naMontada = comADisputaNoUso(lancado, montada, ctx)
    expect([naMontada.venceuEm, naMontada.lancado.golpe?.alvos[0]?.disputa, rolou]).toEqual([['t-generico'], TEXTO_DO_ALVO_SEM_FICHA, false])

    const { avisaSemFicha: _aviso, ...aMao } = montada
    const naMaoDaF2 = comADisputaNoUso(lancado, aMao, ctx)
    expect([naMaoDaF2.venceuEm, naMaoDaF2.lancado.golpe?.alvos[0]]).toEqual([['t-generico'], lancado.golpe?.alvos[0]])
  })
})

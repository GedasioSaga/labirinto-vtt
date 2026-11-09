/**
 * Construtor de mecânicas, fatia C4: a peça `teste` lida e traduzida para a
 * disputa da F2 (a CD por número, por fórmula com "mod(Atributo)" e pela
 * Concentração). Dados inventados; no máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import { cdDaDisputa, quemUsaVence, rolarDisputa } from '../disputa'
import { ficha } from '../fichasDaFatiaB.testkit'
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

import { describe, expect, it } from 'vitest'
import { casaNaAreaVirada } from './area'
import { cdDaDisputa, modificadorDaDisputa } from './disputa'
import { sistema } from './fichasDaFatiaB.testkit'
import { CACADA } from './fichasDaFatiaC.testkit'
import { PROJECAO, vagnCom } from './fichasDaFatiaD.testkit'
import { PAZADA, siegCom } from './fichasDaFatiaF.testkit'
import { fatorDaVelocidade, golpesSaoOverload, mecanicaDoCartao, seloDaMecanica, vezesDaForma } from './mecanicasAMao'
import { agilidadeDe } from './turnos'

/**
 * Conserto das fichas F2b (fatia código): as contas das lacunas da auditoria
 * da F2 com os cartões e atributos REAIS. Lei:
 * docs/auditoria-fichas/respostas-do-grilling.md (respostas de 08/11). No
 * máximo 2 testes por situação.
 */

const ATRACAO = 'cart_f582a96f-06cc-471c-bc92-a591ce481f73'
const IGNICAO_DO_SIEG = 'cart_d6374db1-54d6-4859-9938-1765e2684c38'

describe('fruta do Vagn (Proficiência em Fruta = 1)', () => {
  it('Atração Relâmpago: CD 10 + 1 + mod. de ESP sem carga; com carga 11, 14 e pega sem teste na 3ª', () => {
    const disputa = mecanicaDoCartao(ATRACAO)?.disputa
    if (disputa === undefined || disputa.contra.tipo !== 'cd') throw new Error('a Atração perdeu a disputa')
    const usa = { personagem: vagnCom() }
    const semCarga = 11 + modificadorDaDisputa(usa, sistema, 'espirito')
    expect([0, 1, 2, 3].map((carga) => (disputa.contra.tipo === 'cd' ? cdDaDisputa(disputa.contra.cd, usa, sistema, carga) : null))).toEqual([semCarga, 11, 14, 'acerta'])
    expect(disputa.seQuemUsaVence?.selo?.nome).toBe('Puxado pela Atração')
  })

  it('Projeção Letal pega todos numa linha reta de 6 quadrados (o 7º fica de fora)', () => {
    const area = mecanicaDoCartao(PROJECAO.id)?.area
    if (area === undefined) throw new Error('a Projeção perdeu a área')
    const origem = { col: 0, row: 0 }
    expect([6, 7].map((col) => casaNaAreaVirada(area.forma, origem, null, { col, row: 0 }))).toEqual([true, false])
    expect(area.quem).toBe('todos')
  })
})

describe('Ignição, Pazada e A Caçada Começa', () => {
  it('Ignição ligada: a Velocidade (Agilidade da ordem) do Siegfried × 1,2, para baixo (33 vira 39)', () => {
    const desligada = siegCom()
    const ligada = { ...desligada, cartoesAtivos: [IGNICAO_DO_SIEG] }
    expect([agilidadeDe(desligada, sistema), agilidadeDe(ligada, sistema)]).toEqual([33, 39])
    expect(fatorDaVelocidade([])).toBe(1)
  })

  it('Pazada atordoa por 1 turno; a Caçada dura 5 vezes e faz todo golpe do dono Overload só enquanto ligada', () => {
    expect(seloDaMecanica(PAZADA.id)).toMatchObject({ nome: 'Atordoado', turnos: 1 })
    expect(vezesDaForma(CACADA.id)).toBe(5)
    expect([golpesSaoOverload([CACADA.id]), golpesSaoOverload([])]).toEqual([true, false])
  })
})

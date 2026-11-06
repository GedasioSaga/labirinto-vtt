// @vitest-environment node
/**
 * A LEITURA DO DUELO NO SITE com a vista opcional (fatia M2): o duelo sem a
 * vista (o Worker de antes da M2) ou com a vista torta entra sem ela, e o
 * `duelo.lista` não é recusado inteiro (o frame torto fecharia a conexão da
 * campanha, que voltaria a receber a mesma lista sem fim).
 */
import { describe, expect, it } from 'vitest'
import { criarDuelo, type MotorDoDuelo } from '../../lib/treino/duelo'
import { MARINHEIRO, SISTEMA_DO_TESTE, ze } from '../../lib/treino/fichasDeTreino.testkit'
import { criarSorteio } from '../../lib/treino/sorteio'
import { dueloParaOLado, type DueloDoLado } from '../../lib/treino/vistaDoDuelo'
import { lerFrameDoDuelo } from './fioDoDuelo'

/** O duelo do Lado A como o DO o monta (o fio recortado e a vista). */
function dueloDoLadoA(): DueloDoLado {
  const sorteio = criarSorteio(7)
  const motor: MotorDoDuelo = { sistema: SISTEMA_DO_TESTE, rolarD20: () => sorteio.d20() }
  const criado = criarDuelo({ id: 'duelo_leitura', a: { contaId: 'conta_a', nome: 'Ana', fichas: [{ ...ze(60), dono: 'conta_a' }] }, b: { contaId: 'conta_b', nome: 'Bia', fichas: [{ ...MARINHEIRO, dono: 'conta_b' }] } }, motor)
  if (!criado.ok) throw new Error(`duelo recusado: ${JSON.stringify(criado)}`)
  return dueloParaOLado(criado.duelo, 'a', SISTEMA_DO_TESTE)
}

/** Ida e volta pelo JSON, como o frame chega pela rede. */
function peloFio(valor: object): unknown {
  return JSON.parse(JSON.stringify(valor))
}

describe('leitura do duelo no site', () => {
  it('duelo sem vista ou com vista torta entra com a vista null, sem derrubar o duelo.lista nem o duelo.estado', () => {
    const doLado = dueloDoLadoA()
    const semVista = peloFio({ ...doLado, vista: undefined })
    const vistaTorta = peloFio({ ...doLado, vista: { rodada: 'um' } })
    const inteiro = peloFio(doLado)

    const lista = lerFrameDoDuelo({ t: 'duelo.lista', convites: [], duelos: [semVista, vistaTorta, inteiro] })
    if (lista?.t !== 'duelo.lista') throw new Error(`a lista foi recusada: ${JSON.stringify(lista)}`)
    expect(lista.duelos.map((duelo) => ({ id: duelo.id, seq: duelo.seq, comVista: duelo.vista !== null }))).toEqual([
      { id: doLado.id, seq: doLado.seq, comVista: false },
      { id: doLado.id, seq: doLado.seq, comVista: false },
      { id: doLado.id, seq: doLado.seq, comVista: true },
    ])
    // O fio recortado para o lado passa pelo leitor do site, e a vista inteira volta igual.
    expect(lista.duelos[2]?.vista).toEqual(doLado.vista)

    expect(lerFrameDoDuelo({ t: 'duelo.estado', duelo: semVista })).toMatchObject({ t: 'duelo.estado', duelo: { id: doLado.id, vista: null } })
  })
})

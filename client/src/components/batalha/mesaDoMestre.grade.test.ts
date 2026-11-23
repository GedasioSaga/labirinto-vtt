import { describe, expect, it } from 'vitest'
import type { MapaDoAlcance } from '../../lib/batalha/alcance/quemEntra'
import { ficha, sistema } from '../../lib/batalha/fichasDaFatiaB.testkit'
import { novaCarta, type TurnosDaCena } from '../../lib/batalha/turnos'
import { alvosDaOrdem, type MesaDoMestre } from './mesaDoMestre'

/**
 * Sobra do alcance (23/11/2026): na Arena a mesa do mestre não tem mapa, e a mira da vez do bando
 * (o invocado) saía sem a conta das casas, então nada acendia no palco. A mesa leva a grade da Arena
 * (`gradeSemMapa`), como o `BatalhaDoJogador` já levava. Dados inventados; casas de 50 px.
 */

const CASA = 50
const GRADE_DA_ARENA: MapaDoAlcance = { segmentos: [], colunas: 12, linhas: 8, grade: CASA }

describe('a mesa do mestre sem mapa (a Arena)', () => {
  it('cada alvo da mira leva a grade da Arena na conta das casas; sem a grade, nenhum leva', () => {
    const lobo = ficha('Lobo de Teste', { forca: 10 }, { hp: 40, sp: 0, escudo: 0 }, {})
    const alvo = ficha('Alvo de Teste', { forca: 10 }, { hp: 100, sp: 0, escudo: 0 }, {})
    const doLobo = novaCarta('tok-lobo', lobo.id, lobo.nome)
    const doAlvo = novaCarta('tok-alvo', alvo.id, alvo.nome)
    const turnos: TurnosDaCena = { cartas: [doLobo, doAlvo], vez: doLobo.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
    const fichas = [
      { id: 'tok-lobo', name: lobo.nome, x: 75, y: 75 },
      { id: 'tok-alvo', name: alvo.nome, x: 225, y: 75 },
    ]
    const mesa: MesaDoMestre = { cena: { turnos }, fichas, tamanhoDaCasa: CASA, personagens: [lobo, alvo], equipes: undefined, sistema, rotulos: new Map() }

    const comGrade = alvosDaOrdem({ ...mesa, gradeSemMapa: GRADE_DA_ARENA }, turnos.cartas, doLobo)
    expect(comGrade.map((item) => item.naGrade?.mapa)).toEqual([GRADE_DA_ARENA, GRADE_DA_ARENA])

    const semGrade = alvosDaOrdem(mesa, turnos.cartas, doLobo)
    expect(semGrade.map((item) => item.naGrade?.mapa)).toEqual([undefined, undefined])
  })
})

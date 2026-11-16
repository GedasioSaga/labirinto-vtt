// @vitest-environment node
/**
 * Metas do robô do barril (METAS.md, seção 1), com o placar de 400 partidas
 * por dificuldade e as sementes fixas `robo|barril|<dif>|<i>`: o humano no
 * Normal vence ≥ 70% com mediana entre 10 e 16 s, no Difícil entre 30% e 55%;
 * martelar sem ritmo vence < 10% no Normal.
 */
import { describe, expect, it } from 'vitest'
import { placar, simular } from '../abrir/simular'
import { DIFICULDADES, DT } from '../abrir/tipos'
import { JOGO_BARRIL } from './jogo'
import { DIF } from './sim'
import type { Placar } from '../abrir/simular'
import type { Politica } from '../abrir/tipos'
import type { Estado } from './sim'

/** 1600 partidas no total: o padrão de 5 s do vitest não basta. */
const PRAZO_MS = 120_000

const pct = (p: Placar): string => `${(p.taxa * 100).toFixed(1)}%`
const seg = (p: Placar): string => (Number.isNaN(p.medianaVitoriaS) ? '-' : `${p.medianaVitoriaS.toFixed(2)} s`)

describe('robô do barril, 400 partidas por dificuldade', () => {
  const r: Record<string, Placar> = {}
  it('placar', () => {
    for (const dif of ['normal', 'dificil'] as const) {
      r[`humano|${dif}`] = placar(JOGO_BARRIL, dif, 'humano')
      r[`ruim|${dif}`] = placar(JOGO_BARRIL, dif, 'ruim')
    }
    console.log(
      '[barril] humano Normal ' + pct(r['humano|normal']) + ', mediana ' + seg(r['humano|normal'])
      + ' | humano Difícil ' + pct(r['humano|dificil']) + ', mediana ' + seg(r['humano|dificil'])
      + ' | ruim Normal ' + pct(r['ruim|normal']) + ' | ruim Difícil ' + pct(r['ruim|dificil']),
    )
    expect(Object.keys(r)).toHaveLength(4)
  }, PRAZO_MS)

  it('Normal: humano vence ≥ 70% e a mediana do tempo das vitórias fica entre 10 e 16 s', () => {
    expect(r['humano|normal'].taxa).toBeGreaterThanOrEqual(0.7)
    expect(r['humano|normal'].medianaVitoriaS).toBeGreaterThanOrEqual(10)
    expect(r['humano|normal'].medianaVitoriaS).toBeLessThanOrEqual(16)
  })

  it('Difícil: humano vence entre 30% e 55%', () => {
    expect(r['humano|dificil'].taxa).toBeGreaterThanOrEqual(0.3)
    expect(r['humano|dificil'].taxa).toBeLessThanOrEqual(0.55)
  })

  it('martelar sem ritmo vence < 10% no Normal', () => {
    expect(r['ruim|normal'].taxa).toBeLessThan(0.1)
  })
})

/** Envolve a política e anota o instante de cada toque dela. */
function anotando(p: Politica<Estado>, toques: number[]): Politica<Estado> {
  return (e) => {
    const s = p(e)
    if (s.toque >= 0) toques.push(e.t + DT)
    return s
  }
}

describe('robô humano joga como gente', () => {
  it('nunca golpeia duas vezes a mesma batida por querer', () => {
    for (const dif of DIFICULDADES) {
      let batidas = 0
      let toquesNoTotal = 0
      let duplas = 0
      for (let i = 0; i < 100; i++) {
        const semente = `robo|barril|${dif}|${i}`
        const toques: number[] = []
        const p = simular(JOGO_BARRIL, semente, dif, anotando(JOGO_BARRIL.roboHumano(semente, dif), toques))
        const pulsos = JOGO_BARRIL.criar(semente, dif).pulsos.filter((b) => b.pico <= p.t + DIF[dif].janela)
        // No Normal, nunca mais toques que batidas na tentativa.
        if (dif === 'normal') expect(toques.length, semente).toBeLessThanOrEqual(pulsos.length)
        for (const b of pulsos) if (toques.filter((t) => Math.abs(t - b.pico) <= DIF[dif].janela).length > 1) duplas++
        batidas += pulsos.length
        toquesNoTotal += toques.length
      }
      // No Normal, nunca dois toques na janela da mesma batida. No Difícil a síncope põe duas
      // batidas a meio tempo: um golpe atrasado na de antes pode cair na janela da adiantada,
      // e o robô ainda golpeia a adiantada que viu. É erro de tempo, raro, não martelar.
      if (dif === 'normal') expect(duplas).toBe(0)
      else {
        expect(duplas / batidas).toBeLessThan(0.01)
        expect(toquesNoTotal).toBeLessThanOrEqual(batidas)
      }
    }
  })

  it('não golpeia antes de ver qualquer brilho: o primeiro toque vem depois do começo da primeira subida', () => {
    for (let i = 0; i < 40; i++) {
      const semente = `robo|barril|normal|${i}`
      const toques: number[] = []
      simular(JOGO_BARRIL, semente, 'normal', anotando(JOGO_BARRIL.roboHumano(semente, 'normal'), toques))
      const d = DIF.normal
      // Antes da primeira subida mais o piso de reação de 120 ms, não há nada para ver.
      if (toques.length > 0) expect(toques[0]).toBeGreaterThan(d.primeiroPico - d.subida + 0.12)
    }
  })
})

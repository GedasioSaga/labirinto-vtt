// @vitest-environment node
/**
 * METAS DO ROBÔ NO BAÚ (METAS.md, ajuste 2): 400 partidas por dificuldade com
 * as sementes fixas `robo|bau|<dif>|<i>`. O robô humano vence >= 97% no Normal
 * com mediana das vitórias entre 7 e 11 s e entre 55% e 75% no Difícil; o
 * robô ruim, que toca ao acaso sem olhar, vence < 10% nos dois. E o humano
 * nunca reage em zero nem toca mais rápido que um dedo.
 */
import { describe, expect, it } from 'vitest'
import { REACAO_MIN } from '../abrir/robo'
import { placar, simular } from '../abrir/simular'
import { DIFICULDADES, DT } from '../abrir/tipos'
import { JOGO_BAU } from './jogo'
import { INTERVALO_MIN, roboHumano } from './robo'
import { criar } from './sim'
import type { Placar } from '../abrir/simular'

/** Placar de 400 partidas leva uns segundos: acima do teto padrão de 5 s do vitest. */
const TETO_MS = 120_000
/** Eventos que só saem de um toque (todo toque do robô cai num fecho que existe). */
const TOQUES = new Set(['fecho', 'emperrou', 'travado', 'segurou'])

const pct = (p: Placar): string => `${(p.taxa * 100).toFixed(1)}%`

describe('robô no baú, 400 partidas por dificuldade', () => {
  it('Normal: humano vence >= 97% com mediana das vitórias entre 7 e 11 s; ruim < 10%', () => {
    const humano = placar(JOGO_BAU, 'normal', 'humano')
    const ruim = placar(JOGO_BAU, 'normal', 'ruim')
    console.log(`[baú Normal] humano ${pct(humano)} (${humano.vitorias}/400), mediana ${humano.medianaVitoriaS.toFixed(2)} s; ruim ${pct(ruim)}`)
    expect(humano.taxa).toBeGreaterThanOrEqual(0.97)
    expect(humano.medianaVitoriaS).toBeGreaterThanOrEqual(7)
    expect(humano.medianaVitoriaS).toBeLessThanOrEqual(11)
    expect(humano.temposDeVitoria.every((t) => t <= 20)).toBe(true)
    expect(ruim.taxa).toBeLessThan(0.1)
  }, TETO_MS)

  it('Difícil: humano vence entre 55% e 75%; ruim < 10% (tocar à toa não compensa)', () => {
    const humano = placar(JOGO_BAU, 'dificil', 'humano')
    const ruim = placar(JOGO_BAU, 'dificil', 'ruim')
    console.log(`[baú Difícil] humano ${pct(humano)} (${humano.vitorias}/400), mediana ${humano.medianaVitoriaS.toFixed(2)} s; ruim ${pct(ruim)}`)
    expect(humano.taxa).toBeGreaterThanOrEqual(0.55)
    expect(humano.taxa).toBeLessThanOrEqual(0.75)
    expect(ruim.taxa).toBeLessThan(0.1)
  }, TETO_MS)
})

describe('robô humano joga como gente', () => {
  it('nunca reage em zero: o fecho acende e a mão só vem depois de 120 ms (média perto de 0,36 s)', () => {
    // Estado parado e controlado: fechos altos (nada a fazer) até o fecho 1 acender em `acende`.
    // Assim um toque já decidido antes do aviso não se passa por reação.
    const reacoes: number[] = []
    for (let i = 0; i < 200; i++) {
      const s = `reacao|${i}`
      const e = criar(s, 'normal')
      for (const f of e.fechos) f.a = 0.95
      const robo = roboHumano(s, 'normal')
      // O aviso cai em pontos diferentes do ciclo de releitura do olho.
      const acende = 1 + (i % 9) * 0.017
      for (let k = 0; k < 3 / DT; k++) {
        e.t = k * DT
        if (e.t + 1e-9 >= acende) {
          e.avisoEm = 1
          e.avisoResta = e.d.aviso
        }
        if (robo(e).toque >= 0) {
          reacoes.push(e.t - acende)
          break
        }
      }
    }
    expect(reacoes).toHaveLength(200)
    const media = reacoes.reduce((s, x) => s + x, 0) / reacoes.length
    console.log(`[baú] reação do robô ao aviso: mín ${Math.min(...reacoes).toFixed(3)} s, média ${media.toFixed(3)} s`)
    expect(Math.min(...reacoes)).toBeGreaterThanOrEqual(REACAO_MIN)
    expect(media).toBeGreaterThan(0.25)
    expect(media).toBeLessThan(0.5)
  })

  it('nada antes de 120 ms de partida', () => {
    for (const dif of DIFICULDADES) {
      for (let i = 0; i < 40; i++) {
        const s = `inicio|${dif}|${i}`
        const toques = simular(JOGO_BAU, s, dif, roboHumano(s, dif)).eventos.filter(([, n]) => TOQUES.has(n))
        expect(toques[0][0]).toBeGreaterThanOrEqual(REACAO_MIN)
      }
    }
  })

  it('o dedo não bate mais rápido que 0,16 s entre dois toques', () => {
    for (const dif of DIFICULDADES) {
      for (let i = 0; i < 40; i++) {
        const s = `dedo|${dif}|${i}`
        const toques = simular(JOGO_BAU, s, dif, roboHumano(s, dif)).eventos.filter(([, n]) => TOQUES.has(n))
        for (let k = 1; k < toques.length; k++) expect(toques[k][0] - toques[k - 1][0]).toBeGreaterThanOrEqual(INTERVALO_MIN - 1e-9)
      }
    }
  })
})

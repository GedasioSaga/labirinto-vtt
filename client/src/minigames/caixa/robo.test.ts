// @vitest-environment node
/**
 * Metas do robô da caixa (METAS.md, seção 1), com o placar da base comum:
 * 400 partidas por dificuldade e robô, sementes fixas robo|caixa|<dif>|<i>.
 * O humano só vê o jogo pelo olho com atraso e nunca reage em zero; o ruim
 * segura e solta ao acaso, sem olhar.
 */
import { describe, expect, it } from 'vitest'
import { REACAO_MIN } from '../abrir/robo'
import { placar } from '../abrir/simular'
import type { Placar } from '../abrir/simular'
import { DIFICULDADES } from '../abrir/tipos'
import { JOGO_CAIXA } from './jogo'
import { roboHumano } from './robo'
import { criar, passo, pronto } from './sim'

/* Os placares rodam na coleta (fora do `it`): são ~1 s cada e não devem contar no tempo limite de um teste. */
const HUMANO_NORMAL = placar(JOGO_CAIXA, 'normal', 'humano')
const HUMANO_DIFICIL = placar(JOGO_CAIXA, 'dificil', 'humano')
const RUIM_NORMAL = placar(JOGO_CAIXA, 'normal', 'ruim')
const RUIM_DIFICIL = placar(JOGO_CAIXA, 'dificil', 'ruim')

const linha = (rotulo: string, p: Placar): string =>
  `${rotulo}: vitória ${(p.taxa * 100).toFixed(1)}% (${p.vitorias}/${p.partidas}), mediana das vitórias ${Number.isNaN(p.medianaVitoriaS) ? '-' : p.medianaVitoriaS.toFixed(2) + ' s'}`

console.log(['Caixa, placar do robô:', linha('humano Normal', HUMANO_NORMAL), linha('humano Difícil', HUMANO_DIFICIL),
  linha('ruim Normal', RUIM_NORMAL), linha('ruim Difícil', RUIM_DIFICIL)].join('\n  '))

describe('robô que joga como gente, 400 partidas por dificuldade', () => {
  it('Normal: vence >= 70%', () => {
    expect(HUMANO_NORMAL.taxa).toBeGreaterThanOrEqual(0.7)
  })

  it('Normal: mediana do tempo das vitórias entre 10 e 16 s', () => {
    expect(HUMANO_NORMAL.medianaVitoriaS).toBeGreaterThanOrEqual(10)
    expect(HUMANO_NORMAL.medianaVitoriaS).toBeLessThanOrEqual(16)
  })

  it('Difícil: vence entre 30% e 55%', () => {
    expect(HUMANO_DIFICIL.taxa).toBeGreaterThanOrEqual(0.3)
    expect(HUMANO_DIFICIL.taxa).toBeLessThanOrEqual(0.55)
  })

  it('toda vitória vem em até 20 s', () => {
    for (const p of [HUMANO_NORMAL, HUMANO_DIFICIL, RUIM_NORMAL, RUIM_DIFICIL]) for (const t of p.temposDeVitoria) expect(t).toBeLessThanOrEqual(20)
  })

  it('nunca reação zero: todo aperto vem pelo menos 120 ms depois de o pé de cabra assentar', () => {
    let apertos = 0
    for (const dif of DIFICULDADES) {
      for (let i = 0; i < 40; i++) {
        const semente = `reacao|caixa|${dif}|${i}`
        const e = criar(semente, dif)
        const politica = roboHumano(semente, dif)
        // Instante em que o pé de cabra assentou por último (a partida começa assentada).
        let assentouEm = 0
        let estava = pronto(e)
        while (e.fim === null) {
          const antes = e.enchendo
          passo(e, politica(e))
          // Atualiza antes de conferir: um aperto no mesmo passo em que assenta tem de dar reação 0 e falhar.
          const agora = pronto(e) || e.enchendo
          if (agora && !estava) assentouEm = e.t
          estava = agora
          if (!antes && e.enchendo) {
            apertos++
            expect(e.t - assentouEm, semente).toBeGreaterThanOrEqual(REACAO_MIN - 1e-9)
          }
        }
      }
    }
    expect(apertos).toBeGreaterThan(400)
  })
})

describe('robô ruim (segura e solta ao acaso, sem olhar)', () => {
  it('Normal: vence < 15%', () => {
    expect(RUIM_NORMAL.taxa).toBeLessThan(0.15)
  })
})

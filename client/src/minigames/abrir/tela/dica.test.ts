// @vitest-environment node
/**
 * DICA DE OBJETIVO (METAS.md do estúdio, ajuste 2; porte de vitrine/dica.test.ts):
 * texto curto que diz como ganhar e uma área de parede livre para ela em cada
 * jogo, dentro da tela, longe da vela e da boca e, no baú, fora dos alvos dos
 * fechos. Que nenhum pixel do jogo cai na área foi medido no Edge pelo estúdio.
 */
import { describe, expect, it } from 'vitest'
import { JOGO_BAU } from '../../bau/jogo'
import { VELA_X } from '../cenario'
import { H, W } from '../desenho'
import { DIFICULDADES, MAX_CARACTERES_DA_DICA } from '../tipos'
import { JOGOS_NA_TELA } from './jogos'

/** O halo da vela vai de VELA_X - 14 a VELA_X + 14 (cenario.ts). */
const HALO_DA_VELA = 14

/** Frases: trechos que terminam em ponto, exclamação ou interrogação. */
const frases = (s: string): number => (s.match(/[.!?](\s|$)/g) ?? []).length

describe('dica de objetivo', () => {
  for (const jogo of Object.values(JOGOS_NA_TELA)) {
    describe(jogo.nome, () => {
      it(`texto curto: até ${MAX_CARACTERES_DA_DICA} caracteres e 2 frases`, () => {
        expect(jogo.objetivo.trim()).toBe(jogo.objetivo)
        expect(jogo.objetivo.length).toBeGreaterThan(20)
        expect(jogo.objetivo.length).toBeLessThanOrEqual(MAX_CARACTERES_DA_DICA)
        expect(frases(jogo.objetivo)).toBeGreaterThanOrEqual(1)
        expect(frases(jogo.objetivo)).toBeLessThanOrEqual(2)
      })

      it('área inteira dentro da tela, à esquerda do halo da vela e sem a boca do recipiente', () => {
        const [x, y, w, h] = jogo.areaDaDica
        for (const v of [x, y, w, h]) expect(Number.isInteger(v)).toBe(true)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x + w).toBeLessThanOrEqual(W)
        expect(y + h).toBeLessThanOrEqual(H)
        expect(x + w).toBeLessThanOrEqual(VELA_X - HALO_DA_VELA)
        const [bx, by] = jogo.boca
        expect(bx >= x && bx < x + w && by >= y && by < y + h).toBe(false)
      })
    })
  }

  it('baú: nenhum ponto da área é alvo de fecho (o toque na dica não abre nada sem querer)', () => {
    const [x, y, w, h] = JOGO_BAU.areaDaDica
    for (const dif of DIFICULDADES) {
      const e = JOGO_BAU.criar('dica', dif)
      for (let py = y; py < y + h; py += 0.5) {
        for (let px = x; px < x + w; px += 0.5) expect(JOGO_BAU.alvoEm(px, py, e)).toBe(-1)
      }
    }
  })
})

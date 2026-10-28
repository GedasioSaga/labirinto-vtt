import { describe, expect, it } from 'vitest'
import { simular, type DificuldadeSim } from './sim'

/**
 * A PROVA DO JOGO (decisão do usuário, 28/10/2026: uma só). O robô que joga
 * como gente (reação ~250 ms com erro, semente fixa) joga 200 rodadas de cada
 * dificuldade na simulação JÁ PORTADA, com as sementes de
 * docs/design/minigame-tiro/provas/gerar-provas.cjs. O protótipo aprovado deu
 * bronze em 79,5% no Normal e 23% no Extremo (provas/testes.json); o porte tem
 * de cair a ±3 pontos percentuais disso.
 */

const RODADAS = 200
const TOLERANCIA = 0.03
const BRONZE_DO_PROTOTIPO: Readonly<Record<DificuldadeSim, number>> = { normal: 0.795, extremo: 0.23 }

function taxaDeBronze(dif: DificuldadeSim): number {
  let bronze = 0
  for (let i = 0; i < RODADAS; i++) {
    // Qualquer medalha conta: prata e ouro passam do bronze, como na conta do protótipo.
    if (simular(dif, `robo|${dif}|${i}`, {}).medalha !== null) bronze++
  }
  return bronze / RODADAS
}

describe('tiro: robô humano na simulação portada', () => {
  it('dá o bronze do protótipo no Normal e no Extremo (±3 p.p.)', () => {
    const normal = taxaDeBronze('normal')
    const extremo = taxaDeBronze('extremo')
    // O número que a prova dá é o entregável (vai no relatório), não depuração.
    console.log(`bronze do robô: Normal ${(normal * 100).toFixed(1)}%, Extremo ${(extremo * 100).toFixed(1)}%`)
    expect(Math.abs(normal - BRONZE_DO_PROTOTIPO.normal)).toBeLessThanOrEqual(TOLERANCIA)
    expect(Math.abs(extremo - BRONZE_DO_PROTOTIPO.extremo)).toBeLessThanOrEqual(TOLERANCIA)
  })
})

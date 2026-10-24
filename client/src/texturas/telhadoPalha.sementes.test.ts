import { expect, it } from 'vitest'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { PALETA_DO_TETO } from '../lib/telhado/paletas'
import { escalaDaTexturaDoTelhado } from '../pixi/telhadosRenderer'
import { pintarTelhado } from './telhado'
import { CROMA_P95_MAXIMO, FOLGA_DO_CROMA_MEDIO, SATURACAO_P95_MAXIMA, croma, falhasDaCor, medirCorDoTelhado } from './telhadoPalha.testkit'
import { oklabDoHex } from './meioTermo/materiais'

/**
 * VARREDURA DE 1000 SALAS do telhado de palha (MT6). O telhado não tem semente
 * própria: o desenho sai da forma e do lugar da sala (régua e altura de cada
 * água). Então a "semente do app" aqui é a SALA: 1000 salas sorteadas (grade de
 * 40, 50, 64 e 70; retângulo de 2 a 10 por 2 a 8 casas ou L; posição de 0 a 60
 * casas), cada uma numa das 6 cores, pintada como o app pinta
 * (`escalaDaTexturaDoTelhado`, a escala do jogador e do editor) e a 3x. Todo
 * telhado tem de ficar no alvo de cor do estilo; o pior de cada critério vai
 * para o registro.
 */

const SALAS = 1000

/** Sorteio reprodutível (mulberry32): a sala `i` é sempre a mesma. */
function sorteador(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function salaSorteada(i: number): readonly PontoDoTelhado[] {
  const r = sorteador(9001 + i)
  const g = [40, 50, 64, 70][Math.floor(r() * 4)]
  const x0 = Math.floor(r() * 60) * g
  const y0 = Math.floor(r() * 60) * g
  const w = (2 + Math.floor(r() * 9)) * g
  const h = (2 + Math.floor(r() * 7)) * g
  if (r() < 0.7) return [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }]
  // L: tira um canto de pelo menos 1 casa, deixando os braços com 1 casa ou mais.
  const cw = Math.max(g, Math.floor((r() * (w - g)) / g) * g)
  const ch = Math.max(g, Math.floor((r() * (h - g)) / g) * g)
  return [
    { x: x0, y: y0 },
    { x: x0 + w, y: y0 },
    { x: x0 + w, y: y0 + h - ch },
    { x: x0 + w - cw, y: y0 + h - ch },
    { x: x0 + w - cw, y: y0 + h },
    { x: x0, y: y0 + h },
  ]
}

it('1000 salas de palha, na escala do app e a 3x: todas no alvo de cor do estilo', { timeout: 600_000 }, () => {
  const falhas: string[] = []
  const pior = { saturacao: 0, croma: 0, acimaDaCor: -Infinity }
  for (let i = 0; i < SALAS; i += 1) {
    const sala = salaSorteada(i)
    const cor = PALETA_DO_TETO.palha[i % 6].hex
    const propria = croma(oklabDoHex(cor))
    for (const escala of [escalaDaTexturaDoTelhado(sala), 3]) {
      const img = pintarTelhado(sala, 'palha', cor, escala)
      expect(img.largura, `sala ${i}`).toBeGreaterThan(0)
      const m = medirCorDoTelhado(img)
      pior.saturacao = Math.max(pior.saturacao, m.saturacaoP95)
      pior.croma = Math.max(pior.croma, m.cromaP95)
      pior.acimaDaCor = Math.max(pior.acimaDaCor, m.cromaMedio - propria)
      const f = falhasDaCor(m, cor)
      if (f.length > 0) falhas.push(`sala ${i} (${cor}, ${escala.toFixed(2)}x): ${f.join(', ')}`)
    }
  }
  console.log(
    `[medida] varredura de ${SALAS} salas de palha: pior saturação p95 ${pior.saturacao.toFixed(3)} (teto ${SATURACAO_P95_MAXIMA}), ` +
      `pior croma p95 ${pior.croma.toFixed(4)} (teto ${CROMA_P95_MAXIMO.toFixed(4)}), pior croma médio acima da cor ${pior.acimaDaCor.toFixed(4)} (teto ${FOLGA_DO_CROMA_MEDIO})`,
  )
  expect(falhas.slice(0, 10)).toEqual([])
})

/** Salas grandes (1100 a 2200 por 950 a 1700 px, na grade): passam de 1 milhão de pixels e o app pinta abaixo de 1x. */
function salaGrandeSorteada(i: number): readonly PontoDoTelhado[] {
  const r = sorteador(51_001 + i)
  const g = [40, 50, 64, 70][Math.floor(r() * 4)]
  const x0 = Math.floor(r() * 40) * g
  const y0 = Math.floor(r() * 40) * g
  const w = Math.ceil((1100 + r() * 1100) / g) * g
  const h = Math.ceil((950 + r() * 750) / g) * g
  return [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }]
}

const SALAS_GRANDES = 60

it(`${SALAS_GRANDES} salas grandes de palha, na escala do app ABAIXO de 1x (V de ~6 px, fio de ~1 px, serrilhado): no alvo de cor`, { timeout: 600_000 }, () => {
  const falhas: string[] = []
  const pior = { saturacao: 0, croma: 0, acimaDaCor: -Infinity, menorEscala: Infinity }
  for (let i = 0; i < SALAS_GRANDES; i += 1) {
    const sala = salaGrandeSorteada(i)
    const cor = PALETA_DO_TETO.palha[i % 6].hex
    const escala = escalaDaTexturaDoTelhado(sala)
    expect(escala, `sala grande ${i}`).toBeLessThan(1)
    pior.menorEscala = Math.min(pior.menorEscala, escala)
    const m = medirCorDoTelhado(pintarTelhado(sala, 'palha', cor, escala))
    pior.saturacao = Math.max(pior.saturacao, m.saturacaoP95)
    pior.croma = Math.max(pior.croma, m.cromaP95)
    pior.acimaDaCor = Math.max(pior.acimaDaCor, m.cromaMedio - croma(oklabDoHex(cor)))
    const f = falhasDaCor(m, cor)
    if (f.length > 0) falhas.push(`sala grande ${i} (${cor}, ${escala.toFixed(2)}x): ${f.join(', ')}`)
  }
  console.log(
    `[medida] ${SALAS_GRANDES} salas grandes (escala de ${pior.menorEscala.toFixed(2)}x a menos de 1x): pior saturação p95 ${pior.saturacao.toFixed(3)}, ` +
      `pior croma p95 ${pior.croma.toFixed(4)}, pior croma médio acima da cor ${pior.acimaDaCor.toFixed(4)}`,
  )
  expect(falhas.slice(0, 10)).toEqual([])
})

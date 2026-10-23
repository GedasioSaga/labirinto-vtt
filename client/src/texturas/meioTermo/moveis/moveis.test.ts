import { describe, expect, it } from 'vitest'
import type { OpcaoDeMaterial } from '../materiais'
import { G, type LadoDoMovel } from './contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel, type TipoComTextura } from './index'
import { digitalDosPixels, medirImagem } from './medidas.testkit'

/**
 * Os 6 móveis "de cima com volume" da fatia MT2, cada um em 3 materiais, no
 * nível 1 e no nível 3, medidos pelos critérios do plano
 * (`docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, linha MT2): a
 * imagem cobre a pegada, a cor é contida, nada some de tão escuro e o
 * contorno nunca é preto.
 */

const COBERTURA_MINIMA = 0.25
const SATURACAO_P95_MAXIMA = 0.62
const BRILHO_MEDIO_MINIMO = 0.17
const CONTORNO_MINIMO = 0.06
const GERAR_A_3X_MS = 50

interface Caso {
  readonly tipo: TipoComTextura
  readonly lado: LadoDoMovel
  readonly casasW: number
  readonly casasH: number
  readonly materiais: readonly (readonly OpcaoDeMaterial[])[]
}

/** Tamanho padrão de cada tipo (`lib/mobilia.ts`), arredondado a 0,25 casa como na chave da imagem. Nogueira, a madeira mais escura, em todos. */
const CASOS: readonly Caso[] = [
  { tipo: 'barril', lado: 'frente', casasW: 0.75, casasH: 0.75, materiais: [['carvalho', 'ferro'], ['nogueira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'caixa', lado: 'frente', casasW: 0.75, casasH: 0.75, materiais: [['pinho'], ['cerejeira'], ['nogueira']] },
  { tipo: 'bau', lado: 'frente', casasW: 1, casasH: 0.5, materiais: [['nogueira', 'latao'], ['carvalho', 'ferro'], ['cerejeira', 'latao']] },
  { tipo: 'bau', lado: 'lado', casasW: 0.5, casasH: 0.5, materiais: [['nogueira', 'latao'], ['pinho', 'ferro'], ['velha', 'latao']] },
  { tipo: 'catre', lado: 'frente', casasW: 1, casasH: 2, materiais: [['carvalho', 'vinho', 'linho'], ['nogueira', 'azul', 'musgo'], ['pinho', 'ocre', 'vinho']] },
  { tipo: 'mesa', lado: 'frente', casasW: 2, casasH: 1, materiais: [['carvalho'], ['nogueira'], ['velha']] },
  { tipo: 'cadeira', lado: 'frente', casasW: 0.5, casasH: 0.5, materiais: [['carvalho', 'palha'], ['nogueira', 'mesma'], ['pinho', 'palha']] },
  { tipo: 'cadeira', lado: 'lado', casasW: 0.5, casasH: 0.75, materiais: [['carvalho', 'palha'], ['nogueira', 'mesma'], ['cerejeira', 'palha']] },
]

function desenho(caso: Caso, materiais: readonly OpcaoDeMaterial[]): DesenhoDoMovel {
  return { tipo: caso.tipo, lado: caso.lado, materiais, casasW: caso.casasW, casasH: caso.casasH, semente: 7 }
}

function nomeDo(caso: Caso, materiais: readonly OpcaoDeMaterial[]): string {
  return `${caso.tipo}${caso.lado === 'lado' ? ' de lado' : ''} ${materiais.join('+')}`
}

describe('móveis do Meio-Termo de cima: pixels medidos', () => {
  for (const caso of CASOS) {
    for (const materiais of caso.materiais) {
      for (const nivel of [1, 3]) {
        it(`${nomeDo(caso, materiais)} no nível ${nivel}: cobre, cor contida, claro, contorno nunca preto`, () => {
          const S = escalaDoNivel(nivel)
          const { limites, pixels } = pintarMovel(desenho(caso, materiais), S)
          const pegada = caso.casasW * G * S * (caso.casasH * G * S)
          const m = medirImagem(pixels, limites.W, limites.H, pegada)
          expect(m.cobertura).toBeGreaterThanOrEqual(COBERTURA_MINIMA)
          expect(m.saturacaoP95).toBeLessThanOrEqual(SATURACAO_P95_MAXIMA)
          expect(m.brilhoMedio).toBeGreaterThanOrEqual(BRILHO_MEDIO_MINIMO)
          expect(m.contornoMinimo).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
          expect(m.brilhoMinimo).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
        })
      }
    }
  }
})

describe('móveis do Meio-Termo de cima: mesma entrada, mesma imagem', () => {
  for (const caso of CASOS) {
    it(`${nomeDo(caso, caso.materiais[0])}: duas gerações dão a mesma digital, outro material dá outra`, () => {
      const S = escalaDoNivel(3)
      const a = pintarMovel(desenho(caso, caso.materiais[0]), S)
      const b = pintarMovel(desenho(caso, caso.materiais[0]), S)
      const outro = pintarMovel(desenho(caso, caso.materiais[1]), S)
      expect(digitalDosPixels(b.pixels)).toBe(digitalDosPixels(a.pixels))
      expect(digitalDosPixels(outro.pixels)).not.toBe(digitalDosPixels(a.pixels))
    })
  }
})

describe('móveis do Meio-Termo de cima: tempo de geração a 3x', () => {
  /** Mediana de 5 gerações: uma pausa do coletor de lixo não reprova a peça. */
  const RODADAS = 5
  for (const caso of CASOS) {
    it(`${nomeDo(caso, caso.materiais[0])} a 3x em até ${GERAR_A_3X_MS} ms`, () => {
      const S = escalaDoNivel(3)
      const tempos: number[] = []
      for (let i = 0; i < RODADAS; i += 1) {
        const inicio = performance.now()
        pintarMovel(desenho(caso, caso.materiais[0]), S)
        tempos.push(performance.now() - inicio)
      }
      tempos.sort((a, b) => a - b)
      expect(tempos[Math.floor(RODADAS / 2)]).toBeLessThanOrEqual(GERAR_A_3X_MS)
    })
  }
})

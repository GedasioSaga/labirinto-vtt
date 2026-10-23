import { oklabDoHex, oklabDoRgb } from './meioTermo/materiais'
import type { ImagemDoTelhado } from './telhado'

/**
 * Medida da cor de UM telhado de palha (a peça), para os testes da MT6: a
 * saturação HSV p95 (o limite das peças desde a MT2) e o croma OKLab p95 e
 * médio, contra o token `palha` do estilo. Por histograma: a varredura de
 * 1000 salas mede milhões de pixels sem ordenar listas.
 */

/** Palha do estilo (`docs/design/vila-meio-termo/README.md`, token `palha`): o teto do croma. */
export const PALHA_DO_ESTILO = '#d6b56a'
/** Saturação HSV p95 por peça aceita desde a MT2 (`docs/planos/meio-termo-texturas-objetos-2026-10-23.md`). */
export const SATURACAO_P95_MAXIMA = 0.62
export const croma = (lab: readonly [number, number, number]): number => Math.hypot(lab[1], lab[2])
/** Croma p95 de um telhado de palha: até 10% acima do token do estilo (a luz da textura clareia e escurece). */
export const CROMA_P95_MAXIMO = croma(oklabDoHex(PALHA_DO_ESTILO)) * 1.1
/** Folga do croma médio sobre o da própria cor: a textura não satura a cor escolhida em média. */
export const FOLGA_DO_CROMA_MEDIO = 0.006

export interface MedidaDaCor {
  readonly saturacaoP95: number
  readonly cromaP95: number
  readonly cromaMedio: number
}

const PASSOS_DA_SATURACAO = 1000
const PASSOS_DO_CROMA = 4000
const CROMA_DO_HISTOGRAMA = 0.4
/** Croma de cada cor já vista: a conta do OKLab é cara e um telhado repete poucas centenas de cores. */
const cromaDaCor = new Map<number, number>()

function p95(hist: Uint32Array, total: number, passo: number): number {
  const alvo = Math.floor(total * 0.95)
  let soma = 0
  for (let i = 0; i < hist.length; i += 1) {
    soma += hist[i]
    if (soma > alvo) return i * passo
  }
  return (hist.length - 1) * passo
}

/** Saturação HSV e croma OKLab dos pixels cheios (alfa 255) de UM telhado. */
export function medirCorDoTelhado(img: ImagemDoTelhado): MedidaDaCor {
  const sat = new Uint32Array(PASSOS_DA_SATURACAO + 1)
  const cro = new Uint32Array(PASSOS_DO_CROMA + 1)
  let total = 0
  let somaDoCroma = 0
  const px = img.pixels
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 255) continue
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    const mx = Math.max(r, g, b)
    sat[Math.round((mx > 0 ? (mx - Math.min(r, g, b)) / mx : 0) * PASSOS_DA_SATURACAO)] += 1
    const chave = (r << 16) | (g << 8) | b
    let c = cromaDaCor.get(chave)
    if (c === undefined) {
      c = croma(oklabDoRgb(r, g, b))
      cromaDaCor.set(chave, c)
    }
    cro[Math.min(PASSOS_DO_CROMA, Math.round((c / CROMA_DO_HISTOGRAMA) * PASSOS_DO_CROMA))] += 1
    somaDoCroma += c
    total += 1
  }
  return {
    saturacaoP95: p95(sat, total, 1 / PASSOS_DA_SATURACAO),
    cromaP95: p95(cro, total, CROMA_DO_HISTOGRAMA / PASSOS_DO_CROMA),
    cromaMedio: total > 0 ? somaDoCroma / total : 0,
  }
}

/** O que passou dos limites do estilo num telhado de palha na cor `corHex` (da paleta). */
export function falhasDaCor(m: MedidaDaCor, corHex: string): string[] {
  const falhas: string[] = []
  if (m.saturacaoP95 > SATURACAO_P95_MAXIMA) falhas.push(`saturação p95 ${m.saturacaoP95.toFixed(3)}`)
  if (m.cromaP95 > CROMA_P95_MAXIMO) falhas.push(`croma p95 ${m.cromaP95.toFixed(4)} > ${CROMA_P95_MAXIMO.toFixed(4)}`)
  const proprio = croma(oklabDoHex(corHex))
  if (m.cromaMedio > proprio + FOLGA_DO_CROMA_MEDIO) falhas.push(`croma médio ${m.cromaMedio.toFixed(4)} acima da cor ${proprio.toFixed(4)}`)
  return falhas
}

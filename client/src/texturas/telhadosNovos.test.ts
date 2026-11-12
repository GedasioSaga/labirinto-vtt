import { describe, expect, it } from 'vitest'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { MODELOS_DO_TETO, PALETA_DO_TETO, type ModeloDoTeto } from '../lib/telhado/paletas'
import { pintarTelhado, type ImagemDoTelhado } from './telhado'
import { falhasDaCor, medirCorDoTelhado } from './telhadoPalha.testkit'

/**
 * ARDÓSIA, METAL E TABUINHAS (pedido de 12/11/2026): o desenho de cada um é
 * DELE (não é telha recolorida nem igual a outro modelo na mesma cor), a cor
 * fica contida e no tom escolhido, e mesma entrada dá os mesmos bytes. A
 * aprovação do olho é a da folha (`folhaDosTelhadosNovos.test.ts`).
 */

const p = (x: number, y: number): PontoDoTelhado => ({ x, y })
const RET = [p(40, 60), p(320, 60), p(320, 220), p(40, 220)]
const L = [p(0, 0), p(240, 0), p(240, 100), p(100, 100), p(100, 240), p(0, 240)]
const NOVOS: readonly ModeloDoTeto[] = ['ardosia', 'metal', 'tabuinhas']

/** FNV-1a de 32 bits dos bytes (a mesma de `telhadoSemMudanca.test.ts`). */
function digital(bytes: Uint8ClampedArray): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const luz = (img: ImagemDoTelhado, i: number): number => 0.2126 * img.pixels[i] + 0.7152 * img.pixels[i + 1] + 0.0722 * img.pixels[i + 2]

/** Fração dos pixels cheios em que a luz das duas imagens (mesma forma e escala) difere mais que 4. */
function diferentes(a: ImagemDoTelhado, b: ImagemDoTelhado): number {
  let cheios = 0
  let n = 0
  for (let i = 0; i < a.pixels.length; i += 4) {
    if (a.pixels[i + 3] < 255 || b.pixels[i + 3] < 255) continue
    cheios += 1
    if (Math.abs(luz(a, i) - luz(b, i)) > 4) n += 1
  }
  return n / cheios
}

/** Digitais tiradas em 12/11/2026, depois da 4ª folha. Mudou o desenho de propósito? Regrave AQUI, com o motivo. */
const DIGITAIS: Readonly<Record<string, string>> = {
  'ardosia ret 1x': '3d17d655',
  'ardosia L 2x': 'aa35f43a',
  'metal ret 1x': '1e0ab002',
  'metal L 2x': '0f000992',
  'tabuinhas ret 1x': 'bc66ee85',
  'tabuinhas L 2x livre': 'd4e8c23c',
}

describe('ardósia, metal e tabuinhas: o desenho', () => {
  it('cada um pinta o próprio material: na mesma cor, a maioria dos pixels difere de cada um dos outros cinco', () => {
    const cor = '#7a6a5c'
    const imagens = Object.fromEntries(MODELOS_DO_TETO.map((m) => [m, pintarTelhado(RET, m, cor, 1)]))
    const pares: string[] = []
    for (const novo of NOVOS) {
      for (const outro of MODELOS_DO_TETO) {
        if (outro === novo) continue
        const f = diferentes(imagens[novo], imagens[outro])
        if (f <= 0.5) pares.push(`${novo} x ${outro}: ${f.toFixed(2)}`)
      }
    }
    expect(pares).toEqual([])
  })

  // 72 telhados, metade a 3x: ~5 s sozinho, mais com a máquina ocupada (o teto de 5 s padrão estourou ao lado da varredura da palha).
  it('cor contida e no tom escolhido, POR TELHADO, nas 6 cores, em 2 formas e 2 escalas; mesma entrada, mesmos bytes', { timeout: 60_000 }, () => {
    const falhas: string[] = []
    for (const modelo of NOVOS) {
      for (const cor of PALETA_DO_TETO[modelo]) {
        for (const [nome, poligono] of [['ret', RET], ['L', L]] as const) {
          for (const k of [1, 3]) {
            const img = pintarTelhado(poligono, modelo, cor.hex, k)
            const f = falhasDaCor(medirCorDoTelhado(img), cor.hex)
            // O tom médio fica perto da cor escolhida (a textura tira o claro e o escuro dela).
            const soma = [0, 0, 0]
            let n = 0
            for (let i = 0; i < img.pixels.length; i += 4) {
              if (img.pixels[i + 3] < 255) continue
              for (let c = 0; c < 3; c += 1) soma[c] += img.pixels[i + c]
              n += 1
            }
            const alvo = [1, 3, 5].map((j) => Number.parseInt(cor.hex.slice(j, j + 2), 16))
            for (let c = 0; c < 3; c += 1) if (Math.abs(soma[c] / n - alvo[c]) >= 20) f.push(`canal ${c} média ${(soma[c] / n).toFixed(0)} longe de ${alvo[c]}`)
            if (f.length > 0) falhas.push(`${modelo} ${cor.nome} ${nome} ${k}x: ${f.join(', ')}`)
          }
        }
      }
    }
    expect(falhas).toEqual([])
    const casos: readonly [string, ModeloDoTeto, readonly PontoDoTelhado[], string, number][] = [
      ['ardosia ret 1x', 'ardosia', RET, PALETA_DO_TETO.ardosia[0].hex, 1],
      ['ardosia L 2x', 'ardosia', L, PALETA_DO_TETO.ardosia[4].hex, 2],
      ['metal ret 1x', 'metal', RET, PALETA_DO_TETO.metal[0].hex, 1],
      ['metal L 2x', 'metal', L, PALETA_DO_TETO.metal[2].hex, 2],
      ['tabuinhas ret 1x', 'tabuinhas', RET, PALETA_DO_TETO.tabuinhas[0].hex, 1],
      ['tabuinhas L 2x livre', 'tabuinhas', L, '#3f7fbf', 2],
    ]
    const atual = Object.fromEntries(casos.map(([nome, modelo, poligono, cor, k]) => [nome, digital(pintarTelhado(poligono, modelo, cor, k).pixels)]))
    // Duas chamadas, os mesmos bytes (a memória curta dos sorteios não muda nada entre uma e outra).
    expect(digital(pintarTelhado(L, 'metal', PALETA_DO_TETO.metal[2].hex, 2).pixels)).toBe(atual['metal L 2x'])
    expect(atual).toEqual(DIGITAIS)
  })
})

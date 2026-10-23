import { describe, expect, it } from 'vitest'
import type { Prop } from '../../../types/map'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import type { OpcaoDeMaterial } from '../materiais'
import { G } from './contexto'
import { escalaDoNivel, GRADE_DE_REFERENCIA, pintarMovel, type DesenhoDoMovel } from './index'
import { PERIODO_DO_MOTIVO } from './tapete'

/**
 * Revisão da MT3: o tapete redondo deixa de ler como alvo, o nicho do armário
 * de madeira velha fica cinza, o veio das portas do aparador de lado corre em
 * pé, e o limite da grade de referência do tapete fica medido.
 */

function luminancia(px: Uint8ClampedArray, o: number): number {
  return 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]
}

describe('A7: o tapete redondo tem o medalhão em losango, como o retangular, e um fio claro só', () => {
  const S = escalaDoNivel(3)
  const tapete = (material: OpcaoDeMaterial): DesenhoDoMovel => ({ tipo: 'tapete', lado: 'frente', materiais: [material], casasW: 2, casasH: 2, semente: 7, forma: 'redondo' })
  /** Raio do campo de dentro da borda (px do protótipo) no tapete de 2 casas: o losango tem o vértice a 0,6 dele. */
  const CAMPO = G - 0.12 * 2 * G

  for (const material of ['ocre', 'musgo', 'azul'] as const) {
    it(`${material}: entre a diagonal do losango e o vértice, o eixo é medalhão e a diagonal é campo (um círculo daria o mesmo nos dois)`, () => {
      const { limites, pixels } = pintarMovel(tapete(material), S)
      const brilhoEm = (x: number, y: number): number => luminancia(pixels, (Math.floor((y - limites.y0) * S) * limites.W + Math.floor((x - limites.x0) * S)) * 4)
      const vertice = 0.6 * CAMPO
      for (const r of [0.8 * vertice, 0.88 * vertice, 0.94 * vertice]) {
        const noEixo = [brilhoEm(r, 0), brilhoEm(-r, 0), brilhoEm(0, r), brilhoEm(0, -r)].reduce((s, b) => s + b, 0) / 4
        const k = r / Math.SQRT2
        const naDiagonal = [brilhoEm(k, k), brilhoEm(-k, k), brilhoEm(k, -k), brilhoEm(-k, -k)].reduce((s, b) => s + b, 0) / 4
        expect(naDiagonal - noEixo, `r = ${r.toFixed(1)}`).toBeGreaterThan(10)
      }
    })

    it(`${material}: na média de todas as direções (o que lê como anel), no máximo 1 faixa clara`, () => {
      const { limites, pixels } = pintarMovel(tapete(material), S)
      const perfil: number[] = []
      const PASSO = 0.5
      const ANGULOS = 96
      for (let r = 0; r < G - 1; r += PASSO) {
        let soma = 0
        for (let a = 0; a < ANGULOS; a += 1) {
          const x = Math.cos((a / ANGULOS) * Math.PI * 2) * r
          const y = Math.sin((a / ANGULOS) * Math.PI * 2) * r
          soma += luminancia(pixels, (Math.floor((y - limites.y0) * S) * limites.W + Math.floor((x - limites.x0) * S)) * 4)
        }
        perfil.push(soma / ANGULOS)
      }
      // O campo puro: entre o vértice do losango (0,6) e a borda.
      const campo = perfil[Math.round((0.75 * CAMPO) / PASSO)]
      // Faixa = pico mais claro que o campo E destacado dos dois lados (cai ≥ 8 dentro de 3 px para dentro e para fora):
      // o miolo cheio do centro é um platô, não uma faixa.
      const JANELA = Math.round(3 / PASSO)
      let faixas = 0
      for (let i = JANELA; i + JANELA < perfil.length; i += 1) {
        const pico = perfil[i] >= perfil[i - 1] && perfil[i] >= perfil[i + 1]
        const dentro = Math.min(...perfil.slice(i - JANELA, i))
        const fora = Math.min(...perfil.slice(i + 1, i + JANELA + 1))
        if (pico && perfil[i] > campo + 8 && perfil[i] - dentro >= 8 && perfil[i] - fora >= 8) faixas += 1
      }
      expect(faixas).toBeLessThanOrEqual(1)
    })
  }
})

describe('A8: nicho do armário cinza na madeira velha; veio das portas do aparador de lado em pé', () => {
  it('armário de lado de madeira velha: o fundo do nicho fica cinza (vermelho − azul ≤ 14; antes #4f3729, 38)', () => {
    for (const nivel of [1, 3]) {
      const S = escalaDoNivel(nivel)
      const casasH = 1.5
      const h = casasH * G
      const nA = (f: number): number => -h / 2 + f * h
      const { limites, pixels } = pintarMovel({ tipo: 'armario', lado: 'lado', materiais: ['velha', 'latao'], casasW: 1, casasH, semente: 7 }, S)
      const soma = [0, 0, 0]
      let n = 0
      for (let y = nA(0.36); y < nA(0.53); y += 1 / S) {
        for (let x = -0.3 * G; x < 0.3 * G; x += 1 / S) {
          const o = (Math.floor((y - limites.y0) * S) * limites.W + Math.floor((x - limites.x0) * S)) * 4
          for (let c = 0; c < 3; c += 1) soma[c] += pixels[o + c]
          n += 1
        }
      }
      const [r, , b] = soma.map((v) => v / n)
      expect(r - b, `nível ${nivel}`).toBeLessThanOrEqual(14)
    }
  })

  for (const material of ['nogueira', 'pinho', 'velha'] as const) {
    it(`aparador de lado de ${material}: nas portas a luz varia mais de lado (atravessando o veio) que de cima a baixo`, () => {
      for (const nivel of [1, 3]) {
        const S = escalaDoNivel(nivel)
        const w = 2 * G
        const h = 0.9 * G
        const nA = (f: number): number => -h / 2 + f * h
        const { limites, pixels } = pintarMovel({ tipo: 'aparador', lado: 'lado', materiais: [material, 'latao'], casasW: 2, casasH: 0.9, semente: 7 }, S)
        const i0 = Math.ceil((-0.42 * w - limites.x0) * S)
        const i1 = Math.floor((-0.1 * w - limites.x0) * S)
        const j0 = Math.ceil((nA(0.25) - limites.y0) * S)
        const j1 = Math.floor((nA(0.8) - limites.y0) * S)
        let deLado = 0
        let emPe = 0
        for (let j = j0; j < j1; j += 1) {
          for (let i = i0; i < i1; i += 1) {
            const o = (j * limites.W + i) * 4
            deLado += Math.abs(luminancia(pixels, o + 4) - luminancia(pixels, o))
            emPe += Math.abs(luminancia(pixels, o + limites.W * 4) - luminancia(pixels, o))
          }
        }
        expect(deLado / emPe, `nível ${nivel}`).toBeGreaterThan(1.2)
      }
    })
  }
})

describe('B13: a borda do tapete se repete por casa da grade de REFERÊNCIA (50 px), medido em outra grade', () => {
  it('na grade 70, o tapete 3 x 2 (210 x 140 px) é desenhado como 4,2 x 2,8 casas e leva 2,8 losangos por casa do mapa', () => {
    const prop: Prop = { id: 't', src: '', x: 0, y: 0, width: 210, height: 140, linkedMapPath: null, mobilia: 'tapete' }
    const chave = chaveDoMovel(prop, 1, 1)
    expect(chave?.desenho.casasW).toBeCloseTo(4.2, 9)
    expect(chave?.desenho.casasH).toBeCloseTo(2.8, 9)
    const motivoNoMundo = (PERIODO_DO_MOTIVO * GRADE_DE_REFERENCIA) / G
    expect(70 / motivoNoMundo).toBeCloseTo(2.8, 9)
    expect(GRADE_DE_REFERENCIA / motivoNoMundo).toBeCloseTo(2, 9)
  })
})

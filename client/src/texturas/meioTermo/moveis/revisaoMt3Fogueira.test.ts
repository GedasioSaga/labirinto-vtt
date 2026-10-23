import { describe, expect, it } from 'vitest'
import type { FormaDoTapete } from '../../../types/map'
import type { OpcaoDeMaterial } from '../materiais'
import { CINZA, G, TOM_DO_ARENITO, type LadoDoMovel } from './contexto'
import { escalaDoNivel, montarCena, pintarMovel, type DesenhoDoMovel, type TipoComTextura } from './index'
import { caixa } from './formas'
import { ALTURA_DO_LEITO_DE_LADO, BRASA_QUENTE, BRASA_VIVA, BRASAS_DE_CIMA, BRASAS_DE_LADO, HALO_DE_CIMA, HALO_DE_LADO, LEITO_DE_LADO } from './fogueira'
import { ALFA_OPACO } from './medidas.testkit'
import { criarPecas, pintarCena, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'

/**
 * Revisão da MT3, a FOGUEIRA e o teto de saturação POR PEÇA: o p95 da
 * saturação vale para cada peça sozinha (cada pedra, cada brasa, cada tábua),
 * não só para o móvel inteiro, em que a cinza e a lenha escondiam uma pedra de
 * arenito mostarda (0,66 sozinha, 0,60 a fogueira inteira).
 */

const SATURACAO_P95_MAXIMA = 0.62
/** Peça com menos pixels próprios que isso não tem p95 que diga alguma coisa (o puxador no nível 1). */
const PIXELS_MINIMOS_DA_PECA = 25
const NIVEIS = [1, 2, 3] as const

function saturacao(r: number, g: number, b: number): number {
  const mx = Math.max(r, g, b)
  return mx > 0 ? (mx - Math.min(r, g, b)) / mx : 0
}

function luminancia(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

interface Caso {
  readonly tipo: TipoComTextura
  readonly lado: LadoDoMovel
  readonly casasW: number
  readonly casasH: number
  readonly materiais: readonly (readonly OpcaoDeMaterial[])[]
  readonly forma?: FormaDoTapete
  readonly curva?: number
}

/** Os casos da MT3 (os mesmos tamanhos de `moveisMt3.test.ts`). */
const CASOS: readonly Caso[] = [
  { tipo: 'cerca', lado: 'frente', casasW: 2, casasH: 0.25, materiais: [['carvalho', 'varas'], ['pinho', 'corda'], ['velha', 'arame']] },
  { tipo: 'cerca', lado: 'frente', casasW: 3, casasH: 0.25, curva: 120, materiais: [['nogueira', 'varas'], ['cerejeira', 'corda'], ['velha', 'arame']] },
  { tipo: 'armario', lado: 'frente', casasW: 1, casasH: 0.5, materiais: [['pinho', 'ferro'], ['nogueira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'armario', lado: 'lado', casasW: 1, casasH: 1.5, materiais: [['pinho', 'ferro'], ['nogueira', 'latao'], ['velha', 'latao']] },
  { tipo: 'aparador', lado: 'frente', casasW: 2, casasH: 0.5, materiais: [['nogueira', 'latao'], ['cerejeira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'aparador', lado: 'lado', casasW: 2, casasH: 0.9, materiais: [['nogueira', 'latao'], ['pinho', 'ferro'], ['velha', 'latao']] },
  { tipo: 'fogueira', lado: 'frente', casasW: 1, casasH: 1, materiais: [['granito', 'lenhaCarvalho'], ['arenito', 'lenhaPinho'], ['ardosia', 'lenhaBetula']] },
  { tipo: 'fogueira', lado: 'lado', casasW: 1, casasH: 1.25, materiais: [['granito', 'lenhaCarvalho'], ['arenito', 'lenhaPinho'], ['ardosia', 'lenhaBetula']] },
  { tipo: 'tapete', lado: 'frente', casasW: 3, casasH: 2, materiais: [['azul'], ['vinho'], ['linho']] },
  { tipo: 'tapete', lado: 'frente', casasW: 2, casasH: 2, forma: 'redondo', materiais: [['ocre'], ['musgo'], ['azul']] },
  { tipo: 'tapete', lado: 'lado', casasW: 3, casasH: 0.25, materiais: [['azul'], ['vinho'], ['linho']] },
]

function desenho(caso: Caso, materiais: readonly OpcaoDeMaterial[]): DesenhoDoMovel {
  return { tipo: caso.tipo, lado: caso.lado, materiais, casasW: caso.casasW, casasH: caso.casasH, semente: 7, forma: caso.forma, curva: caso.curva }
}

/** Largura da caixa da peça em px do protótipo. */
function largura(p: Peca): number {
  return p.forma.b[2] - p.forma.b[0]
}

/** O halo da fogueira é quase transparente: o pixel debaixo dele é da peça de baixo. */
function ehHalo(caso: Caso, p: Peca): boolean {
  if (caso.tipo !== 'fogueira' || p.mat !== CINZA) return false
  const esperado = caso.lado === 'lado' ? 2 * HALO_DE_LADO * caso.casasW * G : 2 * HALO_DE_CIMA * Math.min(caso.casasW, caso.casasH) * G * 0.5
  return Math.abs(largura(p) - esperado) < 1e-6
}

/**
 * Os pixels opacos de cada peça: o pixel é da peça de CIMA (a última da lista)
 * que o cobre inteiro (o centro a mais de meio pixel para dentro da borda).
 */
function pixelsPorPeca(caso: Caso, materiais: readonly OpcaoDeMaterial[], S: number): { pecas: Peca[]; donos: Map<number, [number, number, number, number, number][]> } {
  const d = desenho(caso, materiais)
  const pecas = montarCena(d).partes
  const { limites, pixels } = pintarMovel(d, S)
  const donos = new Map<number, [number, number, number, number, number][]>()
  const folga = 0.5 / S
  for (let j = 0; j < limites.H; j += 1) {
    const y = limites.y0 + (j + 0.5) / S
    for (let i = 0; i < limites.W; i += 1) {
      const o = (j * limites.W + i) * 4
      if (pixels[o + 3] < ALFA_OPACO) continue
      const x = limites.x0 + (i + 0.5) / S
      for (let k = pecas.length - 1; k >= 0; k -= 1) {
        const p = pecas[k]
        if (ehHalo(caso, p)) continue
        if (p.forma.d(x - p.dx, y - p.dy) >= -folga) continue
        const lista = donos.get(k) ?? []
        lista.push([pixels[o], pixels[o + 1], pixels[o + 2], x, y])
        donos.set(k, lista)
        break
      }
    }
  }
  return { pecas, donos }
}

function p95(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.floor(ordenados.length * 0.95)]
}

describe('saturação p95 ≤ 0,62 POR PEÇA (cada pedra, cada tábua, cada brasa), nos 11 casos da MT3', () => {
  for (const caso of CASOS) {
    for (const nivel of NIVEIS) {
      it(`${caso.tipo}${caso.lado === 'lado' ? ' de lado' : ''}${caso.forma === 'redondo' ? ' redondo' : ''}${caso.curva ? ` curva ${caso.curva}` : ''} no nível ${nivel}, nos 3 materiais`, () => {
        const S = escalaDoNivel(nivel)
        for (const materiais of caso.materiais) {
          const { pecas, donos } = pixelsPorPeca(caso, materiais, S)
          let medidas = 0
          for (const [k, cores] of donos) {
            if (cores.length < PIXELS_MINIMOS_DA_PECA) continue
            medidas += 1
            const valor = p95(cores.map(([r, g, b]) => saturacao(r, g, b)))
            expect(valor, `${materiais.join('+')}: peça ${k} (${pecas[k].mat.classe}, ${cores.length} px)`).toBeLessThanOrEqual(SATURACAO_P95_MAXIMA)
          }
          expect(medidas, materiais.join('+')).toBeGreaterThan(0)
        }
      })
    }
  }
})

describe('A5: o arenito é areia acinzentada, em camadas', () => {
  /**
   * Cada pedra de arenito sozinha (antes: até 0,66, mostarda). O p95 de uma
   * pedra pequena do nível 1 inclui a borda escurecida, levantada para o
   * escuro quente do piso de luz (saturação 0,60): por isso o teto do p95 é
   * 0,58 e o tom da pedra é conferido pela MÉDIA, que a borda quase não move.
   */
  const P95_DO_ARENITO = 0.58
  const SATURACAO_MEDIA_DO_ARENITO = 0.4

  for (const lado of ['frente', 'lado'] as const) {
    it(`fogueira ${lado === 'lado' ? 'de lado ' : ''}de arenito, níveis 1 a 3: cada pedra com p95 ≤ ${P95_DO_ARENITO} e o tom médio perto de #b39a76`, () => {
      const caso = CASOS.find((c) => c.tipo === 'fogueira' && c.lado === lado)
      if (caso === undefined) throw new Error('sem caso')
      for (const nivel of NIVEIS) {
        const { pecas, donos } = pixelsPorPeca(caso, ['arenito', 'lenhaPinho'], escalaDoNivel(nivel))
        let pedras = 0
        for (const [k, cores] of donos) {
          if (pecas[k].mat.classe !== 'pedra' || cores.length < PIXELS_MINIMOS_DA_PECA) continue
          pedras += 1
          const sats = cores.map(([r, g, b]) => saturacao(r, g, b))
          expect(p95(sats), `nível ${nivel}, pedra ${k}`).toBeLessThanOrEqual(P95_DO_ARENITO)
          expect(sats.reduce((s, v) => s + v, 0) / sats.length, `nível ${nivel}, pedra ${k}: média`).toBeLessThanOrEqual(SATURACAO_MEDIA_DO_ARENITO)
          // O matiz fica no da areia (vermelho > verde > azul), sem virar laranja: verde no meio do caminho.
          const media = [0, 1, 2].map((c) => cores.reduce((s, cor) => s + cor[c], 0) / cores.length)
          expect(media[0] > media[1] && media[1] > media[2], `nível ${nivel}, pedra ${k}: ${media.map(Math.round)}`).toBe(true)
          expect((media[1] - media[2]) / (media[0] - media[2]), `nível ${nivel}, pedra ${k}`).toBeGreaterThan(0.45)
        }
        expect(pedras).toBe(lado === 'lado' ? 4 : 8)
      }
      expect(saturacao(...TOM_DO_ARENITO)).toBeLessThan(0.36)
    })
  }
})

describe('A2: de lado, o leito de cinza fica atrás das pedras (não flutua entre elas e a chama)', () => {
  it('o leito tem o meio na altura do topo das pedras (0,79 a 0,82) e não sobe acima de 0,775', () => {
    const casasH = 1.25
    const h = casasH * G
    const nA = (f: number): number => -h / 2 + f * h
    const cena = montarCena({ tipo: 'fogueira', lado: 'lado', materiais: ['granito', 'lenhaCarvalho'], casasW: 1, casasH, semente: 7 })
    const leitos = cena.partes.filter((p) => p.mat === CINZA && largura(p) > 10 && largura(p) < 14)
    expect(leitos).toHaveLength(1)
    const [leito] = leitos
    const meio = (leito.forma.b[1] + leito.forma.b[3]) / 2
    expect(meio).toBeCloseTo(nA(LEITO_DE_LADO), 9)
    expect(meio).toBeGreaterThanOrEqual(nA(0.79))
    expect(leito.forma.b[1]).toBeGreaterThanOrEqual(nA(0.775))
    expect(leito.forma.b[3] - leito.forma.b[1]).toBeCloseTo(2 * ALTURA_DO_LEITO_DE_LADO, 9)
  })
})

describe('A3 e A4: no cruzamento, brasas redondas sem contorno sobre um halo quente; nada de arruela nem respingo', () => {
  const S = escalaDoNivel(3)
  const R = G / 2

  it('de cima não há peça de cinza do tamanho de uma arruela (meia largura de 2 a 8 px): só o leito, o halo e as brasas', () => {
    const cena = montarCena({ tipo: 'fogueira', lado: 'frente', materiais: ['granito', 'lenhaCarvalho'], casasW: 1, casasH: 1, semente: 7 })
    const cinzas = cena.partes.filter((p) => p.mat === CINZA).map((p) => largura(p) / 2)
    expect(cinzas.filter((m) => m > 2 && m < 8)).toEqual([])
    expect(cinzas.filter((m) => m <= 1.5)).toHaveLength(BRASAS_DE_CIMA.length)
  })

  it(`3 a 5 brasas de raio 1 a 1,5 px, de cima e de lado`, () => {
    for (const brasas of [BRASAS_DE_CIMA, BRASAS_DE_LADO]) {
      expect(brasas.length).toBeGreaterThanOrEqual(3)
      expect(brasas.length).toBeLessThanOrEqual(5)
      for (const [, , raio] of brasas) {
        expect(raio).toBeGreaterThanOrEqual(1)
        expect(raio).toBeLessThanOrEqual(1.5)
      }
    }
  })

  for (const materiais of [['granito', 'lenhaCarvalho'], ['arenito', 'lenhaPinho'], ['ardosia', 'lenhaBetula']] as const) {
    it(`${materiais.join('+')}: o miolo de cada brasa é o laranja quente, a borda não escurece (sem contorno) e o leito não tem respingo de ferrugem`, () => {
      const d: DesenhoDoMovel = { tipo: 'fogueira', lado: 'frente', materiais, casasW: 1, casasH: 1, semente: 7 }
      const { limites, pixels } = pintarMovel(d, S)
      const cor = (x: number, y: number): [number, number, number] => {
        const o = (Math.floor((y - limites.y0) * S) * limites.W + Math.floor((x - limites.x0) * S)) * 4
        return [pixels[o], pixels[o + 1], pixels[o + 2]]
      }
      for (const [fx, fy, raio] of BRASAS_DE_CIMA) {
        const [r, g, b] = cor(fx * R, fy * R)
        expect(Math.abs(r - BRASA_QUENTE[0]) + Math.abs(g - BRASA_QUENTE[1]) + Math.abs(b - BRASA_QUENTE[2]), `brasa em (${fx}, ${fy})`).toBeLessThanOrEqual(12)
        const borda = cor(fx * R + raio * 0.75, fy * R)
        expect(luminancia(...borda), `borda da brasa em (${fx}, ${fy})`).toBeGreaterThanOrEqual(luminancia(...BRASA_VIVA) * 0.95)
      }
      // O leito (a cinza) sozinho: nenhum pixel dele chega à saturação da ferrugem (o halo quente, a 20%, fica bem abaixo).
      const caso = CASOS.find((c) => c.tipo === 'fogueira' && c.lado === 'frente')
      if (caso === undefined) throw new Error('sem caso')
      const { pecas, donos } = pixelsPorPeca(caso, materiais, S)
      const leito = pecas.findIndex((p) => p.mat === CINZA && Math.abs(largura(p) - 2 * 0.76 * R) < 1e-6)
      const doLeito = donos.get(leito) ?? []
      expect(doLeito.length).toBeGreaterThan(100)
      // Fora da sombra que a tora de cima faz no leito (a cinza escura demais é levantada para o escuro quente
      // do piso de luz, de propósito) e longe da borda suavizada das pedras e da lenha.
      const toras = pecas.filter((p) => p.mat.classe === 'casca')
      const pedras = pecas.filter((p) => p.mat.classe === 'pedra')
      const SOMBRA_DA_TORA: readonly [number, number] = [0.79 * 1.2, 0.61 * 1.2]
      const livre = doLeito.filter(([, , , x, y]) => toras.every((t) => t.forma.d(x, y) > 1 && t.forma.d(x - SOMBRA_DA_TORA[0], y - SOMBRA_DA_TORA[1]) > 2) && pedras.every((p) => p.forma.d(x, y) > 1))
      expect(livre.length).toBeGreaterThan(100)
      expect(Math.max(...livre.map(([r, g, b]) => saturacao(r, g, b)))).toBeLessThan(0.3)
    })
  }
})

/** Uma peça de teste com textura própria: cor e emissão fixas. */
function texFixa(c: readonly [number, number, number], emissao: number, pontilhado = 0): Textura {
  return (_u, _v, _x, _y, _p, s) => {
    s[0] = c[0]
    s[1] = c[1]
    s[2] = c[2]
    s[4] = emissao
    s[6] = pontilhado
  }
}

const LISO: MaterialDaPeca = { classe: 'liso', rgb: [120, 110, 100] }

/** Cor média da linha do meio entre x0 e x1 (px do protótipo) de uma cena de 40 x 20 px. */
function corMedia(cena: Cena, x0: number, x1: number): [number, number, number] {
  const S = 2
  const { limites, pixels } = pintarCena(cena, S)
  const j = Math.floor((0 - limites.y0) * S)
  const soma = [0, 0, 0]
  let n = 0
  for (let x = x0; x < x1; x += 1 / S) {
    const o = (j * limites.W + Math.floor((x - limites.x0) * S)) * 4
    for (let c = 0; c < 3; c += 1) soma[c] += pixels[o + c]
    n += 1
  }
  return [soma[0] / n, soma[1] / n, soma[2] / n]
}

describe('B12: a parte que emite (a brasa) não pega a sombra das peças de cima', () => {
  it('a mesma brasa por baixo da sombra de uma tora sai com a mesma cor de sem a tora; a cinza comum escurece', () => {
    const P = criarPecas(0)
    const base = (emissao: number): Peca => P(caixa(-20, -10, 20, 10), LISO, { textura: texFixa([196, 130, 82], emissao), bisel: 0, contorno: 0 })
    // A tora (a última da lista fica por cima): fina, fora da linha medida, mas a sombra dela (projeta) cai sobre a linha do meio.
    const tora = P(caixa(-20, -6, 20, -3), LISO, { bisel: 0, contorno: 0, projeta: { dist: 8, forca: 0.6, suave: 0.5 } })
    for (const [emissao, igual] of [[1, true], [0, false]] as const) {
      const sem = corMedia({ partes: [base(emissao)], sombras: [] }, -15, 15)
      const com = corMedia({ partes: [base(emissao), tora], sombras: [] }, -15, 15)
      const diferenca = Math.abs(sem[0] - com[0]) + Math.abs(sem[1] - com[1]) + Math.abs(sem[2] - com[2])
      if (igual) expect(diferenca, 'brasa').toBeLessThanOrEqual(3)
      else expect(diferenca, 'cinza').toBeGreaterThan(30)
    }
  })
})

describe('A8: o grão do granito some pela metade na sombra', () => {
  it('o mesmo grão (pontilhado -0,2) contrasta metade na sombra de uma peça de cima e inteiro na luz', () => {
    const P = criarPecas(0)
    // Metade de cima da caixa com grão, metade sem; a tora faz sombra só na metade da direita.
    const comGrao = P(caixa(-20, -10, 20, 10), LISO, { textura: texFixa([150, 146, 140], 0, -0.2), bisel: 0, contorno: 0 })
    const semGrao = P(caixa(-20, -10, 20, 10), LISO, { textura: texFixa([150, 146, 140], 0, 0), bisel: 0, contorno: 0 })
    const tora = P(caixa(0, -6, 20, -3), LISO, { bisel: 0, contorno: 0, projeta: { dist: 8, forca: 0.5, suave: 0.5 } })
    const contraste = (x0: number, x1: number): number => {
      const a = corMedia({ partes: [comGrao, tora], sombras: [] }, x0, x1)
      const b = corMedia({ partes: [semGrao, tora], sombras: [] }, x0, x1)
      return 1 - luminancia(...a) / luminancia(...b)
    }
    const naLuz = contraste(-15, -5)
    const naSombra = contraste(8, 18)
    expect(naLuz).toBeCloseTo(0.2, 2)
    expect(naSombra / naLuz).toBeLessThanOrEqual(0.6)
    expect(naSombra / naLuz).toBeGreaterThanOrEqual(0.4)
  })
})

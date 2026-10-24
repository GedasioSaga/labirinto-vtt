import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { PALETA_DO_TETO, type ModeloDoTeto } from '../lib/telhado/paletas'
import { pintarTelhado, type ImagemDoTelhado } from './telhado'
import { oklabDoHex, oklabDoRgb } from './meioTermo/materiais'
import { PALETA_MEIO_TERMO } from './meioTermo/paleta'
import { colar, emPng, escrever, novaTela, type Tela } from './meioTermo/moveis/folhaDeContato.testkit'

/**
 * FOLHA DE CONTATO da fatia MT6 (refeita na revisão de design): o telhado de
 * palha a 0,5x e 1x AO LADO da telha barro na mesma escala, e a 1x AMPLIADA 3
 * vezes como o usuário vê no zoom de 300% (o app nunca pinta telhado acima de
 * 1x, `pixi/telhadosRenderer.ts`, `escalaDaTexturaDoTelhado`: a câmera amplia
 * a imagem de 1x, com filtro linear; o quadro de "3x" que havia aqui mostrava
 * um detalhe que ninguém vê). Mais a madeira, as 6 cores, a sala em L, a cor
 * livre, a sala comprida, a palha no chão de TERRA do Meio-Termo (o par mais
 * fraco) e, lado a lado, a cor média do protótipo aprovado e a do app, com o
 * croma OKLab e a distância entre elas. Fundo: a grama do mapa (#56693f).
 * Embaixo de cada quadro de telhado, o tempo de pintar a imagem (ms, nesta
 * máquina e nesta rodada, uma medida só).
 * Grava `docs/design/objetos/provas/mt6-folha-de-contato.png`.
 *
 * Só roda quando pedida (prova para o usuário, não teste de regressão):
 * `GERAR_FOLHA_MT6=1 npx vitest run src/texturas/folhaDeContatoMt6.test.ts`.
 */

const DESTINO = '../docs/design/objetos/provas/mt6-folha-de-contato.png'
const PEDIDA = import.meta.env.GERAR_FOLHA_MT6 === '1'
const GRAMA: readonly [number, number, number] = [0x56, 0x69, 0x3f]
const TINTA: readonly [number, number, number] = [0xf2, 0xea, 0xd8]
const MARGEM = 24
const VAO = 22
const ESCALA_DA_LETRA = 2
const ALTURA_DA_LETRA = 7 * ESCALA_DA_LETRA + 8
const POR_LINHA = 4
const CASA = 50
/** O zoom da câmera que o quadro imita (300%). */
const ZOOM = 3
/** Lado da amostra de cor (px). */
const AMOSTRA = 160
/**
 * A palha do protótipo aprovado: a média de um miolo do estábulo sem cumeeira
 * em `docs/design/vila-meio-termo/provas/desktop-1440.png` (recorte 1000,960
 * de 200 x 60), medida na revisão de design da MT6. O protótipo pinta com o
 * token `#d6b56a` (`vila-meio-termo/prototipo/meio.js:58` e `:88`); a
 * diferença está no resultado.
 */
const PROTOTIPO = '#cb9940'

function sala(casasW: number, casasH: number): readonly PontoDoTelhado[] {
  return [{ x: 0, y: 0 }, { x: casasW * CASA, y: 0 }, { x: casasW * CASA, y: casasH * CASA }, { x: 0, y: casasH * CASA }]
}
const EL: readonly PontoDoTelhado[] = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }]
const CASA_4X3 = sala(4, 3)
const COR = Object.fromEntries(PALETA_DO_TETO.palha.map((c) => [c.id, c.hex]))
const BARRO = PALETA_DO_TETO.telhas[0].hex
const rgbDe = (hex: string): [number, number, number] => [1, 3, 5].map((k) => Number.parseInt(hex.slice(k, k + 2), 16)) as [number, number, number]
const TERRA = rgbDe(PALETA_MEIO_TERMO.terra.base)

interface QuadroDeTelhado {
  readonly rotulo: string
  readonly poligono: readonly PontoDoTelhado[]
  readonly modelo: ModeloDoTeto
  readonly cor: string
  /** Sempre 1x ou menos (o que o app pinta); `zoom` amplia como a câmera. */
  readonly escala: number
  readonly zoom?: number
  readonly fundo?: readonly [number, number, number]
}

/** A fonte da folha só tem maiúsculas, dígitos, '+', ',' e '/'. */
const QUADROS: readonly QuadroDeTelhado[] = [
  { rotulo: 'PALHA 0,5X', poligono: CASA_4X3, modelo: 'palha', cor: COR.palha, escala: 0.5 },
  { rotulo: 'TELHAS BARRO 0,5X', poligono: CASA_4X3, modelo: 'telhas', cor: BARRO, escala: 0.5 },
  { rotulo: 'PALHA 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR.palha, escala: 1 },
  { rotulo: 'TELHAS BARRO 1X', poligono: CASA_4X3, modelo: 'telhas', cor: BARRO, escala: 1 },
  { rotulo: 'PALHA 1X NO ZOOM 300', poligono: CASA_4X3, modelo: 'palha', cor: COR.palha, escala: 1, zoom: ZOOM },
  { rotulo: 'TELHAS BARRO 1X NO ZOOM 300', poligono: CASA_4X3, modelo: 'telhas', cor: BARRO, escala: 1, zoom: ZOOM },
  { rotulo: 'MADEIRA CARVALHO 1X', poligono: CASA_4X3, modelo: 'madeira', cor: PALETA_DO_TETO.madeira[0].hex, escala: 1 },
  { rotulo: 'PALHA EM L 1X', poligono: EL, modelo: 'palha', cor: COR.palha, escala: 1 },
  { rotulo: 'PALHA CLARA 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR['palha-clara'], escala: 1 },
  { rotulo: 'FENO 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR.feno, escala: 1 },
  { rotulo: 'SAPE 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR.sape, escala: 1 },
  { rotulo: 'PALHA VELHA 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR['palha-velha'], escala: 1 },
  { rotulo: 'PALHA COM MUSGO 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR.musgo, escala: 1 },
  { rotulo: 'PALHA COR LIVRE 1X', poligono: CASA_4X3, modelo: 'palha', cor: '#b8865a', escala: 1 },
  { rotulo: 'PALHA 7 X 2 CASAS 1X', poligono: sala(7, 2), modelo: 'palha', cor: COR.palha, escala: 1 },
  { rotulo: 'FENO EM L 1X NO ZOOM 300', poligono: EL, modelo: 'palha', cor: COR.feno, escala: 1, zoom: ZOOM },
  { rotulo: 'PALHA NA TERRA DDA56C 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR.palha, escala: 1, fundo: TERRA },
]

function emMs(ms: number): string {
  return ms.toFixed(1).replace('.', ',')
}
const virgula = (x: number, casas: number): string => x.toFixed(casas).replace('.', ',')
const hexDe = (c: readonly number[]): string => c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
const croma = (lab: readonly number[]): number => Math.hypot(lab[1], lab[2])
const distancia = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const linear = (c: number): number => {
  const x = c / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}
const luminancia = (c: readonly number[]): number => 0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2])

/** Média RGB dos pixels cheios (alfa 255) da imagem. */
function mediaDosCheios(img: ImagemDoTelhado): [number, number, number] {
  const s = [0, 0, 0]
  let n = 0
  for (let i = 0; i < img.pixels.length; i += 4) {
    if (img.pixels[i + 3] < 255) continue
    for (let k = 0; k < 3; k += 1) s[k] += img.pixels[i + k]
    n += 1
  }
  return [s[0] / n, s[1] / n, s[2] / n]
}

/** Amplia `z` vezes com filtro linear (pré-multiplicado), como a câmera faz com a textura. */
function ampliar(img: ImagemDoTelhado, z: number): { pixels: Uint8ClampedArray; largura: number; altura: number } {
  const W = img.largura
  const H = img.altura
  const largura = W * z
  const altura = H * z
  const pixels = new Uint8ClampedArray(largura * altura * 4)
  const px = img.pixels
  const amostra = (x: number, y: number, k: number): number => {
    const o = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4
    return k === 3 ? px[o + 3] : (px[o + k] * px[o + 3]) / 255
  }
  for (let y = 0; y < altura; y += 1) {
    const sy = (y + 0.5) / z - 0.5
    const y0 = Math.floor(sy)
    const fy = sy - y0
    for (let x = 0; x < largura; x += 1) {
      const sx = (x + 0.5) / z - 0.5
      const x0 = Math.floor(sx)
      const fx = sx - x0
      const o = (y * largura + x) * 4
      const v = [0, 0, 0, 0]
      for (let k = 0; k < 4; k += 1) {
        const cima = amostra(x0, y0, k) * (1 - fx) + amostra(x0 + 1, y0, k) * fx
        const baixo = amostra(x0, y0 + 1, k) * (1 - fx) + amostra(x0 + 1, y0 + 1, k) * fx
        v[k] = cima * (1 - fy) + baixo * fy
      }
      pixels[o + 3] = v[3]
      for (let k = 0; k < 3; k += 1) pixels[o + k] = v[3] > 0 ? (v[k] * 255) / v[3] : 0
    }
  }
  return { pixels, largura, altura }
}

function retangulo(tela: Tela, x: number, y: number, w: number, h: number, cor: readonly number[]): void {
  for (let j = y; j < y + h; j += 1) {
    for (let i = x; i < x + w; i += 1) {
      const o = (j * tela.largura + i) * 3
      tela.rgb[o] = cor[0]
      tela.rgb[o + 1] = cor[1]
      tela.rgb[o + 2] = cor[2]
    }
  }
}

it.skipIf(!PEDIDA)('gera a folha de contato da palha (17 quadros e 2 amostras de cor, com o zoom de 300%) com o tempo embaixo', () => {
  const telhados = QUADROS.map((q) => {
    const t0 = performance.now()
    const img = pintarTelhado(q.poligono, q.modelo, q.cor, q.escala)
    const tempo = `T ${emMs(performance.now() - t0)} MS`
    const visto = q.zoom === undefined ? { pixels: img.pixels, largura: img.largura, altura: img.altura } : ampliar(img, q.zoom)
    return { rotulo: q.rotulo, img: visto, legenda: tempo, fundo: q.fundo, cor: null as readonly number[] | null }
  })
  // A cor média do app (palha padrão a 1x) contra a do protótipo e contra o chão de terra da MT7.
  const app = mediaDosCheios(pintarTelhado(CASA_4X3, 'palha', COR.palha, 1))
  const labApp = oklabDoRgb(app[0], app[1], app[2])
  const labProto = oklabDoHex(PROTOTIPO)
  const deltaProto = distancia(labApp, labProto)
  const deltaTerra = distancia(labApp, oklabDoRgb(TERRA[0], TERRA[1], TERRA[2]))
  const [la, lt] = [luminancia(app), luminancia(TERRA)]
  const luzContraTerra = (Math.max(la, lt) + 0.05) / (Math.min(la, lt) + 0.05)
  const medidas =
    `app ${hexDe(app)} croma ${croma(labApp).toFixed(3)}; protótipo ${PROTOTIPO} croma ${croma(labProto).toFixed(3)}; ΔE OKLab ${deltaProto.toFixed(3)}; ` +
    `contra a terra ${PALETA_MEIO_TERMO.terra.base}: ΔE ${deltaTerra.toFixed(3)}, luz ${luzContraTerra.toFixed(2)}:1`
  console.log(`[medida] folha MT6: ${medidas}`)
  const amostra = (rotulo: string, cor: readonly number[], legenda: string) => ({ rotulo, img: { pixels: new Uint8ClampedArray(0), largura: AMOSTRA, altura: AMOSTRA }, legenda, fundo: undefined, cor })
  const quadros = [
    ...telhados,
    amostra(`COR DO PROTOTIPO ${PROTOTIPO.slice(1).toUpperCase()}`, rgbDe(PROTOTIPO), `CROMA ${virgula(croma(labProto), 3)}`),
    amostra(`COR DO APP ${hexDe(app).toUpperCase()}`, app, `CROMA ${virgula(croma(labApp), 3)} DE ${virgula(deltaProto, 3)}`),
  ]
  const larguraDe = (q: (typeof quadros)[number]): number => Math.max(q.img.largura, q.rotulo.length * 6 * ESCALA_DA_LETRA, q.legenda.length * 6 * ESCALA_DA_LETRA)
  const alturaDe = (q: (typeof quadros)[number]): number => q.img.altura + ALTURA_DA_LETRA * 2 + VAO
  const linhas: (typeof quadros)[] = []
  for (let i = 0; i < quadros.length; i += POR_LINHA) linhas.push(quadros.slice(i, i + POR_LINHA))
  const largura = Math.max(...linhas.map((l) => l.reduce((s, q) => s + larguraDe(q) + VAO * 2, 0)))
  const altura = linhas.reduce((s, l) => s + Math.max(...l.map(alturaDe)), 0)
  const tela = novaTela(largura + MARGEM * 2, altura + MARGEM * 2, GRAMA)
  let y = MARGEM
  for (const linha of linhas) {
    let x = MARGEM
    for (const q of linha) {
      escrever(tela, q.rotulo, x, y, ESCALA_DA_LETRA, TINTA)
      if (q.fundo !== undefined) retangulo(tela, x - 8, y + ALTURA_DA_LETRA - 8, q.img.largura + 16, q.img.altura + 16, q.fundo)
      if (q.cor !== null) retangulo(tela, x, y + ALTURA_DA_LETRA, q.img.largura, q.img.altura, q.cor)
      else colar(tela, q.img.pixels, q.img.largura, q.img.altura, x, y + ALTURA_DA_LETRA)
      escrever(tela, q.legenda, x, y + ALTURA_DA_LETRA + q.img.altura + 10, ESCALA_DA_LETRA, TINTA)
      x += larguraDe(q) + VAO * 2
    }
    y += Math.max(...linha.map(alturaDe))
  }
  const png = emPng(tela)
  writeFileSync(DESTINO, png)
  expect(quadros).toHaveLength(19)
  expect(png.length).toBeGreaterThan(0)
})

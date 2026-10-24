import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Prop } from '../../../types/map'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import { MATERIAIS } from '../materiais'
import { G } from './contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from './index'
import { SOMBRA_X, SOMBRA_Y, type LimitesDaImagem } from './motor'
import { formaDoTampo, geometriaDaMesa, type GeometriaDaMesa } from './mesaComPernas'
import { contextoDaMesa, pintarMesaAntiga, type TipoDeMesa } from './mesasAntigas.testkit'
import { ALFA_DE_PECA, ALFA_OPACO, digitalDosPixels, medirImagem } from './medidas.testkit'

/**
 * A MESA LÊ COMO MESA (pedido do usuário de 24/10/2026: "falta a versão
 * redonda, a quadrada pode ser melhor, a mesa parece um móvel e não uma
 * mesa"): as 3 formas em cada uma das 3 madeiras, com a SEMENTE DO APP
 * (`chaveDoMovel`), provam nos pixels o que faz a mesa ler como mesa:
 *
 * - PERNAS À MOSTRA: a parte de cada perna fora do tampo é opaca e mais escura
 *   que o miolo do tampo;
 * - SOMBRA DE BAIXO: logo em volta do tampo, em cima e à esquerda (onde a
 *   sombra do tampo não chega), o chão está escuro, e mais escuro que a sombra
 *   do tampo; a sombra do tampo tem a largura que a altura dá (`SOMBRA_X` x a
 *   altura, mais o borrão);
 * - BORDA CLARA: a faixa da borda do tampo é mais clara que o miolo.
 *
 * CONTROLE POSITIVO: a mesa de antes (`mesasAntigas.testkit.ts`, a mesma
 * semente e o mesmo material) reprova nos mesmos testes. E a retangular não
 * estica: de 2 x 1 para 3 x 1 as tábuas e as pernas são as mesmas, e a de 4 x
 * 2 tem o dobro de tábuas (a de antes tinha as mesmas, mais largas).
 */

const CASA = 50
const MADEIRAS = ['carvalho', 'nogueira', 'velha'] as const
type Madeira = (typeof MADEIRAS)[number]

const FORMAS: readonly { readonly tipo: TipoDeMesa; readonly casasW: number; readonly casasH: number }[] = [
  { tipo: 'mesa', casasW: 2, casasH: 1 },
  { tipo: 'mesaQuadrada', casasW: 1, casasH: 1 },
  { tipo: 'mesaRedonda', casasW: 1.25, casasH: 1.25 },
]

/** Tamanhos fora do padrão que o mestre consegue (esticar, deitar, a redonda oval). */
const OUTROS_TAMANHOS: readonly { readonly tipo: TipoDeMesa; readonly casasW: number; readonly casasH: number; readonly madeira: Madeira }[] = [
  { tipo: 'mesa', casasW: 3, casasH: 1, madeira: 'velha' },
  { tipo: 'mesa', casasW: 1, casasH: 2, madeira: 'nogueira' },
  { tipo: 'mesa', casasW: 4, casasH: 2, madeira: 'carvalho' },
  { tipo: 'mesaRedonda', casasW: 2, casasH: 1.25, madeira: 'carvalho' },
]

function peca(tipo: TipoDeMesa, casasW: number, casasH: number, madeira: Madeira): Prop {
  return { id: `m-${tipo}`, src: '', x: 0, y: 0, width: casasW * CASA, height: casasH * CASA, linkedMapPath: null, mobilia: tipo, mobiliaCor: MATERIAIS[madeira].hex }
}

/** O desenho que o app pede: a semente sai do hash da chave, e o material do tom oficial gravado. */
function desenhoDoApp(tipo: TipoDeMesa, casasW: number, casasH: number, madeira: Madeira, nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(peca(tipo, casasW, casasH, madeira), nivel, 1)
  if (chave === null) throw new Error(`${tipo}: sem desenho com textura`)
  return chave.desenho
}

interface Imagem {
  readonly px: Uint8ClampedArray
  readonly W: number
  readonly H: number
  readonly S: number
  readonly x0: number
  readonly y0: number
}

function emImagem(r: { limites: LimitesDaImagem; pixels: Uint8ClampedArray }, S: number): Imagem {
  return { px: r.pixels, W: r.limites.W, H: r.limites.H, S, x0: r.limites.x0, y0: r.limites.y0 }
}

function nova(d: DesenhoDoMovel, nivel: number): Imagem {
  const S = escalaDoNivel(nivel)
  return emImagem(pintarMovel(d, S), S)
}

function antiga(d: DesenhoDoMovel, nivel: number): Imagem {
  const S = escalaDoNivel(nivel)
  return emImagem(pintarMesaAntiga(d, S), S)
}

function brilho(px: Uint8ClampedArray, o: number): number {
  return (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255
}

/** Chama `f` para cada pixel com o centro dele em px do protótipo (centro do móvel na origem). */
function cadaPixel(im: Imagem, f: (x: number, y: number, o: number) => void): void {
  for (let j = 0; j < im.H; j += 1) {
    for (let i = 0; i < im.W; i += 1) f(im.x0 + (i + 0.5) / im.S, im.y0 + (j + 0.5) / im.S, (j * im.W + i) * 4)
  }
}

function media(xs: readonly number[]): number {
  return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN
}

/** Meio pixel e mais um pouco: o que a borda suavizada e o contorno de uma peça ocupam. */
function folgaDoPixel(im: Imagem): number {
  return 0.5 / im.S + 0.2
}

function geometria(d: DesenhoDoMovel): GeometriaDaMesa {
  return geometriaDaMesa(contextoDaMesa(d), d.tipo === 'mesaRedonda')
}

/** Brilho médio do MIOLO do tampo: longe da borda clara e da quina. */
function brilhoDoMiolo(im: Imagem, g: GeometriaDaMesa): number {
  const tampo = formaDoTampo(g)
  const brilhos: number[] = []
  cadaPixel(im, (x, y, o) => {
    if (-tampo.d(x, y) >= 3 * g.larguraDaBordaClara && im.px[o + 3] >= ALFA_OPACO) brilhos.push(brilho(im.px, o))
  })
  return media(brilhos)
}

interface Perna {
  readonly pixels: number
  readonly fracaoOpaca: number
  readonly brilho: number
}

/** A parte de cada perna FORA do tampo: quantos pixels, quantos opacos e o brilho deles. */
function pernasAMostra(im: Imagem, g: GeometriaDaMesa): Perna[] {
  const tampo = formaDoTampo(g)
  const folga = folgaDoPixel(im)
  return g.pernas.map((b) => {
    const cx = (b[0] + b[2]) / 2
    const cy = (b[1] + b[3]) / 2
    const r = (b[2] - b[0]) / 2 - folga
    const dentro = (x: number, y: number): boolean => (g.redonda ? Math.hypot(x - cx, y - cy) <= r : Math.abs(x - cx) <= r && Math.abs(y - cy) <= r)
    let pixels = 0
    const brilhos: number[] = []
    cadaPixel(im, (x, y, o) => {
      if (!dentro(x, y) || tampo.d(x, y) < folga) return
      pixels += 1
      if (im.px[o + 3] >= ALFA_OPACO) brilhos.push(brilho(im.px, o))
    })
    return { pixels, fracaoOpaca: pixels > 0 ? brilhos.length / pixels : 0, brilho: media(brilhos) }
  })
}

interface SombraDeBaixo {
  /** Pixels da faixa logo fora do tampo, em cima e à esquerda (longe das pernas). */
  readonly pixels: number
  /** Fração deles que é CHÃO (alfa abaixo do de peça): a faixa é chão sombreado, não peça. */
  readonly fracaoDeChao: number
  /** Alfa médio (0..255) da faixa: a sombra de baixo. */
  readonly alfa: number
  /** Alfa (0..255) no miolo da sombra do tampo, à direita do tampo, no meio da altura. */
  readonly alfaDoTampo: number
  /** Largura da sombra do tampo à direita, no meio da altura, medida e prevista (px do protótipo). */
  readonly largura: number
  readonly larguraPrevista: number
}

/** A faixa logo fora do tampo vai de `folga` até 1 px do protótipo (a sombra de baixo cresce 1,4 px além do tampo). */
const FIM_DA_FAIXA_DE_BAIXO = 1

function sombraDeBaixo(im: Imagem, g: GeometriaDaMesa): SombraDeBaixo {
  const tampo = formaDoTampo(g)
  const folga = folgaDoPixel(im)
  const longeDasPernas = (x: number, y: number): boolean => g.pernas.every((b) => x < b[0] - 1.5 || x > b[2] + 1.5 || y < b[1] - 1.5 || y > b[3] + 1.5)
  const alfas: number[] = []
  let chao = 0
  cadaPixel(im, (x, y, o) => {
    if (x > 0 || y > 0) return
    const d = tampo.d(x, y)
    if (d < folga || d > Math.max(FIM_DA_FAIXA_DE_BAIXO, folga + 0.4) || !longeDasPernas(x, y)) return
    alfas.push(im.px[o + 3])
    if (im.px[o + 3] < ALFA_DE_PECA) chao += 1
  })
  // A sombra do tampo, à direita no meio da altura: o tampo deslocado pela altura (`SOMBRA_X`, `SOMBRA_Y`).
  const ox = SOMBRA_X * g.altura
  const oy = SOMBRA_Y * g.altura
  const bordaDireita = g.tampo[2]
  let larguraPrevista = 0
  for (let x = bordaDireita; x < bordaDireita + 3 * ox; x += 0.05) if (tampo.d(x - ox, -oy) <= 0) larguraPrevista = x - bordaDireita
  const alfaEm = (x: number, y: number): number => {
    const i = Math.min(im.W - 1, Math.max(0, Math.floor((x - im.x0) * im.S)))
    const j = Math.min(im.H - 1, Math.max(0, Math.floor((y - im.y0) * im.S)))
    return im.px[(j * im.W + i) * 4 + 3]
  }
  let largura = 0
  for (let x = bordaDireita; x < bordaDireita + 3 * ox; x += 0.5 / im.S) if (alfaEm(x, 0) >= 8) largura = x - bordaDireita
  return { pixels: alfas.length, fracaoDeChao: alfas.length > 0 ? chao / alfas.length : 0, alfa: media(alfas), alfaDoTampo: alfaEm(bordaDireita + 0.75 * ox, 0), largura, larguraPrevista }
}

/** Brilho da faixa da borda do tampo (fora o contorno de meio pixel) e do miolo. */
function bordaEMiolo(im: Imagem, g: GeometriaDaMesa): { borda: number; miolo: number } {
  const tampo = formaDoTampo(g)
  const folga = folgaDoPixel(im)
  const brilhos: number[] = []
  cadaPixel(im, (x, y, o) => {
    const t = -tampo.d(x, y)
    if (t >= folga && t <= g.larguraDaBordaClara && im.px[o + 3] >= ALFA_OPACO) brilhos.push(brilho(im.px, o))
  })
  return { borda: media(brilhos), miolo: brilhoDoMiolo(im, g) }
}

/** Quanto a perna é mais escura que o miolo, no mínimo, para ler como perna (na sombra do tampo). */
const PERNA_MAIS_ESCURA = 0.05
/** A sombra de baixo: alfa médio mínimo (0,25 de 255) e quanto passa da sombra do tampo (em 255). */
const ALFA_MINIMO_DA_SOMBRA_DE_BAIXO = 0.25 * 255
const SOMBRA_DE_BAIXO_ALEM_DA_DO_TAMPO = 10
/** Quanto a borda clara passa do miolo, no mínimo. */
const BORDA_MAIS_CLARA = 0.01

function reprovacoesDeMesa(im: Imagem, g: GeometriaDaMesa): string[] {
  const erros: string[] = []
  const miolo = brilhoDoMiolo(im, g)
  pernasAMostra(im, g).forEach((p, i) => {
    if (p.pixels < 3) erros.push(`perna ${i}: só ${p.pixels} pixels fora do tampo`)
    else if (p.fracaoOpaca < 0.8) erros.push(`perna ${i}: ${(p.fracaoOpaca * 100).toFixed(0)}% opaca`)
    else if (!(p.brilho <= miolo - PERNA_MAIS_ESCURA)) erros.push(`perna ${i}: brilho ${p.brilho.toFixed(3)} contra o miolo ${miolo.toFixed(3)}`)
  })
  const s = sombraDeBaixo(im, g)
  if (s.pixels < 4 || s.fracaoDeChao < 0.9) erros.push(`sombra de baixo: ${s.pixels} pixels, ${(s.fracaoDeChao * 100).toFixed(0)}% chão`)
  else if (!(s.alfa >= ALFA_MINIMO_DA_SOMBRA_DE_BAIXO)) erros.push(`sombra de baixo: alfa ${s.alfa.toFixed(1)}`)
  else if (!(s.alfa >= s.alfaDoTampo + SOMBRA_DE_BAIXO_ALEM_DA_DO_TAMPO)) erros.push(`sombra de baixo ${s.alfa.toFixed(1)} não passa da do tampo ${s.alfaDoTampo}`)
  if (Math.abs(s.largura - s.larguraPrevista) > 1.5 + 1 / im.S) erros.push(`sombra do tampo: largura ${s.largura.toFixed(2)} contra ${s.larguraPrevista.toFixed(2)} prevista`)
  const b = bordaEMiolo(im, g)
  if (!(b.borda >= b.miolo + BORDA_MAIS_CLARA)) erros.push(`borda ${b.borda.toFixed(3)} contra o miolo ${b.miolo.toFixed(3)}`)
  return erros
}

const MEDIR = import.meta.env.MEDIR_MESAS === '1'

describe('mesas: lê como mesa (semente do app), e a mesa de antes reprova', () => {
  for (const forma of FORMAS) {
    for (const madeira of MADEIRAS) {
      for (const nivel of [1, 3]) {
        it(`${forma.tipo} ${forma.casasW}x${forma.casasH} ${madeira} no nível ${nivel}: pernas à mostra, sombra de baixo, borda clara`, () => {
          const d = desenhoDoApp(forma.tipo, forma.casasW, forma.casasH, madeira, nivel)
          const g = geometria(d)
          const im = nova(d, nivel)
          if (MEDIR) {
            const s = sombraDeBaixo(im, g)
            const b = bordaEMiolo(im, g)
            const p = pernasAMostra(im, g)
            console.log(`${forma.tipo} ${madeira} n${nivel}: miolo ${b.miolo.toFixed(3)} borda ${b.borda.toFixed(3)} pernas ${p.map((x) => `${x.pixels}/${x.fracaoOpaca.toFixed(2)}/${x.brilho.toFixed(3)}`).join(' ')} baixo ${s.pixels}/${s.fracaoDeChao.toFixed(2)}/${s.alfa.toFixed(1)} tampo ${s.alfaDoTampo} largura ${s.largura.toFixed(2)}/${s.larguraPrevista.toFixed(2)} | antiga: ${reprovacoesDeMesa(antiga(d, nivel), g).join('; ')}`)
          }
          expect(reprovacoesDeMesa(im, g)).toEqual([])
          // Controle positivo: a de antes, com a mesma semente e o mesmo material, reprova nas três provas.
          const deAntes = reprovacoesDeMesa(antiga(d, nivel), g)
          expect(deAntes.some((e) => e.startsWith('perna')), deAntes.join('; ')).toBe(true)
          expect(deAntes.some((e) => e.startsWith('sombra de baixo')), deAntes.join('; ')).toBe(true)
          expect(deAntes.some((e) => e.startsWith('borda')), deAntes.join('; ')).toBe(true)
        })
      }
    }
  }

  for (const t of OUTROS_TAMANHOS) {
    it(`${t.tipo} ${t.casasW}x${t.casasH} ${t.madeira} nos níveis 1 e 3: também lê como mesa`, () => {
      for (const nivel of [1, 3]) {
        const d = desenhoDoApp(t.tipo, t.casasW, t.casasH, t.madeira, nivel)
        expect(reprovacoesDeMesa(nova(d, nivel), geometria(d)), `nível ${nivel}`).toEqual([])
      }
    })
  }
})

const COBERTURA_MINIMA = 0.25
const SATURACAO_P95_MAXIMA = 0.62
const BRILHO_MEDIO_MINIMO = 0.17
const CONTORNO_MINIMO = 0.06
const LUMINANCIA_LINEAR_MINIMA = 0.03
const OPACIDADE_DOS_OPACOS_MINIMA = 0.98
const OPACIDADE_DO_MIOLO_MINIMA = 0.96

describe('mesas: os limites de pixel da MT2 com a semente do app, nos níveis 1 a 3', () => {
  const casos = [...FORMAS.flatMap((f) => MADEIRAS.map((madeira) => ({ ...f, madeira }))), ...OUTROS_TAMANHOS]
  for (const caso of casos) {
    for (const nivel of [1, 2, 3]) {
      it(`${caso.tipo} ${caso.casasW}x${caso.casasH} ${caso.madeira} no nível ${nivel}: cobre, cor contida, claro, contorno nunca preto, opaca`, () => {
        const d = desenhoDoApp(caso.tipo, caso.casasW, caso.casasH, caso.madeira, nivel)
        const S = escalaDoNivel(nivel)
        const { limites, pixels } = pintarMovel(d, S)
        const m = medirImagem(pixels, limites.W, limites.H, caso.casasW * G * S * (caso.casasH * G * S))
        expect(m.cobertura).toBeGreaterThanOrEqual(COBERTURA_MINIMA)
        expect(m.saturacaoP95).toBeLessThanOrEqual(SATURACAO_P95_MAXIMA)
        expect(m.brilhoMedio).toBeGreaterThanOrEqual(BRILHO_MEDIO_MINIMO)
        expect(m.contornoMinimo).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
        expect(m.brilhoMinimo).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
        expect(m.luminanciaLinearMinima).toBeGreaterThanOrEqual(LUMINANCIA_LINEAR_MINIMA)
        expect(m.opacidadeDosOpacos).toBeGreaterThanOrEqual(OPACIDADE_DOS_OPACOS_MINIMA)
        expect(m.opacidadeDoMiolo).toBeGreaterThanOrEqual(OPACIDADE_DO_MIOLO_MINIMA)
      })
    }
  }
})

/**
 * Frestas entre as tábuas do tampo (que correm deitadas): linhas de pixels do
 * miolo em que mais da metade fica abaixo de 0,82 do brilho mediano do miolo. A
 * fresta corre a tábua inteira; a emenda de topo e o veio, não.
 */
function centrosDasFrestas(im: Imagem, g: GeometriaDaMesa): number[] {
  const tampo = formaDoTampo(g)
  const margem = 2 * g.larguraDaBordaClara
  const linhas: { y: number; brilhos: number[] }[] = []
  for (let j = 0; j < im.H; j += 1) {
    const y = im.y0 + (j + 0.5) / im.S
    const brilhos: number[] = []
    for (let i = 0; i < im.W; i += 1) {
      const x = im.x0 + (i + 0.5) / im.S
      if (-tampo.d(x, y) >= margem) brilhos.push(brilho(im.px, (j * im.W + i) * 4))
    }
    if (brilhos.length > 0) linhas.push({ y, brilhos })
  }
  const todos = linhas.flatMap((l) => l.brilhos).sort((a, b) => a - b)
  const mediana = todos[Math.floor(todos.length / 2)]
  const centros: number[] = []
  let inicio: number | null = null
  let ultimo = 0
  for (const { y, brilhos } of linhas) {
    const fresta = brilhos.filter((b) => b < 0.82 * mediana).length > brilhos.length / 2
    if (fresta && inicio === null) inicio = y
    if (!fresta && inicio !== null) {
      centros.push((inicio + ultimo) / 2)
      inicio = null
    }
    ultimo = y
  }
  if (inicio !== null) centros.push((inicio + ultimo) / 2)
  return centros
}

function frestas(im: Imagem, g: GeometriaDaMesa): number {
  return centrosDasFrestas(im, g).length
}

/** A distância mediana entre frestas vizinhas (px do protótipo): a largura da tábua que se vê. */
function larguraDaTabuaVista(im: Imagem, g: GeometriaDaMesa): number {
  const c = centrosDasFrestas(im, g)
  const passos = c.slice(1).map((y, i) => y - c[i]).sort((a, b) => a - b)
  return passos.length > 0 ? passos[Math.floor(passos.length / 2)] : NaN
}

describe('mesa retangular: estica sem esticar o desenho (tábua e perna por casa)', () => {
  const desenho = (casasW: number, casasH: number): DesenhoDoMovel => ({ tipo: 'mesa', lado: 'frente', materiais: ['carvalho'], casasW, casasH, semente: 7 })

  it('de 2 x 1 para 3 x 1: as mesmas tábuas e as mesmas pernas; 4 x 2 tem o dobro de tábuas; a de antes alargava as tábuas', () => {
    const [d21, d31, d42] = [desenho(2, 1), desenho(3, 1), desenho(4, 2)]
    const [g21, g31, g42] = [geometria(d21), geometria(d31), geometria(d42)]
    expect(g31.larguraDaTabua).toBe(g21.larguraDaTabua)
    expect(g42.larguraDaTabua).toBe(g21.larguraDaTabua)
    const lado = (g: GeometriaDaMesa): number => g.pernas[0][2] - g.pernas[0][0]
    expect(lado(g31)).toBe(lado(g21))
    expect(lado(g42)).toBe(lado(g21))
    const [n21, n31, n42] = [nova(d21, 3), nova(d31, 3), nova(d42, 3)]
    const f21 = frestas(n21, g21)
    if (MEDIR) console.log(`frestas: 2x1 ${f21}, 3x1 ${frestas(n31, g31)}, 4x2 ${frestas(n42, g42)}; antes 2x1 ${frestas(antiga(d21, 3), g21)}, 4x2 ${frestas(antiga(d42, 3), g42)}`)
    expect(f21).toBeGreaterThanOrEqual(3)
    expect(frestas(n31, g31)).toBe(f21)
    // A de 4 x 2 tem o tampo 2,5 vezes mais alto na janela medida: as frestas acompanham (pelo menos o dobro).
    expect(frestas(n42, g42) / f21).toBeGreaterThanOrEqual(2)
    // As pernas nos pixels: a da quina de cima à esquerda tem a mesma área à mostra (até 1 pixel de arredondamento por lado).
    const area = (im: Imagem, g: GeometriaDaMesa): number => pernasAMostra(im, g)[0].pixels
    expect(Math.abs(area(n31, g31) - area(n21, g21))).toBeLessThanOrEqual(0.15 * area(n21, g21))
    expect(Math.abs(area(n42, g42) - area(n21, g21))).toBeLessThanOrEqual(0.15 * area(n21, g21))
    // A tábua que se vê nos pixels é a de uma casa (0,2 casa) nas duas; a de antes, na de 4 x 2, tinha o dobro (altura / 4,2).
    for (const [im, g] of [[n21, g21], [n42, g42]] as const) expect(Math.abs(larguraDaTabuaVista(im, g) - g21.larguraDaTabua)).toBeLessThanOrEqual(0.25 * g21.larguraDaTabua)
    expect(larguraDaTabuaVista(antiga(d42, 3), g42)).toBeGreaterThan(1.5 * g21.larguraDaTabua)
  })
})

describe('mesas: mesma entrada, mesma imagem, sem sorteio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('as 9 combinações: duas gerações dão a mesma digital, sem chamar Math.random; outra madeira dá outra', () => {
    const sorteio = vi.spyOn(Math, 'random')
    for (const forma of FORMAS) {
      const digitais = MADEIRAS.map((madeira) => {
        const d = desenhoDoApp(forma.tipo, forma.casasW, forma.casasH, madeira, 2)
        const a = digitalDosPixels(pintarMovel(d, escalaDoNivel(2)).pixels)
        expect(digitalDosPixels(pintarMovel(d, escalaDoNivel(2)).pixels), `${forma.tipo} ${madeira}`).toBe(a)
        return a
      })
      expect(new Set(digitais).size, forma.tipo).toBe(3)
    }
    expect(sorteio).not.toHaveBeenCalled()
  })
})

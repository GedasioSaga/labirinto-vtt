/**
 * COVA de cima (07/11/2026), o desenho do Atual, em TRÊS VERSÕES do estúdio
 * (`~/jogos/texturas-labirinto/exportado/cemiterio-atual/opcoes-cova`, folha
 * `prova/cova-atual-opcoes.png`), escolhidas no painel (`lib/mobilia/cova.ts`),
 * que chegam na `variante`:
 *
 * - 0 Fresca: o monte recém-cavado, terra solta sem assentar, borda irregular e
 *   torrões caídos ao pé dela;
 * - 1 Antiga: o monte baixo de bordas gastas, o miolo afundado (a cova cedeu) e
 *   três tufos de mato nas beiradas;
 * - 2 Com pedras: o retângulo de cantos gastos com terra rasa por dentro e a roda
 *   de pedras de granito marcando a borda.
 *
 * Ao longo do lado maior da pegada (1 x 2 casas, estica com ela). No Desenhado sai
 * a arte do estúdio (`godot/desenhado/exportado/movel-cova`), uma só. Sem material
 * do painel: a terra, as pedras e o mato têm cor própria.
 */
import { elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { hash, rgb } from '../../ruido'
import { lerVarianteDaCova, type FormaDaCova } from '../../../lib/mobilia/cova'

/** Vértices de cada borda. */
const VERTICES = 48

/** A sombra no chão: cinza-escuro neutro. O piso padrão é a nogueira quente e pintava a borda de laranja. */
const SOMBRA_DO_CHAO = rgb('#3d3935')

/**
 * Feitio de uma borda: meia largura e meio comprimento (frações da pegada),
 * expoente da superelipse (2 = elipse; maior = mais quadrado) e o tremor da borda,
 * em três ondas de fase fixa. Sem a pílula: a borda não é uma reta com duas pontas.
 */
interface Feitio {
  readonly larg: number
  readonly comp: number
  readonly expoente: number
  readonly tremor: number
  /** Quanto a borda se alarga para o pé (positivo) ou para a cabeça (negativo), em fração da largura. */
  readonly inclina: number
  readonly fases: readonly [number, number, number]
}

/** Ponto da borda no ângulo `t`, em (através, ao longo), em frações da pegada. */
function bordaEm(f: Feitio, t: number): Ponto {
  const e = 2 / f.expoente
  const c = Math.cos(t)
  const s = Math.sin(t)
  const k = 1 + f.tremor * (Math.sin(3 * t + f.fases[0]) + 0.6 * Math.sin(5 * t + f.fases[1]) + 0.35 * Math.sin(9 * t + f.fases[2]))
  const b = Math.sign(s) * Math.abs(s) ** e * f.comp * k
  return [Math.sign(c) * Math.abs(c) ** e * f.larg * k * (1 + f.inclina * (b / f.comp)), b]
}

/** A borda inteira, com um pouco de tremor por vértice (`folga`: o torrão que sobra na beira). */
function borda(f: Feitio, semente: number, folga: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < VERTICES; i += 1) {
    const [a, b] = bordaEm(f, (i / VERTICES) * 2 * Math.PI)
    const j = 1 + folga * (hash(i, 7, semente) - 0.5)
    pontos.push([a * j, b * j])
  }
  return pontos
}

/**
 * Torrões: células de Voronoi com um ponto sorteado em cada. `fresta` é a folga
 * entre o ponto mais perto e o segundo (perto de 0 = divisa entre dois torrões);
 * `tom` é o claro ou escuro sorteado para o torrão.
 */
function torroes(x: number, y: number, lado: number, semente: number): { fresta: number; tom: number; perto: number } {
  const X = x / lado
  const Y = y / lado
  const cx = Math.floor(X)
  const cy = Math.floor(Y)
  let perto = Infinity
  let longe = Infinity
  let tom = 0.5
  for (let j = -1; j <= 1; j += 1) {
    for (let i = -1; i <= 1; i += 1) {
      const ix = cx + i
      const iy = cy + j
      const d = Math.hypot(X - (ix + hash(ix, iy, semente)), Y - (iy + hash(ix, iy, semente + 1)))
      if (d < perto) {
        longe = perto
        perto = d
        tom = hash(ix, iy, semente + 2)
      } else if (d < longe) {
        longe = d
      }
    }
  }
  return { fresta: longe - perto, tom, perto }
}

/** (através, ao longo) em frações da meia pegada → px do protótipo; o comprimento corre no lado maior. */
function posicionador(c: ContextoDoMovel): { em: (atraves: number, aoLongo: number) => Ponto; meiaL: number } {
  const deitada = c.w > c.h
  const meioC = Math.max(c.hw, c.hh)
  const meiaL = Math.min(c.hw, c.hh)
  return { em: (atraves, aoLongo) => (deitada ? [aoLongo * meioC, atraves * meiaL] : [atraves * meiaL, aoLongo * meioC]), meiaL }
}

// ---------------------------------------------------------------------------
// 0 FRESCA: monte recém-cavado.

/** Altura do monte em casas: a terra fofa sobe mais que a de uma cova assentada. */
const ALTURA_DA_FRESCA = 0.1
/** A terra fresca: cinza-marrom escura, sem o laranja do barranco. */
const TERRA_FRESCA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#5a5249') }
/** Os torrões caídos: um tom mais escuro, para não virarem o mesmo monte. */
const TORRAO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#4a443d') }
const FEITIO_DA_FRESCA: Feitio = { larg: 0.8, comp: 0.9, expoente: 2.7, tremor: 0.06, inclina: 0.12, fases: [0.4, 1.9, 4.1] }
/** Os torrões caídos ao pé da borda: ângulo da borda onde caem e raio em frações da meia pegada. */
const CAIDOS: readonly (readonly [number, number])[] = [
  [0.3, 0.15],
  [1.9, 0.13],
  [2.6, 0.17],
  [3.5, 0.14],
  [4.4, 0.16],
  [5.5, 0.15],
]

/** A luz da terra fresca: a luz de cima à esquerda, cada torrão um pouco mais claro ou escuro e as frestas escuras entre eles. */
function texDaTerraFresca(hw: number, hh: number, semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const nx = x / hw
    const ny = y / hh
    const { fresta, tom, perto } = torroes(x, y, 13, semente)
    s[3] += -0.14 * (0.5 * nx + 0.85 * ny) + (tom - 0.5) * 0.04 + (0.6 - perto) * 0.4 - Math.max(0, 0.05 - fresta) * 0.5 + ruido(x * 1.6, y * 1.6) * 0.12
  }
}

/** Um torrão caído: polígono irregular de raio `r` (px do protótipo) no ponto (x, y). */
function torraoCaido(x: number, y: number, r: number, semente: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < 7; i += 1) {
    const t = (i / 7) * 2 * Math.PI
    const k = 0.65 + 0.6 * hash(i, semente, 11)
    pontos.push([x + Math.cos(t) * r * k, y + Math.sin(t) * r * k * 0.8])
  }
  return pontos
}

const montarCovaFresca: MontarMovel = (c, cena) => {
  const P = c.peca
  const { em, meiaL } = posicionador(c)
  const forma = poligono(borda(FEITIO_DA_FRESCA, 61, 0.07).map(([a, b]) => em(a, b)))
  cena.sombras.push({ forma, z: c.g * ALTURA_DA_FRESCA }, contato(forma))
  const L = cena.partes
  L.push(P(forma, TERRA_FRESCA, { bisel: meiaL * 0.45, contorno: 0.45, textura: texDaTerraFresca(c.hw, c.hh, 61), semente: 61 }))
  CAIDOS.forEach(([t, r], i) => {
    const [a, b] = bordaEm(FEITIO_DA_FRESCA, t)
    const [x, y] = em(a * 1.03, b * 1.03)
    const caido = poligono(torraoCaido(x, y, r * meiaL, 70 + i))
    cena.sombras.push(contato(caido, 0.2))
    L.push(P(caido, TORRAO, { bisel: 0.8, contorno: 0.35, semente: 70 + i }))
  })
}

// ---------------------------------------------------------------------------
// 1 ANTIGA: monte afundado, com mato.

/** Altura do monte em casas: baixo, a terra já assentou. */
const ALTURA_DA_ANTIGA = 0.07
/** A crosta de terra velha: cinza-marrom, um pouco mais clara que o miolo. */
const TERRA_VELHA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#5f5850') }
/** O miolo afundado: a terra mais escura, onde a cova cedeu. */
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#403b36') }
/** O mato: o verde-oliva escuro do Meio-Termo, em tom baixo para não gritar. */
const MATO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** A borda antiga é mais redonda e lenta que a fresca: o tremor é baixo e de onda longa. */
const FEITIO_DA_ANTIGA: Feitio = { larg: 0.86, comp: 0.92, expoente: 2.3, tremor: 0.09, inclina: -0.1, fases: [2.2, 0.5, 3.3] }
/** O miolo afundado: menor, mais quadrado, sem tremor de borda. */
const MIOLO: Feitio = { larg: 0.5, comp: 0.56, expoente: 2.4, tremor: 0.05, inclina: 0, fases: [1.1, 2.7, 0.2] }
/** Os três tufos: ângulo da borda onde nascem (o pé fica um pouco fora dela), tamanho em fração da meia pegada. */
const TUFOS: readonly (readonly [number, number])[] = [
  [4.6, 0.36],
  [1.0, 0.28],
  [3.6, 0.22],
]

/** A luz da terra velha: torrões com pouco contraste (terra assentada é mais lisa) e frestas leves entre eles. */
function texDaTerraVelha(hw: number, hh: number, semente: number, forca: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const nx = x / hw
    const ny = y / hh
    const { fresta, tom, perto } = torroes(x, y, 16, semente)
    s[3] += forca * (-0.12 * (0.5 * nx + 0.85 * ny) + (tom - 0.5) * 0.03 + (0.6 - perto) * 0.3 - Math.max(0, 0.04 - fresta) * 0.5) + ruido(x * 1.4, y * 1.4) * 0.08
  }
}

/** Um tufo de mato de `largura` x `alto` px com o pé em (x, y): folhas em zigue-zague. */
function tufo(x: number, y: number, largura: number, alto: number): Ponto[] {
  const m = largura / 2
  return [
    [x - m, y],
    [x - m * 0.8, y - alto * 0.7],
    [x - m * 0.3, y - alto * 0.2],
    [x, y - alto],
    [x + m * 0.3, y - alto * 0.25],
    [x + m * 0.85, y - alto * 0.6],
    [x + m, y],
  ]
}

const montarCovaAntiga: MontarMovel = (c, cena) => {
  const P = c.peca
  const { em, meiaL } = posicionador(c)
  const forma = poligono(borda(FEITIO_DA_ANTIGA, 61, 0.05).map(([a, b]) => em(a, b)))
  cena.sombras.push({ forma, z: c.g * ALTURA_DA_ANTIGA }, contato(forma, 0.25))
  const L = cena.partes
  L.push(P(forma, TERRA_VELHA, { bisel: meiaL * 0.22, contorno: 0.4, textura: texDaTerraVelha(c.hw, c.hh, 61, 1), semente: 61 }))
  const miolo = poligono(borda(MIOLO, 62, 0.05).map(([a, b]) => em(a, b)))
  L.push(P(miolo, FUNDO, { bisel: meiaL * 0.1, contorno: 0.3, recesso: { k: 2.4, forca: 0.36 }, textura: texDaTerraVelha(c.hw, c.hh, 62, 0.8), semente: 62 }))
  TUFOS.forEach(([t, tamanho], i) => {
    const [a, b] = bordaEm(FEITIO_DA_ANTIGA, t)
    const [x, y] = em(a * 1.04, b * 1.04)
    L.push(P(poligono(tufo(x, y, tamanho * meiaL * 2, tamanho * meiaL * 1.4)), MATO, { bisel: 0.4, contorno: 0.3, tom: 0.95 + 0.1 * i, semente: 63 + i }))
  })
}

// ---------------------------------------------------------------------------
// 2 COM PEDRAS: contorno de pedras.

/** Altura em casas: a terra da cova é rasa, sem monte alto. */
const ALTURA_DA_COM_PEDRAS = 0.07
/** A terra solta dentro da cova: escura e acinzentada. */
const TERRA_SOLTA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#45403b') }
/** As pedras: granito do Meio-Termo, um tom abaixo do claro para não brilhar demais. */
const PEDRA: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: rgb(tomDoMeio('granito', 0.9)) }
/** Quantas pedras na roda. */
const PEDRAS = 11
/** Expoente alto = retângulo de cantos gastos, não pílula. */
const FEITIO_DA_COM_PEDRAS: Feitio = { larg: 0.78, comp: 0.86, expoente: 3.6, tremor: 0.025, inclina: 0, fases: [0.9, 2.1, 0.3] }

/** A luz da terra solta da cova: a luz de cima à esquerda, torrões e frestas escuras entre eles. */
function texDaTerraSolta(hw: number, hh: number, semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const nx = x / hw
    const ny = y / hh
    const { fresta, tom, perto } = torroes(x, y, 12, semente)
    s[3] += -0.12 * (0.5 * nx + 0.85 * ny) + (tom - 0.5) * 0.04 + (0.6 - perto) * 0.4 - Math.max(0, 0.05 - fresta) * 0.5 + ruido(x * 1.6, y * 1.6) * 0.12
  }
}

const montarCovaComPedras: MontarMovel = (c, cena) => {
  const P = c.peca
  const { em, meiaL } = posicionador(c)
  const terra = poligono(borda(FEITIO_DA_COM_PEDRAS, 61, 0.04).map(([a, b]) => em(a, b)))
  cena.sombras.push({ forma: terra, z: c.g * ALTURA_DA_COM_PEDRAS }, contato(terra, 0.25))
  const L = cena.partes
  L.push(P(terra, TERRA_SOLTA, { bisel: meiaL * 0.2, contorno: 0.4, textura: texDaTerraSolta(c.hw, c.hh, 61), semente: 61 }))
  // A roda de pedras: uma por fatia da borda, com tamanho e giro sorteados; a pedra entra um pouco na terra.
  for (let k = 0; k < PEDRAS; k += 1) {
    const t = ((k + 0.5) / PEDRAS) * 2 * Math.PI + (hash(k, 0, 80) - 0.5) * 0.3
    const [a, b] = bordaEm(FEITIO_DA_COM_PEDRAS, t)
    const [x, y] = em(a * 1.02, b * 1.02)
    const rx = meiaL * (0.14 + 0.08 * hash(k, 1, 80))
    const ry = rx * (0.6 + 0.3 * hash(k, 2, 80))
    const pedra: Forma = elipseGirada(x, y, rx, ry, (hash(k, 3, 80) - 0.5) * Math.PI)
    cena.sombras.push(contato(pedra, 0.25))
    L.push(P(pedra, PEDRA, { bisel: 1.2, contorno: 0.5, projeta: { dist: 1.2, forca: 0.3 }, semente: 90 + k }))
  }
}

const MONTAR_POR_VERSAO: Readonly<Record<FormaDaCova, MontarMovel>> = {
  fresca: montarCovaFresca,
  antiga: montarCovaAntiga,
  pedras: montarCovaComPedras,
}

export const montarCova: MontarMovel = (c, cena) => {
  cena.corDoPiso = SOMBRA_DO_CHAO
  MONTAR_POR_VERSAO[lerVarianteDaCova(c.variante)](c, cena)
}

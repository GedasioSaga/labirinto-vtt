/**
 * COVA de cima (07/11/2026), o desenho do Atual: o monte de terra comprido de
 * uma sepultura fechada, ao longo do lado maior da pegada (1 x 2 casas, estica
 * com ela). A metade da cabeça pega a luz; a dos pés é a terra revolvida, mais
 * escura, com a beira ondulada de través e duas pedras; dois tufos de capim
 * nascem na metade clara. No Desenhado sai a arte do estúdio
 * (`godot/desenhado/exportado/movel-cova`), que este desenho segue de longe.
 * Sem material: a terra, as pedras e o capim têm cor própria.
 */
import { capsula, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** Altura do monte em casas (a sombra é curta: a terra é baixa). */
const ALTURA = 0.2
/** A terra: o barranco do Meio-Termo, um pouco mais escuro (a cova recém-fechada). */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('barranco', 0.92)) }
const PEDRA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('granito', 0.82)) }
/** O capim, o mesmo verde-oliva do pé da lápide. */
const CAPIM: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.95)) }

/** Quanto a terra revolvida dos pés escurece, e a largura (fração do comprimento) da passagem para ela. */
const ESCURO_DOS_PES = 0.17
const PASSAGEM = 0.06

/** (através, ao longo) em frações da meia pegada → px do protótipo; `deitada` = o comprimento corre em x. */
type Posicao = (atraves: number, aoLongo: number) => Ponto

/**
 * A luz da terra: o domo (claro em cima à esquerda, escuro embaixo à direita), a terra revolvida dos pés
 * depois da beira ondulada e os torrões (o ruído miúdo).
 */
function texDaTerra(hw: number, hh: number, deitada: boolean): Textura {
  return (_u, _v, x, y, _p, s) => {
    const nx = x / hw
    const ny = y / hh
    const aoLongo = deitada ? nx : ny
    const atraves = deitada ? ny : nx
    const beira = 0.04 + 0.07 * Math.sin(atraves * 4.2)
    const pes = Math.max(0, Math.min(1, (aoLongo - beira) / PASSAGEM + 0.5))
    s[3] += -0.14 * (0.5 * nx + 0.85 * ny) - ESCURO_DOS_PES * pes + ruido(x * 0.35, y * 0.35) * 0.08
  }
}

/** Um tufo de capim de `largura` x `alto` px com o pé em (x, y): folhas em zigue-zague, como o da lápide. */
function tufo(x: number, y: number, largura: number, alto: number): Forma {
  const m = largura / 2
  return poligono([
    [x - m, y],
    [x - m * 0.8, y - alto * 0.7],
    [x - m * 0.3, y - alto * 0.2],
    [x, y - alto],
    [x + m * 0.3, y - alto * 0.25],
    [x + m * 0.85, y - alto * 0.6],
    [x + m, y],
  ])
}

export const montarCova: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, peca: P } = c
  const deitada = w > h
  const meioC = Math.max(hw, hh)
  const meiaL = Math.min(hw, hh)
  const em: Posicao = (atraves, aoLongo) => (deitada ? [aoLongo * meioC, atraves * meiaL] : [atraves * meiaL, aoLongo * meioC])
  const r = meiaL * 0.94
  const a = Math.max(0, meioC * 0.97 - r)
  const monte = deitada ? capsula(-a, 0, a, 0, r) : capsula(0, -a, 0, a, r)
  cena.sombras.push({ forma: monte, z: c.g * ALTURA }, contato(monte))
  const L = cena.partes
  L.push(P(monte, TERRA, { bisel: r * 0.3, contorno: 0.45, textura: texDaTerra(hw, hh, deitada), semente: 61 }))
  // As duas pedras na terra revolvida, tortas.
  const pedras: readonly [number, number, number, number, number][] = [
    [-0.22, 0.3, 0.3, 0.19, -0.45],
    [0.28, 0.64, 0.21, 0.15, 0.35],
  ]
  pedras.forEach(([atraves, aoLongo, rx, ry, angulo], i) => {
    const [x, y] = em(atraves, aoLongo)
    L.push(P(elipseGirada(x, y, rx * meiaL, ry * meiaL, deitada ? angulo + Math.PI / 2 : angulo), PEDRA, { bisel: 1.2, contorno: 0.5, projeta: { dist: 1.2, forca: 0.3 }, semente: 62 + i }))
  })
  // Os tufos de capim na metade clara.
  const tufos: readonly [number, number, number][] = [
    [-0.42, -0.6, 0.36],
    [0.46, -0.22, 0.28],
  ]
  for (const [atraves, aoLongo, tamanho] of tufos) {
    const [x, y] = em(atraves, aoLongo)
    L.push(P(tufo(x, y, tamanho * meiaL * 2, tamanho * meiaL * 1.5), CAPIM, { bisel: 0.4, contorno: 0.3, semente: 64 }))
  }
}

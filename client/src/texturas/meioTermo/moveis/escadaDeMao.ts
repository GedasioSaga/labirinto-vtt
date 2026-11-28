/**
 * ESCADA DE MÃO (L01 do plano de arte por tema, 28/11/2026, temas Dungeons e Prisão; fila de 24/11): a escada de
 * madeira de dois BANZOS e oito DEGRAUS roliços encaixados, com a CAVILHA escura de cada encaixe. Duas versões no
 * mesmo tipo (`versoes/escadaDeMaoVersoes.ts`):
 *
 * - ENCOSTADA (a 1ª, `montarEscadaDeMao`): o pé no chão e a ponta apoiada na parede do lado de cima da pegada. Vista
 *   do alto ela encurta (os degraus ficam mais juntos) e a SOMBRA dela se afasta para baixo à direita conforme a
 *   escada sobe: é o que diz que ela está em pé. Na 3/4 cada degrau e cada trecho dos banzos sobe na altura dele, cada
 *   um com a sombra solta (a regra dos elos do lustre): a escada aparece inclinada até a parede. De cima o banzo é uma
 *   peça só (a dos trechos só aparece na 3/4: `soNaTresQuartos`), para não sair emendado.
 * - DEITADA (`montarEscadaDeMaoDeitada`): a mesma escada largada no chão, inteira, com a sombra curta.
 *
 * Pegada 0,5 x 1,5 casa, comprida no sentido de y. Material: `madeira`. Na 3/4 o perfil é `{ modo: 'derivado',
 * espessura: 0 }` (os tampos soltos sem beirada).
 */
import { caixa, elipse, type Forma } from './formas'
import { contato, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { comMeioEm } from './varalDeBandeirinhas'

/** O banzo (largura, px), o raio do degrau roliço, quantos degraus e a folga da ponta até a beira da pegada (px). */
const LARGURA_DO_BANZO = 2.6
const RAIO_DO_DEGRAU = 0.95
const DEGRAUS = 8
const FOLGA = 1.5
/** Encostada: o cosseno do ângulo com o chão (de cima ela mede 0,62 do comprimento: uns 52 graus). */
const COSSENO_DA_ENCOSTADA = 0.62
/** Os trechos de cada banzo na 3/4 da encostada (mais trechos, degrau menor entre eles). */
const TRECHOS = 16
/** A escada deitada sobe um nada na 3/4: o banzo e o degrau, que é mais fino (px). */
const ALTURA_DO_BANZO_DEITADO = 2.4
const ALTURA_DO_DEGRAU_DEITADO = 1.9
/** A cavilha escura de cada encaixe e o pino que sobe as peças só de cima (um fio, para sumirem na 3/4). */
const CAVILHA: MaterialDaPeca = { classe: 'liso', rgb: [0x3c, 0x2c, 0x22] }
const ALTURA_DO_PINO_DE_CIMA = 0.05

/** A peça só onde a vista é a de cima (`dy` zero) ou só na 3/4 (a peça subiu, `dy` diferente de zero). */
function soNaVista(mat: MaterialDaPeca, deCima: boolean): Textura {
  const doMaterial = texturaDaClasse(mat.classe)
  return (u, v, x, y, p, s, escala) => {
    if ((p.dy === 0) !== deCima) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

interface Medidas {
  /** O meio de cada banzo (x) e as pontas da escada no chão: a de cima e o pé. */
  readonly xb: number
  readonly yTopo: number
  readonly yPe: number
  /** A altura da ponta de cima (px; 0 = deitada). */
  readonly alto: number
}

function medidas(c: ContextoDoMovel, encostada: boolean): Medidas {
  const comprido = c.h - 2 * FOLGA
  const projetado = encostada ? comprido * COSSENO_DA_ENCOSTADA : comprido
  const yTopo = -c.hh + FOLGA
  return {
    xb: c.hw - LARGURA_DO_BANZO / 2 - 0.8,
    yTopo,
    yPe: yTopo + projetado,
    alto: encostada ? comprido * Math.sqrt(1 - COSSENO_DA_ENCOSTADA ** 2) : 0,
  }
}

/** Os degraus, de cima para o pé, com a altura de cada um. */
function degraus(m: Medidas): { readonly y: number; readonly z: number }[] {
  const passo = (m.yPe - m.yTopo) / (DEGRAUS + 0.4)
  return Array.from({ length: DEGRAUS }, (_, j) => {
    const y = m.yTopo + passo * (j + 0.7)
    return { y, z: (m.alto * (m.yPe - y)) / (m.yPe - m.yTopo) }
  })
}

function montarEscada(c: ContextoDoMovel, cena: Cena, encostada: boolean): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const m = medidas(c, encostada)
  const lb = LARGURA_DO_BANZO / 2
  const banzo = (x: number, y0: number, y1: number): Forma => caixa(x - lb, y0, x + lb, y1, 0.7)
  const lista = degraus(m)

  // Os DEGRAUS primeiro: as pontas entram nos banzos, que passam por cima delas.
  lista.forEach(({ y, z }, j) => {
    const degrau = caixa(-m.xb, y - RAIO_DO_DEGRAU, m.xb, y + RAIO_DO_DEGRAU, RAIO_DO_DEGRAU)
    cena.sombras.push(encostada ? { forma: degrau, z, solta: true, suave: 1, forca: 0.3 } : { forma: degrau, z: ALTURA_DO_DEGRAU_DEITADO, forca: 0.26 })
    L.push(P(degrau, mad, { eixo: 0, tabua: 0, bisel: RAIO_DO_DEGRAU, tom: 1.02, contorno: 0.26, semente: 3100 + j }))
  })

  if (!encostada) {
    for (const lado of [-1, 1]) {
      const forma = banzo(lado * m.xb, m.yTopo, m.yPe)
      cena.sombras.push({ forma, z: ALTURA_DO_BANZO_DEITADO, forca: 0.3 })
      L.push(P(forma, mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.94, contorno: 0.28, semente: 3120 }))
      for (const { y } of lista) L.push(P(elipse(lado * m.xb, y, 0.65, 0.65), CAVILHA, { tabua: 0, bisel: 0.4, contorno: 0, alfa: 0.85, semente: 3130 }))
    }
    return
  }

  // ENCOSTADA. Na 3/4: os trechos dos banzos, cada um na altura dele e esticado para cima pelo degrau de altura até o
  // vizinho (sem isso ficava um vão entre dois trechos). De cima eles não pintam.
  const trecho = (m.yPe - m.yTopo) / TRECHOS
  const subida = m.alto / TRECHOS
  for (const lado of [-1, 1]) {
    for (let k = 0; k < TRECHOS; k += 1) {
      const y0 = m.yTopo + trecho * k
      const y1 = y0 + trecho
      const z = (m.alto * (m.yPe - (y0 + y1) / 2)) / (m.yPe - m.yTopo)
      const forma = banzo(lado * m.xb, Math.max(m.yTopo, y0 - subida), y1)
      cena.sombras.push({ forma: banzo(lado * m.xb, y0, y1), z, solta: true, suave: 1, forca: 0.32 })
      L.push(P(forma, mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.94, contorno: 0.28, textura: soNaVista(mad, false), semente: 3120 }))
    }
  }
  // De cima: cada banzo inteiro e as cavilhas, presos a um pino que sobe um fio (na 3/4 eles somem).
  const [px, py] = [0, m.yPe + 0.6]
  cena.sombras.push({ forma: elipse(px, py, 0.1, 0.1), z: ALTURA_DO_PINO_DE_CIMA, solta: true, forca: 0 })
  for (const lado of [-1, 1]) {
    L.push(P(comMeioEm(banzo(lado * m.xb, m.yTopo, m.yPe), px, py), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.94, contorno: 0.28, textura: soNaVista(mad, true), semente: 3120 }))
    for (const { y } of lista) L.push(P(comMeioEm(elipse(lado * m.xb, y, 0.6, 0.6), px, py), CAVILHA, { tabua: 0, bisel: 0.4, contorno: 0, alfa: 0.85, textura: soNaVista(CAVILHA, true), semente: 3130 }))
  }
  // O pé no chão: o contato curto de cada banzo.
  for (const lado of [-1, 1]) cena.sombras.push(contato(banzo(lado * m.xb, m.yPe - 2.4, m.yPe), 0.3))
}

export const montarEscadaDeMao: MontarMovel = (c, cena) => {
  montarEscada(c, cena, true)
}

export const montarEscadaDeMaoDeitada: MontarMovel = (c, cena) => {
  montarEscada(c, cena, false)
}

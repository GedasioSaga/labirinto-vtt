/**
 * A CASA NA ÁRVORE (lote L19 de 14/11/2026, item 108 da lista do dia; construção do parque que barra). Uma árvore
 * de copa larga e, presa ao tronco, a plataforma de tábuas em três estacas, com a casinha de tábuas (o telhado de
 * telha de madeira avermelhada, a porta, a janela de cruz e a bandeirinha na empena), a varanda com o parapeito e a
 * escada de mão que desce da varanda ao chão.
 *
 * De cima, a copa fica a noroeste por cima do tronco e a casinha a sudeste, com o telhado de duas águas, a varanda e
 * a escada à mostra: é o telhado vermelho no meio do verde, com a escada saindo dele, que diz "casa na árvore". Na
 * 3/4 (as duas vistas de `duasVistasDoParque.ts`) se veem o tronco, as estacas, a casa de frente com a porta e a
 * janela, e a copa por trás e por cima dela.
 *
 * Materiais: `madeira` (a casa, a plataforma, o parapeito e a escada); a casca, as folhas e a telha são fixas. O
 * piso de luz é o verde-escuro da folha (`cena.corDoPiso`, como na laranjeira): a copa é a maior parte do desenho.
 */
import { hash } from '../../ruido'
import { capsula, dentroDe, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { PISO_DA_FOLHA, type MaterialDaPeca } from './motor'
import { G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { bloco, deslocada, novoPalco, type OpcoesDaVista, type P3, type Palco } from './duasVistasDoParque'

const CASCA = materialDaPeca('lenhaCarvalho')
const FOLHA = materialDaPeca('buxo')
const TELHA: MaterialDaPeca = { classe: 'madeira', rgb: [0x8c, 0x54, 0x42] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x2a, 0x22] }
const BANDEIRA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xc0, 0x9a, 0x50] }

/** O raio de partida (a meia pegada de 3 casas): `k` = 1 nele. */
const RAIO_DE_PARTIDA = 84
/** As alturas, em casas: a plataforma, a parede da casa, o beiral e o cume do telhado acima dela, e a copa (o alto e a grossura). */
const ALTURA_DA_PLATAFORMA = 1.15
const ALTURA_DA_PAREDE = 0.62
const CUME_ACIMA_DA_PAREDE = 0.38
const ALTURA_DA_COPA = 2.45
const GROSSURA_DA_COPA = 0.55
/** As medidas da planta, em px numa árvore de 3 casas: [x0, y0, x1, y1]. */
const PLATAFORMA = [-30, -26, 56, 44] as const
const CASA = [0, -14, 50, 18] as const
const BEIRADA_DO_TELHADO = 4
const ESPESSURA_DA_PLATAFORMA = 4
/** O tronco: o meio e o raio (px). */
const TRONCO: Ponto = [-24, -18]
const RAIO_DO_TRONCO = 12.5
/** As estacas da plataforma e o raio delas (px). */
const ESTACAS: readonly Ponto[] = [[-26, 40], [52, 40], [52, -22]]
const RAIO_DA_ESTACA = 2.2
/** A escada: os dois banzos (x, px), até onde ela chega no chão (y, px) e quantos degraus. */
const BANZOS = [-19, -10] as const
const PE_DA_ESCADA = 70
const DEGRAUS = 6
/** O parapeito da varanda: a altura acima da plataforma (casas), os balaústres da frente (x, px) e o do lado. */
const ALTURA_DO_PARAPEITO = 0.36
const BALAUSTRES = [-5, 16, 36, 55] as const
const BALAUSTRE_DO_LADO: Ponto = [55, 22]
/** A porta e a janela na parede do sul (px na parede, a partir do pé dela). */
const PORTA = { x0: 9, x1: 21, alto: 25 }
const JANELA = { x0: 28, x1: 40, z0: 11, z1: 23 }
/** A copa: os lóbulos (x, y, raio, px numa árvore de 3 casas) e a receita da folhagem (a da laranjeira). */
const LOBULOS: readonly (readonly [number, number, number])[] = [
  [-30, -30, 34],
  [-58, -6, 23],
  [-52, -50, 24],
  [-12, -58, 21],
  [16, -48, 22],
  [6, -26, 19],
]
const TOM_DA_MASSA = 0.8
const COPA = { raio: 0.86, puxa: 0.16 }
const REALCE = { raio: 0.3, x: 0.36, y: 0.4, tom: 1.16, quantos: 0.7 }
/** A ordem da 3/4 onde a conta do meio erra: a escada passa na frente da beira da plataforma. */
const ESCADA_ADIANTE = 30

/** A largura da tábua do tabuado (px numa árvore de 3 casas). */
const TABUA = 5.5
const OPCOES_DA_TABUA: OpcoesDaVista = { bisel: 0.8, contorno: 0.28 }

interface Desenho {
  readonly palco: Palco
  readonly c: ContextoDoMovel
  readonly k: number
  readonly g: number
}

/** O tronco (em dois pedaços: o de cima passa na frente da plataforma) e as raízes no chão. */
function tronco(d: Desenho): void {
  const { palco, k, g } = d
  const [tx, ty] = TRONCO.map((v) => v * k)
  const r = RAIO_DO_TRONCO * k
  const zp = ALTURA_DA_PLATAFORMA * g
  const zc = (ALTURA_DA_COPA - GROSSURA_DA_COPA * 0.5) * g
  const casca = { tabua: 0, bisel: 2 * k, contorno: 0.3, semente: 10 }
  for (let i = 0; i < 5; i += 1) {
    const a = 0.5 + i * 1.25
    const raiz = elipseGirada(tx + Math.cos(a) * r * 1.05, ty + Math.sin(a) * r * 1.05, 7 * k, 3.2 * k, a)
    palco.plano(raiz, 1, CASCA, { ...casca, eixo: a, tom: 0.9, semente: 11 + i }, { adiante: -100 })
  }
  palco.costado(tx, ty, r, 0, zp, CASCA, casca)
  palco.costado(tx, ty, r * 0.92, zp - 2, zc, CASCA, { ...casca, semente: 12 })
}

/** A plataforma: as estacas, o tabuado com a beira, o parapeito da varanda e a escada de mão. */
function plataforma(d: Desenho): void {
  const { palco, c, k, g } = d
  const mad = c.m.madeira
  const zp = ALTURA_DA_PLATAFORMA * g
  const e = ESPESSURA_DA_PLATAFORMA * k
  const [x0, y0, x1, y1] = PLATAFORMA.map((v) => v * k)
  ESTACAS.forEach(([x, y], i) => {
    palco.costado(x * k, y * k, RAIO_DA_ESTACA * k, 0, zp - e, mad, { tabua: 0, bisel: 0.8, contorno: 0.3, tom: 0.85, semente: 20 + i })
    palco.contato(elipse(x * k, y * k, RAIO_DA_ESTACA * k * 1.4, RAIO_DA_ESTACA * k * 1.4), 0.3)
  })
  bloco(palco, x0, y0, x1, y1, zp - e, zp, mad, { ...OPCOES_DA_TABUA, tabua: TABUA * k, eixo: QUARTO, semente: 30 })
  // O parapeito: os balaústres e a tábua de cima, na frente da varanda e no lado de leste.
  const zr = zp + ALTURA_DO_PARAPEITO * g
  const balaustre = { tabua: 0, bisel: 0.6, contorno: 0.3, tom: 0.92 }
  for (const x of BALAUSTRES) palco.costado(x * k, y1 - 1.5 * k, 1.2 * k, zp, zr, mad, { ...balaustre, semente: 40 + x })
  palco.costado(BALAUSTRE_DO_LADO[0] * k, BALAUSTRE_DO_LADO[1] * k, 1.2 * k, zp, zr, mad, { ...balaustre, semente: 49 })
  bloco(palco, BALAUSTRES[0] * k - 1.5 * k, y1 - 3 * k, x1, y1, zr - 2.4 * k, zr, mad, { tabua: 0, bisel: 0.6, contorno: 0.3, semente: 50 }, { adiante: 2 })
  bloco(palco, x1 - 3 * k, CASA[3] * k, x1, y1, zr - 2.4 * k, zr, mad, { tabua: 0, bisel: 0.6, contorno: 0.3, eixo: QUARTO, semente: 51 }, { adiante: 2 })
  // A escada de mão: os banzos e os degraus, tábuas inclinadas da beira da varanda ao chão.
  const pe = PE_DA_ESCADA * k
  const largura = 1.6 * k
  const madEscada = { tabua: 0, bisel: 0.5, contorno: 0.32, eixo: QUARTO, semente: 60 }
  for (const xb of BANZOS) {
    const x = xb * k
    palco.face([[x - largura, y1, zp], [x + largura, y1, zp], [x + largura, pe, 0], [x - largura, pe, 0]], mad, madEscada, { adiante: ESCADA_ADIANTE + 1 })
  }
  for (let i = 1; i <= DEGRAUS; i += 1) {
    const t = i / (DEGRAUS + 1)
    const y = y1 + (pe - y1) * t
    const z = zp * (1 - t)
    const dy = 1.5 * k
    const dz = (zp / (pe - y1)) * dy
    palco.face([[BANZOS[0] * k, y, z], [BANZOS[1] * k, y, z], [BANZOS[1] * k, y + dy, z - dz], [BANZOS[0] * k, y + dy, z - dz]], mad, { ...madEscada, eixo: 0, tom: 0.95 }, { adiante: ESCADA_ADIANTE })
  }
  palco.contato(capsula(BANZOS[0] * k, pe, BANZOS[1] * k, pe, 1.6 * k), 0.3)
}

/** A casinha: as paredes de tábua, a porta e a janela na do sul, o telhado de duas águas e a bandeirinha. */
function casa(d: Desenho): void {
  const { palco, c, k, g } = d
  const mad = c.m.madeira
  const zp = ALTURA_DA_PLATAFORMA * g
  const zw = zp + ALTURA_DA_PAREDE * g
  const [x0, y0, x1, y1] = CASA.map((v) => v * k)
  const ym = (y0 + y1) / 2
  const dentro: P3 = [(x0 + x1) / 2, ym, zp + 2]
  const parede = { tabua: 4.6 * k, bisel: 0.6, contorno: 0.28, eixo: 0 }
  palco.face([[x0, y1, zp], [x1, y1, zp], [x1, y1, zw], [x0, y1, zw]], mad, { ...parede, semente: 70 }, { dentro })
  palco.face([[x0, y0, zp], [x1, y0, zp], [x1, y0, zw], [x0, y0, zw]], mad, { ...parede, semente: 71 }, { dentro })
  // As paredes das empenas sobem até o cume (a casa girada mostra a empena de frente).
  const zc = zw + CUME_ACIMA_DA_PAREDE * g
  for (const x of [x0, x1]) palco.face([[x, y0, zp], [x, y1, zp], [x, y1, zw], [x, ym, zc - 2 * k], [x, y0, zw]], mad, { ...parede, semente: 72 }, { dentro })
  // A porta e a janela, um tico para fora da parede do sul (a ordem da 3/4 as põe por cima dela).
  const yf = y1 + 0.3
  palco.face([[PORTA.x0 * k, yf, zp], [PORTA.x1 * k, yf, zp], [PORTA.x1 * k, yf, zp + PORTA.alto * k], [PORTA.x0 * k, yf, zp + PORTA.alto * k]], VAO, { tabua: 0, bisel: 0.5, contorno: 0.32 }, { dentro, luz: 0, adiante: 12 })
  const [jx0, jx1, jz0, jz1] = [JANELA.x0 * k, JANELA.x1 * k, zp + JANELA.z0 * k, zp + JANELA.z1 * k]
  const moldura = 1.3 * k
  palco.face([[jx0 - moldura, yf, jz0 - moldura], [jx1 + moldura, yf, jz0 - moldura], [jx1 + moldura, yf, jz1 + moldura], [jx0 - moldura, yf, jz1 + moldura]], mad, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 1.12, semente: 73 }, { dentro, adiante: 12.5 })
  palco.face([[jx0, yf, jz0], [jx1, yf, jz0], [jx1, yf, jz1], [jx0, yf, jz1]], VAO, { tabua: 0, bisel: 0.4, contorno: 0.2 }, { dentro, luz: 0, adiante: 12.6 })
  const jxm = (jx0 + jx1) / 2
  const jzm = (jz0 + jz1) / 2
  palco.face([[jxm - 0.7 * k, yf, jz0], [jxm + 0.7 * k, yf, jz0], [jxm + 0.7 * k, yf, jz1], [jxm - 0.7 * k, yf, jz1]], mad, { tabua: 0, bisel: 0.2, contorno: 0.16, tom: 1.12 }, { dentro, adiante: 12.7 })
  palco.face([[jx0, yf, jzm - 0.7 * k], [jx1, yf, jzm - 0.7 * k], [jx1, yf, jzm + 0.7 * k], [jx0, yf, jzm + 0.7 * k]], mad, { tabua: 0, bisel: 0.2, contorno: 0.16, tom: 1.12 }, { dentro, adiante: 12.8 })
  // O telhado: as duas águas de telha (as fiadas ao comprido), passando da parede.
  const b = BEIRADA_DO_TELHADO * k
  const ze = zw - 2 * k
  const telha = { tabua: 3.6 * k, bisel: 0.7, contorno: 0.3, eixo: 0 }
  palco.face([[x0 - b, y1 + b, ze], [x1 + b, y1 + b, ze], [x1 + b, ym, zc], [x0 - b, ym, zc]], TELHA, { ...telha, semente: 80 }, { dentro })
  palco.face([[x0 - b, y0 - b, ze], [x1 + b, y0 - b, ze], [x1 + b, ym, zc], [x0 - b, ym, zc]], TELHA, { ...telha, semente: 81 }, { dentro })
  // A cumeeira, uma tábua por cima do cume.
  palco.face([[x0 - b, ym - 1.2 * k, zc + 0.4], [x1 + b, ym - 1.2 * k, zc + 0.4], [x1 + b, ym + 1.2 * k, zc + 0.4], [x0 - b, ym + 1.2 * k, zc + 0.4]], mad, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.8, semente: 82 }, { dentro, acima: 1, adiante: 1 })
  // A bandeirinha na ponta do cume de oeste: a vara e o pano (na 3/4 de pé, de cima deitado para leste).
  const pau = 14 * k
  const [vx, vy] = [x0 - b + 2 * k, ym]
  palco.costado(vx, vy, 0.7 * k, zc, zc + pau, mad, { tabua: 0, bisel: 0.3, contorno: 0.3 }, { adiante: 40 })
  const [bx, by] = palco.naTela([vx, vy, zc + pau - 1 * k])
  palco.deFrente(poligono([[bx + 0.6 * k, by - 0.4 * k], [bx + 10 * k, by + 2.4 * k], [bx + 0.6 * k, by + 5.2 * k]]), BANDEIRA, { tabua: 0, bisel: 0.5, contorno: 0.26, tom: 0.95 }, vy + zc + pau + 41)
  palco.deCima(poligono([[vx + 0.8 * k, vy - 2.4 * k], [vx + 10 * k, vy], [vx + 0.8 * k, vy + 2.4 * k]]), BANDEIRA, { tabua: 0, bisel: 0.5, contorno: 0.26 }, zc + pau)
}

/** Muitos círculos numa forma só (a massa da copa): a distância é a do círculo mais perto. */
function circulos(lista: readonly (readonly [number, number, number])[]): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y, r] of lista) {
    x0 = Math.min(x0, x - r)
    y0 = Math.min(y0, y - r)
    x1 = Math.max(x1, x + r)
    y1 = Math.max(y1, y + r)
  }
  return {
    b: [x0, y0, x1, y1],
    d(px, py) {
      let menor = Infinity
      for (const [x, y, r] of lista) menor = Math.min(menor, Math.hypot(px - x, py - y) - r)
      return menor
    },
  }
}

/**
 * A copa: a massa, as copinhas puxadas para a luz e os realces (a receita da laranjeira). De cima, no alto; na
 * 3/4, o corpo da copa (cada lóbulo varrido de pé, a grossura da folhagem, mais escuro) e a mesma copa por cima.
 */
function copa(d: Desenho): void {
  const { palco, k, g } = d
  const zc = ALTURA_DA_COPA * g
  const grossura = GROSSURA_DA_COPA * g
  const lobulos = LOBULOS.map(([x, y, r]): readonly [number, number, number] => {
    const [gx, gy] = palco.noChao(x * k, y * k)
    return [gx, gy, r * k]
  })
  // As formas na tela (giradas): a mesma copa serve às duas vistas, porque a de cima é sempre sem giro.
  const massa = circulos(lobulos)
  // O corpo: cada lóbulo varrido de pé do alto da copa até a grossura dela (a cápsula de pé de cada círculo).
  const varrido: Forma = {
    b: [massa.b[0], massa.b[1] - zc, massa.b[2], massa.b[3] - zc + grossura],
    d: (x, y) => {
      let menor = Infinity
      for (const [lx, ly, r] of lobulos) {
        const cy = Math.max(ly - zc, Math.min(ly - zc + grossura, y))
        menor = Math.min(menor, Math.hypot(x - lx, y - cy) - r)
      }
      return menor
    },
  }
  // Na 3/4 a copa vai depois do tronco e antes da casa (ela fica atrás e por cima da casa, a noroeste).
  const fundoDaCopa = zc - grossura
  palco.deFrente(varrido, FOLHA, { bisel: 0, contorno: 0.24, tom: 0.72, semente: 90 }, fundoDaCopa - 1)
  const porCima = (forma: Forma, o: OpcoesDaVista, i: number): void => {
    palco.deCima(forma, FOLHA, o, zc + i * 0.01)
    palco.deFrente(deslocada(forma, 0, -zc), FOLHA, o, fundoDaCopa + i * 0.01)
  }
  porCima(massa, { bisel: 0, contorno: 0.24, tom: TOM_DA_MASSA, semente: 91 }, 0)
  lobulos.forEach(([x, y, r], i) => {
    porCima(dentroDe(elipse(x - COPA.puxa * r, y - COPA.puxa * r * 1.1, r * COPA.raio, r * COPA.raio), massa), { bisel: 0, contorno: 0, semente: 100 + i }, 1 + i)
  })
  lobulos.forEach(([x, y, r], i) => {
    if (hash(i, 3, 7720) >= REALCE.quantos) return
    porCima(dentroDe(elipse(x - REALCE.x * r, y - REALCE.y * r, r * REALCE.raio, r * REALCE.raio), massa), { bisel: 0, contorno: 0, tom: REALCE.tom, semente: 120 + i }, 20 + i)
  })
}

export const montarCasaNaArvore: MontarMovel = (c, cena) => {
  const k = Math.min(c.hw, c.hh) / RAIO_DE_PARTIDA
  const g = G * k
  const palco = novoPalco(c.peca, cena, c.giro)
  const d: Desenho = { palco, c, k, g }
  cena.corDoPiso = PISO_DA_FOLHA
  // A sombra no chão: a copa e o telhado caídos pela altura, a plataforma, e o pé do tronco.
  const pontos: P3[] = []
  for (const [x, y, r] of LOBULOS) {
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4
      pontos.push([(x + r * Math.cos(a)) * k, (y + r * Math.sin(a)) * k, ALTURA_DA_COPA * g])
    }
  }
  const [px0, py0, px1, py1] = PLATAFORMA.map((v) => v * k)
  const zw = (ALTURA_DA_PLATAFORMA + ALTURA_DA_PAREDE + CUME_ACIMA_DA_PAREDE) * g
  pontos.push([px0, py1, 0], [px1, py1, 0], [px1, py0, zw], [px1, py1, zw])
  palco.sombra(pontos, 0.24, 3)
  palco.contato(elipse(TRONCO[0] * k, TRONCO[1] * k, RAIO_DO_TRONCO * k * 1.15, RAIO_DO_TRONCO * k * 1.15), 0.34)
  tronco(d)
  plataforma(d)
  casa(d)
  copa(d)
  palco.fechar()
}

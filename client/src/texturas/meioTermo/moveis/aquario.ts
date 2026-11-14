/**
 * AQUÁRIO de cima com volume (lote L12 dos objetos novos, 14/11/2026, "Descanso e brincadeira"): o tanque de
 * vidro de gabinete de colecionador, retangular, com a MOLDURA de metal e as cantoneiras, em cima de um MÓVEL de
 * madeira. De cima se vê o tampo do móvel numa beira estreita em volta (atrás e dos lados; na frente o vidro fica
 * rente), o VIDRO claro entre a moldura e a água e, pela água, o FUNDO de areia com as manchas de luz que a
 * superfície joga nele, os SEIXOS, uma ÂNFORA tombada e três tufos de PLANTA. Na água nadam três PEIXES (dois
 * dourados e um prateado), cada um com a sombra dele na areia; num canto sobe um fio de BOLHAS, e a superfície
 * tem dois brilhos do lado da luz.
 *
 * A 25% de zoom sobram o retângulo de água azul-esverdeada com a moldura clara e as pintas laranja dos peixes:
 * é o que diz aquário, e não tina ou cocho (a água deles é escura e sem fundo; aqui o fundo de areia clareia a água).
 *
 * Na 3/4 (`tresQuartos.ts`, derivado, beirada de `ESPESSURA_DO_TANQUE_DO_AQUARIO`): o MÓVEL é uma coluna da
 * altura dele, e o TANQUE é um tampo solto na altura da boca, com a beirada da altura do vidro: a frente que se vê
 * é o vidro (a maior peça do tanque) em cima da frente de madeira do móvel. As beiras do tampo do móvel ficam
 * fora do tanque e são as peças do móvel: é por elas que a frente dele sai de madeira. O móvel vem antes do
 * tanque (mesma base, mais baixo), e o tanque tapa a beira de trás, como tapa de verdade. A sombra do tanque no
 * chão é a forma dele arrastada da altura do móvel até a boca, calculada aqui (a estrutura dele é só âncora).
 *
 * Materiais: `madeira` (o móvel) e `moldura` (a moldura e as cantoneiras). A água, o vidro, a areia, os seixos,
 * a ânfora, as plantas e os peixes são fixos.
 */
import { limitar01, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, cadeia, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

/** A altura do móvel e a da boca do tanque, em casas; a beirada da 3/4 é a altura do vidro (px). */
const ALTURA_DO_MOVEL = 0.5
const ALTURA_DA_BOCA = 0.88
export const ESPESSURA_DO_TANQUE_DO_AQUARIO = (ALTURA_DA_BOCA - ALTURA_DO_MOVEL) * G

/** O desenho foi medido em 1,2 x 0,6 casa: as medidas miúdas (px) escalam por aqui. */
const MEIA_LARGURA_DE_PARTIDA = 0.6 * G
const MEIA_FUNDURA_DE_PARTIDA = 0.3 * G

/** Px: a beira do tampo do móvel em volta do tanque, a moldura e o vidro. */
const BEIRA_DO_MOVEL = 3
const MOLDURA = 1.5
const VIDRO_GROSSO = 0.8
const CANTONEIRA = 2.4

/** O vidro (claro, um pouco verde, como o vidro grosso), a água, a areia, o brilho e as bolhas. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xa4, 0xc6, 0xc0] }
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 1.08)) }
const AREIA: MaterialDaPeca = { classe: 'liso', rgb: [0xc9, 0xb6, 0x8c] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xec, 0xf2, 0xee] }
/** A água cobre o fundo sem esconder: a areia, os seixos e as plantas aparecem por ela. */
const ALFA_DA_AGUA = 0.46

/** Os peixes: o dourado (contido, para a saturação ficar no teto) e o prateado; a nadadeira é mais clara. */
const DOURADO: Rgb = [0xd2, 0x8e, 0x58]
const PRATEADO: Rgb = [0xa9, 0xb8, 0xbf]
const OLHO: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x26, 0x22] }

/** Cada peixe: o meio [x, y] em frações da meia água, o rumo da cabeça (graus), o tamanho e a cor. */
const PEIXES: readonly (readonly [x: number, y: number, rumo: number, tamanho: number, cor: Rgb])[] = [
  [-0.18, -0.12, 168, 1, DOURADO],
  [0.36, 0.22, -18, 0.86, DOURADO],
  [-0.56, 0.3, 24, 0.78, PRATEADO],
]

/** Os seixos do fundo: o meio em frações da meia água, o raio (px de partida) e o tom (fração do cinza). */
const SEIXOS: readonly (readonly [x: number, y: number, raio: number, tom: number])[] = [
  [-0.86, 0.62, 1.5, 0.9],
  [-0.7, 0.72, 1.1, 1.15],
  [-0.12, 0.74, 1.3, 1],
  [0.06, 0.66, 1, 1.2],
  [0.52, 0.76, 1.4, 0.85],
  [0.7, 0.66, 1.1, 1.1],
  [0.86, 0.04, 1.2, 0.95],
  [-0.9, -0.1, 1.1, 1.05],
]
const CINZA_DO_SEIXO: Rgb = [0x9a, 0x94, 0x8a]

/** Os tufos de planta: o pé em frações da meia água, as folhas (rumo em graus e comprimento em px de partida) e o verde. */
const TUFOS: readonly (readonly [x: number, y: number, folhas: readonly (readonly [rumo: number, comprimento: number])[], verde: 'buxo' | 'alfeneiro'])[] = [
  [0.74, -0.52, [[200, 8], [235, 9.5], [260, 7], [170, 6.5], [290, 5.5]], 'buxo'],
  [-0.78, -0.56, [[-20, 7.5], [-60, 8.5], [10, 6], [-95, 5.5]], 'alfeneiro'],
  [0.2, 0.58, [[-110, 6.5], [-75, 7.5], [-140, 5]], 'alfeneiro'],
]
const PASSOS_DA_FOLHA = 7
const RAIO_DA_FOLHA = 0.6

/** A luz da superfície no fundo (as cáusticas): a escala da rede e quanto ela clareia a areia. */
const ESCALA_DA_REDE = 0.24
const LUZ_DA_REDE = 0.34

/** Para o lado da luz, no chão: a moldura desse lado faz sombra na água (como a borda da tina). */
const PARA_A_LUZ_X = -0.79
const PARA_A_LUZ_Y = -0.61
const SOMBRA_DA_MOLDURA = 2.6
const FORCA_DA_SOMBRA_DA_MOLDURA = 0.3

/** O fundo de areia: as dunas miúdas que a água deixa e as manchas de luz da superfície, em rede. */
function texDaAreia(k: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const xs = x / k
    const ys = y / k
    const duna = Math.sin(xs * 0.9 + ruido(xs * 0.08 + p.su, ys * 0.08) * 6) * 0.035
    const r1 = 1 - Math.abs(ruido(xs * ESCALA_DA_REDE + 13, ys * ESCALA_DA_REDE) * 2)
    const r2 = 1 - Math.abs(ruido(xs * ESCALA_DA_REDE * 1.3 + 70, ys * ESCALA_DA_REDE * 1.3 + 5) * 2)
    const rede = Math.max(r1, r2)
    const r4 = rede * rede * rede * rede
    s[3] += duna + r4 * r4 * LUZ_DA_REDE + ruido(xs * 1.3, ys * 1.3) * 0.05
  }
}

/** A água: a sombra da moldura do lado da luz e a marola miúda. */
function texDaAgua(agua: Forma, k: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const naSombra = limitar01(0.5 + agua.d(x + PARA_A_LUZ_X * SOMBRA_DA_MOLDURA * k, y + PARA_A_LUZ_Y * SOMBRA_DA_MOLDURA * k) / (1.6 * k))
    const xs = x / k
    const ys = y / k
    s[3] += ruido(xs * 0.16 + p.su, ys * 0.16) * 0.1 + ruido(xs * 0.5, ys * 0.5 + p.sv) * 0.03 - FORCA_DA_SOMBRA_DA_MOLDURA * naSombra
  }
}

/** O peixe visto de cima: o corpo em gota, a cauda em leque atrás e a sombra dele no fundo. */
function formasDoPeixe(cx: number, cy: number, rumo: number, t: number): { corpo: Forma; cauda: Forma; olhos: readonly Ponto[] } {
  const a = (rumo * Math.PI) / 180
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  const em = (aoLongo: number, deTraves: number): Ponto => [cx + (ux * aoLongo - uy * deTraves) * t, cy + (uy * aoLongo + ux * deTraves) * t]
  const corpo = elipseGirada(cx, cy, 2.6 * t, 1.15 * t, a)
  const cauda = poligono([em(-1.9, 0), em(-4.4, -1.7), em(-3.8, 0), em(-4.4, 1.7)])
  return { corpo, cauda, olhos: [em(1.5, -0.55), em(1.5, 0.55)] }
}

/** A forma `f` andada de (dx, dy): a sombra do tanque no chão. */
function andada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

export const montarAquario: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const moldura = c.m.moldura
  const L = cena.partes
  const k = Math.min(hw / MEIA_LARGURA_DE_PARTIDA, hh / MEIA_FUNDURA_DE_PARTIDA)
  const zMovel = g * ALTURA_DO_MOVEL
  const zBoca = g * ALTURA_DA_BOCA

  // O tanque fica rente à frente do móvel; atrás e dos lados sobra a beira do tampo.
  const beira = BEIRA_DO_MOVEL * k
  const x0 = -hw + beira
  const x1 = hw - beira
  const y0 = -hh + beira
  const y1 = hh
  const tanque = caixa(x0, y0, x1, y1, 0.6 * k)
  const dentro = MOLDURA * k
  const agua = (MOLDURA + VIDRO_GROSSO) * k
  const ax0 = x0 + agua
  const ax1 = x1 - agua
  const ay0 = y0 + agua
  const ay1 = y1 - agua
  const formaDaAgua = caixa(ax0, ay0, ax1, ay1, 0.4 * k)
  const mx = (ax1 - ax0) / 2
  const my = (ay1 - ay0) / 2
  const ox = (ax0 + ax1) / 2
  const oy = (ay0 + ay1) / 2
  const naAgua = (fx: number, fy: number): Ponto => [ox + fx * mx, oy + fy * my]

  // O MÓVEL: a coluna até o tampo, e a sombra do tanque arrastada do tampo do móvel até a boca. As beiras do
  // tampo são as peças do móvel (a de trás e as dos lados); a frente dele é a madeira delas.
  const movel = caixa(-hw, -hh, hw, hh, 0.5 * k)
  cena.sombras.push({ forma: movel, z: zMovel }, contato(movel, 0.32))
  const passos = 4
  for (let i = 1; i <= passos; i += 1) {
    const z = zMovel + ((zBoca - zMovel) * i) / passos
    cena.sombras.push({ forma: andada(tanque, SOMBRA_X * z, SOMBRA_Y * z), z: 0, suave: 0.8 + 0.09 * z, forca: 0.3 - 0.0016 * z })
  }
  L.push(P(caixa(-hw, -hh, hw, y0 + 0.4 * k, 0.5 * k), mad, { eixo: 0, tabua: 0, bisel: 0.9 * k, contorno: 0.26, semente: 7400 }))
  for (const lado of [-1, 1]) {
    const xa = lado < 0 ? -hw : x1 - 0.4 * k
    const xb = lado < 0 ? x0 + 0.4 * k : hw
    L.push(P(caixa(xa, y0, xb, hh, 0.5 * k), mad, { eixo: QUARTO, tabua: 0, bisel: 0.9 * k, contorno: 0.26, semente: 7401 + lado }))
  }

  // O TANQUE: tampo solto na boca, só âncora (a sombra dele já está no chão). O vidro é a peça maior: a frente da 3/4.
  cena.sombras.push({ forma: tanque, z: zBoca, solta: true, forca: 0 })
  L.push(P(tanque, VIDRO, { bisel: 0.6 * k, contorno: 0.22, semente: 7410 }))

  // O FUNDO, visto pela água: a areia com a luz da superfície, os seixos, a ânfora tombada e as plantas.
  L.push(P(formaDaAgua, AREIA, { bisel: 0, contorno: 0.1, textura: texDaAreia(k), recesso: { k: 2.2 * k, forca: 0.3 }, semente: 7420 }))
  SEIXOS.forEach(([fx, fy, raio, tom], i) => {
    const [x, y] = naAgua(fx, fy)
    L.push(P(elipse(x, y, raio * k * 1.15, raio * k), { classe: 'liso', rgb: CINZA_DO_SEIXO }, { bisel: raio * k, tom, contorno: 0.24, semente: 7430 + i }))
  })
  const barro = materialDaPeca('barro')
  const [anx, any] = naAgua(-0.44, 0.38)
  const giroDaAnfora = 0.35
  const bocaX = anx - Math.cos(giroDaAnfora) * 4.4 * k
  const bocaY = any - Math.sin(giroDaAnfora) * 4.4 * k
  L.push(P(capsula(anx, any, bocaX, bocaY, 0.9 * k), barro, { eixo: giroDaAnfora, bisel: 0.9 * k, tom: 0.9, contorno: 0.26, semente: 7440 }))
  L.push(P(elipseGirada(anx + Math.cos(giroDaAnfora) * 1.2 * k, any + Math.sin(giroDaAnfora) * 1.2 * k, 3.4 * k, 2 * k, giroDaAnfora), barro, { eixo: giroDaAnfora, bisel: 2 * k, contorno: 0.26, semente: 7441 }))
  L.push(P(elipseGirada(bocaX, bocaY, 0.7 * k, 1.25 * k, giroDaAnfora), barro, { bisel: 0.5 * k, tom: 0.62, contorno: 0.3, semente: 7442 }))
  TUFOS.forEach(([fx, fy, folhas, verde], i) => {
    const [px, py] = naAgua(fx, fy)
    const mat = materialDaPeca(verde)
    folhas.forEach(([rumo, comprimento], j) => {
      const a = (rumo * Math.PI) / 180
      const fio: Ponto[] = []
      for (let n = 0; n <= PASSOS_DA_FOLHA; n += 1) {
        const t = n / PASSOS_DA_FOLHA
        const lado = Math.sin(t * Math.PI * 2.2 + j) * 0.9 * k * t
        const ao = t * comprimento * k
        fio.push([px + Math.cos(a) * ao - Math.sin(a) * lado, py + Math.sin(a) * ao + Math.cos(a) * lado])
      }
      L.push(P(cadeia(fio, RAIO_DA_FOLHA * k), mat, { bisel: 0.5 * k, tom: 1 + j * 0.05, contorno: 0.22, semente: 7450 + i * 10 + j }))
    })
  })

  // A ÁGUA por cima do fundo: deixa ver tudo, mais verde e mais escura do lado da moldura que faz sombra.
  L.push(P(formaDaAgua, AGUA, { bisel: 0, contorno: 0, alfa: ALFA_DA_AGUA, textura: texDaAgua(formaDaAgua, k), semente: 7460 }))

  // Os PEIXES, no meio da água, com a sombra deles no fundo.
  PEIXES.forEach(([fx, fy, rumo, tamanho, cor], i) => {
    const [px, py] = naAgua(fx, fy)
    const { corpo, cauda, olhos } = formasDoPeixe(px, py, rumo, tamanho * k)
    const sombra = { dist: 3.2 * k, forca: 0.32, suave: 1 * k }
    L.push(P(cauda, { classe: 'liso', rgb: cor }, { bisel: 0.4 * k, tom: 1.1, alfa: 0.86, contorno: 0.2, semente: 7470 + i, projeta: sombra }))
    L.push(P(corpo, { classe: 'liso', rgb: cor }, { bisel: 1.1 * tamanho * k, contorno: 0.24, semente: 7475 + i, projeta: sombra }))
    for (const [ex, ey] of olhos) L.push(P(elipse(ex, ey, 0.32 * k, 0.32 * k), OLHO, { bisel: 0, contorno: 0, semente: 7480 + i }))
  })

  // As BOLHAS subindo no canto da planta escura, e os dois BRILHOS da superfície do lado da luz.
  for (let i = 0; i < 4; i += 1) {
    const [bx, by] = naAgua(0.6 + (i % 2) * 0.05, 0.1 - i * 0.2)
    const r = (0.55 + i * 0.12) * k
    L.push(P(elipse(bx, by, r, r), BRILHO, { bisel: r, alfa: 0.62, contorno: 0.3, semente: 7485 + i }))
  }
  const [b1x, b1y] = naAgua(-0.5, -0.62)
  const [b2x, b2y] = naAgua(0.05, -0.7)
  L.push(P(elipse(b1x, b1y, 6 * k, 0.55 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.34, suave: 0.6 * k, semente: 7490 }))
  L.push(P(elipse(b2x, b2y, 3 * k, 0.45 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.28, suave: 0.5 * k, semente: 7491 }))

  // A MOLDURA de metal por cima de tudo, com a beira de vidro clara por dentro e as quatro cantoneiras.
  L.push(P(caixa(x0 + dentro, y0 + dentro, x1 - dentro, y0 + agua, 0.2 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 7495 }))
  L.push(P(caixa(x0 + dentro, y0 + dentro, x0 + agua, y1 - dentro, 0.2 * k), BRILHO, { bisel: 0, contorno: 0, alfa: 0.4, semente: 7496 }))
  L.push(P(menos(tanque, caixa(x0 + dentro, y0 + dentro, x1 - dentro, y1 - dentro, 0.3 * k)), moldura, { bisel: 0.8 * k, contorno: 0.3, metal: 0.55, semente: 7500 }))
  const cant = CANTONEIRA * k
  const cantos: readonly Ponto[] = [[x0, y0], [x1 - cant, y0], [x0, y1 - cant], [x1 - cant, y1 - cant]]
  cantos.forEach(([x, y], i) => {
    L.push(P(caixa(x, y, x + cant, y + cant, 0.4 * k), moldura, { bisel: 0.9 * k, tom: 1.08, contorno: 0.3, metal: 0.6, semente: 7505 + i }))
  })
}

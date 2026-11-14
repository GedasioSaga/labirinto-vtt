/**
 * A PÉRGOLA COM TREPADEIRA (lote L19 de 14/11/2026, item 109 da lista do dia; construção do parque que não barra:
 * passa-se por baixo). Os esteios de madeira, as duas vigas ao comprido, as ripas de través por cima passando das
 * vigas, e a glicínia: a folhagem que corre por cima das ripas, os cachos lilás pendurados na frente e a rama
 * subindo por dois esteios. No chão, o caminho de lajes por baixo, com a sombra listrada das ripas.
 *
 * De cima, a grade das ripas com a folhagem e a sombra listrada no chão dizem "pérgola"; na 3/4 (as duas vistas de
 * `duasVistasDoParque.ts`) a pérgola fica de pé, com os cachos pendentes na frente. A pegada esticada de pé deita a
 * pérgola na vertical.
 *
 * Materiais: `madeira` (os esteios, as vigas e as ripas) e `pedra` (as lajes do caminho); a folhagem e as flores são
 * fixas. O piso de luz é o verde-escuro da folha (`cena.corDoPiso`, como na sebe).
 */
import { hash } from '../../ruido'
import { caixa, capsula, dentroDe, elipse, type Forma, type Ponto } from './formas'
import { PISO_DA_FOLHA, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca } from './motor'
import { G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { bloco, deslocada, novoPalco, type OpcoesDaVista, type P3, type Palco } from './duasVistasDoParque'

const FOLHA = materialDaPeca('buxo')
const LILAS: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x86, 0xb4] }
const LILAS_CLARO: MaterialDaPeca = { classe: 'liso', rgb: [0xc0, 0xb0, 0xd4] }
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1e, 0x16, 0x10] }

/** A meia pegada curta de partida (2 casas): `k` = 1 nela. */
const LADO_DE_PARTIDA = 56
/** Os esteios: o lugar (fração da meia pegada comprida e da curta), o lado do quadrado (px) e a altura (casas). */
const ESTEIO_AO_COMPRIDO = 0.84
const ESTEIO_DE_TRAVES = 0.6
const LADO_DO_ESTEIO = 5.5
const ALTURA_DAS_VIGAS = 1.42
/** As vigas: até onde vão (fração da meia pegada comprida), a altura e a grossura (px). */
const VIGA_ATE = 0.98
const ALTURA_DA_VIGA = 5.5
const GROSSURA_DA_VIGA = 3
/** As ripas: o passo, a largura, a altura (px) e até onde passam das vigas (fração da meia pegada curta). */
const PASSO_DAS_RIPAS = 9
const LARGURA_DA_RIPA = 2.3
const ALTURA_DA_RIPA = 3.4
const RIPA_ATE = 0.96
/** A folhagem por cima das ripas: os lóbulos (u, v em fração da meia pegada; raio em px numa de 2 casas de fundo). */
const LOBULOS: readonly (readonly [number, number, number])[] = [
  [-0.8, 0.5, 20],
  [-0.52, 0.6, 19],
  [-0.68, 0.05, 18],
  [-0.4, 0.22, 14],
  [-0.24, 0.56, 17],
  [0.04, 0.68, 15],
  [-0.86, -0.42, 16],
  [0.64, -0.55, 19],
  [0.88, -0.3, 17],
  [0.36, -0.64, 16],
  [0.74, 0.1, 14],
]
const COPA = { raio: 0.8, puxa: 0.24 }
const REALCE = { raio: 0.3, x: 0.34, y: 0.38, tom: 1.12, quantos: 0.5 }
/** Os cachos de flor: quantos por lóbulo na vista de cima, e os pendentes na frente (u em fração, comprimento em px). */
const FLORES_POR_LOBULO = 5
const PENDENTES: readonly (readonly [number, number])[] = [
  [-0.86, 13],
  [-0.7, 9],
  [-0.56, 15],
  [-0.4, 10],
  [-0.22, 12],
  [-0.05, 8],
  [0.12, 11],
]
/** A rama que sobe pelos esteios (os índices dos esteios) e o raio das folhas dela (px). */
const ESTEIOS_COM_RAMA = [0, 3] as const
const FOLHA_DA_RAMA = 2.4
/** As lajes do caminho: a meia largura (fração da meia pegada curta), o tamanho e a junta (px). */
const CAMINHO = 0.3
const LAJE = 11
const JUNTA = 1.2
/** A força da sombra pintada das ripas e da folhagem no chão. */
const ALFA_DA_SOMBRA = 0.2
/** As ripas vão depois das vigas na 3/4 (elas apoiam por cima); a folhagem depois das ripas. */
const RIPAS_ADIANTE = 40
const FOLHAGEM_ADIANTE = 60
const NO_CHAO = -1e4

interface Medidas {
  readonly k: number
  readonly g: number
  readonly deitado: boolean
  readonly a: number
  readonly b: number
  readonly zv: number
}

/** Do referencial da pérgola (u ao comprido, v de través) para o do objeto. */
function noObjeto(m: Medidas, u: number, v: number): Ponto {
  return m.deitado ? [u, v] : [v, u]
}

/** O bloco dado em (u, v): o mesmo bloco no referencial do objeto, com o veio ao comprido de u. */
function blocoUV(palco: Palco, m: Medidas, u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, mat: MaterialDaPeca, o: OpcoesDaVista, adiante = 0): void {
  const [x0, y0] = noObjeto(m, u0, v0)
  const [x1, y1] = noObjeto(m, u1, v1)
  const eixo = (o.eixo ?? 0) + (m.deitado ? 0 : QUARTO)
  bloco(palco, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), z0, z1, mat, { ...o, eixo }, { adiante })
}

function esteios(m: Medidas): Ponto[] {
  const us = m.a > 1.7 * m.b ? [-ESTEIO_AO_COMPRIDO, 0, ESTEIO_AO_COMPRIDO] : [-ESTEIO_AO_COMPRIDO, ESTEIO_AO_COMPRIDO]
  const lista: Ponto[] = []
  for (const v of [ESTEIO_DE_TRAVES, -ESTEIO_DE_TRAVES]) for (const u of us) lista.push([u * m.a, v * m.b])
  return lista
}

/** O caminho de lajes por baixo, ao comprido, com as juntas desencontradas. */
function caminho(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const k = m.k
  const meia = CAMINHO * m.b
  const laje = LAJE * k
  const fileiras = Math.max(1, Math.round((2 * meia) / laje))
  const alto = (2 * meia) / fileiras
  for (let f = 0; f < fileiras; f += 1) {
    const v0 = -meia + f * alto
    const desloc = f % 2 === 0 ? 0 : laje / 2
    for (let u = -m.a * 0.98 - desloc; u < m.a * 0.98; u += laje) {
      const u0 = Math.max(-m.a * 0.98, u)
      const u1 = Math.min(m.a * 0.98, u + laje)
      if (u1 - u0 < laje * 0.3) continue
      const [x0, y0] = noObjeto(m, u0 + JUNTA * k / 2, v0 + JUNTA * k / 2)
      const [x1, y1] = noObjeto(m, u1 - JUNTA * k / 2, v0 + alto - JUNTA * k / 2)
      const i = Math.round(u / laje) + f * 31
      palco.plano(caixa(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), 1.6 * k), 0.4, c.m.pedra, { tabua: 0, bisel: 1 * k, contorno: 0.26, tom: 0.78 + hash(i, f, 501) * 0.14, semente: 500 + i }, { adiante: NO_CHAO })
    }
  }
}

/** As ripas: a forma de cada uma no chão (u0, u1 ao comprido), para o bloco e para a sombra. */
function ripas(m: Medidas): [number, number][] {
  const n = Math.max(2, Math.round((2 * m.a * VIGA_ATE) / (PASSO_DAS_RIPAS * m.k)))
  const lista: [number, number][] = []
  for (let i = 0; i < n; i += 1) {
    const u = -m.a * VIGA_ATE + ((i + 0.5) * 2 * m.a * VIGA_ATE) / n
    lista.push([u - (LARGURA_DA_RIPA * m.k) / 2, u + (LARGURA_DA_RIPA * m.k) / 2])
  }
  return lista
}

/** A sombra das ripas e da folhagem no chão, caída para baixo à direita na tela (a luz não gira com o objeto). */
function sombraNoChao(palco: Palco, m: Medidas, lobulos: readonly (readonly [number, number, number])[]): void {
  const z = m.zv
  const [sx, sy] = [SOMBRA_X * z, SOMBRA_Y * z]
  const ate = RIPA_ATE * m.b
  const opcoes: OpcoesDaVista = { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_SOMBRA, suave: 1.2 }
  const por = (forma: Forma): void => {
    const caida = deslocada(forma, sx, sy)
    palco.deCima(caida, SOMBRA, opcoes, 0.5)
    palco.deFrente(caida, SOMBRA, opcoes, NO_CHAO + 1)
  }
  for (const [u0, u1] of ripas(m)) {
    const [ax, ay] = palco.noChao(...noObjeto(m, u0, -ate))
    const [bx, by] = palco.noChao(...noObjeto(m, u1, ate))
    por(caixa(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)))
  }
  for (const v of [-ESTEIO_DE_TRAVES, ESTEIO_DE_TRAVES]) {
    const [ax, ay] = palco.noChao(...noObjeto(m, -m.a * VIGA_ATE, v * m.b - GROSSURA_DA_VIGA * m.k / 2))
    const [bx, by] = palco.noChao(...noObjeto(m, m.a * VIGA_ATE, v * m.b + GROSSURA_DA_VIGA * m.k / 2))
    por(caixa(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)))
  }
  for (const [x, y, r] of lobulos) por(elipse(x, y, r * 0.9, r * 0.9))
}

/** A estrutura: os esteios, as vigas e as ripas. */
function estrutura(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const k = m.k
  const mad = c.m.madeira
  const lado = (LADO_DO_ESTEIO * k) / 2
  esteios(m).forEach(([u, v], i) => {
    blocoUV(palco, m, u - lado, v - lado, u + lado, v + lado, 0, m.zv - ALTURA_DA_VIGA * k, mad, { tabua: 0, bisel: 0.6, contorno: 0.3, eixo: QUARTO, semente: 10 + i })
    const [x, y] = noObjeto(m, u, v)
    palco.contato(caixa(x - lado * 1.3, y - lado * 1.3, x + lado * 1.3, y + lado * 1.3, 0.6), 0.32)
  })
  const g = (GROSSURA_DA_VIGA * k) / 2
  for (const v of [-ESTEIO_DE_TRAVES, ESTEIO_DE_TRAVES]) {
    blocoUV(palco, m, -m.a * VIGA_ATE, v * m.b - g, m.a * VIGA_ATE, v * m.b + g, m.zv - ALTURA_DA_VIGA * k, m.zv, mad, { tabua: 0, bisel: 0.6, contorno: 0.3, semente: 20 + v })
  }
  const ate = RIPA_ATE * m.b
  ripas(m).forEach(([u0, u1], i) => {
    blocoUV(palco, m, u0, -ate, u1, ate, m.zv, m.zv + ALTURA_DA_RIPA * k, mad, { tabua: 0, bisel: 0.5, contorno: 0.3, eixo: QUARTO, tom: 1.02, semente: 30 + i }, RIPAS_ADIANTE)
  })
}

/** A rama que sobe por um esteio: as folhinhas em zigue-zague pelo esteio, de pé na 3/4 e em volta do pé de cima. */
function rama(palco: Palco, m: Medidas, u: number, v: number, semente: number): void {
  const k = m.k
  const [x, y] = noObjeto(m, u, v)
  const [gx, gy] = palco.noChao(x, y)
  const r = FOLHA_DA_RAMA * k
  const passos = Math.round(m.zv / (r * 1.6))
  for (let i = 0; i < passos; i += 1) {
    const z = (i + 0.5) * (m.zv / passos)
    const lado = (i % 2 === 0 ? 1 : -1) * (1.6 + hash(i, semente, 7) * 1.2) * k
    const tom = 0.8 + hash(i, semente, 9) * 0.3
    palco.deFrente(elipse(gx + lado, gy - z + LADO_DO_ESTEIO * k * 0.5, r, r * 0.85), FOLHA, { bisel: 0.4, contorno: 0.22, tom }, gy + m.zv / 2 + LADO_DO_ESTEIO * k + 1 + i * 0.01)
  }
  for (let i = 0; i < 4; i += 1) {
    const a = i * 1.7 + semente
    palco.deCima(elipse(x + Math.cos(a) * 3.4 * k, y + Math.sin(a) * 3.4 * k, r, r * 0.85), FOLHA, { bisel: 0.4, contorno: 0.22, tom: 0.85 + i * 0.06 }, 1 + i * 0.01)
  }
}

/** Muitos círculos numa forma só (a massa da folhagem): a distância é a do círculo mais perto. */
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

/** A folhagem por cima das ripas (a receita da sebe) e os cachos de flor; na 3/4, os cachos pendentes da viga da frente. */
function glicinia(palco: Palco, m: Medidas, lobulos: readonly (readonly [number, number, number])[]): void {
  const k = m.k
  const z = m.zv + ALTURA_DA_RIPA * k + 0.6
  const massa = circulos(lobulos)
  const fundo = z + FOLHAGEM_ADIANTE
  const porCima = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaVista, i: number): void => {
    palco.deCima(forma, mat, o, z + i * 0.01)
    palco.deFrente(deslocada(forma, 0, -z), mat, o, fundo + i * 0.01)
  }
  porCima(massa, FOLHA, { bisel: 0, contorno: 0.24, tom: 0.8, semente: 40 }, 0)
  lobulos.forEach(([x, y, r], i) => {
    porCima(dentroDe(elipse(x - COPA.puxa * r, y - COPA.puxa * r * 1.1, r * COPA.raio, r * COPA.raio), massa), FOLHA, { bisel: 0, contorno: 0, semente: 50 + i }, 1 + i)
  })
  lobulos.forEach(([x, y, r], i) => {
    if (hash(i, 3, 611) >= REALCE.quantos) return
    porCima(dentroDe(elipse(x - REALCE.x * r, y - REALCE.y * r, r * REALCE.raio, r * REALCE.raio), massa), FOLHA, { bisel: 0, contorno: 0, tom: REALCE.tom, semente: 70 + i }, 20 + i)
  })
  // Os cachos vistos de cima: pinguinhos lilás na folhagem.
  lobulos.forEach(([x, y, r], i) => {
    for (let j = 0; j < FLORES_POR_LOBULO; j += 1) {
      const a = hash(i, j, 621) * 2 * Math.PI
      const d = r * (0.25 + hash(j, i, 622) * 0.5)
      const cor = j % 2 === 0 ? LILAS : LILAS_CLARO
      porCima(elipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.6 * k, 1.6 * k), cor, { bisel: 0.6 * k, contorno: 0.22 }, 40 + i * 3 + j)
    }
  })
}

/** Os cachos pendentes da viga que fica na frente na tela: gotas compridas lilás, as de baixo mais claras. */
function pendentes(palco: Palco, m: Medidas): void {
  const k = m.k
  // A viga da frente na tela: a de v positivo sem giro; girada, a que o giro leva para baixo (de lado, nenhuma).
  const [fx, fy] = palco.noChao(...noObjeto(m, 0, 1))
  if (Math.abs(fx) > Math.abs(fy)) return
  const v = (fy > 0 ? 1 : -1) * ESTEIO_DE_TRAVES * m.b + (fy > 0 ? 1 : -1) * (GROSSURA_DA_VIGA * k) / 2
  const z = m.zv - ALTURA_DA_VIGA * k
  PENDENTES.forEach(([u, comprimento], i) => {
    const [x, y] = noObjeto(m, u * m.a, v)
    const [gx, gy] = palco.noChao(x, y)
    const topo = gy - z
    const l = comprimento * k
    const fundo = gy + z + RIPAS_ADIANTE + FOLHAGEM_ADIANTE + 1 + i * 0.01
    palco.deFrente(capsula(gx, topo, gx + 0.4 * k, topo + l * 0.55, 2.1 * k), LILAS, { bisel: 0.9 * k, contorno: 0.24, tom: 0.92 }, fundo)
    palco.deFrente(capsula(gx + 0.4 * k, topo + l * 0.45, gx, topo + l, 1.3 * k), LILAS_CLARO, { bisel: 0.6 * k, contorno: 0.22 }, fundo + 0.001)
    palco.deFrente(elipse(gx - 1.6 * k, topo + 1.2 * k, 2.2 * k, 1.5 * k), FOLHA, { bisel: 0.4, contorno: 0.22, tom: 0.95 }, fundo + 0.002)
  })
}

export const montarPergolaComTrepadeira: MontarMovel = (c, cena) => {
  const deitado = c.hw >= c.hh
  const a = deitado ? c.hw : c.hh
  const b = deitado ? c.hh : c.hw
  const k = b / LADO_DE_PARTIDA
  const g = G * k
  const m: Medidas = { k, g, deitado, a, b, zv: ALTURA_DAS_VIGAS * g }
  const palco = novoPalco(c.peca, cena, c.giro)
  cena.corDoPiso = PISO_DA_FOLHA
  // Os lóbulos da folhagem na tela (girados): a mesma folhagem serve às duas vistas (a de cima é sem giro).
  const lobulos = LOBULOS.map(([u, v, r]): readonly [number, number, number] => {
    const [gx, gy] = palco.noChao(...noObjeto(m, u * a, v * b))
    return [gx, gy, r * k]
  })
  const pontos: P3[] = []
  for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const [x, y] = noObjeto(m, u * a * VIGA_ATE, v * b * RIPA_ATE)
    pontos.push([x, y, m.zv], [x, y, 0])
  }
  palco.sombra(pontos, 0.12, 3)
  caminho(palco, c, m)
  sombraNoChao(palco, m, lobulos)
  estrutura(palco, c, m)
  ESTEIOS_COM_RAMA.forEach((i, j) => {
    const [u, v] = esteios(m)[i]
    rama(palco, m, u, v, 80 + j * 13)
  })
  glicinia(palco, m, lobulos)
  pendentes(palco, m)
  palco.fechar()
}

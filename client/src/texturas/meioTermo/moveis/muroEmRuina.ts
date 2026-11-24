/**
 * MURO EM RUÍNA (lote L07 "Selva: ruína e água", 24/11/2026; versão original do `muroBaixoDePedra`, só a ideia do
 * objeto). Um trecho do alicerce de uma casa caída na mata, em L: o braço de cima e o da esquerda (no giro 0), de
 * blocos de cantaria em fiadas desencontradas, mais alto no canto (três fiadas) e baixando para as pontas, com FALHAS
 * onde a parede ruiu até o alicerce. O ALICERCE (a fiada de baixo, um pouco mais larga) corre inteiro até a beira da
 * pegada: quatro trechos girados fecham a planta de uma casa sem degrau entre eles. Dentro do L ficam os BLOCOS
 * CAÍDOS, deitados tortos e meio enterrados, e lascas; o musgo verde-escuro pega o alto das fiadas baixas, o pé do
 * muro e os blocos do chão (o alto do canto, mais seco, fica quase limpo).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`), como a coluna quebrada: cada bloco é um prisma em
 * fatias, e a 3/4 mostra a face de cada um com a junta embaixo, a quina de cima acesa e o musgo que sobe do pé, nos
 * quatro giros. Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `pedra` (sugestão: arenito).
 *
 * Este arquivo guarda também o APOIO DO LOTE L07 (o musgo, o prisma de pedra em fatias, a sombra dele e o retângulo
 * girado), que a coluna com glifos, a estela, o pedestal, a cabana de lajes, as pontes, a calçada e o tanque importam.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, poligono, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Sombra, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, rumoDaSombra, type Fatiador } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'

// ---------- o apoio do lote L07 ----------

/** O musgo do lote: verde-escuro contido (saturação HSL ~0,22), o mesmo nas ruínas, na coluna, na estela e na cabana. */
export const TOM_DO_MUSGO: Rgb = [0x55, 0x5e, 0x3f]
export const MUSGO: MaterialDaPeca = { classe: 'folha', rgb: TOM_DO_MUSGO }

/**
 * Quanto o grão da pedra anda por px de altura: cada fatia lê outra linha da textura. Sem isso a frente da 3/4
 * repetia a mesma linha em todas as fatias e saía riscada de pé; com o passo da coluna quebrada (2,3) os estratos do
 * arenito viravam uma faixa por fatia e o bloco parecia uma pilha de papel. Com 0,9 os estratos ficam largos.
 */
export const GRAO_POR_ALTURA = 0.9
/** O passo das fatias (px do protótipo): a faixa de cada uma na 3/4. */
export const PASSO_DAS_FATIAS = 0.8

export function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** Leva a cor da amostra para `cor` (0 a 1). */
export function misturarCor(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/**
 * O musgo contido: o corte sobe `CORTE_DO_MUSGO` acima do `limiar` de cada desenho (menos mancha) e a beira da
 * mancha passa da pedra ao musgo em `RAMPA_DO_MUSGO` (macia; com 0,1 as manchas saíam recortadas, de camuflagem).
 */
const CORTE_DO_MUSGO = 0.12
const RAMPA_DO_MUSGO = 0.2
/** O máximo que o musgo cobre a cor da pedra: a pedra ainda aparece por baixo. */
const COBERTURA_DO_MUSGO = 0.74

/** A mancha de musgo no ponto (0 a 1): duas escalas de ruído cortadas no `limiar` (maior = menos musgo). */
export function manchaDeMusgo(x: number, y: number, semente: number, limiar: number): number {
  const n = ruido(x * 0.12 + semente * 7.31, y * 0.12 + semente * 3.17) + 0.5 * ruido(x * 0.41 + 17.3, y * 0.41 + semente * 1.9)
  return limitar((n - limiar - CORTE_DO_MUSGO) / RAMPA_DO_MUSGO, 0, 1)
}

/** Põe o musgo na amostra: a cor dele e um grão fofo, um nada mais escuro que a pedra em volta. */
export function musgar(s: Float32Array, t: number, x: number, y: number): void {
  if (t <= 0) return
  misturarCor(s, TOM_DO_MUSGO, COBERTURA_DO_MUSGO * t)
  s[3] += (ruido(x * 0.95 + 5.1, y * 0.95 + 2.7) * 0.12 - 0.03) * t
}

/** Os quatro cantos do retângulo de meios lados (a, b) em volta de (cx, cy), girado `angulo` radianos. */
export function retanguloGirado(cx: number, cy: number, a: number, b: number, angulo: number): Ponto[] {
  const c = Math.cos(angulo)
  const s = Math.sin(angulo)
  const cantos: readonly Ponto[] = [[-a, -b], [a, -b], [a, b], [-a, b]]
  return cantos.map(([u, v]): Ponto => [cx + u * c - v * s, cy + u * s + v * c])
}

/** O polígono com o canto `canto` lascado: o canto vira dois pontos, `tamanho` px para dentro de cada lado. */
export function lascar(pontos: readonly Ponto[], canto: number, tamanho: number): Ponto[] {
  const n = pontos.length
  const saida: Ponto[] = []
  pontos.forEach((p, i) => {
    if (i !== canto) {
      saida.push(p)
      return
    }
    for (const viz of [pontos[(i + n - 1) % n], pontos[(i + 1) % n]]) {
      const l = Math.hypot(viz[0] - p[0], viz[1] - p[1]) || 1
      const t = Math.min(0.42, tamanho / l)
      saida.push([p[0] + (viz[0] - p[0]) * t, p[1] + (viz[1] - p[1]) * t])
    }
  })
  return saida
}

/** A normal (para fora) do lado mais perto, escrita aqui pela função de `normaisDoPoligono`: sem alocar por pixel. */
export const NORMAL = new Float64Array(2)

/** A função que acha o lado do polígono mais perto do ponto e escreve a normal dele em `NORMAL`. */
export function normaisDoPoligono(pontos: readonly Ponto[]): (x: number, y: number) => void {
  const n = pontos.length
  let area = 0
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = pontos[i]
    const [bx, by] = pontos[(i + 1) % n]
    area += ax * by - bx * ay
  }
  const sinal = area >= 0 ? 1 : -1
  const lados = pontos.map(([ax, ay], i) => {
    const [bx, by] = pontos[(i + 1) % n]
    const dx = bx - ax
    const dy = by - ay
    const l = Math.hypot(dx, dy) || 1
    return { ax, ay, dx, dy, l2: l * l, nx: (sinal * dy) / l, ny: (-sinal * dx) / l }
  })
  return (x, y) => {
    let menor = Infinity
    for (const lado of lados) {
      let h = ((x - lado.ax) * lado.dx + (y - lado.ay) * lado.dy) / lado.l2
      h = h < 0 ? 0 : h > 1 ? 1 : h
      const qx = x - lado.ax - lado.dx * h
      const qy = y - lado.ay - lado.dy * h
      const d = qx * qx + qy * qy
      if (d < menor) {
        menor = d
        NORMAL[0] = lado.nx
        NORMAL[1] = lado.ny
      }
    }
  }
}

export interface OpcoesDoBloco {
  readonly semente: number
  /** O tom do alto; as faces saem um nada mais escuras. */
  readonly tom?: number
  readonly bisel?: number
  readonly contorno?: number
  readonly passo?: number
  /** A junta escura no pé da face, em px (o bloco assentado noutro, ou o pé no chão). Padrão 0,9. */
  readonly junta?: number
  /** Luz a mais nas faces (o entalhe, a porta, as juntas): o ponto, a altura e a normal da face no objeto. */
  readonly face?: (x: number, y: number, z: number, nx: number, ny: number) => number
  /** Luz a mais no alto (as juntas das lajes, o entalhe de cima). */
  readonly topo?: (x: number, y: number) => number
  /** O musgo (0 a 1) no ponto e na altura. */
  readonly musgo?: (x: number, y: number, z: number) => number
  /** Mexe na cor da amostra da face depois da luz (o vão escuro da porta da cabana). */
  readonly corDaFace?: (s: Float32Array, x: number, y: number, z: number, nx: number, ny: number) => void
}

/**
 * Um PRISMA DE PEDRA na pilha de fatias, do chão `z0` ao alto `z1` (px), com a planta `pontos`: as fatias de dentro
 * levam a luz da face mais perto (pela tela, `luzDaNormal`), a junta no pé e a quina de cima acesa; a de cima leva o
 * chanfro, o contorno e a textura do alto. Prisma empilhado noutro (`z0` > 0) não repete a fatia de baixo.
 */
export function blocoEmFatias(f: Fatiador, camada: number, pontos: readonly Ponto[], z0: number, z1: number, pedra: MaterialDaPeca, o: OpcoesDoBloco): void {
  const forma = poligono(pontos)
  const daPedra = texturaDaClasse(pedra.classe)
  const normal = normaisDoPoligono(pontos)
  const tom = o.tom ?? 1
  const junta = o.junta ?? 0.9
  const lista = alturas(z0, z1, o.passo ?? PASSO_DAS_FATIAS)
  if (z0 > 0) lista.shift()
  for (const z of lista) {
    if (z >= z1 - 1e-6) {
      const doAlto: Textura = (u, v, x, y, p, s, escala) => {
        if (daPedra !== null) daPedra(u, v, x, y, p, s, escala)
        if (o.topo !== undefined) s[3] += o.topo(x, y)
        if (o.musgo !== undefined) musgar(s, o.musgo(x, y, z), x, y)
      }
      f.fatia(camada, z, forma, pedra, { tabua: 0, bisel: o.bisel ?? 1.2, tom, contorno: o.contorno ?? 0.26, textura: doAlto, semente: o.semente })
      continue
    }
    const daFace: Textura = (u, v, x, y, p, s, escala) => {
      if (daPedra !== null) daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, p, s, escala)
      normal(x, y)
      const nx = NORMAL[0]
      const ny = NORMAL[1]
      let luz = luzDaNormal(nx, ny, 0, f.q)
      if (z - z0 < junta) luz -= 0.2
      else if (z1 - z < 1.3) luz += 0.05
      if (o.face !== undefined) luz += o.face(x, y, z, nx, ny)
      s[3] += luz
      if (o.musgo !== undefined) musgar(s, o.musgo(x, y, z), x, y)
      if (o.corDaFace !== undefined) o.corDaFace(s, x, y, z, nx, ny)
    }
    f.fatia(camada, z, forma, pedra, lisa(tom * 0.94, daFace, o.semente + 1))
  }
}

/** O contorno convexo dos pontos (a cadeia monótona), na ordem da volta. */
function envoltoria(pontos: readonly Ponto[]): Ponto[] {
  const ordem = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const vira = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const metade = (lista: readonly Ponto[]): Ponto[] => {
    const h: Ponto[] = []
    for (const p of lista) {
      while (h.length >= 2 && vira(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop()
      h.push(p)
    }
    h.pop()
    return h
  }
  return [...metade(ordem), ...metade([...ordem].reverse())]
}

/** A sombra no chão de um prisma de planta convexa e altura `z`: a planta varrida até onde a sombra do alto cai. */
export function sombraDoPrisma(pontos: readonly Ponto[], z: number, q: number, forca: number, suave: number): Sombra {
  const [rx, ry] = rumoDaSombra(q)
  const todos: Ponto[] = [...pontos, ...pontos.map(([x, y]): Ponto => [x + rx * z, y + ry * z])]
  return { forma: poligono(envoltoria(todos)), z: 0, forca, suave }
}

// ---------- o muro ----------

/** A espessura do muro, a altura de uma fiada e a do alicerce (casas). */
const ESPESSURA = 0.3
const FIADA = 0.125
const ALICERCE = 0.06
/** Quanto o alicerce passa do muro de cada lado, a margem da pegada e a meia folga entre dois blocos (px). */
const SOBRA_DO_ALICERCE = 1.8
const MARGEM = 2.2
const FOLGA = 0.5
/** O comprimento de um bloco (casas): de partida e quanto varia; o de uma laje do alicerce. */
const BLOCO = 0.3
const BLOCO_QUE_VARIA = 0.2
const LAJE_DO_ALICERCE = 0.55
const FIADAS = 3

/** As fiadas que sobraram ao longo de um braço, do canto para a ponta: [até onde (0 a 1), quantas]. */
type Perfil = readonly (readonly [number, number])[]
const PERFIL_DE_CIMA: Perfil = [[0.3, 3], [0.5, 2], [0.64, 0], [0.84, 1], [1, 0]]
const PERFIL_DA_ESQUERDA: Perfil = [[0.2, 3], [0.4, 2], [0.58, 1], [0.76, 0], [1, 1]]

function fiadasEm(perfil: Perfil, t: number): number {
  for (const [ate, n] of perfil) if (t <= ate) return n
  return 0
}

/** Um braço do L: ao longo, do canto (`de`) para a ponta (`ate`); de través, a faixa do muro (`v0` a `v1`). */
interface Braco {
  readonly de: number
  readonly ate: number
  /** Onde começa o alicerce deste braço (o de cima cobre o canto). */
  readonly alicerceDe: number
  readonly v0: number
  readonly v1: number
  readonly deitado: boolean
  readonly perfil: Perfil
  readonly sal: number
}

function noBraco(b: Braco, u: number, v: number): Ponto {
  return b.deitado ? [u, v] : [v, u]
}

function retanguloDoBraco(b: Braco, u0: number, v0: number, u1: number, v1: number): Ponto[] {
  const [ax, ay] = noBraco(b, u0, v0)
  const [bx, by] = noBraco(b, u1, v1)
  return [[ax, ay], [bx, ay], [bx, by], [ax, by]]
}

type Musgo = (x: number, y: number, z: number) => number

/** As fiadas de blocos de um braço: desencontradas, cada uma até onde o perfil deixa, o alto torto e lascado. */
function montarFiadas(f: Fatiador, b: Braco, pedra: MaterialDaPeca, g: number, musgo: Musgo): void {
  const zA = g * ALICERCE
  const hc = g * FIADA
  for (let k = 0; k < FIADAS; k += 1) {
    let u = b.de - (k % 2 === 1 ? g * BLOCO * 0.55 : 0)
    for (let i = 0; u < b.ate - 1e-6; i += 1) {
      const sorte = (j: number): number => hash(i * 7 + k, j, b.sal)
      const comprimento = g * (BLOCO + BLOCO_QUE_VARIA * sorte(1))
      const u0 = Math.max(b.de, u)
      const u1 = Math.min(b.ate, u + comprimento)
      u += comprimento
      if (u1 - u0 < 4) continue
      const n = fiadasEm(b.perfil, ((u0 + u1) / 2 - b.de) / (b.ate - b.de))
      if (n <= k) continue
      // Um ou outro bloco do alto já caiu: a falha não fica só onde o perfil manda.
      if (k > 0 && k === n - 1 && sorte(2) < 0.18) continue
      const doAlto = k === n - 1
      const [cx, cy] = noBraco(b, (u0 + u1) / 2, (b.v0 + b.v1) / 2 + (sorte(3) - 0.5) * 1.1 * k)
      const hu = (u1 - u0) / 2 - FOLGA
      const hv = (b.v1 - b.v0) / 2 - (doAlto ? 0.4 : 0)
      let pontos = retanguloGirado(cx, cy, b.deitado ? hu : hv, b.deitado ? hv : hu, (sorte(4) - 0.5) * 0.05 * k)
      if (doAlto && sorte(5) < 0.45) pontos = lascar(pontos, Math.floor(sorte(6) * 4), 2.2 + 1.6 * sorte(7))
      const z0 = zA + k * hc
      blocoEmFatias(f, 0, pontos, z0, z0 + hc, pedra, { semente: b.sal + k * 100 + i * 2, tom: 0.92 + 0.14 * sorte(8), musgo })
    }
  }
}

/** O alicerce de um braço: lajes compridas, mais largas que o muro, até a beira da pegada (emenda no trecho vizinho). */
function montarAlicerce(f: Fatiador, b: Braco, pedra: MaterialDaPeca, g: number, musgo: Musgo): void {
  const zA = g * ALICERCE
  const n = Math.max(1, Math.round((b.ate - b.alicerceDe) / (g * LAJE_DO_ALICERCE)))
  const passo = (b.ate - b.alicerceDe) / n
  for (let j = 0; j < n; j += 1) {
    const u0 = b.alicerceDe + j * passo + (j > 0 ? FOLGA : 0)
    const u1 = b.alicerceDe + (j + 1) * passo - (j < n - 1 ? FOLGA : 0)
    const pontos = retanguloDoBraco(b, u0, b.v0 - SOBRA_DO_ALICERCE, u1, b.v1 + SOBRA_DO_ALICERCE)
    blocoEmFatias(f, 0, pontos, 0, zA, pedra, { semente: b.sal + 900 + j * 2, tom: 0.84 + 0.1 * hash(j, 1, b.sal + 1), bisel: 0.9, musgo })
  }
}

/** Os blocos caídos: [braço (0 = de cima), onde ao longo (0 a 1), afastado da face de dentro, meio comprido e meio largo, giro, altura (casas)]. */
const CAIDOS: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [0, 0.57, 0.2, 0.15, 0.11, 0.42, 0.12],
  [0, 0.93, 0.15, 0.12, 0.09, -0.55, 0.1],
  [1, 0.68, 0.19, 0.14, 0.1, 1.05, 0.11],
  [1, 0.3, 0.44, 0.1, 0.08, -0.3, 0.085],
  [0, 0.26, 0.5, 0.09, 0.075, 0.2, 0.075],
]
/** As lascas soltas: [braço, onde ao longo, afastado (casas), raio (casas)]. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [0, 0.5, 0.07, 0.04],
  [0, 0.72, 0.36, 0.03],
  [1, 0.55, 0.07, 0.035],
  [1, 0.86, 0.3, 0.03],
  [0, 0.37, 0.1, 0.028],
  [1, 0.12, 0.3, 0.026],
]

export const montarMuroEmRuina: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DA_PEDRA
  const T = g * ESPESSURA
  const S = SOBRA_DO_ALICERCE
  const bracos: readonly Braco[] = [
    { de: -hw + MARGEM, ate: hw, alicerceDe: -hw + MARGEM - S, v0: -hh + MARGEM, v1: -hh + MARGEM + T, deitado: true, perfil: PERFIL_DE_CIMA, sal: 6100 },
    { de: -hh + MARGEM + T, ate: hh, alicerceDe: -hh + MARGEM + T + S, v0: -hw + MARGEM, v1: -hw + MARGEM + T, deitado: false, perfil: PERFIL_DA_ESQUERDA, sal: 6400 },
  ]
  // O musgo: sobe do pé (até ~4 px) e mancha o alto das fiadas, mais nas baixas (o alto do canto seca ao sol).
  const musgo: Musgo = (x, y, z) => {
    const pe = z < 4.5 ? (1 - z / 4.5) * manchaDeMusgo(x * 1.3, y * 1.3 + z, 11, -0.12) : 0
    const mancha = manchaDeMusgo(x + z * 0.7, y + z * 1.9, 3, 0.08 + z * 0.007)
    return pe > mancha ? pe : mancha
  }
  for (const b of bracos) {
    montarAlicerce(f, b, pedra, g, musgo)
    montarFiadas(f, b, pedra, g, musgo)
  }

  // Os blocos caídos dentro do L, tortos e meio enterrados (baixos para o tamanho), e as lascas.
  const naFrente = (braco: number, t: number, afastado: number): Ponto => {
    const b = bracos[braco]
    return noBraco(b, b.de + t * (b.ate - b.de), b.v1 + S + afastado * g)
  }
  CAIDOS.forEach(([braco, t, afastado, a, bb, giro, alto], i) => {
    const [cx, cy] = naFrente(braco, t, afastado)
    let pontos = retanguloGirado(cx, cy, a * g, bb * g, giro)
    if (i % 2 === 0) pontos = lascar(pontos, (i + 1) % 4, 2.6)
    blocoEmFatias(f, 0, pontos, 0, alto * g, pedra, { semente: 6700 + i * 2, tom: 0.9 + 0.12 * hash(i, 2, 6701), musgo: (x, y, z) => Math.max(musgo(x, y, z), manchaDeMusgo(x, y, 13, 0.02)) })
    cena.sombras.push(sombraDoPrisma(pontos, alto * g, q, 0.26, 1.3), contato(poligono(pontos), 0.32))
  })
  LASCAS.forEach(([braco, t, afastado, r], i) => {
    const [cx, cy] = naFrente(braco, t, afastado)
    const pontos: Ponto[] = []
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * 2 * Math.PI + i * 0.7
      const rr = r * g * (0.7 + 0.5 * hash(i, k, 6800))
      pontos.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85])
    }
    blocoEmFatias(f, 0, pontos, 0, g * 0.035, pedra, { semente: 6810 + i * 2, tom: 0.98, bisel: 0.6, contorno: 0.22, junta: 0 })
    cena.sombras.push(contato(poligono(pontos), 0.3))
  })
  f.fechar()

  // As sombras no chão: cada pedaço do braço na altura que sobrou dele, o alicerce inteiro e o contato.
  const zA = g * ALICERCE
  for (const b of bracos) {
    let antes = 0
    for (const [ate, n] of b.perfil) {
      if (n > 0) {
        const [x0, y0] = noBraco(b, b.de + antes * (b.ate - b.de), b.v0)
        const [x1, y1] = noBraco(b, b.de + ate * (b.ate - b.de), b.v1)
        cena.sombras.push(sombraVarrida(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), zA + n * g * FIADA, q, 0.26, 1.6))
      }
      antes = ate
    }
    const [ax, ay] = noBraco(b, b.alicerceDe, b.v0 - S)
    const [bx, by] = noBraco(b, b.ate, b.v1 + S)
    const [x0, y0, x1, y1] = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]
    cena.sombras.push(sombraVarrida(x0, y0, x1, y1, zA, q, 0.22, 1.2), contato(caixa(x0, y0, x1, y1, 1), 0.3))
  }
}

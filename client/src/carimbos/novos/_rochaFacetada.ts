import { css, misturar, type Rgb } from '../embutidos'

/**
 * O BLOCO FACETADO das rochas do lote C6 dos carimbos de 14/11/2026, dividido
 * pelo rochedo com musgo (`rochedoComMusgo.ts`), pela rocha vulcânica
 * (`rochaVulcanica.ts`) e pelo calombo de onde nascem os cristais
 * (`cristais.ts`). Não exporta `carimbo`: é o ajudante deles.
 *
 * A rocha é um sólido de anéis empilhados (o pé no chão, um ou dois anéis no
 * meio, o topo), cada anel com os mesmos `lados` vértices, como a pedra da
 * serra de `embutidos.ts` (`desenharPedra`) com mais um andar: o anel do meio
 * mais largo que o pé faz o bojo do matacão. Cada face toma o tom pela
 * direção para onde olha em 3D (a luz de cima à esquerda e do alto, a mesma
 * das pedras); só as faces que olham para quem vê são pintadas, de trás para
 * a frente. O giro gira os vértices em volta do eixo: a luz não gira.
 */

export type Ponto = readonly [number, number]
type V3 = readonly [number, number, number]

export interface TonsDaRocha {
  readonly escura: Rgb
  readonly meia: Rgb
  readonly clara: Rgb
}

export interface FormaDaRocha {
  /** O meio do pé no quadro (onde a rocha toca o chão). */
  readonly cx: number
  readonly cy: number
  /** O raio do pé no chão, em unidades. */
  readonly raio: number
  readonly altura: number
  readonly lados: number
  /** Os anéis, de baixo para cima: [altura de 0 a 1, raio relativo]. O último é o topo. */
  readonly aneis: ReadonlyArray<readonly [number, number]>
  /** Quanto o topo recua para trás e para a esquerda, em fração do raio. */
  readonly recuo: number
  /** Quanto o raio de cada vértice varia (0 = regular). */
  readonly aspereza: number
  /** Quanto a altura de cada vértice do topo varia (0 = topo chato). */
  readonly picos: number
  readonly giro: number
  readonly semente: number
}

export interface FaceDaRocha {
  /** Os cantos na tela. Na face de lado: o de baixo k, o de baixo k+1, o de cima k+1, o de cima k. */
  readonly pontos: readonly Ponto[]
  /** O quanto a face olha para a luz (-1 a 1). */
  readonly luz: number
  /** O quanto a face olha para quem vê (0 a 1). */
  readonly frente: number
  readonly tipo: 'lado' | 'topo'
  /** O quanto a face está perto de quem vê (para pintar de trás para a frente). */
  readonly fundo: number
}

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function normalizar(v: V3): V3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / n, v[1] / n, v[2] / n]
}

function escalar(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Luz em 3D (x à direita, y para a frente no chão, z para cima): de cima à esquerda e do alto. */
const LUZ_3D = normalizar([-0.5, -0.55, 0.67])
/** A direção de quem vê: o ponto que anda nela não sai do lugar na tela (y x 0,55 - z). */
const OLHO = normalizar([0, 1, ACHATA])

/** A normal de um polígono pelo método de Newell (vale para quadrilátero torto). */
function normalDe(p: readonly V3[]): V3 {
  let x = 0
  let y = 0
  let z = 0
  p.forEach((a, i) => {
    const b = p[(i + 1) % p.length]
    x += (a[1] - b[1]) * (a[2] + b[2])
    y += (a[2] - b[2]) * (a[0] + b[0])
    z += (a[0] - b[0]) * (a[1] + b[1])
  })
  return normalizar([x, y, z])
}

function media(p: readonly V3[]): V3 {
  const s = p.reduce<[number, number, number]>((m, v) => [m[0] + v[0], m[1] + v[1], m[2] + v[2]], [0, 0, 0])
  return [s[0] / p.length, s[1] / p.length, s[2] / p.length]
}

/** As faces visíveis da rocha, já na tela e na ordem de pintar (de trás para a frente). */
export function facesDaRocha(f: FormaDaRocha): FaceDaRocha[] {
  const n = f.lados
  const ultimo = f.aneis.length - 1
  const angulos = Array.from({ length: n }, (_, k) => f.giro + (k * Math.PI * 2) / n + (sorteio(f.semente, 10 + k) - 0.5) * (Math.PI / n) * 0.8)
  const aneis: V3[][] = f.aneis.map(([h, r], i) => {
    const recua = f.recuo * f.raio * h
    return angulos.map((a, k): V3 => {
      const raio = f.raio * r * (1 + f.aspereza * (sorteio(f.semente, 20 + i * 13 + k) - 0.5))
      const z = f.altura * h * (i === ultimo ? 1 + f.picos * (sorteio(f.semente, 60 + k) - 0.5) : 1)
      return [Math.cos(a) * raio - recua, Math.sin(a) * raio - recua, z]
    })
  })
  const naTela = (v: V3): Ponto => [f.cx + v[0], f.cy + v[1] * ACHATA - v[2]]
  const faces: FaceDaRocha[] = []
  const juntar = (cantos: readonly V3[], tipo: 'lado' | 'topo', normal: V3): void => {
    const frente = escalar(normal, OLHO)
    if (frente <= 0.02) return
    const luz = escalar(normal, LUZ_3D) + (tipo === 'topo' ? 0.1 : 0)
    faces.push({ pontos: cantos.map(naTela), luz, frente, tipo, fundo: escalar(media(cantos), OLHO) })
  }
  for (let i = 0; i < ultimo; i++) {
    for (let k = 0; k < n; k++) {
      const cantos = [aneis[i][k], aneis[i][(k + 1) % n], aneis[i + 1][(k + 1) % n], aneis[i + 1][k]]
      let normal = normalDe(cantos)
      // Para fora: a normal aponta para longe do eixo (o meio dos dois anéis).
      const eixo = media([...aneis[i], ...aneis[i + 1]])
      const meio = media(cantos)
      if (normal[0] * (meio[0] - eixo[0]) + normal[1] * (meio[1] - eixo[1]) < 0) normal = [-normal[0], -normal[1], -normal[2]]
      juntar(cantos, 'lado', normal)
    }
  }
  let topo = normalDe(aneis[ultimo])
  if (topo[2] < 0) topo = [-topo[0], -topo[1], -topo[2]]
  juntar(aneis[ultimo], 'topo', topo)
  return faces.sort((a, b) => a.fundo - b.fundo)
}

/** O tom de uma face pelo quanto ela olha para a luz (a rampa das pedras da serra). */
export function tomDaRocha(tons: TonsDaRocha, luz: number): Rgb {
  const t = Math.min(1, Math.max(0, (luz - 0.1) / 0.85))
  return t > 0.5 ? misturar(tons.meia, tons.clara, (t - 0.5) * 2) : misturar(tons.escura, tons.meia, t * 2)
}

/**
 * Pinta as faces. `clareia` soma na luz de todas: a rocha de lados em pé (o
 * matacão) quase não tem face que chegue ao claro pela conta das pedras, que
 * são baixas e inclinadas; sem isso ela ficava um cinza só.
 */
export function pintarRocha(g: CanvasRenderingContext2D, faces: readonly FaceDaRocha[], tons: TonsDaRocha, clareia = 0): void {
  // Um fundo único no meio-tom: sem ele, a emenda de duas faces deixava passar o chão num fio claro.
  g.fillStyle = css(tons.meia)
  caminhoDaRocha(g, faces)
  g.fill()
  for (const face of faces) {
    g.fillStyle = css(tomDaRocha(tons, face.luz + clareia))
    g.beginPath()
    face.pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
    g.closePath()
    g.fill()
  }
}

/** O caminho da rocha inteira (todas as faces no mesmo sentido), para o recorte do que cresce por cima dela. */
export function caminhoDaRocha(g: CanvasRenderingContext2D, faces: readonly FaceDaRocha[]): void {
  g.beginPath()
  for (const face of faces) {
    const p = face.pontos
    let area = 0
    p.forEach((a, i) => {
      const b = p[(i + 1) % p.length]
      area += a[0] * b[1] - b[0] * a[1]
    })
    const ordem = area >= 0 ? p : [...p].reverse()
    ordem.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
    g.closePath()
  }
}

/** O ponto (s, t) de uma face de lado: s de um canto ao outro, t do pé (0) ao alto (1). */
export function pontoNaFace(face: FaceDaRocha, s: number, t: number): Ponto {
  const [a, b, c, d] = face.pontos
  const baixo: Ponto = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]
  const cima: Ponto = [d[0] + (c[0] - d[0]) * s, d[1] + (c[1] - d[1]) * s]
  return [baixo[0] + (cima[0] - baixo[0]) * t, baixo[1] + (cima[1] - baixo[1]) * t]
}

/** O meio de uma face na tela. */
export function meioDaFace(face: FaceDaRocha): Ponto {
  const s = face.pontos.reduce<[number, number]>((m, p) => [m[0] + p[0], m[1] + p[1]], [0, 0])
  return [s[0] / face.pontos.length, s[1] / face.pontos.length]
}

/** Todas as cores chapadas da rocha (as três da rampa). */
export function paletaDaRocha(tons: TonsDaRocha): Rgb[] {
  return [tons.escura, tons.meia, tons.clara]
}

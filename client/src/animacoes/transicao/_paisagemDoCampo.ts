import type * as Three from 'three'
import type { ThreeModule } from '../../transicoes/tipos'
import { semente } from '../../transicoes/texturas'

/*
 * O FUNDO das variações do "Campo ensolarado" (pedido de 27/10/2026): três casas
 * no fim da estrada, ou uma vila (casario, praça e feira), sem muro. Só acrescenta
 * à cena aprovada; câmera, sol, tempos e som não mudam.
 *
 * Como o resto da cena, nada aqui recebe luz do motor: a luz de contraluz (sol
 * de frente, à direita) é assada por face nas cores de vértice, e as texturas
 * só trazem o detalhe (telha, pedra, tábua) em tons de branco. A névoa da cena
 * faz a perspectiva aérea. Semente própria: o `rnd` da cena não anda.
 */

export type FundoDoCampo = 'nenhum' | 'tres-casas' | 'vila'
type ComFundo = Exclude<FundoDoCampo, 'nenhum'>

type Rgb = readonly [number, number, number]
type V3 = readonly [number, number, number]
type Uv = readonly [number, number]

interface ArvoreDoCampo {
  tronco: [number, number]
  copa: [number, number, number]
  raio: number
  clumps: number
}

/**
 * Árvores que mudam de lugar nas variações, pelo índice na lista da cena: abrem a
 * vista do fundo no meio da estrada. A da direita (índice 2) chega 2 m para fora;
 * a do fundo à esquerda (índice 6) sai da frente das casas.
 */
const ARVORES_DO_FUNDO: Record<ComFundo, Record<number, ArvoreDoCampo>> = {
  'tres-casas': {
    2: { tronco: [6, -50], copa: [5.7, 4.8, -50], raio: 2.5, clumps: 7 },
    // A árvore grande das casas (como no mapa): atrás, à esquerda, mais alta que os telhados.
    6: { tronco: [-15.5, -114], copa: [-15.1, 6.6, -114], raio: 3.7, clumps: 9 },
  },
  vila: {
    2: { tronco: [6, -50], copa: [5.7, 4.8, -50], raio: 2.5, clumps: 7 },
    6: { tronco: [-18, -84], copa: [-18, 5.0, -84], raio: 3, clumps: 6 },
  },
}

/** A lista de árvores da cena com o fundo escolhido; com 'nenhum' devolve a mesma lista. */
export function arvoresDoFundo(fundo: FundoDoCampo, originais: readonly ArvoreDoCampo[]): readonly ArvoreDoCampo[] {
  if (fundo === 'nenhum') return originais
  const trocas = ARVORES_DO_FUNDO[fundo]
  return originais.map((a, i) => trocas[i] ?? a)
}

// ---------------------------------------------------------------------------
// Cor e luz
// ---------------------------------------------------------------------------

/** O céu do hemisfério da cena (lado na sombra) e a luz do sol (borda acesa). */
const CEU: Rgb = [166, 192, 234]
const LUZ: Rgb = [255, 220, 174]

const misturar = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
const escalar = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k]
const hex = (h: number): Rgb => [(h >> 16) & 255, (h >> 8) & 255, h & 255]
const suave = (a: number, b: number, x: number) => {
  const s = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return s * s * (3 - 2 * s)
}

function paraLinear(c: Rgb): [number, number, number] {
  const um = (v: number) => {
    const s = Math.min(1, Math.max(0, v / 255))
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return [um(c[0]), um(c[1]), um(c[2])]
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const ponto = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
function unitario(a: V3): V3 {
  const n = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / n, a[1] / n, a[2] / n]
}

// ---------------------------------------------------------------------------
// Pintura do detalhe (branco com juntas: a cor vem do vértice)
// ---------------------------------------------------------------------------

type Padrao = 'liso' | 'reboco' | 'pedra' | 'tabuas' | 'telha' | 'palha' | 'toldo'

/** Metros que uma volta da textura cobre (detalhe nenhum abaixo de ~3 px a 100 m em 720p). */
const METROS: Record<Padrao, number> = { liso: 1, reboco: 4, pedra: 4, tabuas: 3, telha: 4, palha: 4, toldo: 2 }

const cinza = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`

function pintarPadrao(padrao: Padrao, g: CanvasRenderingContext2D, rnd: () => number): void {
  const L = 128
  g.fillStyle = cinza(255)
  g.fillRect(0, 0, L, L)
  const repetir = (x: number, y: number, desenhar: (x: number, y: number) => void) => {
    for (const dx of [-L, 0, L]) for (const dy of [-L, 0, L]) desenhar(x + dx, y + dy)
  }
  const manchas = (n: number, tom: number, alfa: number, r0: number, r1: number) => {
    g.fillStyle = cinza(tom, alfa)
    for (let i = 0; i < n; i++) {
      const [x, y, r] = [rnd() * L, rnd() * L, r0 + rnd() * (r1 - r0)]
      repetir(x, y, (px, py) => {
        g.beginPath()
        g.ellipse(px, py, r, r * 0.7, 0, 0, Math.PI * 2)
        g.fill()
      })
    }
  }
  if (padrao === 'reboco') {
    manchas(46, 196, 0.1, 6, 22)
    manchas(20, 255, 0.5, 4, 12)
  } else if (padrao === 'pedra') {
    // Fiadas de 0,5 m (16 px), pedras de 0,5 a 1 m, junta clara de reboco.
    g.fillStyle = cinza(238)
    g.fillRect(0, 0, L, L)
    for (let y = 0; y < L; y += 16) {
      let x = -rnd() * 24
      while (x < L) {
        const w = 16 + rnd() * 18
        g.fillStyle = cinza(Math.round(196 + rnd() * 40))
        g.beginPath()
        g.roundRect(x + 1.5, y + 1.5, w - 3, 13, 4)
        g.roundRect(x + 1.5 - L, y + 1.5, w - 3, 13, 4)
        g.fill()
        x += w
      }
    }
  } else if (padrao === 'tabuas') {
    // Tábuas deitadas de 0,5 m (21 px) com a fresta escura.
    const tabua = 128 / 6
    for (let i = 0; i < 6; i++) {
      g.fillStyle = cinza(Math.round(208 + rnd() * 40))
      g.fillRect(0, i * tabua, L, tabua - 3)
    }
    g.fillStyle = cinza(150)
    for (let i = 0; i < 6; i++) g.fillRect(0, (i + 1) * tabua - 3, L, 3)
    manchas(18, 170, 0.12, 3, 9)
  } else if (padrao === 'telha') {
    // Seis fiadas por volta (0,67 m): cada uma clareia em cima e escurece na beira de baixo.
    const fiada = L / 6
    for (let i = 0; i < 6; i++) {
      const y = i * fiada
      const grad = g.createLinearGradient(0, y, 0, y + fiada)
      grad.addColorStop(0, cinza(252))
      grad.addColorStop(0.75, cinza(214))
      grad.addColorStop(1, cinza(168))
      g.fillStyle = grad
      g.fillRect(0, y, L, fiada)
    }
    manchas(30, 150, 0.1, 4, 12)
  } else if (padrao === 'palha') {
    g.strokeStyle = cinza(196, 0.5)
    g.lineWidth = 2
    g.beginPath()
    for (let i = 0; i < 260; i++) {
      const [x, y] = [rnd() * L, rnd() * L]
      g.moveTo(x, y)
      g.lineTo(x + (rnd() - 0.5) * 2, y + 8 + rnd() * 10)
    }
    g.stroke()
    g.fillStyle = cinza(176, 0.6)
    for (let y = 30; y < L; y += 32) g.fillRect(0, y, L, 3)
  } else if (padrao === 'toldo') {
    // Listras de 0,5 m em oliva e creme (o par do mapa da vila); a luz vem do vértice.
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 === 0 ? '#7a8952' : '#ded0ad'
      g.fillRect(i * 32, 0, 32, L)
    }
  }
}

/** Fio de fumaça: bolhas macias ao longo do meio, periódico na vertical (sobe rolando a textura). */
function pintarFumaca(g: CanvasRenderingContext2D, rnd: () => number): void {
  for (let i = 0; i < 70; i++) {
    const y = rnd() * 256
    const x = 32 + Math.sin((y / 256) * Math.PI * 4 + rnd()) * 7 + (rnd() - 0.5) * 8
    const r = 6 + rnd() * 12
    for (const dy of [-256, 0, 256]) {
      const grad = g.createRadialGradient(x, y + dy, 0, x, y + dy, r)
      grad.addColorStop(0, 'rgba(255,255,255,0.32)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(x - r, y + dy - r, r * 2, r * 2)
    }
  }
}

/** A fumaça nasce fina na chaminé e some no alto: degradê fixo (alphaMap), a textura de cima rola. */
function pintarSumico(g: CanvasRenderingContext2D): void {
  const grad = g.createLinearGradient(0, 64, 0, 0)
  grad.addColorStop(0, cinza(0))
  grad.addColorStop(0.08, cinza(255))
  grad.addColorStop(0.45, cinza(200))
  grad.addColorStop(1, cinza(0))
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 64)
}

/** Terreiro de terra batida no fim da estrada: a mesma terra clara, borda irregular (alphaTest recorta). */
function pintarTerreiro(g: CanvasRenderingContext2D, rnd: () => number): void {
  const borda: [number, number][] = []
  const fases = [rnd() * 6, rnd() * 6, rnd() * 6]
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2
    const r = 112 + 7 * Math.sin(a * 3 + fases[0]) + 5 * Math.sin(a * 7 + fases[1]) + 3 * Math.sin(a * 13 + fases[2])
    borda.push([128 + Math.cos(a) * r, 128 + Math.sin(a) * r])
  }
  g.fillStyle = 'rgb(214,192,154)'
  g.beginPath()
  for (const [x, y] of borda) g.lineTo(x, y)
  g.closePath()
  g.fill()
  g.globalCompositeOperation = 'source-atop'
  for (const [tom, n] of [
    ['rgba(186,160,120,0.35)', 26],
    ['rgba(228,210,174,0.4)', 20],
  ] as [string, number][]) {
    g.fillStyle = tom
    for (let i = 0; i < n; i++) {
      g.beginPath()
      g.ellipse(rnd() * 256, rnd() * 256, 8 + rnd() * 22, 5 + rnd() * 12, rnd() * Math.PI, 0, Math.PI * 2)
      g.fill()
    }
  }
  // Beira mais escura, como a da estrada.
  g.strokeStyle = 'rgba(186,160,120,0.8)'
  g.lineWidth = 9
  g.beginPath()
  for (const [x, y] of borda) g.lineTo(x, y)
  g.closePath()
  g.stroke()
  g.globalCompositeOperation = 'source-over'
}

// ---------------------------------------------------------------------------
// Construção (lotes por padrão: um draw call por textura de detalhe)
// ---------------------------------------------------------------------------

interface Lote {
  pos: number[]
  uv: number[]
  cor: number[]
}

/** O que a cena do campo empresta ao fundo. */
export interface GanchosDoFundo {
  fundo: ComFundo
  scene: Three.Scene
  /** Cria a textura e a põe na lista que a cena descarta. */
  textura: (canvas: HTMLCanvasElement, opcoes?: { repetir?: boolean; cor?: boolean }) => Three.Texture
  pintar: (largura: number, altura: number, pintor: (g: CanvasRenderingContext2D) => void) => HTMLCanvasElement
  /** Direção do sol (unitária) da cena. */
  sol: Three.Vector3
  reduzirMovimento: boolean
}

interface Casa {
  x0: number
  x1: number
  z0: number
  z1: number
  /** Altura do beiral (topo da parede). */
  parede: number
  cumeeira: number
  /** Direção da cumeeira: 'x' = de lado para a câmera, 'z' = empena virada para a câmera. */
  eixo: 'x' | 'z'
  quatroAguas?: boolean
  corParede: number
  padraoParede: Padrao
  corTelhado: number
  padraoTelhado?: Padrao
  /** Chaminé (x, z) em cima do telhado. */
  chamine?: readonly [number, number]
  /** Porta na frente (+z) a esta distância do canto esquerdo; sem ela, só janelas. */
  porta?: number
}

const JANELA: Rgb = [61, 74, 92]
const PORTA: Rgb = [84, 64, 46]

function criarObra(sol: V3, rnd: () => number) {
  const lotes = new Map<Padrao, Lote>()
  const lote = (p: Padrao) => {
    let l = lotes.get(p)
    if (!l) {
      l = { pos: [], uv: [], cor: [] }
      lotes.set(p, l)
    }
    return l
  }

  /** Luz de contraluz assada: o lado da câmera fica na sombra, escurecido e frio; o lado do sol, quente. */
  function tom(base: Rgb, n: V3): Rgb {
    const d = ponto(n, sol)
    const sombra = misturar(escalar(base, 0.74 + 0.08 * Math.max(0, n[1])), CEU, 0.3)
    const luz = misturar(escalar(base, 0.95 + 0.25 * d), LUZ, 0.22)
    return misturar(sombra, luz, suave(-0.05, 0.45, d))
  }

  function tri(p: Padrao, v: readonly [V3, V3, V3], uv: readonly [Uv, Uv, Uv], cores: readonly [Rgb, Rgb, Rgb]) {
    const l = lote(p)
    for (let i = 0; i < 3; i++) {
      l.pos.push(v[i][0], v[i][1], v[i][2])
      l.uv.push(uv[i][0] / METROS[p], uv[i][1] / METROS[p])
      l.cor.push(...paraLinear(cores[i]))
    }
  }
  function quad(p: Padrao, v: readonly [V3, V3, V3, V3], uv: readonly [Uv, Uv, Uv, Uv], cores: readonly [Rgb, Rgb, Rgb, Rgb]) {
    tri(p, [v[0], v[1], v[2]], [uv[0], uv[1], uv[2]], [cores[0], cores[1], cores[2]])
    tri(p, [v[0], v[2], v[3]], [uv[0], uv[2], uv[3]], [cores[0], cores[2], cores[3]])
  }

  /** Normal da face virada para fora (para longe de `centro`). */
  function normalPara(a: V3, b: V3, c: V3, centro: V3): V3 {
    const n = unitario(cruz(sub(b, a), sub(c, a)))
    const meio: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]
    return ponto(n, sub(meio, centro)) < 0 ? [-n[0], -n[1], -n[2]] : n
  }

  /**
   * Parede vertical de `a` a `b` (planta), de y0 a y1, com o pé escurecido (contato com o chão)
   * e, se tiver beiral, a faixa de sombra de 0,4 m embaixo dele.
   */
  function parede(p: Padrao, base: Rgb, a: readonly [number, number], b: readonly [number, number], y0: number, y1: number, fora: V3, beiral: boolean) {
    const dir = unitario([b[0] - a[0], 0, b[1] - a[1]])
    const n: V3 = unitario(fora)
    const c = tom(base, n)
    const u = (x: number, z: number) => x * dir[0] + z * dir[2]
    const [ua, ub] = [u(a[0], a[1]), u(b[0], b[1])]
    const faixa = (ya: number, yb: number, ca: Rgb, cb: Rgb) => {
      if (yb - ya < 0.01) return
      quad(
        p,
        [
          [a[0], ya, a[1]],
          [b[0], ya, b[1]],
          [b[0], yb, b[1]],
          [a[0], yb, a[1]],
        ],
        [
          [ua, ya],
          [ub, ya],
          [ub, yb],
          [ua, yb],
        ],
        [ca, ca, cb, cb],
      )
    }
    const pe = Math.min(0.7, (y1 - y0) * 0.3)
    const topo = beiral ? y1 - 0.4 : y1
    faixa(y0, y0 + pe, escalar(c, 0.62), c)
    faixa(y0 + pe, topo, c, c)
    if (beiral) faixa(topo, y1, escalar(c, 0.7), escalar(c, 0.7))
  }

  /** Abertura escura (janela, porta, vão) colada 3 cm na frente de uma parede. */
  function abertura(cor: Rgb, a: readonly [number, number], b: readonly [number, number], y0: number, y1: number, fora: V3) {
    const n = unitario(fora)
    const d = 0.03
    const c = tom(cor, n)
    const pts: [V3, V3, V3, V3] = [
      [a[0] + n[0] * d, y0, a[1] + n[2] * d],
      [b[0] + n[0] * d, y0, b[1] + n[2] * d],
      [b[0] + n[0] * d, y1, b[1] + n[2] * d],
      [a[0] + n[0] * d, y1, a[1] + n[2] * d],
    ]
    quad('liso', pts, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ], [c, c, escalar(c, 0.8), escalar(c, 0.8)])
  }

  /** Telhado: cumeeira levemente torta, borda acesa pelo sol na cumeeira. */
  function telhado(casa: Casa) {
    const b = 0.4
    const corT = hex(casa.corTelhado)
    const p = casa.padraoTelhado ?? 'telha'
    const centro: V3 = [(casa.x0 + casa.x1) / 2, casa.parede, (casa.z0 + casa.z1) / 2]
    const largo = casa.eixo === 'x' ? casa.z1 - casa.z0 : casa.x1 - casa.x0
    const queda = ((casa.cumeeira - casa.parede) / (largo / 2)) * b
    const beiral = casa.parede - queda
    const torto = () => (rnd() - 0.5) * 0.12
    // No sistema da casa: s ao longo da cumeeira, w de um beiral ao outro.
    const S0 = (casa.eixo === 'x' ? casa.x0 : casa.z0) - b
    const S1 = (casa.eixo === 'x' ? casa.x1 : casa.z1) + b
    const W0 = (casa.eixo === 'x' ? casa.z0 : casa.x0) - b
    const W1 = (casa.eixo === 'x' ? casa.z1 : casa.x1) + b
    const Wm = (W0 + W1) / 2
    const meia = (W1 - W0) / 2
    const ponta = casa.quatroAguas ? Math.min(meia, (S1 - S0) / 2 - 0.01) : 0
    const mundo = (s: number, y: number, w: number): V3 => (casa.eixo === 'x' ? [s, y, w] : [w, y, s])
    const r0 = mundo(S0 + ponta, casa.cumeeira + torto(), Wm)
    const r1 = mundo(S1 - ponta, casa.cumeeira + torto(), Wm)
    const aceso = (c: Rgb): Rgb => misturar(escalar(c, 1.18), LUZ, 0.42)
    const inclinado = Math.hypot(meia, casa.cumeeira - beiral)
    for (const lado of [-1, 1]) {
      const W = lado < 0 ? W0 : W1
      const e0 = mundo(S0, beiral, W)
      const e1 = mundo(S1, beiral, W)
      const n = normalPara(e0, e1, r1, centro)
      const c = tom(corT, n)
      // 82% da água no tom dela; o último palmo antes da cumeeira acende.
      const k = 0.82
      const m0: V3 = [e0[0] + (r0[0] - e0[0]) * k, e0[1] + (r0[1] - e0[1]) * k, e0[2] + (r0[2] - e0[2]) * k]
      const m1: V3 = [e1[0] + (r1[0] - e1[0]) * k, e1[1] + (r1[1] - e1[1]) * k, e1[2] + (r1[2] - e1[2]) * k]
      const sAt = (v: V3) => (casa.eixo === 'x' ? v[0] : v[2])
      quad(p, [e0, e1, m1, m0], [
        [S0, 0],
        [S1, 0],
        [sAt(m1), inclinado * k],
        [sAt(m0), inclinado * k],
      ], [escalar(c, 0.9), escalar(c, 0.9), c, c])
      quad(p, [m0, m1, r1, r0], [
        [sAt(m0), inclinado * k],
        [sAt(m1), inclinado * k],
        [sAt(r1), inclinado],
        [sAt(r0), inclinado],
      ], [c, c, aceso(c), aceso(c)])
    }
    if (casa.quatroAguas) {
      // As duas pontas da quatro-águas: triângulos do beiral à ponta da cumeeira.
      for (const [S, r] of [
        [S0, r0],
        [S1, r1],
      ] as [number, V3][]) {
        const a = mundo(S, beiral, W0)
        const z = mundo(S, beiral, W1)
        const n = normalPara(a, z, r, centro)
        const c = tom(corT, n)
        tri(p, [a, z, r], [
          [W0, 0],
          [W1, 0],
          [Wm, inclinado],
        ], [escalar(c, 0.9), escalar(c, 0.9), aceso(c)])
      }
    } else {
      // Empenas: o triângulo de parede entre o beiral e a cumeeira, nas duas pontas.
      const corP = hex(casa.corParede)
      for (const S of [S0 + b, S1 - b]) {
        const a = mundo(S, casa.parede, W0 + b)
        const z = mundo(S, casa.parede, W1 - b)
        const r = mundo(S, casa.cumeeira - 0.05, Wm)
        const n = normalPara(a, z, r, centro)
        const c = tom(corP, n)
        const wAt = (v: V3) => (casa.eixo === 'x' ? v[2] : v[0])
        tri(casa.padraoParede, [a, z, r], [
          [wAt(a), casa.parede],
          [wAt(z), casa.parede],
          [wAt(r), casa.cumeeira],
        ], [escalar(c, 0.7), escalar(c, 0.7), c])
      }
    }
  }

  function casa(c: Casa) {
    const base = hex(c.corParede)
    const { x0, x1, z0, z1 } = c
    // Frente (+z), fundos (-z), esquerda (-x), direita (+x).
    const faces: [readonly [number, number], readonly [number, number], V3][] = [
      [[x0, z1], [x1, z1], [0, 0, 1]],
      [[x1, z0], [x0, z0], [0, 0, -1]],
      [[x0, z0], [x0, z1], [-1, 0, 0]],
      [[x1, z1], [x1, z0], [1, 0, 0]],
    ]
    for (const [a, b, n] of faces) parede(c.padraoParede, base, a, b, 0, c.parede, n, true)
    // Janelas de 1 × 1,1 m nas faces que a câmera vê (frente e laterais); um andar a cada 2,6 m de parede.
    const andares = c.parede >= 4 ? [1.0, 1.0 + 2.2] : [0.95]
    for (const [a, b, n] of faces) {
      if (n[2] < 0) continue
      const comp = Math.hypot(b[0] - a[0], b[1] - a[1])
      const nJanelas = Math.max(1, Math.floor(comp / 2.6))
      const passo = comp / nJanelas
      const em = (s: number): [number, number] => [a[0] + ((b[0] - a[0]) * s) / comp, a[1] + ((b[1] - a[1]) * s) / comp]
      for (const [k, y] of andares.entries()) {
        for (let i = 0; i < nJanelas; i++) {
          const s = passo * (i + 0.5)
          const naPorta = n[2] > 0 && k === 0 && c.porta !== undefined && Math.abs(s - c.porta) < 1.4
          if (naPorta || y + 1.1 > c.parede - 0.5) continue
          abertura(JANELA, em(s - 0.5), em(s + 0.5), y, y + 1.1, n)
        }
      }
      if (n[2] > 0 && c.porta !== undefined) abertura(PORTA, em(c.porta - 0.5), em(c.porta + 0.5), 0, 2.1, n)
    }
    telhado(c)
    if (c.chamine) {
      const [cx, cz] = c.chamine
      const m = 0.35
      const pedra = hex(0xc3c0b2)
      const topo = c.cumeeira + 0.9
      const pe = c.parede
      for (const [a, b, n] of [
        [[cx - m, cz + m], [cx + m, cz + m], [0, 0, 1]],
        [[cx + m, cz - m], [cx - m, cz - m], [0, 0, -1]],
        [[cx - m, cz - m], [cx - m, cz + m], [-1, 0, 0]],
        [[cx + m, cz + m], [cx + m, cz - m], [1, 0, 0]],
      ] as [[number, number], [number, number], V3][]) {
        parede('pedra', pedra, a, b, pe, topo, n, false)
      }
    }
  }

  /** Chão chato (praça, soleira): quadrilátero no plano, um palmo acima do campo. */
  function chao(cor: Rgb, x0: number, x1: number, z0: number, z1: number) {
    const c = tom(cor, [0, 1, 0])
    quad('liso', [
      [x0, 0.02, z1],
      [x1, 0.02, z1],
      [x1, 0.02, z0],
      [x0, 0.02, z0],
    ], [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ], [c, c, c, c])
  }

  return { lotes, tom, quad, tri, parede, abertura, casa, chao }
}

type Obra = ReturnType<typeof criarObra>

// ---------------------------------------------------------------------------
// Variação 1: três casas no fim da estrada (o mapa do pedido: cinza atrás, lilás à esquerda, madeira na frente)
// ---------------------------------------------------------------------------

const TRES_CASAS: readonly Casa[] = [
  // Cinza, a maior: atrás, no fim da estrada, de lado para quem chega; chaminé de pedra.
  { x0: -6, x1: 1, z0: -104, z1: -98, parede: 2.8, cumeeira: 5.8, eixo: 'x', corParede: 0xefe7cf, padraoParede: 'reboco', corTelhado: 0x565050, chamine: [-4.2, -102.2], porta: 3.6 },
  // Lilás, estreita e funda: à esquerda, a empena virada para a estrada.
  { x0: -11.2, x1: -7.7, z0: -97, z1: -92, parede: 2.6, cumeeira: 4.8, eixo: 'z', corParede: 0xc3c0b2, padraoParede: 'pedra', corTelhado: 0x665e86, porta: 1.75 },
  // Madeira, larga e baixa: na frente, à direita da estrada.
  { x0: 0.4, x1: 6.4, z0: -91, z1: -87, parede: 2.3, cumeeira: 4.2, eixo: 'x', corParede: 0xb9895f, padraoParede: 'tabuas', corTelhado: 0x5e4b24, porta: 1.6 },
]

interface Fumaca {
  x: number
  y: number
  z: number
  altura: number
  /** Para onde o alto do fio deita (m, negativo = esquerda, com o vento do capim). */
  deriva: number
}

/** O que cada fundo devolve depois de erguer as casas: as fumaças e, nas três casas, o terreiro. */
interface FundoErguido {
  fumacas: Fumaca[]
  terreiro?: { x: number; z: number; rx: number; rz: number }
}

function obraDasTresCasas(obra: Obra): FundoErguido {
  for (const c of TRES_CASAS) obra.casa(c)
  const [cinza] = TRES_CASAS
  const [cx, cz] = cinza.chamine ?? [0, 0]
  return {
    fumacas: [{ x: cx, y: cinza.cumeeira + 0.9, z: cz, altura: 8, deriva: -3 }],
    terreiro: { x: -1.6, z: -93.5, rx: 9.5, rz: 9 },
  }
}

// ---------------------------------------------------------------------------
// Variação 2: vila no fim da estrada (o mapa: casario de tamanhos e telhados variados, praça, feira).
// Sem muro: o de pedra, com guarita e portão, saiu a pedido do usuário em 27/10/2026.
// ---------------------------------------------------------------------------

/** Beira da praça do lado da estrada (onde a estrada chega à vila). */
const PRACA_Z = -122.7

const VILA: readonly Casa[] = [
  // Fileira da frente.
  { x0: -30, x1: -18, z0: -136, z1: -127, parede: 4.4, cumeeira: 7.4, eixo: 'x', corParede: 0xefe7cf, padraoParede: 'reboco', corTelhado: 0xb56e50, chamine: [-21.5, -133.5] },
  { x0: -14, x1: -5, z0: -138, z1: -126, parede: 4.2, cumeeira: 7.6, eixo: 'z', corParede: 0xc3c0b2, padraoParede: 'pedra', corTelhado: 0x565050, chamine: [-7.2, -134] },
  // A estalagem comprida, de várias águas (três empenas para a praça).
  { x0: 6, x1: 11.6, z0: -137, z1: -127, parede: 4.0, cumeeira: 6.6, eixo: 'z', corParede: 0xb9895f, padraoParede: 'tabuas', corTelhado: 0x5e4b24 },
  { x0: 11.6, x1: 17.2, z0: -137, z1: -127, parede: 4.0, cumeeira: 6.9, eixo: 'z', corParede: 0xb9895f, padraoParede: 'tabuas', corTelhado: 0x867a6a },
  { x0: 17.2, x1: 22.8, z0: -137, z1: -127, parede: 4.0, cumeeira: 6.6, eixo: 'z', corParede: 0xb9895f, padraoParede: 'tabuas', corTelhado: 0x5e4b24, chamine: [21, -133] },
  // Meio e fundo: dois salões de quatro águas, a casa do canto e a do meio.
  { x0: -44, x1: -33, z0: -152, z1: -140, parede: 4.2, cumeeira: 7.2, eixo: 'z', corParede: 0xefe7cf, padraoParede: 'reboco', corTelhado: 0x665e86 },
  { x0: -38, x1: -20, z0: -168, z1: -157, parede: 5.0, cumeeira: 9.2, eixo: 'x', quatroAguas: true, corParede: 0xc3c0b2, padraoParede: 'pedra', corTelhado: 0xd6b56a, padraoTelhado: 'palha' },
  { x0: -12, x1: -3, z0: -166, z1: -158, parede: 4.6, cumeeira: 7.8, eixo: 'x', corParede: 0xefe7cf, padraoParede: 'reboco', corTelhado: 0x665e86, chamine: [-9, -163.5] },
  { x0: 2, x1: 20, z0: -170, z1: -158, parede: 5.2, cumeeira: 9.0, eixo: 'x', quatroAguas: true, corParede: 0xb9895f, padraoParede: 'tabuas', corTelhado: 0x565050 },
  { x0: 15, x1: 23, z0: -154, z1: -141, parede: 4.6, cumeeira: 7.6, eixo: 'z', corParede: 0xc3c0b2, padraoParede: 'pedra', corTelhado: 0xb56e50 },
]

function obraDaVila(obra: Obra): FundoErguido {
  const frente: V3 = [0, 0, 1]
  // Praça de chão escuro entre as fileiras de casas.
  obra.chao(hex(0x4a3f38), -14, 14, -156, PRACA_Z)
  // A barraca da feira, na beira da praça: balcão de tábua e toldo listrado inclinado.
  const bx = 0.8
  const bz = -133
  obra.parede('tabuas', hex(0x9a7552), [bx - 1.3, bz + 0.5], [bx + 1.3, bz + 0.5], 0, 1.0, frente, false)
  const toldo: [V3, V3, V3, V3] = [
    [bx - 1.6, 2.2, bz + 1.2],
    [bx + 1.6, 2.2, bz + 1.2],
    [bx + 1.6, 2.75, bz - 0.9],
    [bx - 1.6, 2.75, bz - 0.9],
  ]
  const luzDoToldo: Rgb = [196, 200, 210]
  obra.quad('toldo', toldo, [
    [bx - 1.6, 0],
    [bx + 1.6, 0],
    [bx + 1.6, 2.2],
    [bx - 1.6, 2.2],
  ], [luzDoToldo, luzDoToldo, luzDoToldo, luzDoToldo])
  for (const c of VILA) obra.casa(c)
  // Fumaça só nas chaminés da metade esquerda: do lado do sol ela acenderia e disputaria com ele.
  const fumacas: Fumaca[] = []
  for (const c of VILA) {
    if (!c.chamine || c.chamine[0] > -6) continue
    if (fumacas.length < 2) fumacas.push({ x: c.chamine[0], y: c.cumeeira + 0.9, z: c.chamine[1], altura: 10, deriva: -4 })
  }
  return { fumacas }
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/** Velocidade da fumaça subindo (voltas da textura por segundo). */
const SUBIDA_DA_FUMACA = 0.07
/** Cinza quente, um pouco mais escuro que o céu baixo: contra o céu claro, fumaça clara some. */
const COR_DA_FUMACA: Rgb = [180, 173, 162]
const SEMENTE_DO_FUNDO: Record<ComFundo, number> = { 'tres-casas': 27102601, vila: 27102602 }

/**
 * A vila pinta as texturas na ordem da versão aprovada em 27/10/2026, que ainda tinha o muro: a semente
 * é uma só para todas, e outra ordem mudaria de lugar cada pedra, telha e mancha do casario (e a fase da
 * fumaça). A folha do portão era a única com padrão próprio (tábuas em pé: 6 tábuas e 18 manchas de 3
 * sorteios); saiu com o muro, e os sorteios dela continuam gastos no mesmo ponto.
 */
const FOLHA_DO_PORTAO = { sorteios: 6 + 18 * 3 } as const
const ORDEM_DE_PINTURA: Record<ComFundo, readonly (Padrao | typeof FOLHA_DO_PORTAO)[]> = {
  'tres-casas': [],
  vila: ['pedra', 'reboco', FOLHA_DO_PORTAO, 'liso', 'tabuas', 'toldo', 'telha', 'palha'],
}

export function montarPaisagem(THREE: ThreeModule, g: GanchosDoFundo): { atualizar: (t: number) => void } {
  const rnd = semente(SEMENTE_DO_FUNDO[g.fundo])
  const obra = criarObra([g.sol.x, g.sol.y, g.sol.z], rnd)
  const grupo = new THREE.Group()
  grupo.name = `paisagem-${g.fundo}`
  g.scene.add(grupo)

  const resultado = g.fundo === 'tres-casas' ? obraDasTresCasas(obra) : obraDaVila(obra)

  // A ordem fixa primeiro; o que ela não cita vai depois, na ordem em que a obra usou.
  const fixa = ORDEM_DE_PINTURA[g.fundo]
  const ordem = [...fixa, ...[...obra.lotes.keys()].filter((p) => !fixa.includes(p))]
  for (const padrao of ordem) {
    if (typeof padrao !== 'string') {
      for (let i = 0; i < padrao.sorteios; i++) rnd()
      continue
    }
    const l = obra.lotes.get(padrao)
    if (!l) continue
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(l.pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(l.uv, 2))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(l.cor, 3))
    const map = g.textura(
      g.pintar(padrao === 'liso' ? 4 : 128, padrao === 'liso' ? 4 : 128, (c) => pintarPadrao(padrao, c, rnd)),
      { repetir: true },
    )
    const malha = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, vertexColors: true, side: THREE.DoubleSide }))
    malha.name = `paisagem-${padrao}`
    grupo.add(malha)
  }

  if (resultado.terreiro) {
    const t = resultado.terreiro
    const tex = g.textura(g.pintar(256, 256, (c) => pintarTerreiro(c, rnd)))
    const terreiro = new THREE.Mesh(
      new THREE.PlaneGeometry(t.rx * 2, t.rz * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    )
    terreiro.name = 'paisagem-terreiro'
    terreiro.position.set(t.x, 0.006, t.z)
    grupo.add(terreiro)
  }

  const sumico = g.textura(g.pintar(4, 64, pintarSumico), { cor: false })
  const fumacas = resultado.fumacas.map((f, i) => {
    const tex = g.textura(g.pintar(64, 256, (c) => pintarFumaca(c, rnd)), { repetir: true })
    tex.repeat.set(1, 1.4)
    const base = 0.7
    const topo = 3.4
    const pos = new Float32Array([
      f.x - base / 2, f.y, f.z,
      f.x + base / 2, f.y, f.z,
      f.x + f.deriva + topo / 2, f.y + f.altura, f.z,
      f.x + f.deriva - topo / 2, f.y + f.altura, f.z,
    ])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    const malha = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: tex, alphaMap: sumico, color: new THREE.Color(...paraLinear(COR_DA_FUMACA)), transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    )
    malha.name = `paisagem-fumaca-${i}`
    grupo.add(malha)
    return { tex, fase: rnd() }
  })

  return {
    atualizar(t: number) {
      const ritmo = g.reduzirMovimento ? 0.5 : 1
      for (const f of fumacas) f.tex.offset.y = f.fase - t * SUBIDA_DA_FUMACA * ritmo
    },
  }
}

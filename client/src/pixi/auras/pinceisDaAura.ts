import type { TipoDeAura } from '../../lib/auras'
import { liso } from './estadoDaAura'

/**
 * AURA DA FICHA — os pincéis: as rampas de cor e as formas (texturas cinza com
 * alfa, geradas por conta, como a bolha de `pixi/particulasDoMapa.ts`). Porte
 * de `docs/design/auras/prova/auras.js`, com os valores da página aprovada.
 * Cada pincel é uma forma pintada pela rampa, passo a passo; o atlas
 * (`atlasDaAura.ts`) os põe lado a lado numa textura só por aura.
 */

/** Rampa de lista (de 0 a 1 na rampa) ou anel de matiz OKLCH (a rampa dá a volta). */
type Rampa = readonly string[] | { readonly passos: number; readonly volta: true; readonly oklch: readonly [claridade: number, croma: number] }

const RAMPAS = {
  almasBrilho: ['#7c50d8'],
  almas: ['#bb9cff', '#9c6ef2', '#8150da', '#6538b9', '#4a2794'],
  almasLuz: ['#f3ebff', '#d6c0ff', '#a983ec'],

  negrasBrilho: ['#7d3fe6'],
  negrasBorda: ['#a971ff', '#8c4cf2', '#6f31d2', '#4f1f98'],
  negrasMiolo: ['#0b0611', '#120a1a', '#1c1028', '#2b193b'],
  negrasBrasa: ['#ecdcff', '#b07cff', '#6a33bf'],

  misturaBrilho: ['#ff7a3a', '#c650ff'],
  // duas metades: 0 a 0,4 a língua laranja, 0,6 a 1 a roxa (o meio não é usado)
  misturaCorpo: ['#f4b25e', '#e98a3e', '#cf5d3c', '#a978ff', '#8448ee', '#6430c8'],
  misturaMiolo: ['#fff1cc', '#ffcf86', '#f59a62', '#f1e4ff', '#d0a8ff', '#a06cf0'],
  raioFaixa: ['#7a35e0'],
  raioNucleo: ['#f6eeff', '#d4b0ff'],
  misturaFaisca: ['#ffd9a0', '#ff9a5a', '#d58bff', '#9a52ff'],

  // a paleta da fogueira aprovada (docs/design/objeto-fogo)
  fogoBrilho: ['#e38a3e'],
  fogoCorpo: ['#eea65a', '#e39446', '#c4683a', '#a04a2c', '#7c3622'],
  fogoMiolo: ['#fff2d2', '#f6dca8', '#f0c98a', '#e39446'],
  fogoBrasa: ['#fff2d2', '#f6c27a', '#e3823f', '#a04a2c'],

  trevasBrilho: ['#07050b'],
  trevasNevoa: ['#151020', '#0d0a14', '#07050b'],
  trevasLuz: ['#f1edff', '#bdb1f2', '#7464b8', '#352c5c'],

  amarelaBrilho: ['#ffcc33'],
  amarelaFaixa: ['#d99a0e'],
  amarelaNucleo: ['#ffffff', '#fff6c4', '#ffe27a'],
  amarelaFaisca: ['#fffbe8', '#ffe066', '#ffae1f'],

  azulBrilho: ['#3d9bff'],
  azulFaixa: ['#1f6fe0'],
  azulNucleo: ['#ffffff', '#e0f4ff', '#a3daff'],
  azulFaisca: ['#f2fbff', '#90d4ff', '#2f86ff'],

  vermelhaBrilho: ['#ff2d2d'],
  vermelhaCorpo: ['#ff5a44', '#e8262e', '#b3121f', '#7a0a17', '#4e0610'],
  vermelhaMiolo: ['#ffe2d4', '#ff9c7c', '#ff5c3e'],
  vermelhaRisco: ['#ffd3c4', '#ff6c4c', '#cc1f2a'],

  // cores suaves (claridade alta, croma baixo): arco-íris sem cara de brinquedo
  prismaBrilho: { passos: 24, volta: true, oklch: [0.86, 0.06] },
  prisma: { passos: 24, volta: true, oklch: [0.8, 0.13] },
  prismaLuz: { passos: 24, volta: true, oklch: [0.93, 0.07] },
  prismaFaisca: ['#ffffff', '#f4efff', '#eaf6ff'],
} as const satisfies Record<string, Rampa>

export type NomeDaRampa = keyof typeof RAMPAS

function rampa(nome: NomeDaRampa): Rampa {
  return RAMPAS[nome]
}

function ehLista(r: Rampa): r is readonly string[] {
  return Array.isArray(r)
}

type Rgb = [number, number, number]

function hexParaRgb(h: string): Rgb {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function oklchParaRgb(L: number, C: number, graus: number): Rgb {
  const h = (graus * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin: Rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const gama = (x: number): number => {
    const v = Math.max(0, Math.min(1, x))
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  }
  return [gama(lin[0]), gama(lin[1]), gama(lin[2])]
}

/** Quantas colunas a rampa ocupa no atlas: 1 para cor única, 16 para lista, os passos do anel de matiz. */
export function passosDaRampa(nome: NomeDaRampa): number {
  const r = rampa(nome)
  if (!ehLista(r)) return r.passos
  return r.length === 1 ? 1 : 16
}

/** A rampa dá a volta (anel de matiz): a última coluna encosta na primeira. */
export function rampaDaVolta(nome: NomeDaRampa): boolean {
  return !ehLista(rampa(nome))
}

/** Cor (r, g, b de 0 a 1) no ponto `u` da rampa. */
export function corDaRampa(nome: NomeDaRampa, u: number): Rgb {
  const r = rampa(nome)
  if (!ehLista(r)) return oklchParaRgb(r.oklch[0], r.oklch[1], (((u % 1) + 1) % 1) * 360 + 15)
  if (r.length === 1) return hexParaRgb(r[0])
  const p = Math.max(0, Math.min(1, u)) * (r.length - 1)
  const i = Math.min(r.length - 2, Math.floor(p))
  const f = p - i
  const a = hexParaRgb(r[i])
  const b = hexParaRgb(r[i + 1])
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

// ---------------------------------------------------------------- formas (texturas)

/** Textura cinza com alfa, pixel a pixel. `lum` = quanto da cor da rampa (1 = ela inteira). */
export interface FormaDaAura {
  w: number
  h: number
  lum: Float32Array
  alfa: Float32Array
}

/** `o[0]` = lum, `o[1]` = alfa do pixel (x, y), no centro do pixel. */
type Pixel = (x: number, y: number, o: [number, number]) => void

function criarForma(w: number, h: number, fn: Pixel): FormaDaAura {
  const lum = new Float32Array(w * h)
  const alfa = new Float32Array(w * h)
  const o: [number, number] = [1, 0]
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      o[0] = 1
      o[1] = 0
      fn(x + 0.5, y + 0.5, o)
      lum[y * w + x] = o[0]
      alfa[y * w + x] = o[1] < 0 ? 0 : o[1] > 1 ? 1 : o[1]
    }
  }
  return { w, h, lum, alfa }
}

function distanciaAoSegmento(x: number, y: number): number {
  const px = Math.max(8, Math.min(56, x))
  return Math.hypot(x - px, y - 8)
}

/** As formas, por nome; cada uma é feita na primeira vez que alguém pede (são contas de pixel). */
const DESENHO_DAS_FORMAS = {
  /** Disco macio (o mesmo da bolha do particulasDoMapa). */
  ponto: () =>
    criarForma(32, 32, (x, y, o) => {
      const d = Math.min(1, Math.hypot(x - 16, y - 16) / 16)
      o[1] = (1 - d) * (1 - d)
    }),
  /** Ponto com miolo duro: brasa, faísca. */
  nucleo: () =>
    criarForma(32, 32, (x, y, o) => {
      const d = Math.min(1, Math.hypot(x - 16, y - 16) / 16)
      o[1] = Math.min(1, Math.exp(-((d / 0.17) ** 2)) + 0.45 * (1 - d) ** 2.5)
    }),
  /** Língua de fogo em pé: fundo redondo, ponta fina um pouco torta. */
  lingua: () =>
    criarForma(48, 96, (x, y, o) => {
      const vv = (1 - y / 96 - 0.04) / 0.94
      if (vv <= 0 || vv >= 1) return
      const u = (vv - 0.24) / 0.76
      const hw = vv < 0.24 ? 0.92 * Math.sqrt(Math.max(0, 1 - ((0.24 - vv) / 0.24) ** 2)) : 0.92 * Math.pow(Math.max(0, 1 - Math.pow(u, 1.4)), 0.9) * (1 - 0.25 * u)
      const cx = 0.1 * Math.sin(vv * Math.PI * 1.2) * vv
      const e = Math.abs((x - 24) / 24 - cx) / Math.max(hw, 1e-3)
      o[1] = (1 - liso(0.55, 1, e)) * (1 - liso(0.86, 1, vv)) * liso(0, 0.07, vv)
    }),
  /** Alma: cabeça redonda com olhos fundos e um rabo curto (o resto do rabo é o rastro). */
  alma: () =>
    criarForma(48, 64, (x, y, o) => {
      let a = 1 - liso(0.62, 1, Math.hypot(x - 24, y - 20) / 14)
      if (y > 20) {
        const u = (y - 20) / 42
        if (u < 1) {
          const hw = 14 * Math.pow(1 - u, 1.35)
          const cx = 24 + 3.2 * Math.sin(u * Math.PI)
          const e = Math.abs(x - cx) / Math.max(hw, 0.01)
          a = Math.max(a, (1 - liso(0.5, 1, e)) * (1 - 0.65 * u))
        }
      }
      o[1] = a
      const olho = Math.min(Math.hypot((x - 18.8) / 2.9, (y - 19.5) / 3.9), Math.hypot((x - 29.2) / 2.9, (y - 19.5) / 3.9))
      o[0] = 1 - 0.88 * (1 - liso(0.7, 1.05, olho))
    }),
  /** Traço de raio: miolo fino e halo, deitado no eixo x (a cápsula ocupa de 8 a 56). */
  traco: () =>
    criarForma(64, 16, (x, y, o) => {
      const d = distanciaAoSegmento(x, y)
      const nuc = Math.exp(-((d / 1.7) ** 2))
      const halo = 0.42 * Math.exp(-((d / 5) ** 2))
      o[1] = Math.min(1, nuc + halo) * (1 - liso(6.5, 8, d))
      o[0] = (nuc + halo * 0.62) / Math.max(1e-4, nuc + halo)
    }),
  /** Faixa macia por baixo do raio (mistura normal): é ela que dá cor ao raio na grama. */
  faixa: () =>
    criarForma(64, 16, (x, y, o) => {
      o[1] = 1 - liso(1.5, 7.5, distanciaAoSegmento(x, y))
    }),
  /** Fita: miolo cheio da cor e borda mais escura (lum 0,5), deitada no eixo x como o traço. */
  fita: () =>
    criarForma(64, 16, (x, y, o) => {
      // a borda escura é só nas laterais: nas pontas a fita só some, sem costura escura na emenda
      const dy = Math.abs(y - 8)
      const foraDaPonta = Math.max(0, Math.abs(x - 32) - 24)
      o[1] = (1 - liso(4.5, 7.6, dy)) * (1 - liso(0, 8, foraDaPonta))
      o[0] = 1 - 0.5 * liso(1.5, 6, dy)
    }),
  /** Ponta de energia: fina e afiada. */
  espinho: () =>
    criarForma(32, 96, (x, y, o) => {
      const vv = (1 - y / 96 - 0.03) / 0.95
      if (vv <= 0 || vv >= 1) return
      const hw = 0.95 * Math.pow(1 - vv, 1.25) * Math.sqrt(liso(-0.02, 0.12, vv))
      const e = Math.abs((x - 16) / 16) / Math.max(hw, 1e-3)
      o[1] = (1 - liso(0.5, 1, e)) * (1 - liso(0.9, 1, vv))
    }),
  /** Estrela de 4 pontas, pequena. */
  estrela: () =>
    criarForma(48, 48, (x, y, o) => {
      const dx = x - 24
      const dy = y - 24
      const r = Math.hypot(dx, dy)
      const bh = Math.exp(-((dy / 1.3) ** 2)) * Math.pow(Math.max(0, 1 - Math.abs(dx) / 23), 2.2)
      const bv = Math.exp(-((dx / 1.3) ** 2)) * Math.pow(Math.max(0, 1 - Math.abs(dy) / 23), 2.2)
      o[1] = Math.min(1, bh + bv + Math.exp(-((r / 3.2) ** 2)) + 0.25 * Math.exp(-((r / 8) ** 2)))
    }),
  /** Tufo de névoa de borda irregular. */
  nevoa: () =>
    criarForma(64, 64, (x, y, o) => {
      const dx = x - 32
      const dy = y - 32
      const r = Math.hypot(dx, dy) / 32
      const f = Math.atan2(dy, dx)
      const borda = 0.8 + 0.08 * Math.sin(3 * f + 1.3) + 0.06 * Math.sin(5 * f + 0.4) + 0.04 * Math.sin(9 * f + 2.1)
      const miolo = 0.82 + 0.18 * Math.sin(x * 0.33 + 2 * Math.sin(y * 0.21)) * Math.sin(y * 0.29 + 1.1)
      o[1] = (1 - liso(0.3, borda, r)) * miolo * (1 - liso(0.9, 1, r))
    }),
  /** O brilho: anel com pico em 1,05 raio da ficha (a borda da textura é 1,75 raio). */
  anel: () =>
    criarForma(96, 96, (x, y, o) => {
      const p = Math.hypot(x - 48, y - 48) / 48
      const s = p < 0.6 ? 0.12 : 0.2
      o[1] = Math.exp(-(((p - 0.6) / s) ** 2)) * (1 - liso(0.86, 1, p))
    }),
} as const

export type NomeDaForma = keyof typeof DESENHO_DAS_FORMAS

const formasProntas = new Map<NomeDaForma, FormaDaAura>()

export function formaDaAura(nome: NomeDaForma): FormaDaAura {
  let forma = formasProntas.get(nome)
  if (forma === undefined) {
    forma = DESENHO_DAS_FORMAS[nome]()
    formasProntas.set(nome, forma)
  }
  return forma
}

/** Um pincel: a forma e a rampa que a pinta. O índice na lista é o `pincel` de cada item do quadro. */
export type PincelDaAura = readonly [forma: NomeDaForma, rampa: NomeDaRampa]

/** Os pincéis de cada aura, na ordem da página de prova. O 0 é sempre o brilho. */
export const PINCEIS_DA_AURA: Record<TipoDeAura, readonly PincelDaAura[]> = {
  'almas-roxas': [
    ['anel', 'almasBrilho'],
    ['ponto', 'almas'],
    ['alma', 'almas'],
    ['ponto', 'almasLuz'],
    ['nucleo', 'almasLuz'],
  ],
  'chamas-negras': [
    ['anel', 'negrasBrilho'],
    ['lingua', 'negrasBorda'],
    ['lingua', 'negrasMiolo'],
    ['nucleo', 'negrasBrasa'],
  ],
  'fogo-raios-roxos': [
    ['anel', 'misturaBrilho'],
    ['lingua', 'misturaCorpo'],
    ['lingua', 'misturaMiolo'],
    ['faixa', 'raioFaixa'],
    ['traco', 'raioNucleo'],
    ['nucleo', 'misturaFaisca'],
  ],
  fogo: [
    ['anel', 'fogoBrilho'],
    ['lingua', 'fogoCorpo'],
    ['lingua', 'fogoMiolo'],
    ['nucleo', 'fogoBrasa'],
  ],
  trevas: [
    ['anel', 'trevasBrilho'],
    ['nevoa', 'trevasNevoa'],
    ['nucleo', 'trevasLuz'],
  ],
  'eletrica-amarela': [
    ['anel', 'amarelaBrilho'],
    ['faixa', 'amarelaFaixa'],
    ['traco', 'amarelaNucleo'],
    ['nucleo', 'amarelaFaisca'],
  ],
  'eletrica-azul': [
    ['anel', 'azulBrilho'],
    ['faixa', 'azulFaixa'],
    ['traco', 'azulNucleo'],
    ['nucleo', 'azulFaisca'],
  ],
  vermelha: [
    ['anel', 'vermelhaBrilho'],
    ['espinho', 'vermelhaCorpo'],
    ['espinho', 'vermelhaMiolo'],
    ['traco', 'vermelhaRisco'],
  ],
  multicolorida: [
    ['anel', 'prismaBrilho'],
    ['fita', 'prisma'],
    ['traco', 'prismaLuz'],
    ['estrela', 'prismaFaisca'],
  ],
}

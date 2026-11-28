/**
 * As versões do CALDEIRÃO (lote L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; temas
 * Inferno e Bruxaria). A 1ª, o de hoje (o caldo de legumes), é o desenho de `MONTADORES` (`montarCaldeirao`).
 *
 * VERDE BORBULHANDO (id `verde`): o mesmo caldeirão, as mesmas pedras e o mesmo fogo de chão, com a brasa no verde da
 * chama de bruxaria (`comBrasaNoTom`, a mesma troca de tom do braseiro verde) e, no lugar do caldo, a POÇÃO verde que
 * acende fraco: as manchas que ela faz ao girar, as bolhas (abertas, em anel, e fechadas, de cúpula clara), a bolha
 * grande que estoura, a espuma na beira e as duas escorridas que transbordaram pelo bojo. A concha de madeira fica. O
 * id `verde` faz a luz do objeto (`lib/mobilia/corDaChama.ts`) sair no mesmo verde. As BOLHAS que sobem são do
 * animador `vapor` (`ANIMACAO_DO_CALDEIRAO_VERDE`, o pivô no meio da boca).
 *
 * Como, sem editar `caldeirao.ts`: o montador de hoje monta a cena inteira; daqui saem as peças do caldo (pela cor:
 * o caldo, os legumes, a espuma) e entram as da poção nas mesmas medidas da boca, com os PINOS da 3/4 delas (a regra
 * do caldeirão: as peças da boca sobem pela altura da boca, `caldeirao.ts:391`).
 */
import type { VersoesDesenhadas } from '.'
import type { Rgb } from '../../../ruido'
import type { AnimacaoDoMovel } from '../../../../lib/mobilia/animadores'
import { montarCaldeirao } from '../caldeirao'
import type { MontarMovel } from '../contexto'
import { anel, capsula, elipse, type Forma, type Ponto } from '../formas'
import { ruido, type MaterialDaPeca, type Peca, type Textura } from '../motor'
import { comBrasaNoTom } from './brasaNoTom'

// ---------- as medidas do caldeirão de hoje (`caldeirao.ts`: o mesmo desenho, frações do menor meio lado) ----------

/** O bojo recua 0,05 da meia pegada; a boca, mais 0,036 do menor meio lado; o caldo tem 0,615 do raio do bojo (0,66). */
const RECUO_DO_BOJO = 0.05
const RECUO_DA_BOCA = 0.036
const RAIO_DO_BOJO = 0.66
const RAIO_DO_CALDO = 0.615
/** A boca sobe 0,44 do menor lado na 3/4; o pino tem 0,004 do menor meio lado. */
const ALTURA_DA_BOCA = 0.44
const RAIO_DO_PINO = 0.004
/** A casa de partida (28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIA_CASA = 28

/** As cores do caldo de hoje, que saem: o caldo, a cenoura, a batata, a couve e a espuma. */
const CORES_DO_CALDO: readonly Rgb[] = [
  [0x9c, 0x6e, 0x44],
  [0xc4, 0x86, 0x54],
  [0xd9, 0xc6, 0x98],
  [0x7c, 0x93, 0x58],
  [0xe2, 0xcf, 0xa8],
]

// ---------- a poção ----------

const POCAO_FUNDA: Rgb = [0x3c, 0x5e, 0x30]
const POCAO: Rgb = [0x5e, 0x8a, 0x44]
const POCAO_CLARA: Rgb = [0xa4, 0xc8, 0x7c]
const ESPUMA_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0xd0, 0xe4, 0xb0] }
const BOLHA: MaterialDaPeca = { classe: 'liso', rgb: [0xbc, 0xd8, 0x96] }
const ESCORRIDA: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x96, 0x4c] }

/** As bolhas abertas (anel) e fechadas (cúpula): x e y em fração do raio do caldo, e o raio (px da casa de partida). */
const BOLHAS_ABERTAS: readonly (readonly [number, number, number])[] = [
  [-0.42, -0.38, 1.5],
  [0.38, 0.12, 1.1],
  [-0.2, 0.5, 1.3],
  [0.56, -0.44, 0.9],
  [-0.66, 0.12, 0.8],
]
const BOLHAS_FECHADAS: readonly (readonly [number, number, number])[] = [
  [0.12, -0.52, 1.4],
  [-0.5, 0.42, 1],
  [0.6, 0.36, 1.2],
  [-0.06, 0.2, 0.9],
  [0.32, -0.16, 0.7],
  [-0.74, -0.3, 0.8],
]
/** A bolha grande que estoura: o meio (fração do raio do caldo) e o raio dela. */
const ESTOURO = { x: 0.18, y: -0.08, r: 2.6 }
/** As escorridas que transbordaram: o ângulo na beira do beiço (graus, 90 = a frente) e o comprimento (px). */
const ESCORRIDAS: readonly (readonly [number, number])[] = [
  [62, 5.2],
  [128, 3.6],
]

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function entre(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function mesmaCor(a: Rgb, b: Rgb): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

/** A peça é do caldo de hoje (sai)? Pela cor, e só as lisas: o ferro, a lenha e a pedra não são. */
function ehDoCaldo(p: Peca): boolean {
  return p.mat.classe === 'liso' && CORES_DO_CALDO.some((cor) => mesmaCor(cor, p.mat.rgb))
}

/** A poção: as manchas tortas de quem girou a concha, mais clara no meio, e acende fraco (a luz verde de dentro). */
function texPocao(cx: number, cy: number, rx: number, ry: number, k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const xs = x / k
    const ys = y / k
    const rr = Math.min(1, Math.hypot((x - cx) / rx, (y - cy) / ry))
    const torto = ruido(xs * 0.11 + 5, ys * 0.11) * 4
    const mancha = ruido(xs * 0.26 + torto, ys * 0.26 - torto)
    const t = limitar(0.55 + mancha * 0.35 + (0.5 - rr) * 0.35, 0, 1)
    const cor = t < 0.5 ? entre(POCAO_FUNDA, POCAO, t / 0.5) : entre(POCAO, POCAO_CLARA, (t - 0.5) / 0.5)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 0.45 + 0.25 * (1 - rr)
  }
}

/** A peça acende: a cor dela não pega luz nem sombra (`forca` de 0 a 1). */
function texAcesa(forca: number): Textura {
  return (_u, _v, _x, _y, _p, s) => {
    s[4] = forca
  }
}

function meioDaPeca(p: Peca): Ponto {
  const b = p.forma.b
  return [(b[0] + b[2]) / 2 + p.dx, (b[1] + b[3]) / 2 + p.dy]
}

/** Os pinos de uma altura: um disco de raio `r` em cada ponto, numa forma só (o molde de `caldeirao.ts`). */
function pinos(pontos: readonly Ponto[], r: number): Forma {
  const xs = pontos.map(([x]) => x)
  const ys = pontos.map(([, y]) => y)
  return {
    b: [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r],
    d(x, y) {
      let menor = Infinity
      for (const [px, py] of pontos) menor = Math.min(menor, (x - px) * (x - px) + (y - py) * (y - py))
      return Math.sqrt(menor) - r
    },
  }
}

/** A brasa do fogo de chão no verde da chama de bruxaria (só o que emite muda: o ferro, a cinza e a pedra ficam). */
const caldeiraoComBrasaVerde = comBrasaNoTom(montarCaldeirao, 'verde')

/** VERDE BORBULHANDO: o caldeirão de hoje com a brasa verde e a poção no lugar do caldo. */
const montarCaldeiraoVerde: MontarMovel = (c, cena) => {
  caldeiraoComBrasaVerde(c, cena)
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / MEIA_CASA
  const rx = RAIO_DO_BOJO * hw
  const ry = RAIO_DO_BOJO * hh
  const yBoca = -RECUO_DO_BOJO * hh - RECUO_DA_BOCA * R
  const cx = rx * RAIO_DO_CALDO
  const cy = ry * RAIO_DO_CALDO
  // Sai o caldo de hoje (a cuia da concha, que é caldo, também: entra a poção no lugar dela).
  const ficam = cena.partes.filter((p) => !ehDoCaldo(p))
  const indiceDaConcha = ficam.findIndex((p) => p.mat.classe === 'madeira' && p.forma.b[1] > yBoca - cy)
  const pocao: Peca[] = []
  pocao.push(P(elipse(0, yBoca, cx, cy), { classe: 'liso', rgb: POCAO }, { bisel: 0, contorno: 0.12, textura: texPocao(0, yBoca, cx, cy, k), recesso: { k: 2.2 * k, forca: 0.4 }, semente: 3903 }))
  pocao.push(P(anel(0, yBoca, cx, cy, cx * 0.9, cy * 0.9), ESPUMA_VERDE, { bisel: 0, contorno: 0, alfa: 0.4, suave: 0.8 * k, textura: texAcesa(0.5), semente: 3904 }))
  BOLHAS_ABERTAS.forEach(([fx, fy, raio], i) => {
    const r = raio * k
    pocao.push(P(anel(fx * cx, yBoca + fy * cy, r, r, r - 0.42 * k, r - 0.42 * k), BOLHA, { bisel: 0, contorno: 0, alfa: 0.8, textura: texAcesa(0.6), semente: 3910 + i }))
  })
  BOLHAS_FECHADAS.forEach(([fx, fy, raio], i) => {
    const r = raio * k
    const [x, y] = [fx * cx, yBoca + fy * cy]
    pocao.push(P(elipse(x, y, r, r), BOLHA, { bisel: r * 0.8, contorno: 0.18, alfa: 0.92, textura: texAcesa(0.45), semente: 3920 + i, projeta: { dist: 0.4 * k, forca: 0.2 } }))
    pocao.push(P(elipse(x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.26), ESPUMA_VERDE, { bisel: 0, contorno: 0, alfa: 0.85, textura: texAcesa(0.7), semente: 3930 + i }))
  })
  const [ex, ey] = [ESTOURO.x * cx, yBoca + ESTOURO.y * cy]
  const re = ESTOURO.r * k
  pocao.push(P(anel(ex, ey, re, re * 0.92, re - 0.5 * k, (re - 0.5 * k) * 0.92), ESPUMA_VERDE, { bisel: 0, contorno: 0, alfa: 0.75, textura: texAcesa(0.7), semente: 3940 }))
  for (const [i, a] of [20, 110, 200, 290].entries()) {
    const g = (a * Math.PI) / 180
    pocao.push(P(elipse(ex + Math.cos(g) * re * 1.5, ey + Math.sin(g) * re * 1.4, 0.4 * k, 0.4 * k), ESPUMA_VERDE, { bisel: 0, contorno: 0, alfa: 0.8, textura: texAcesa(0.7), semente: 3941 + i }))
  }
  // As escorridas pelo bojo (no ferro, embaixo da boca: o caldeirão as cobre de cima, a 3/4 mostra na barriga).
  const escorridas: Peca[] = ESCORRIDAS.map(([graus, comprido], i) => {
    const g = (graus * Math.PI) / 180
    const [x0, y0] = [Math.cos(g) * rx * 0.76, yBoca + Math.sin(g) * ry * 0.76]
    return P(capsula(x0, y0, x0 + 0.3 * k, y0 + comprido * k, 0.7 * k), ESCORRIDA, { bisel: 0.5 * k, contorno: 0.2, alfa: 0.9, textura: texAcesa(0.4), semente: 3950 + i })
  })
  const antes = indiceDaConcha < 0 ? ficam.length : indiceDaConcha
  cena.partes.splice(0, cena.partes.length, ...ficam.slice(0, antes), ...pocao, ...escorridas, ...ficam.slice(antes))
  cena.sombras.push({ forma: pinos([...pocao, ...escorridas].map(meioDaPeca), RAIO_DO_PINO * R), z: 2 * R * ALTURA_DA_BOCA, solta: true, forca: 0 })
}

export const versoesDoCaldeirao: VersoesDesenhadas = {
  verde: montarCaldeiraoVerde,
}

/** As bolhas e o vapor verde sobem do meio da boca (um nada atrás do meio da pegada): um fio a cada 2,2 s. */
export const ANIMACAO_DO_CALDEIRAO_VERDE: AnimacaoDoMovel = {
  animador: 'vapor',
  pivo: { x: 0.5, y: 0.5 - (RECUO_DO_BOJO * 0.5 + RECUO_DA_BOCA * 0.5) },
  periodoMs: 2200,
}

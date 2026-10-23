/**
 * SEBE de cima com volume (peça nova da MT5): desenho original inspirado na
 * sebe do Estilo Mother da vila (`docs/design/vila-estilo-mother/prototipo/
 * mother.js`, `sebe`): uma fileira de copinhas redondas de folha, as do lado da
 * luz por cima, sobre um miolo de folha mais escura que fecha os vãos, e umas
 * florzinhas. Material: `folhas` (buxo ou alfeneiro); as flores são fixas.
 *
 * A geometria é a da CERCA (`geometriaDaCerca` de `lib/mobilia.ts`): o eixo
 * pela reta ou pelo ARCO da sebe curva, com as pontas onde a cerca põe os
 * mourões das pontas. As copinhas se repartem pelo comprimento do arco a ~0,36
 * da espessura, então a sebe esticada ganha mais copinhas, nunca copinhas
 * esticadas, e a seleção e o clique (que leem a mesma faixa) caem em cima do
 * desenho. A sebe longa sai em ladrilhos (`pixi/rasterDosMoveis.ts`), como a cerca.
 */
import { geometriaDaCerca } from '../../../lib/mobilia'
import { hash, rgb } from '../../ruido'
import type { StairArc } from '../../../lib/stairCurve'
import { capsula, elipse, type Forma, type Ponto } from './formas'
import { contato, texFolhagem, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** Altura da sebe em casas (a sombra no chão). */
const ALTURA_DA_SEBE = 0.55
/** Passo entre copinhas e o raio delas, em fração da espessura (`mother.js`: 8 px e 6 a 8,2 px numa sebe de 22). */
const PASSO_DAS_COPAS = 0.36
const RAIO_MINIMO = 0.3
const RAIO_VARIA = 0.07
/** Quanto a copinha sai do eixo para cada lado (fração da espessura). */
const DESVIO = 0.055
/** O miolo escuro que fecha os vãos entre as copinhas (meia espessura dele, em fração da espessura). */
const MIOLO = 0.3

/** Flores fixas, tons contidos da vila (saturação HSV até 0,48). */
const FLORES: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: rgb('#ece6d6') },
  { classe: 'liso', rgb: rgb('#d49ab4') },
  { classe: 'liso', rgb: rgb('#d8c070') },
]
const MIOLO_DA_FLOR: MaterialDaPeca = { classe: 'liso', rgb: rgb('#c9a24f') }

/** Luz de cima à esquerda, no chão: a copinha mais deste lado vai por cima. */
const LUZ_X = -0.79
const LUZ_Y = -0.61

/**
 * A faixa de raio `r` em volta do eixo: a cápsula na sebe reta e, na curva, a
 * distância exata ao ARCO (|distância ao centro - raio|, e as pontas como
 * círculos). Uma conta por pixel: a `cadeia` dos pontos das copinhas olhava os
 * ~22 pedaços em cada pixel da caixa inteira (o miolo vazio do arco incluso) e
 * a sebe curva de 4 casas levava ~160 ms a 3x.
 */
function faixa(eixo: readonly Ponto[], arco: StairArc | null, r: number): Forma {
  const [ax, ay] = eixo[0]
  const [bx, by] = eixo[eixo.length - 1]
  if (arco === null) return capsula(ax, ay, bx, by, r)
  const { x: cx, y: cy } = arco.center
  const R = arco.radius
  const inicio = arco.startAngle
  const giro = Math.abs(arco.sweep)
  const sentido = Math.sign(arco.sweep) || 1
  const volta = Math.PI * 2
  const xs = eixo.map(([x]) => x)
  const ys = eixo.map(([, y]) => y)
  // O arco passa um pouco por fora da corda entre dois pontos vizinhos do eixo.
  const folga = r + R * (1 - Math.cos(giro / (eixo.length - 1) / 2)) + 0.5
  return {
    b: [Math.min(...xs) - folga, Math.min(...ys) - folga, Math.max(...xs) + folga, Math.max(...ys) + folga],
    d(x, y) {
      const rel = ((((Math.atan2(y - cy, x - cx) - inicio) * sentido) % volta) + volta) % volta
      if (rel <= giro) return Math.abs(Math.hypot(x - cx, y - cy) - R) - r
      return Math.min(Math.hypot(x - ax, y - ay), Math.hypot(x - bx, y - by)) - r
    },
  }
}

interface Copa {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly i: number
}

export const montarSebe: MontarMovel = (c, cena) => {
  const geometria = geometriaDaCerca(c.w, c.h, c.curva)
  if (geometria === null) return
  const esp = Math.min(c.w, c.h)
  const primeiro = geometria.mouroes[0]
  const ultimo = geometria.mouroes[geometria.mouroes.length - 1]
  const arco = geometria.arco
  const comprimento = arco === null ? Math.hypot(ultimo.x - primeiro.x, ultimo.y - primeiro.y) : arco.radius * Math.abs(arco.sweep)
  const n = Math.max(2, Math.round(comprimento / (PASSO_DAS_COPAS * esp)))
  // Variação por sebe (não por pixel): o tamanho entra, então duas sebes do mesmo tamanho são iguais.
  const sorteio = Math.round(c.w + 7 * c.h)
  const eixo: Ponto[] = []
  const copas: Copa[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    let x: number
    let y: number
    let nx: number
    let ny: number
    if (arco === null) {
      x = primeiro.x + (ultimo.x - primeiro.x) * t
      y = primeiro.y + (ultimo.y - primeiro.y) * t
      const l = comprimento || 1
      nx = -(ultimo.y - primeiro.y) / l
      ny = (ultimo.x - primeiro.x) / l
    } else {
      const a = arco.startAngle + arco.sweep * t
      nx = Math.cos(a)
      ny = Math.sin(a)
      x = arco.center.x + nx * arco.radius
      y = arco.center.y + ny * arco.radius
    }
    eixo.push([x, y])
    const desvio = (hash(i, sorteio, 17) - 0.5) * 2 * DESVIO * esp
    copas.push({ x: x + nx * desvio, y: y + ny * desvio, r: esp * (RAIO_MINIMO + RAIO_VARIA * hash(i, sorteio, 18)), i })
  }
  const corpo = faixa(eixo, arco, MIOLO * esp)
  // Sombra SOLTA (sem as amostras arrastadas do pé até a ponta): a sebe é uma massa fechada que
  // cobre o próprio pé, e o contato escurece a base. Arrastada, a sombra lia a forma até 1 + n vezes
  // por pixel e a sebe curva de 4 casas levava ~120 ms só de sombra a 3x.
  cena.sombras.push({ forma: faixa(eixo, arco, 0.4 * esp), z: c.g * ALTURA_DA_SEBE, solta: true }, contato(corpo, 0.26))
  const P = c.peca
  const folhas = c.m.folhas
  cena.partes.push(P(corpo, folhas, { textura: texFolhagem, bisel: 0.25 * esp, contorno: 0.24, tom: 0.7, semente: 30 }))
  // As do lado da luz por último (por cima), como a folhagem do protótipo.
  const ordem = [...copas].sort((a, b) => a.x * LUZ_X + a.y * LUZ_Y - (b.x * LUZ_X + b.y * LUZ_Y))
  for (const copa of ordem) {
    cena.partes.push(P(elipse(copa.x, copa.y, copa.r, copa.r), folhas, { textura: texFolhagem, bisel: copa.r * 0.85, contorno: 0.2, tom: 0.9 + 0.14 * hash(copa.i, sorteio, 19), semente: 40 + copa.i }))
  }
  for (const copa of copas) {
    if (hash(copa.i, sorteio, 21) >= 0.3) continue
    const fr = 0.075 * esp
    const fx = copa.x - copa.r * 0.3
    const fy = copa.y - copa.r * 0.3
    cena.partes.push(P(elipse(fx, fy, fr, fr), FLORES[copa.i % FLORES.length], { bisel: fr * 0.7, contorno: 0.14, semente: 70 + copa.i }))
    cena.partes.push(P(elipse(fx, fy, fr * 0.38, fr * 0.38), MIOLO_DA_FLOR, { bisel: 0, contorno: 0, semente: 80 + copa.i }))
  }
}

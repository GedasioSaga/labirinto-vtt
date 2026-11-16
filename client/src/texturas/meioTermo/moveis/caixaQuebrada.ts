/**
 * CAIXA QUEBRADA (16/11/2026, depois do barril quebrado): a MESMA caixa de `caixa.ts` (o caixote de pinho com a
 * moldura de 4 tábuas, as tábuas afundadas no meio, o X das ripas e um prego em cada canto), arrombada no
 * minigame. Antes ela virava os destroços de madeira, a pilha genérica de vigas e tábuas, sem o X nem a moldura
 * e chata na 3/4.
 *
 * O CAIXOTE ficou no lugar, aberto: as paredes partidas cada uma numa altura (a de trás quase inteira, a da
 * esquerda descendo para a frente, a da direita baixa e arrancada na frente, a da frente só um toco à esquerda)
 * e três dos quatro pilaretes dos cantos. A quebra de cima mostra a madeira de dentro, clara, e a ponta de cada
 * parede que acabou é lascada. Dentro, o fundo de tábuas, a PALHA do recheio (a do feno) e o pedaço de cima da
 * TAMPA, caído por cima dela.
 *
 * NO CHÃO: o pedaço de baixo da tampa (a moldura do canto, o prego e o pé do X) deslizou pela frente arrombada;
 * o pedaço de cima da parede da direita (a moldura, o prego e o pé da diagonal) caiu à direita; uma tábua da
 * moldura atrás, outra à esquerda e um pilarete no canto; a palha vazou pelo rombo da direita; lascas em volta.
 *
 * O TAMANHO: o caixote tem o tamanho da caixa (0,8 casa) e a caixa quebrada ocupa 1,2 casa, onde os pedaços se
 * espalham em volta, como os cacos do barril quebrado; o minigame a põe no centro da caixa
 * (`lib/conteudoDoObjeto.ts`). As medidas saem de frações da meia pegada: esticada, a caixa estica junto.
 *
 * A 3/4 é a `derivado` (`tresQuartos.ts`), como a da caixa: cada trecho de parede e cada pilarete é uma coluna
 * com a altura dele (a frente varrida sai da madeira dele) e os pedaços do chão são colunas baixas, da grossura
 * da tábua. O fundo, a palha e a tampa de dentro não fazem coluna: ficam no chão, atrás do toco da frente.
 *
 * Material: `madeira` (o da caixa, pinho de partida). A palha e a madeira de dentro (o cerne) são fixas.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { barra, caixa, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Peca } from './motor'
import { PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { texMonte } from './feno'

/** O caixote em frações da meia pegada: a caixa (0,8 casa, `TAMANHO_EM_CASAS` de `mobilia.ts`) na quebrada (1,2). */
const CAIXOTE = 0.8 / 1.2
/** A altura da caixa inteira, em casas (a de `caixa.ts`): a parede da caixa é o lado dela por esta altura. */
const ALTURA_DA_CAIXA = 0.5
/** A largura da moldura, em fração do lado da placa (a de `caixa.ts`). */
const MOLDURA = 0.17
/** A grossura da parede vista de cima e o lado do pilarete, em frações da moldura da tampa. */
const PAREDE = 0.45
const PILARETE = 0.8
/** A madeira de dentro, na quebra: o cerne claro dos destroços (`destrocos.ts`). */
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
const QUANTO_DE_CERNE = 0.6
/** A palha do recheio: a do barril quebrado (o amarelo contido do feno). */
const PALHA: MaterialDaPeca = { classe: 'palha', rgb: [0xc4, 0xa7, 0x69] }
/** O fundo do caixote, na sombra das paredes. */
const TOM_DO_FUNDO = 0.74
/** Dentes de uma beirada lascada, por px de beirada, e o fundo deles em px. */
const DENTES_POR_PX = 0.32
const FUNDO_DO_DENTE = 2.2

type Lado = 'n' | 'o' | 'l' | 's'

/** Um trecho de parede que ficou de pé: de `t0` a `t1` ao longo dela (do canto de trás ou da esquerda) e a altura em casas. */
interface Trecho {
  readonly t0: number
  readonly t1: number
  readonly z: number
}

interface Parede {
  readonly lado: Lado
  readonly trechos: readonly Trecho[]
  /** A parede acaba no último trecho, lascada (o resto foi arrancado). */
  readonly arrancada: boolean
}

/** As paredes: a de trás quase inteira; a da esquerda desce para a frente; a da direita e a da frente foram arrancadas. */
const PAREDES: readonly Parede[] = [
  { lado: 'n', trechos: [{ t0: 0, t1: 0.38, z: 0.46 }, { t0: 0.38, t1: 0.72, z: 0.4 }, { t0: 0.72, t1: 1, z: 0.33 }], arrancada: false },
  { lado: 'o', trechos: [{ t0: 0, t1: 0.42, z: 0.42 }, { t0: 0.42, t1: 0.76, z: 0.29 }, { t0: 0.76, t1: 1, z: 0.19 }], arrancada: false },
  { lado: 'l', trechos: [{ t0: 0, t1: 0.44, z: 0.31 }, { t0: 0.44, t1: 0.66, z: 0.2 }], arrancada: true },
  { lado: 's', trechos: [{ t0: 0, t1: 0.34, z: 0.13 }], arrancada: true },
]

/** Os pilaretes que ficaram (o da frente à direita voou): o canto (sinal de x e de y) e a altura em casas. */
const PILARETES: readonly (readonly [number, number, number])[] = [
  [-1, -1, ALTURA_DA_CAIXA],
  [1, -1, 0.42],
  [-1, 1, 0.22],
]

type Beirada = 'cima' | 'baixo' | 'esquerda' | 'direita'

/**
 * Um pedaço de placa do caixote no chão (ou caído dentro dele): a tampa (o quadrado da caixa) ou a parede (o
 * lado da caixa pela altura dela), com a moldura, as tábuas, o X e os pregos de `caixa.ts`.
 */
interface Pedaco {
  /** O meio, em frações da meia pegada, e o giro (rad). */
  readonly x: number
  readonly y: number
  readonly ang: number
  readonly placa: 'tampa' | 'parede'
  /** O pedaço da placa, em frações dos meios lados dela (-1 a 1). */
  readonly u0: number
  readonly u1: number
  readonly v0: number
  readonly v1: number
  /** As beiradas quebradas (lascadas); as outras são as da placa inteira. */
  readonly quebras: readonly Beirada[]
  /** A altura da coluna, em casas: 0 = sem coluna (dentro do caixote, no chão da 3/4). */
  readonly z: number
  readonly semente: number
}

/** Na ordem do desenho: o de dentro, o da parede à direita e o da tampa na frente, por cima da palha que vazou. */
const PEDACOS: readonly Pedaco[] = [
  { x: -0.12, y: -0.06, ang: 0.52, placa: 'tampa', u0: -1, u1: 0.2, v0: -1, v1: -0.3, quebras: ['baixo', 'direita'], z: 0, semente: 40 },
  { x: 0.835, y: -0.2, ang: 1.62, placa: 'parede', u0: -0.1, u1: 1, v0: -1, v1: -0.3, quebras: ['esquerda', 'baixo'], z: 0.06, semente: 60 },
  { x: 0.42, y: 0.68, ang: -0.18, placa: 'tampa', u0: -0.5, u1: 1, v0: 0.31, v1: 1, quebras: ['cima', 'esquerda'], z: 0.07, semente: 80 },
]

/** Uma tábua solta no chão: o meio (frações da meia pegada), o comprimento (fração da meia largura), a largura em molduras, o giro, as pontas e a grossura em casas. */
interface TabuaSolta {
  readonly x: number
  readonly y: number
  readonly comp: number
  readonly larg: number
  readonly ang: number
  readonly lascadas: readonly [boolean, boolean]
  readonly z: number
}

/** Uma tábua da moldura atrás, outra à esquerda e o pilarete que voou, no canto de trás à esquerda. */
const TABUAS_SOLTAS: readonly TabuaSolta[] = [
  { x: 0.05, y: -0.855, comp: 1.15, larg: 0.75, ang: 0.1, lascadas: [true, false], z: 0.05 },
  { x: -0.86, y: 0.3, comp: 0.62, larg: 0.7, ang: 1.75, lascadas: [true, true], z: 0.05 },
  { x: -0.8, y: -0.8, comp: 0.36, larg: PILARETE, ang: -0.75, lascadas: [true, false], z: 0.11 },
]

/** As lascas soltas: o meio (frações da meia pegada), o comprimento (fração da meia largura) e o ângulo. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [-0.95, -0.55, 0.11, 0.5],
  [0.85, -0.82, 0.1, -0.3],
  [0.95, 0.3, 0.09, 1.4],
  [-0.35, 0.95, 0.1, 0.2],
  [-0.93, 0.8, 0.09, -1.0],
]

/** A palha que vazou pelo rombo da direita (meio em frações da meia pegada, raio em frações da meia largura) e um tufo na frente. */
const PALHA_DE_FORA: readonly (readonly [number, number, number])[] = [
  [0.8, 0.27, 0.23],
  [-0.5, 0.9, 0.08],
]

function quebraDe(mad: MaterialDaPeca): MaterialDaPeca {
  return { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
}

/** Mancha irregular (a palha): `n` pontos em volta do meio, o raio tremido pela semente. */
function mancha(cx: number, cy: number, rx: number, ry: number, semente: number, n = 14): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const a = (2 * Math.PI * i) / n
    const r = 0.78 + 0.3 * hash(i, 7, semente)
    pontos.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r])
  }
  return poligono(pontos)
}

/** Os pontos de uma beirada de `a` a `b`; lascada, em dentes que entram para o lado de `dentro` (vetor unitário). */
function beirada(a: Ponto, b: Ponto, lascada: boolean, dentro: Ponto, semente: number): Ponto[] {
  if (!lascada) return [a]
  const comp = Math.hypot(b[0] - a[0], b[1] - a[1])
  const dentes = Math.max(2, Math.round(comp * DENTES_POR_PX))
  const pontos: Ponto[] = [a]
  for (let k = 1; k < dentes * 2; k += 1) {
    const t = k / (dentes * 2)
    const entra = k % 2 === 1 ? 0.35 + 0.65 * hash(k, semente, 71) : 0.15 * hash(k, semente, 72)
    pontos.push([a[0] + (b[0] - a[0]) * t + dentro[0] * FUNDO_DO_DENTE * entra, a[1] + (b[1] - a[1]) * t + dentro[1] * FUNDO_DO_DENTE * entra])
  }
  return pontos
}

/** Um pedaço de placa: as peças de `caixa.ts` no referencial dela, recortadas pelo pedaço e levadas ao lugar. */
function montarPedaco(c: ContextoDoMovel, cena: Cena, L: Peca[], p: Pedaco, mad: MaterialDaPeca): void {
  const P = c.peca
  const A = p.placa === 'tampa' ? CAIXOTE * c.hw : CAIXOTE * c.hh
  const B = p.placa === 'tampa' ? CAIXOTE * c.hh : (c.g * ALTURA_DA_CAIXA) / 2
  const fu0 = p.u0 * A
  const fu1 = p.u1 * A
  const fv0 = p.v0 * B
  const fv1 = p.v1 * B
  const mu = (fu0 + fu1) / 2
  const mv = (fv0 + fv1) / 2
  const co = Math.cos(p.ang)
  const si = Math.sin(p.ang)
  const ox = p.x * c.hw
  const oy = p.y * c.hh
  const noMapa = ([u, v]: Ponto): Ponto => [ox + (u - mu) * co - (v - mv) * si, oy + (u - mu) * si + (v - mv) * co]
  const quebrada = (b: Beirada): boolean => p.quebras.includes(b)
  const contornoLocal = [
    ...beirada([fu0, fv0], [fu1, fv0], quebrada('cima'), [0, 1], p.semente + 1),
    ...beirada([fu1, fv0], [fu1, fv1], quebrada('direita'), [-1, 0], p.semente + 2),
    ...beirada([fu1, fv1], [fu0, fv1], quebrada('baixo'), [0, -1], p.semente + 3),
    ...beirada([fu0, fv1], [fu0, fv0], quebrada('esquerda'), [1, 0], p.semente + 4),
  ]
  const contorno = poligono(contornoLocal.map(noMapa))
  if (p.z > 0) cena.sombras.push({ forma: contorno, z: c.g * p.z, forca: 0.26 }, contato(contorno, 0.26))
  // A peça entra recortada pelo pedaço, se cruza com ele (o que fica de fora não é desenhado).
  const cruza = (x0: number, y0: number, x1: number, y1: number): boolean => x1 > fu0 && x0 < fu1 && y1 > fv0 && y0 < fv1
  const projeta = p.z === 0 ? { dist: 1.6, forca: 0.36, suave: 1 } : undefined
  const por = (forma: Forma, o: OpcoesDaPeca): void => {
    L.push(P(dentroDe(forma, contorno), mad, { ...o, projeta: o.projeta ?? projeta }))
  }
  const retangulo = (x0: number, y0: number, x1: number, y1: number): Forma => poligono(([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Ponto[]).map(noMapa))
  const m = Math.min(2 * A, 2 * B) * MOLDURA
  const ix0 = -A + m
  const iy0 = -B + m
  const ix1 = A - m
  const iy1 = B - m
  const s = p.semente
  if (cruza(ix0, iy0, ix1, iy1)) {
    por(retangulo(Math.max(ix0, fu0 - 3), Math.max(iy0, fv0 - 3), Math.min(ix1, fu1 + 3), Math.min(iy1, fv1 + 3)), {
      eixo: p.ang,
      tabua: (iy1 - iy0) / 3,
      bisel: 0.5,
      recesso: { k: 2, forca: 0.34 },
      tom: 0.9,
      semente: s,
    })
    const larg = m * 0.9
    const a1 = Math.atan2(iy1 - iy0, ix1 - ix0)
    const dentro = retangulo(ix0, iy0, ix1, iy1)
    // Cada ripa do X só entra se passa pelo pedaço (a outra ficou no outro pedaço).
    const ripaCruza = (a: Ponto, b: Ponto): boolean => {
      for (let i = 0; i <= 24; i += 1) {
        const u = a[0] + ((b[0] - a[0]) * i) / 24
        const v = a[1] + ((b[1] - a[1]) * i) / 24
        if (u > fu0 + 1 && u < fu1 - 1 && v > fv0 + 1 && v < fv1 - 1) return true
      }
      return false
    }
    // As duas fazem sombra nas tábuas (na caixa inteira só a de cima precisa): no pedaço, a ripa às vezes vem sozinha.
    const ripas: readonly (readonly [Ponto, Ponto, number, OpcoesDaPeca['projeta']])[] = [
      [[ix0, iy0], [ix1, iy1], a1, { dist: 1.1, forca: 0.34, suave: 0.7 }],
      [[ix1, iy0], [ix0, iy1], Math.PI - a1, { dist: 1.1, forca: 0.3, suave: 0.7 }],
    ]
    ripas.forEach(([a, b, eixo, sombra], i) => {
      if (!ripaCruza(a, b)) return
      const [pa, pb] = [noMapa(a), noMapa(b)]
      L.push(P(dentroDe(dentroDe(barra(pa[0], pa[1], pb[0], pb[1], larg), dentro), contorno), mad, { eixo: eixo + p.ang, tabua: 0, bisel: 0.9, semente: s + 1 + i, projeta: sombra }))
    })
  }
  if (cruza(-A, -B, ix0, B)) por(retangulo(-A, Math.max(-B, fv0 - 3), ix0, Math.min(B, fv1 + 3)), { eixo: QUARTO + p.ang, tabua: 0, bisel: 1, semente: s + 3 })
  if (cruza(ix1, -B, A, B)) por(retangulo(ix1, Math.max(-B, fv0 - 3), A, Math.min(B, fv1 + 3)), { eixo: QUARTO + p.ang, tabua: 0, bisel: 1, semente: s + 4 })
  if (cruza(ix0, -B, ix1, iy0)) por(retangulo(Math.max(ix0, fu0 - 3), -B, Math.min(ix1, fu1 + 3), iy0), { eixo: p.ang, tabua: 0, bisel: 1, semente: s + 5 })
  if (cruza(ix0, iy1, ix1, B)) por(retangulo(Math.max(ix0, fu0 - 3), iy1, Math.min(ix1, fu1 + 3), B), { eixo: p.ang, tabua: 0, bisel: 1, semente: s + 6 })
  for (const [pu, pv] of [[-A + m / 2, -B + m / 2], [A - m / 2, -B + m / 2], [-A + m / 2, B - m / 2], [A - m / 2, B - m / 2]] as const) {
    if (pu < fu0 + 1 || pu > fu1 - 1 || pv < fv0 + 1 || pv > fv1 - 1) continue
    const [px, py] = noMapa([pu, pv])
    L.push(P(elipse(px, py, 0.6, 0.6), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 }))
  }
  // A quebra mostra a madeira de dentro: a faixa da beirada lascada, só no fundo dos dentes (clareia as fibras).
  const quebra = quebraDe(mad)
  const faixas: readonly (readonly [Beirada, number, number, number, number])[] = [
    ['cima', fu0, fv0 - 1, fu1, fv0 + FUNDO_DO_DENTE * 0.9],
    ['baixo', fu0, fv1 - FUNDO_DO_DENTE * 0.9, fu1, fv1 + 1],
    ['esquerda', fu0 - 1, fv0, fu0 + FUNDO_DO_DENTE * 0.9, fv1],
    ['direita', fu1 - FUNDO_DO_DENTE * 0.9, fv0, fu1 + 1, fv1],
  ]
  faixas.forEach(([b, x0, y0, x1, y1], k) => {
    if (quebrada(b)) L.push(P(dentroDe(retangulo(x0, y0, x1, y1), contorno), quebra, { eixo: p.ang, tabua: 0, bisel: 0.4, contorno: 0.16, semente: s + 10 + k }))
  })
}

/** O retângulo do trecho de parede, de cima: a parede vai de pilarete a pilarete, com a grossura `e`. */
function retanguloDoTrecho(lado: Lado, t0: number, t1: number, bx: number, by: number, e: number, ps: number): [number, number, number, number] {
  const deX = (t: number): number => -bx + ps + t * (2 * bx - 2 * ps)
  const deY = (t: number): number => -by + ps + t * (2 * by - 2 * ps)
  if (lado === 'n') return [deX(t0), -by, deX(t1), -by + e]
  if (lado === 's') return [deX(t0), by - e, deX(t1), by]
  if (lado === 'o') return [-bx, deY(t0), -bx + e, deY(t1)]
  return [bx - e, deY(t0), bx, deY(t1)]
}

/** O trecho de parede de pé: a borda de cima com a quebra clara, a coluna com a altura dele e, no fim arrancado, a ponta lascada. */
function montarTrecho(c: ContextoDoMovel, cena: Cena, L: Peca[], lado: Lado, t: Trecho, lascado: boolean, mad: MaterialDaPeca, k: number): void {
  const P = c.peca
  const bx = CAIXOTE * c.hw
  const by = CAIXOTE * c.hh
  const m = Math.min(2 * bx, 2 * by) * MOLDURA
  const e = m * PAREDE
  const ps = m * PILARETE
  const [x0, y0, x1, y1] = retanguloDoTrecho(lado, t.t0, t.t1, bx, by, e, ps)
  const deitada = lado === 'n' || lado === 's'
  // A ponta arrancada: a fibra de fora vai mais longe que a de dentro, em dentes.
  const pontos: Ponto[] = deitada
    ? [[x0, y0], [x1 + (lascado ? e * 0.5 : 0), y0], ...(lascado ? ([[x1 - e * 0.15, y0 + e * 0.4], [x1 + e * 0.35, y0 + e * 0.72], [x1 - e * 0.05, y1]] as Ponto[]) : ([[x1, y1]] as Ponto[])), [x0, y1]]
    : [[x0, y0], [x1, y0], ...(lascado ? ([[x1, y1 + e * 0.35], [x0 + e * 0.6, y1 - e * 0.15], [x0 + e * 0.28, y1 + e * 0.6]] as Ponto[]) : ([[x1, y1]] as Ponto[])), [x0, y1]]
  const forma = poligono(pontos)
  cena.sombras.push({ forma, z: c.g * t.z, forca: 0.3 }, contato(forma, 0.3))
  // As de trás e da esquerda fazem sombra para dentro, no fundo e na palha: a luz vem de cima à esquerda.
  const paraDentro = lado === 'n' || lado === 'o'
  const projeta = paraDentro ? { dist: 1.2 + c.g * t.z * 0.12, forca: 0.42, suave: 1.4 } : { dist: 0.9, forca: 0.28, suave: 0.8 }
  const eixo = deitada ? 0 : QUARTO
  L.push(P(forma, mad, { eixo, tabua: 0, bisel: 0.7, tom: 1.02, semente: 300 + k, projeta }))
  // A quebra de cima: o miolo da borda, claro (a parede inteira, a de 0,5 casa, não tem).
  const meio = e * 0.28
  const miolo = deitada ? caixa(x0 + 0.4, y0 + meio, x1 - 0.4, y1 - meio) : caixa(x0 + meio, y0 + 0.4, x1 - meio, y1 - 0.4)
  L.push(P(dentroDe(miolo, forma), quebraDe(mad), { eixo, tabua: 0, bisel: 0.3, contorno: 0, tom: 1, semente: 320 + k }))
}

/** O pilarete do canto: o quadrado de cima, com a quebra clara se não ficou inteiro. */
function montarPilarete(c: ContextoDoMovel, cena: Cena, L: Peca[], sx: number, sy: number, z: number, mad: MaterialDaPeca, k: number): void {
  const P = c.peca
  const bx = CAIXOTE * c.hw
  const by = CAIXOTE * c.hh
  const ps = Math.min(2 * bx, 2 * by) * MOLDURA * PILARETE
  const x0 = sx < 0 ? -bx : bx - ps
  const y0 = sy < 0 ? -by : by - ps
  const forma = caixa(x0, y0, x0 + ps, y0 + ps, 0.4)
  cena.sombras.push({ forma, z: c.g * z, forca: 0.3 }, contato(forma, 0.3))
  const projeta = { dist: 1.2 + c.g * z * 0.12, forca: 0.4, suave: 1.4 }
  L.push(P(forma, mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 1.04, semente: 340 + k, projeta }))
  if (z < ALTURA_DA_CAIXA) L.push(P(caixa(x0 + ps * 0.24, y0 + ps * 0.24, x0 + ps * 0.76, y0 + ps * 0.76, 0.5), quebraDe(mad), { tabua: 0, bisel: 0.4, contorno: 0, semente: 350 + k }))
}

/** A ponta da tábua solta no referencial dela: reta ou em dentes. `lado` = -1 a de trás, 1 a da frente. */
function pontaDaTabua(lascada: boolean, lado: -1 | 1, meioComp: number, meiaLarg: number, semente: number): Ponto[] {
  const x = lado * meioComp
  const fim: Ponto = [x, lado * meiaLarg]
  return [...beirada([x, -lado * meiaLarg], fim, lascada, [-lado, 0], semente), fim]
}

function montarTabuaSolta(c: ContextoDoMovel, cena: Cena, L: Peca[], t: TabuaSolta, mad: MaterialDaPeca, k: number): void {
  const P = c.peca
  const m = Math.min(2 * CAIXOTE * c.hw, 2 * CAIXOTE * c.hh) * MOLDURA
  const cx = t.x * c.hw
  const cy = t.y * c.hh
  const meioComp = (t.comp * c.hw) / 2
  const meiaLarg = (t.larg * m) / 2
  const co = Math.cos(t.ang)
  const si = Math.sin(t.ang)
  const noMapa = ([x, y]: Ponto): Ponto => [cx + x * co - y * si, cy + x * si + y * co]
  const pontos = [...pontaDaTabua(t.lascadas[1], 1, meioComp, meiaLarg, 400 + k), ...pontaDaTabua(t.lascadas[0], -1, meioComp, meiaLarg, 410 + k)]
  const forma = poligono(pontos.map(noMapa))
  cena.sombras.push({ forma, z: c.g * t.z, forca: 0.26 }, contato(forma, 0.24))
  L.push(P(forma, mad, { eixo: t.ang, tabua: 0, bisel: 1, tom: 0.96, semente: 420 + k, projeta: { dist: 1, forca: 0.3 } }))
  const quebra = quebraDe(mad)
  for (const [i, lado] of ([-1, 1] as const).entries()) {
    const fundo = lado * (meioComp - FUNDO_DO_DENTE * 0.9)
    if (t.lascadas[i]) {
      const faixa = poligono(([[fundo, -meiaLarg - 1], [lado * (meioComp + 1), -meiaLarg - 1], [lado * (meioComp + 1), meiaLarg + 1], [fundo, meiaLarg + 1]] as Ponto[]).map(noMapa))
      L.push(P(dentroDe(faixa, forma), quebra, { eixo: t.ang, tabua: 0, bisel: 0.4, contorno: 0.16, semente: 430 + k * 2 + i }))
      continue
    }
    // A ponta inteira guarda os pregos de quando a tábua estava pregada.
    for (const v of [-0.4, 0.4]) {
      const [px, py] = noMapa([lado * (meioComp - meiaLarg * 0.9), v * meiaLarg])
      L.push(P(elipse(px, py, 0.6, 0.6), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 }))
    }
  }
}

export const montarCaixaQuebrada: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const bx = CAIXOTE * hw
  const by = CAIXOTE * hh
  const e = Math.min(2 * bx, 2 * by) * MOLDURA * PAREDE
  // As lascas e a palha que vazou ficam no chão, por baixo de tudo.
  LASCAS.forEach(([fx, fy, comp, ang], k) => {
    const meio = (comp * hw) / 2
    const lasca = capsula(fx * hw - Math.cos(ang) * meio, fy * hh - Math.sin(ang) * meio, fx * hw + Math.cos(ang) * meio, fy * hh + Math.sin(ang) * meio, 0.8)
    cena.sombras.push(contato(lasca, 0.2))
    L.push(P(lasca, quebraDe(mad), { eixo: ang, tabua: 0, bisel: 0.6, contorno: 0.24, semente: 200 + k }))
  })
  PALHA_DE_FORA.forEach(([fx, fy, raio], k) => {
    const r = raio * hw
    const tufo = mancha(fx * hw, fy * hh, r, r * 0.8, 220 + k)
    cena.sombras.push(contato(tufo, 0.14))
    L.push(P(tufo, PALHA, { bisel: 0.8, tom: 0.92, contorno: 0, textura: texMonte(tufo, fx * hw, fy * hh, r, 220 + k), semente: 220 + k }))
  })
  // O caixote: o pé no chão, o fundo de tábuas na sombra das paredes e a palha do recheio.
  const base = caixa(-bx, -by, bx, by)
  cena.sombras.push(contato(base, 0.32))
  const fundo = caixa(-bx + e, -by + e, bx - e, by - e)
  L.push(P(fundo, mad, { tabua: (2 * by - 2 * e) / 4, bisel: 0.4, recesso: { k: 3, forca: 0.42 }, tom: TOM_DO_FUNDO, semente: 10 }))
  const recheio = dentroDe(mancha(bx * 0.12, by * 0.1, bx * 0.98, by * 0.92, 230, 16), fundo)
  L.push(P(recheio, PALHA, { bisel: 0.8, tom: 0.9, contorno: 0, textura: texMonte(recheio, bx * 0.12, by * 0.1, bx * 0.9, 230), semente: 230 }))
  // O pedaço de cima da tampa, caído por cima da palha.
  montarPedaco(c, cena, L, PEDACOS[0], mad)
  // As paredes e os pilaretes que ficaram de pé.
  let k = 0
  for (const parede of PAREDES) {
    parede.trechos.forEach((trecho, i) => {
      montarTrecho(c, cena, L, parede.lado, trecho, parede.arrancada && i === parede.trechos.length - 1, mad, k)
      k += 1
    })
  }
  PILARETES.forEach(([sx, sy, z], i) => montarPilarete(c, cena, L, sx, sy, z, mad, i))
  // No chão: as tábuas soltas, o pedaço da parede da direita e o pedaço de baixo da tampa.
  TABUAS_SOLTAS.forEach((tabua, i) => montarTabuaSolta(c, cena, L, tabua, mad, i))
  montarPedaco(c, cena, L, PEDACOS[1], mad)
  montarPedaco(c, cena, L, PEDACOS[2], mad)
}

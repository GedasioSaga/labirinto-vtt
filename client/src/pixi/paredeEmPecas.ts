import { CONTORNO_PX } from '../lib/contornoDaParede'
import { AJUSTE_DO_RELEVO } from '../lib/relevo'
import { COR, FORMATO_DA_IMAGEM, materialDoCatalogo, MATERIAIS_DA_PAREDE, PONTO, RAMPA, type ReceitaDaParede } from '../texturas/paredes/catalogo'
import type { MaterialDaParede } from '../types/map'
import { analisarEncontros, type Pilar, type Trecho, type TrechoDeEntrada } from './encontrosDaParede'

/**
 * A PAREDE EM PEÇAS (pedido de 10/11/2026: "parece mais chão do que uma parede,
 * refaça"): a parede com textura vista de cima, montada peça por peça. Só
 * geometria e conta (função pura, sem placa): `paredesComMaterial.ts` põe as
 * malhas no palco.
 *
 * O que dá VOLUME, de baixo para cima:
 *  1. a SOMBRA de contato no chão, deslocada na direção da sombra do mapa
 *     (`AJUSTE_DO_RELEVO.sombra`: a direção das sombras das árvores e dos
 *     objetos, na cor da sombra do relevo), macia na borda, e uma oclusão curta
 *     em volta da parede inteira;
 *  2. o CONTORNO fino no tom escuro da própria cor (a regra do Meio-Termo);
 *  3. o TOPO: a junta por baixo e, por cima, as peças do material em FIADAS ao
 *     longo da parede, com as juntas desencontradas de uma fiada para a outra;
 *  4. o BISEL de cada peça: claro nas arestas viradas para a luz, escuro nas
 *     outras, pela direção da parede no mapa (a diagonal acende do lado certo);
 *  5. os detalhes do material (prego, rebite, amarra, barbante).
 *
 * As JUNTAS são ancoradas no MAPA, não no trecho (`juntasDaFiada`): a posição de
 * cada junta sai da coordenada ao longo da reta da parede. Duas paredes na mesma
 * reta continuam o mesmo aparelho, o jogador (que só recebe parte das paredes)
 * vê os mesmos blocos do mestre, e nenhum bloco se repete em grade.
 *
 * Os ENCONTROS vêm de `encontrosDaParede.ts`: ponta solta com TAMPA, dobra suave
 * na bissetriz, PILAR no canto em L, no T, na cruz e entre espessuras
 * diferentes, e a ponta embutida rente à borda da outra parede.
 */

export type { TrechoDeEntrada }

export interface TriangulosDaParede {
  readonly posicoes: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint32Array
}

/** As duas malhas de um material numa opacidade: a de baixo (sombra e contorno) e a de cima (o topo). */
export interface MalhaEmPecas {
  readonly material: MaterialDaParede
  readonly alpha: number
  readonly baixo: TriangulosDaParede
  readonly cima: TriangulosDaParede
}

// ---------- medidas comuns (px do mundo a 64 px por casa) ----------

/** O contorno, no tom escuro da própria cor (mora em `lib/contornoDaParede.ts`: a conta pura da névoa também mede com ele). */
export { CONTORNO_PX }
/** A sombra de contato: quanto anda (cresce com a espessura: parede grossa é mais alta), o alfa e a borda macia. */
const SOMBRA = { andaBase: 3.5, andaPorEspessura: 0.16, alfa: 0.36, macia: 4 } as const
/** A oclusão em volta da parede inteira (assenta a parede no chão também do lado da luz). */
const OCLUSAO = { alfa: 0.2, macia: 2.6 } as const
/** A tampa da ponta solta: o comprimento em espessuras, e o mínimo. */
const TAMPA = { porEspessura: 0.9, minimo: 8 } as const
/** O bisel some abaixo desta luz (aresta de lado para a luz). */
const LUZ_MINIMA = 0.04
/** A aresta de fora da parede pega mais luz e mais escuro que a aresta entre duas peças. */
const REFORCO_DA_BORDA = 1.25
/**
 * A QUINA DO TOPO: um fio contínuo ao longo da borda de fora da parede, por cima das peças, claro do lado da
 * luz e escuro do outro. É o que faz a parede inteira ler como um volume só, e não como uma fileira de lajotas.
 */
const QUINA = { largura: 1.6, luz: 0.5, sombra: 0.44 } as const
/** A tampa redonda (mourão, feixe): a luz cai de um lado ao outro da peça inteira, sem aresta. */
const FORCA_DA_REDONDA = 1.6

const F = FORMATO_DA_IMAGEM

/** A direção da sombra do mapa, de comprimento 1 (para baixo e para a direita); a luz vem do lado oposto. */
const DIRECAO_DA_SOMBRA = (() => {
  const { dx, dy } = AJUSTE_DO_RELEVO.sombra
  const n = Math.hypot(dx, dy) || 1
  return { x: dx / n, y: dy / n }
})()

// ---------- sorteio com posição ----------

function mistura(a: number, b: number, c: number): number {
  let x = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35)
  x ^= x >>> 15
  x = Math.imul(x, 0x2c1b3c6d)
  x ^= x >>> 12
  x = Math.imul(x, 0x297a2d39)
  x ^= x >>> 15
  return x >>> 0
}

/** Um número de 0 a 1 (sem o 1) fixo para a tripla. */
function acaso(a: number, b: number, c: number): number {
  return mistura(a, b, c) / 4294967296
}

/** Uma junta de uma fiada: a posição ao longo da reta da parede (px do mundo) e a casa do sorteio dela. */
export interface JuntaDaFiada {
  readonly s: number
  readonly i: number
}

/**
 * As juntas de uma fiada entre `de` e `ate`, na coordenada ao longo da reta da
 * parede. Uma junta por casa de `passo` px, fora do lugar até `varia` do passo
 * (sorteio fixo pela casa: a mesma reta dá as mesmas juntas em qualquer trecho),
 * e `funde` é a chance de a junta sumir (dois blocos viram um comprido). A `fase`
 * desencontra a fiada da vizinha: com meia casa de fase e `varia` até 0,4, duas
 * juntas de fiadas vizinhas nunca ficam a menos de um décimo do passo.
 */
export function juntasDaFiada(semente: number, fiada: number, passo: number, varia: number, funde: number, fase: number, de: number, ate: number): JuntaDaFiada[] {
  const juntas: JuntaDaFiada[] = []
  if (!(passo > 0) || !(ate > de)) return juntas
  const primeira = Math.floor(de / passo - fase) - 1
  const ultima = Math.ceil(ate / passo - fase) + 1
  for (let i = primeira; i <= ultima; i += 1) {
    if (funde > 0 && acaso(semente ^ 0x5bd1e995, fiada, i) < funde) continue
    const s = (i + fase + 0.5 + (acaso(semente, fiada, i) - 0.5) * varia) * passo
    if (s > de && s < ate) juntas.push({ s, i })
  }
  return juntas
}

/** Quantas fiadas cabem na espessura (px a 64 px por casa). */
export function fiadasDaReceita(receita: ReceitaDaParede, espessura: number): number {
  let n = 1
  for (const limite of receita.fiadasAte) if (espessura > limite) n += 1
  return n
}

// ---------- a malha em montagem ----------

/**
 * A malha em montagem, em vetores de número que dobram de tamanho quando enchem: um mapa com 400 paredes dá
 * uns 200 mil vértices, e a conta roda de novo a cada parede riscada ou movida.
 */
class Montagem {
  private pos = new Float32Array(4096)
  private uv = new Float32Array(4096)
  private idx = new Uint32Array(3072)
  /** Quantos vértices e quantos índices já entraram. */
  private vertices = 0
  private indices = 0

  get vazia(): boolean {
    return this.indices === 0
  }

  /** Garante lugar para mais `v` vértices e `i` índices. */
  private caber(v: number, i: number): void {
    if ((this.vertices + v) * 2 > this.pos.length) {
      const maior = Math.max(this.pos.length * 2, (this.vertices + v) * 2)
      const pos = new Float32Array(maior)
      pos.set(this.pos)
      this.pos = pos
      const uv = new Float32Array(maior)
      uv.set(this.uv)
      this.uv = uv
    }
    if (this.indices + i > this.idx.length) {
      const idx = new Uint32Array(Math.max(this.idx.length * 2, this.indices + i))
      idx.set(this.idx)
      this.idx = idx
    }
  }

  private ponto(x: number, y: number, u: number, v: number): void {
    const k = this.vertices * 2
    this.pos[k] = x
    this.pos[k + 1] = y
    this.uv[k] = u
    this.uv[k + 1] = v
    this.vertices += 1
  }

  tri(x0: number, y0: number, u0: number, v0: number, x1: number, y1: number, u1: number, v1: number, x2: number, y2: number, u2: number, v2: number): void {
    this.caber(3, 3)
    const a = this.vertices
    this.ponto(x0, y0, u0, v0)
    this.ponto(x1, y1, u1, v1)
    this.ponto(x2, y2, u2, v2)
    const i = this.indices
    this.idx[i] = a
    this.idx[i + 1] = a + 1
    this.idx[i + 2] = a + 2
    this.indices += 3
  }

  /** Quatro cantos em volta (0, 1, 2, 3). */
  quad(x0: number, y0: number, u0: number, v0: number, x1: number, y1: number, u1: number, v1: number, x2: number, y2: number, u2: number, v2: number, x3: number, y3: number, u3: number, v3: number): void {
    this.caber(4, 6)
    const a = this.vertices
    this.ponto(x0, y0, u0, v0)
    this.ponto(x1, y1, u1, v1)
    this.ponto(x2, y2, u2, v2)
    this.ponto(x3, y3, u3, v3)
    const i = this.indices
    this.idx[i] = a
    this.idx[i + 1] = a + 1
    this.idx[i + 2] = a + 2
    this.idx[i + 3] = a
    this.idx[i + 4] = a + 2
    this.idx[i + 5] = a + 3
    this.indices += 6
  }

  /** Quatro cantos numa cor só (a célula chapada ou um ponto da rampa). */
  chapado(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, u: number, v: number): void {
    this.quad(x0, y0, u, v, x1, y1, u, v, x2, y2, u, v, x3, y3, u, v)
  }

  /** Quatro cantos em rampa: os dois primeiros (a aresta de fora) com alfa `r`, os dois últimos com 0. */
  rampa(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, coluna: number, r: number): void {
    const u = uDaCela(coluna)
    const v = vDaRampa(r)
    const zero = vDaRampa(0)
    this.quad(x0, y0, u, v, x1, y1, u, v, x2, y2, u, zero, x3, y3, u, zero)
  }

  fechar(): TriangulosDaParede {
    return { posicoes: this.pos.slice(0, this.vertices * 2), uvs: this.uv.slice(0, this.vertices * 2), indices: this.idx.slice(0, this.indices) }
  }
}

// ---------- onde cada coisa está na folha (uv de 0 a 1) ----------

function uDaCela(coluna: number): number {
  return (coluna * F.cela + F.cela / 2) / F.lado
}

/** O ponto da rampa com alfa `r` (0 a 1). */
function vDaRampa(r: number): number {
  const t = r <= 0 ? 0 : r >= 1 ? 1 : r
  return (F.rampasY + F.rampaInicio + t * (F.rampaFim - F.rampaInicio)) / F.lado
}

const V_DA_COR = (F.coresY + F.cela / 2) / F.lado
const PEQUENO = 1e-3
const MIOLO_DA_FAIXA = F.faixa - 2 * F.sobraDaFaixa
/** Meio lado útil da tampa (a borda de 2 texels fica de fora: não mistura com a vizinha). */
const MEIA_TAMPA = F.faixa / 2 - 2

// ---------- o quadro de um trecho ----------

/** O quadro do trecho: s ao longo da parede (a partir da origem), t para a esquerda dela. */
interface Quadro {
  readonly ax: number
  readonly ay: number
  readonly dx: number
  readonly dy: number
}

function mx(q: Quadro, s: number, t: number): number {
  return q.ax + q.dx * s - q.dy * t
}

function my(q: Quadro, s: number, t: number): number {
  return q.ay + q.dy * s + q.dx * t
}

/** Quatro cantos (s, t) do quadro numa cor só. */
function chapadoNoQuadro(m: Montagem, q: Quadro, s0: number, t0: number, s1: number, t1: number, s2: number, t2: number, s3: number, t3: number, u: number, v: number, ox = 0, oy = 0): void {
  m.chapado(mx(q, s0, t0) + ox, my(q, s0, t0) + oy, mx(q, s1, t1) + ox, my(q, s1, t1) + oy, mx(q, s2, t2) + ox, my(q, s2, t2) + oy, mx(q, s3, t3) + ox, my(q, s3, t3) + oy, u, v)
}

/** Quatro cantos (s, t) do quadro em rampa: os dois primeiros com `r`, os dois últimos com 0. */
function rampaNoQuadro(m: Montagem, q: Quadro, s0: number, t0: number, s1: number, t1: number, s2: number, t2: number, s3: number, t3: number, coluna: number, r: number, ox = 0, oy = 0): void {
  m.rampa(mx(q, s0, t0) + ox, my(q, s0, t0) + oy, mx(q, s1, t1) + ox, my(q, s1, t1) + oy, mx(q, s2, t2) + ox, my(q, s2, t2) + oy, mx(q, s3, t3) + ox, my(q, s3, t3) + oy, coluna, r)
}

/** O corpo do trecho entre os dois cortes: `c0(t)` e `c1(t)` dão o s de cada ponta na linha t. */
interface Corpo {
  readonly t: Trecho
  readonly q: Quadro
  readonly h: number
  readonly c0: (t: number) => number
  readonly c1: (t: number) => number
}

function corpoDe(t: Trecho): Corpo | null {
  const [p0, p1] = t.pontas
  const c0 = (lado: number): number => p0.recuo + p0.k * lado
  const c1 = (lado: number): number => t.comp - p1.recuo + p1.k * lado
  // Os dois pilares das pontas comeram o trecho inteiro: não sobra corpo.
  if (c1(0) - c0(0) < 0.5) return null
  return { t, q: { ax: t.ax, ay: t.ay, dx: t.dx, dy: t.dy }, h: t.h, c0, c1 }
}

/** A luz na aresta com normal (nx, ny): 1 de frente para a luz, -1 de costas. */
function luzNa(nx: number, ny: number): number {
  return -(nx * DIRECAO_DA_SOMBRA.x + ny * DIRECAO_DA_SOMBRA.y)
}

// ---------- a malha de baixo: sombra, oclusão e contorno ----------

/** A ponta solta: a borda macia para fora da ponta e os dois cantos dela. `para` = -1 na origem, 1 no fim. */
function pontaMacia(m: Montagem, c: Corpo, s: number, para: number, largura: number, alfa: number, ox: number, oy: number): void {
  const { q, h } = c
  const fora = s + para * largura
  rampaNoQuadro(m, q, s, -h, s, h, fora, h, fora, -h, RAMPA.sombra, alfa, ox, oy)
  const u = uDaCela(RAMPA.sombra)
  const cheio = vDaRampa(alfa)
  const zero = vDaRampa(0)
  for (const lado of [-1, 1]) {
    const t = lado * h
    const f = lado * (h + largura)
    m.tri(mx(q, s, t) + ox, my(q, s, t) + oy, u, cheio, mx(q, fora, t) + ox, my(q, fora, t) + oy, u, zero, mx(q, s, f) + ox, my(q, s, f) + oy, u, zero)
  }
}

/** A mancha macia (sombra ou oclusão) do corpo do trecho, andada (ox, oy): o miolo cheio e a borda que some. */
function macioDoTrecho(m: Montagem, c: Corpo, largura: number, alfa: number, ox: number, oy: number, comMiolo: boolean): void {
  const { q, h, c0, c1 } = c
  if (comMiolo) chapadoNoQuadro(m, q, c0(-h), -h, c1(-h), -h, c1(h), h, c0(h), h, uDaCela(RAMPA.sombra), vDaRampa(alfa), ox, oy)
  for (const lado of [-1, 1]) {
    const t = lado * h
    const f = lado * (h + largura)
    rampaNoQuadro(m, q, c0(t), t, c1(t), t, c1(f), f, c0(f), f, RAMPA.sombra, alfa, ox, oy)
  }
  const [p0, p1] = c.t.pontas
  if (p0.tipo === 'solta') pontaMacia(m, c, c0(0), -1, largura, alfa, ox, oy)
  if (p1.tipo === 'solta') pontaMacia(m, c, c1(0), 1, largura, alfa, ox, oy)
}

/** O contorno do trecho: uma tira de cada lado e, na ponta que não continua noutra peça, a tira da ponta. */
function contornoDoTrecho(m: Montagem, c: Corpo, largura: number): void {
  const { q, h, c0, c1 } = c
  const u = uDaCela(COR.contorno)
  for (const lado of [-1, 1]) {
    const t = lado * h
    const f = lado * (h + largura)
    chapadoNoQuadro(m, q, c0(t), t, c1(t), t, c1(f), f, c0(f), f, u, V_DA_COR)
  }
  const [p0, p1] = c.t.pontas
  const H = h + largura
  if (p0.tipo !== 'dobra' && p0.tipo !== 'pilar') chapadoNoQuadro(m, q, c0(-H), -H, c0(H), H, c0(H) - largura, H, c0(-H) - largura, -H, u, V_DA_COR)
  if (p1.tipo !== 'dobra' && p1.tipo !== 'pilar') chapadoNoQuadro(m, q, c1(-H), -H, c1(H), H, c1(H) + largura, H, c1(-H) + largura, -H, u, V_DA_COR)
}

/** A normal de fora da aresta i do pilar (o polígono anda no sentido anti-horário dos números). */
function normalDaAresta(p: Pilar, i: number): { x: number; y: number } {
  const n = p.interna.length
  const j = (i + 1) % n
  const ex = p.pontos[j * 2] - p.pontos[i * 2]
  const ey = p.pontos[j * 2 + 1] - p.pontos[i * 2 + 1]
  const l = Math.hypot(ex, ey) || 1
  return { x: ey / l, y: -ex / l }
}

/** O pilar cheio numa cor só (leque a partir do nó, de onde o polígono inteiro se vê). */
function pilarChapado(m: Montagem, p: Pilar, u: number, v: number, ox: number, oy: number): void {
  const n = p.interna.length
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    m.tri(p.x + ox, p.y + oy, u, v, p.pontos[i * 2] + ox, p.pontos[i * 2 + 1] + oy, u, v, p.pontos[j * 2] + ox, p.pontos[j * 2 + 1] + oy, u, v)
  }
}

/**
 * A tira para fora das arestas de fora do pilar (as que não encostam em parede),
 * com a quina fechada entre duas delas: `vDentro` na aresta, `vFora` na borda de fora.
 */
function bordaDoPilar(m: Montagem, p: Pilar, largura: number, u: number, vDentro: number, vFora: number, ox: number, oy: number): void {
  const n = p.interna.length
  for (let i = 0; i < n; i += 1) {
    if (p.interna[i]) continue
    const j = (i + 1) % n
    const ax = p.pontos[i * 2] + ox
    const ay = p.pontos[i * 2 + 1] + oy
    const bx = p.pontos[j * 2] + ox
    const by = p.pontos[j * 2 + 1] + oy
    const nor = normalDaAresta(p, i)
    m.quad(ax, ay, u, vDentro, bx, by, u, vDentro, bx + nor.x * largura, by + nor.y * largura, u, vFora, ax + nor.x * largura, ay + nor.y * largura, u, vFora)
    // A quina com a aresta de fora anterior: o leque que fecha o vão entre as duas tiras.
    const antes = (i + n - 1) % n
    if (p.interna[antes]) continue
    const na = normalDaAresta(p, antes)
    if (na.x * nor.y - na.y * nor.x <= 1e-6) continue
    const soma = 1 + na.x * nor.x + na.y * nor.y
    const x1 = ax + na.x * largura
    const y1 = ay + na.y * largura
    const x2 = ax + nor.x * largura
    const y2 = ay + nor.y * largura
    if (soma > 0.25) {
      const qx = ax + ((na.x + nor.x) / soma) * largura
      const qy = ay + ((na.y + nor.y) / soma) * largura
      m.tri(ax, ay, u, vDentro, x1, y1, u, vFora, qx, qy, u, vFora)
      m.tri(ax, ay, u, vDentro, qx, qy, u, vFora, x2, y2, u, vFora)
    } else {
      m.tri(ax, ay, u, vDentro, x1, y1, u, vFora, x2, y2, u, vFora)
    }
  }
}

// ---------- a malha de cima: as peças ----------

/** A aresta de uma peça: clara virada para a luz, escura de costas, nada de lado. Fora (0, 1) com `r`, dentro (2, 3) com 0. */
function aresta(m: Montagem, q: Quadro, s0: number, t0: number, s1: number, t1: number, s2: number, t2: number, s3: number, t3: number, luz: number, forcaDaLuz: number, forcaDoEscuro: number): void {
  if (luz > LUZ_MINIMA) rampaNoQuadro(m, q, s0, t0, s1, t1, s2, t2, s3, t3, RAMPA.luz, Math.min(1, forcaDaLuz * luz))
  else if (luz < -LUZ_MINIMA) rampaNoQuadro(m, q, s0, t0, s1, t1, s2, t2, s3, t3, RAMPA.bisel, Math.min(1, forcaDoEscuro * -luz))
}

/** A peça de quatro cantos no quadro: (sA0, tA) (sA1, tA) (sB1, tB) (sB0, tB). */
interface Peca {
  readonly sA0: number
  readonly sA1: number
  readonly sB0: number
  readonly sB1: number
  readonly tA: number
  readonly tB: number
}

/** O bisel nas quatro arestas da peça, com a largura `b`; `reforcoA` e `reforcoB` valem nas arestas do lado -t e +t. */
function biselDaPeca(m: Montagem, q: Quadro, p: Peca, b: number, forcaDaLuz: number, forcaDoEscuro: number, reforcoA: number, reforcoB: number, reforcoDaPonta: number): void {
  const luzDoLado = luzNa(-q.dy, q.dx)
  const luzDaPonta = luzNa(q.dx, q.dy)
  const { sA0, sA1, sB0, sB1, tA, tB } = p
  const iA = tA + b
  const iB = tB - b
  aresta(m, q, sA0, tA, sA1, tA, sA1 - b, iA, sA0 + b, iA, -luzDoLado, forcaDaLuz * reforcoA, forcaDoEscuro * reforcoA)
  aresta(m, q, sB0, tB, sB1, tB, sB1 - b, iB, sB0 + b, iB, luzDoLado, forcaDaLuz * reforcoB, forcaDoEscuro * reforcoB)
  aresta(m, q, sA0, tA, sB0, tB, sB0 + b, iB, sA0 + b, iA, -luzDaPonta, forcaDaLuz * reforcoDaPonta, forcaDoEscuro * reforcoDaPonta)
  aresta(m, q, sA1, tA, sB1, tB, sB1 - b, iB, sA1 - b, iA, luzDaPonta, forcaDaLuz * reforcoDaPonta, forcaDoEscuro * reforcoDaPonta)
}

/**
 * A luz na peça redonda: clara do lado da luz, escura do outro, caindo a zero no meio. `pontos` é o contorno
 * (x, y) da peça, (cx, cy) o meio dela e `raio` a distância em que a luz chega inteira.
 */
function luzRedonda(m: Montagem, pontos: readonly number[], cx: number, cy: number, raio: number, forcaDaLuz: number, forcaDoEscuro: number): void {
  const n = pontos.length / 2
  const quanto: number[] = []
  for (let i = 0; i < n; i += 1) {
    const l = -((pontos[i * 2] - cx) * DIRECAO_DA_SOMBRA.x + (pontos[i * 2 + 1] - cy) * DIRECAO_DA_SOMBRA.y) / raio
    quanto.push(Math.max(-1, Math.min(1, l)))
  }
  const zero = vDaRampa(0)
  for (const [coluna, sinal, forca] of [
    [RAMPA.luz, 1, forcaDaLuz],
    [RAMPA.bisel, -1, forcaDoEscuro],
  ] as const) {
    const u = uDaCela(coluna)
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n
      const ri = Math.max(0, sinal * quanto[i]) * forca
      const rj = Math.max(0, sinal * quanto[j]) * forca
      if (ri <= 0 && rj <= 0) continue
      m.tri(cx, cy, u, zero, pontos[i * 2], pontos[i * 2 + 1], u, vDaRampa(ri), pontos[j * 2], pontos[j * 2 + 1], u, vDaRampa(rj))
    }
  }
}

/** Um disco (prego, rebite) de diâmetro `d` no ponto (s, t) do quadro, andado (ox, oy). */
function disco(m: Montagem, q: Quadro, s: number, t: number, d: number, coluna: number, ox = 0, oy = 0): void {
  const r = d / 2
  const u0 = (coluna * F.cela) / F.lado
  const u1 = ((coluna + 1) * F.cela) / F.lado
  const v0 = F.pontosY / F.lado
  const v1 = (F.pontosY + F.cela) / F.lado
  m.quad(mx(q, s - r, t - r) + ox, my(q, s - r, t - r) + oy, u0, v0, mx(q, s + r, t - r) + ox, my(q, s + r, t - r) + oy, u1, v0, mx(q, s + r, t + r) + ox, my(q, s + r, t + r) + oy, u1, v1, mx(q, s - r, t + r) + ox, my(q, s - r, t + r) + oy, u0, v1)
}

/** A tampa (a peça da ponta solta) do trecho: uma peça inteira na espessura, com a matéria de uma das 12 tampas da folha. */
function tampaDoTrecho(m: Montagem, q: Quadro, receita: ReceitaDaParede, k: number, p: Peca, sorte: number): void {
  const j = Math.min(F.tampas - 1, Math.floor(sorte * F.tampas))
  const sMin = Math.min(p.sA0, p.sB0)
  const sMax = Math.max(p.sA1, p.sB1)
  const meio = (sMin + sMax) / 2
  const meia = Math.max((sMax - sMin) / 2, (p.tB - p.tA) / 2, PEQUENO)
  const tMeio = (p.tA + p.tB) / 2
  const u = (s: number): number => (j * F.faixa + F.faixa / 2 + ((s - meio) / meia) * MEIA_TAMPA) / F.lado
  const v = (t: number): number => (F.tampasY + F.faixa / 2 + ((t - tMeio) / meia) * MEIA_TAMPA) / F.lado
  m.quad(mx(q, p.sA0, p.tA), my(q, p.sA0, p.tA), u(p.sA0), v(p.tA), mx(q, p.sA1, p.tA), my(q, p.sA1, p.tA), u(p.sA1), v(p.tA), mx(q, p.sB1, p.tB), my(q, p.sB1, p.tB), u(p.sB1), v(p.tB), mx(q, p.sB0, p.tB), my(q, p.sB0, p.tB), u(p.sB0), v(p.tB))
  const menor = Math.min(sMax - sMin, p.tB - p.tA)
  if (receita.tampaComBisel) {
    biselDaPeca(m, q, p, Math.min(receita.bisel * 1.25 * k, 0.3 * menor), receita.luz * 1.15, receita.sombra * 1.15, REFORCO_DA_BORDA, REFORCO_DA_BORDA, REFORCO_DA_BORDA)
    return
  }
  const cantos = [mx(q, p.sA0, p.tA), my(q, p.sA0, p.tA), mx(q, p.sA1, p.tA), my(q, p.sA1, p.tA), mx(q, p.sB1, p.tB), my(q, p.sB1, p.tB), mx(q, p.sB0, p.tB), my(q, p.sB0, p.tB)]
  luzRedonda(m, cantos, mx(q, meio, tMeio), my(q, meio, tMeio), meia, receita.luz * FORCA_DA_REDONDA, receita.sombra * FORCA_DA_REDONDA)
}

/** A folga entre o corte da ponta e a primeira peça da fiada. */
function folgaDaPonta(tipo: Trecho['pontas'][0]['tipo'], junta: number): number {
  if (tipo === 'pilar') return junta
  if (tipo === 'embutida') return 0
  return junta / 2
}

/** O topo do trecho: as tampas das pontas soltas, as fiadas de peças com o bisel e os detalhes do material. */
function topoDoTrecho(m: Montagem, c: Corpo, receita: ReceitaDaParede, k: number, iMaterial: number): void {
  const { t: trecho, q, h, c0, c1 } = c
  const [p0, p1] = trecho.pontas
  const g = receita.junta * k
  const luzDoLado = luzNa(-q.dy, q.dx)
  const luzDaPonta = luzNa(q.dx, q.dy)
  // A reta da parede: a semente sai do ângulo e da distância à origem; o S anda ao longo dela.
  const semente = mistura(Math.round(Math.atan2(q.dy, q.dx) * 2000), Math.round((-q.ax * q.dy + q.ay * q.dx) * 2), iMaterial + 1)
  const s0 = q.ax * q.dx + q.ay * q.dy
  const livre = c1(0) - c0(0)
  const tampas = Number(p0.tipo === 'solta') + Number(p1.tipo === 'solta')
  let tampa = Math.max(2 * h * TAMPA.porEspessura, TAMPA.minimo * k)
  // Parede curta: as tampas dividem o que há.
  if (tampas > 0 && livre < tampas * tampa + 6 * k) tampa = Math.max(PEQUENO, livre / tampas - (tampas === 2 ? g / 2 : 0))
  if (p0.tipo === 'solta') tampaDoTrecho(m, q, receita, k, { sA0: c0(-h), sB0: c0(h), sA1: c0(0) + tampa, sB1: c0(0) + tampa, tA: -h, tB: h }, acaso(semente, 17, Math.round(s0)))
  if (p1.tipo === 'solta') tampaDoTrecho(m, q, receita, k, { sA0: c1(0) - tampa, sB0: c1(0) - tampa, sA1: c1(-h), sB1: c1(h), tA: -h, tB: h }, acaso(semente, 19, Math.round(s0 + trecho.comp)))
  const inicio = (t: number): number => (p0.tipo === 'solta' ? c0(0) + tampa + g : c0(t) + folgaDaPonta(p0.tipo, g))
  const fim = (t: number): number => (p1.tipo === 'solta' ? c1(0) - tampa - g : c1(t) - folgaDaPonta(p1.tipo, g))
  if (fim(0) - inicio(0) < 1.5 * k) return
  const fiadas = fiadasDaReceita(receita, (2 * h) / k)
  const fundura = (2 * h) / fiadas
  const passo = Math.min(receita.passo.max, Math.max(receita.passo.min, (receita.passo.porFundura * fundura) / k)) * k
  const minimo = Math.max(0.3 * passo, 3 * k)
  const tremor = receita.tremor * k
  const rolica = receita.face === 'rolica'
  const encolhe = Math.min(1, MIOLO_DA_FAIXA / (fundura / k))
  for (let f = 0; f < fiadas; f += 1) {
    const tA = -h + f * fundura
    const tB = tA + fundura
    const tMeio = (tA + tB) / 2
    const de = inicio(tMeio)
    const ate = fim(tMeio)
    if (ate - de < 1.5 * k) continue
    const juntas = juntasDaFiada(semente, f, passo, receita.varia, receita.funde, (f % 2) * 0.5, s0 + de + minimo, s0 + ate - minimo)
    for (let b = 0; b <= juntas.length; b += 1) {
      const esq = b > 0 ? juntas[b - 1] : null
      const dir = b < juntas.length ? juntas[b] : null
      const casa = esq !== null ? esq.i : Math.floor((s0 + de) / passo) ^ 0x2545f491
      const sorte = (n: number): number => acaso(semente, f * 131 + n, casa)
      const tA2 = tA + (f > 0 ? g / 2 + tremor * sorte(3) : 0)
      const tB2 = tB - (f < fiadas - 1 ? g / 2 + tremor * sorte(4) : 0)
      const sEsq = esq !== null ? esq.s - s0 + g / 2 + tremor * 0.6 * sorte(5) : null
      const sDir = dir !== null ? dir.s - s0 - g / 2 - tremor * 0.6 * sorte(6) : null
      let sA0 = sEsq ?? inicio(tA2)
      let sB0 = sEsq ?? inicio(tB2)
      let sA1 = sDir ?? fim(tA2)
      let sB1 = sDir ?? fim(tB2)
      if (sA1 < sA0) sA0 = sA1 = (sA0 + sA1) / 2
      if (sB1 < sB0) sB0 = sB1 = (sB0 + sB1) / 2
      const comprimento = (sA1 - sA0 + sB1 - sB0) / 2
      if (comprimento < 0.8 * k) continue
      // A face: uma janela na faixa de tom sorteada, começando num x sorteado.
      const faixa = Math.min(F.faixas - 1, Math.floor(sorte(1) * F.faixas))
      const xDaFolha = sorte(2) * F.lado
      const sRef = Math.min(sA0, sB0)
      const u = (s: number): number => (xDaFolha + (s - sRef) / k) / F.lado
      const v = rolica
        ? (t: number): number => (faixa * F.faixa + F.sobraDaFaixa + (MIOLO_DA_FAIXA * (t - tA)) / fundura) / F.lado
        : (t: number): number => (faixa * F.faixa + F.faixa / 2 + ((t - tMeio) / k) * encolhe) / F.lado
      m.quad(mx(q, sA0, tA2), my(q, sA0, tA2), u(sA0), v(tA2), mx(q, sA1, tA2), my(q, sA1, tA2), u(sA1), v(tA2), mx(q, sB1, tB2), my(q, sB1, tB2), u(sB1), v(tB2), mx(q, sB0, tB2), my(q, sB0, tB2), u(sB0), v(tB2))
      const peca: Peca = { sA0, sA1, sB0, sB1, tA: tA2, tB: tB2 }
      const altura = tB2 - tA2
      if (rolica) {
        // O roliço: claro do lado da luz até o meio, escuro do outro (a faixa já traz o claro-escuro do cilindro).
        const meio = (tA2 + tB2) / 2
        const forca = 0.35 + 0.65 * Math.abs(luzDoLado)
        const [tClaro, tEscuro] = luzDoLado > 0 ? [tB2, tA2] : [tA2, tB2]
        const [aClaro, bClaro] = luzDoLado > 0 ? [sB0, sB1] : [sA0, sA1]
        const [aEscuro, bEscuro] = luzDoLado > 0 ? [sA0, sA1] : [sB0, sB1]
        rampaNoQuadro(m, q, aClaro, tClaro, bClaro, tClaro, bClaro, meio, aClaro, meio, RAMPA.luz, receita.luz * forca)
        rampaNoQuadro(m, q, aEscuro, tEscuro, bEscuro, tEscuro, bEscuro, meio, aEscuro, meio, RAMPA.bisel, receita.sombra * forca)
      } else if (receita.bisel > 0) {
        biselDaPeca(m, q, peca, Math.min(receita.bisel * k, 0.3 * comprimento, 0.3 * altura), receita.luz, receita.sombra, f === 0 ? REFORCO_DA_BORDA : 1, f === fiadas - 1 ? REFORCO_DA_BORDA : 1, 1)
      }
      if (receita.detalhe === 'pregos') {
        // Dois pregos em cada emenda de tábua (um só na tábua estreita).
        const lados = altura < 7 * k ? [0] : [-0.24, 0.24]
        for (const lado of lados) {
          if (esq !== null && comprimento > 14 * k) disco(m, q, sA0 + 3.2 * k, tMeio + lado * altura, 2.4 * k, PONTO.escuro)
          if (dir !== null && comprimento > 14 * k) disco(m, q, sA1 - 3.2 * k, tMeio + lado * altura, 2.4 * k, PONTO.escuro)
        }
      } else if (receita.detalhe === 'rebites') {
        // Rebites nas duas bordas da chapa: o escuro por baixo, para o lado da sombra, e a cabeça clara.
        const quantos = Math.max(2, Math.round(comprimento / (13 * k)))
        const linhas = altura < 9 * k ? [tMeio] : [tA2 + 2.8 * k, tB2 - 2.8 * k]
        for (let r = 0; r < quantos; r += 1) {
          const s = sA0 + 3.2 * k + ((comprimento - 6.4 * k) * r) / (quantos - 1)
          for (const t of linhas) {
            disco(m, q, s, t, 3.6 * k, PONTO.escuro, DIRECAO_DA_SOMBRA.x * 0.6 * k, DIRECAO_DA_SOMBRA.y * 0.6 * k)
            disco(m, q, s, t, 2.6 * k, PONTO.claro)
          }
        }
      } else if (receita.detalhe === 'amarras') {
        // O nó do bambu: um fio claro de cada lado da junta.
        if (esq !== null) rampaNoQuadro(m, q, sA0 + 0.2 * k, tA2, sA0 + 0.2 * k, tB2, sA0 + 2 * k, tB2, sA0 + 2 * k, tA2, RAMPA.claro, 0.5)
        if (dir !== null) rampaNoQuadro(m, q, sA1 - 0.2 * k, tA2, sA1 - 0.2 * k, tB2, sA1 - 2 * k, tB2, sA1 - 2 * k, tA2, RAMPA.claro, 0.5)
      } else if (receita.detalhe === 'barbante' && comprimento > 12 * k) {
        // O barbante no meio do feixe, com a sombrinha dele do lado contrário ao da luz.
        const meio = (sA0 + sA1) / 2
        const para = luzDaPonta > 0 ? -1 : 1
        rampaNoQuadro(m, q, meio + para * 0.7 * k, tA2, meio + para * 0.7 * k, tB2, meio + para * 2.2 * k, tB2, meio + para * 2.2 * k, tA2, RAMPA.bisel, 0.45)
        chapadoNoQuadro(m, q, meio - 0.7 * k, tA2, meio + 0.7 * k, tA2, meio + 0.7 * k, tB2, meio - 0.7 * k, tB2, uDaCela(COR.claro), V_DA_COR)
      }
    }
  }
  if (receita.detalhe === 'amarras') {
    // As amarras do bambu: uma corda atravessando os colmos de tempos em tempos, com o fio de luz do lado claro.
    const para = luzDaPonta > 0 ? 1 : -1
    for (const amarra of juntasDaFiada(semente ^ 0x1b873593, 99, 104 * k, 0.3, 0, 0, s0 + inicio(0) + 6 * k, s0 + fim(0) - 6 * k)) {
      const s = amarra.s - s0
      chapadoNoQuadro(m, q, s - 1.4 * k, -h, s + 1.4 * k, -h, s + 1.4 * k, h, s - 1.4 * k, h, uDaCela(COR.escuro), V_DA_COR)
      rampaNoQuadro(m, q, s + para * 1.4 * k, -h, s + para * 1.4 * k, h, s + para * 0.2 * k, h, s + para * 0.2 * k, -h, RAMPA.claro, 0.4)
    }
  }
}

/** O topo do pilar: a matéria de uma tampa da folha no polígono inteiro e o bisel em cada aresta. */
function topoDoPilar(m: Montagem, p: Pilar, receita: ReceitaDaParede, k: number): void {
  const n = p.interna.length
  // O quadro da tampa: a direção da parede dona, centrado na caixa do polígono.
  let minA = Infinity
  let maxA = -Infinity
  let minB = Infinity
  let maxB = -Infinity
  for (let i = 0; i < n; i += 1) {
    const rx = p.pontos[i * 2] - p.x
    const ry = p.pontos[i * 2 + 1] - p.y
    const a = rx * p.ox + ry * p.oy
    const b = -rx * p.oy + ry * p.ox
    minA = Math.min(minA, a)
    maxA = Math.max(maxA, a)
    minB = Math.min(minB, b)
    maxB = Math.max(maxB, b)
  }
  const meia = Math.max((maxA - minA) / 2, (maxB - minB) / 2, PEQUENO)
  const j = Math.min(F.tampas - 1, Math.floor(acaso(Math.round(p.x * 4), Math.round(p.y * 4), 23) * F.tampas))
  const u = (x: number, y: number): number => (j * F.faixa + F.faixa / 2 + ((((x - p.x) * p.ox + (y - p.y) * p.oy - (minA + maxA) / 2) / meia) * MEIA_TAMPA)) / F.lado
  const v = (x: number, y: number): number => (F.tampasY + F.faixa / 2 + (((-(x - p.x) * p.oy + (y - p.y) * p.ox - (minB + maxB) / 2) / meia) * MEIA_TAMPA)) / F.lado
  for (let i = 0; i < n; i += 1) {
    const jv = (i + 1) % n
    const ax = p.pontos[i * 2]
    const ay = p.pontos[i * 2 + 1]
    const bx = p.pontos[jv * 2]
    const by = p.pontos[jv * 2 + 1]
    m.tri(p.x, p.y, u(p.x, p.y), v(p.x, p.y), ax, ay, u(ax, ay), v(ax, ay), bx, by, u(bx, by), v(bx, by))
  }
  if (!receita.tampaComBisel) {
    const ca = (minA + maxA) / 2
    const cb = (minB + maxB) / 2
    luzRedonda(m, p.pontos, p.x + ca * p.ox - cb * p.oy, p.y + ca * p.oy + cb * p.ox, meia, receita.luz * FORCA_DA_REDONDA, receita.sombra * FORCA_DA_REDONDA)
    return
  }
  // O bisel: cada vértice entra pela bissetriz das duas arestas dele.
  const menor = 2 * Math.min((maxA - minA) / 2, (maxB - minB) / 2)
  const b = Math.min(receita.bisel * 1.25 * k, 0.3 * menor)
  const forcaDaLuz = receita.luz * 1.15 * REFORCO_DA_BORDA
  const forcaDoEscuro = receita.sombra * 1.15 * REFORCO_DA_BORDA
  const dentro: number[] = []
  for (let i = 0; i < n; i += 1) {
    const na = normalDaAresta(p, (i + n - 1) % n)
    const nb = normalDaAresta(p, i)
    const soma = Math.max(0.3, 1 + na.x * nb.x + na.y * nb.y)
    dentro.push(p.pontos[i * 2] - ((na.x + nb.x) / soma) * b, p.pontos[i * 2 + 1] - ((na.y + nb.y) / soma) * b)
  }
  for (let i = 0; i < n; i += 1) {
    const jv = (i + 1) % n
    const nor = normalDaAresta(p, i)
    const luz = luzNa(nor.x, nor.y)
    const coluna = luz > LUZ_MINIMA ? RAMPA.luz : luz < -LUZ_MINIMA ? RAMPA.bisel : -1
    if (coluna < 0) continue
    const r = Math.min(1, (luz > 0 ? forcaDaLuz : forcaDoEscuro) * Math.abs(luz))
    m.rampa(p.pontos[i * 2], p.pontos[i * 2 + 1], p.pontos[jv * 2], p.pontos[jv * 2 + 1], dentro[jv * 2], dentro[jv * 2 + 1], dentro[i * 2], dentro[i * 2 + 1], coluna, r)
  }
}

/** O fio da quina numa aresta de fora: de (ax, ay) a (bx, by), entrando `largura` pela normal de dentro (-nx, -ny). */
function fioDaQuina(m: Montagem, ax: number, ay: number, bx: number, by: number, nx: number, ny: number, largura: number): void {
  const luz = luzNa(nx, ny)
  if (Math.abs(luz) <= LUZ_MINIMA) return
  const r = luz > 0 ? QUINA.luz * luz : QUINA.sombra * -luz
  m.rampa(ax, ay, bx, by, bx - nx * largura, by - ny * largura, ax - nx * largura, ay - ny * largura, luz > 0 ? RAMPA.luz : RAMPA.bisel, Math.min(1, r))
}

/** A quina do topo no trecho: os dois lados e as pontas soltas. */
function quinaDoTrecho(m: Montagem, c: Corpo, k: number): void {
  const { q, h, c0, c1 } = c
  const largura = Math.min(QUINA.largura * k, 0.4 * h)
  for (const lado of [-1, 1]) {
    const t = lado * h
    fioDaQuina(m, mx(q, c0(t), t), my(q, c0(t), t), mx(q, c1(t), t), my(q, c1(t), t), -q.dy * lado, q.dx * lado, largura)
  }
  const [p0, p1] = c.t.pontas
  if (p0.tipo === 'solta') fioDaQuina(m, mx(q, c0(-h), -h), my(q, c0(-h), -h), mx(q, c0(h), h), my(q, c0(h), h), -q.dx, -q.dy, largura)
  if (p1.tipo === 'solta') fioDaQuina(m, mx(q, c1(-h), -h), my(q, c1(-h), -h), mx(q, c1(h), h), my(q, c1(h), h), q.dx, q.dy, largura)
}

/** A quina do topo no pilar: as arestas de fora. */
function quinaDoPilar(m: Montagem, p: Pilar, k: number): void {
  const n = p.interna.length
  const largura = Math.min(QUINA.largura * k, 0.4 * p.h)
  for (let i = 0; i < n; i += 1) {
    if (p.interna[i]) continue
    const j = (i + 1) % n
    const nor = normalDaAresta(p, i)
    fioDaQuina(m, p.pontos[i * 2], p.pontos[i * 2 + 1], p.pontos[j * 2], p.pontos[j * 2 + 1], nor.x, nor.y, largura)
  }
}

// ---------- tudo junto ----------

interface Grupo {
  readonly material: MaterialDaParede
  readonly alpha: number
  readonly baixo: Montagem
  readonly cima: Montagem
}

/**
 * As malhas das paredes com textura, duas por material e opacidade: a de baixo
 * (sombra, oclusão, contorno) e a de cima (o topo em peças). Quem põe no palco
 * desenha TODAS as de baixo antes de qualquer uma de cima: no encontro, o topo de
 * uma parede cobre o contorno e a sombra da outra, e as duas se fundem.
 * Função pura: a mesma lista dá a mesma malha.
 */
export function montarParedes(entradas: readonly TrechoDeEntrada[], grid: number): MalhaEmPecas[] {
  const { trechos, pilares } = analisarEncontros(entradas)
  const k = Number.isFinite(grid) && grid > 0 ? grid / F.casa : 1
  const grupos = new Map<string, Grupo>()
  const grupoDe = (material: MaterialDaParede, alpha: number): Grupo => {
    const chave = `${material}|${alpha}`
    let g = grupos.get(chave)
    if (g === undefined) {
      g = { material, alpha, baixo: new Montagem(), cima: new Montagem() }
      grupos.set(chave, g)
    }
    return g
  }
  const corpos: { c: Corpo; g: Grupo }[] = []
  for (const t of trechos) {
    if (!t.entrada.desenha) continue
    const c = corpoDe(t)
    if (c !== null) corpos.push({ c, g: grupoDe(t.entrada.material, t.entrada.alpha) })
  }
  const visiveis = pilares.filter((p) => p.desenha).map((p) => ({ p, g: grupoDe(p.material, p.alpha) }))
  const anda = (h: number): number => (SOMBRA.andaBase + (SOMBRA.andaPorEspessura * 2 * h) / k) * k
  const uSombra = uDaCela(RAMPA.sombra)
  // 1. As sombras de contato, andadas na direção da sombra do mapa.
  for (const { c, g } of corpos) macioDoTrecho(g.baixo, c, SOMBRA.macia * k, SOMBRA.alfa, DIRECAO_DA_SOMBRA.x * anda(c.h), DIRECAO_DA_SOMBRA.y * anda(c.h), true)
  for (const { p, g } of visiveis) {
    const ox = DIRECAO_DA_SOMBRA.x * anda(p.h)
    const oy = DIRECAO_DA_SOMBRA.y * anda(p.h)
    pilarChapado(g.baixo, p, uSombra, vDaRampa(SOMBRA.alfa), ox, oy)
    bordaDoPilar(g.baixo, p, SOMBRA.macia * k, uSombra, vDaRampa(SOMBRA.alfa), vDaRampa(0), ox, oy)
  }
  // 2. A oclusão em volta, sem andar.
  for (const { c, g } of corpos) macioDoTrecho(g.baixo, c, OCLUSAO.macia * k, OCLUSAO.alfa, 0, 0, false)
  for (const { p, g } of visiveis) bordaDoPilar(g.baixo, p, OCLUSAO.macia * k, uSombra, vDaRampa(OCLUSAO.alfa), vDaRampa(0), 0, 0)
  // 3. O contorno.
  for (const { c, g } of corpos) contornoDoTrecho(g.baixo, c, CONTORNO_PX * k)
  for (const { p, g } of visiveis) bordaDoPilar(g.baixo, p, CONTORNO_PX * k, uDaCela(COR.contorno), V_DA_COR, V_DA_COR, 0, 0)
  // 4. A junta por baixo das peças. Na ponta que continua noutra peça ela passa 1 px do corte, por baixo
  // da vizinha: duas malhas que só se encostam podem deixar um fio do chão aparecer na emenda.
  const passa = (tipo: Trecho['pontas'][0]['tipo']): number => (tipo === 'solta' ? 0 : k)
  for (const { c, g } of corpos) {
    const a = passa(c.t.pontas[0].tipo)
    const b = passa(c.t.pontas[1].tipo)
    chapadoNoQuadro(g.cima, c.q, c.c0(-c.h) - a, -c.h, c.c1(-c.h) + b, -c.h, c.c1(c.h) + b, c.h, c.c0(c.h) - a, c.h, uDaCela(COR.junta), V_DA_COR)
  }
  // 5. As peças.
  for (const { c, g } of corpos) {
    topoDoTrecho(g.cima, c, materialDoCatalogo(g.material).receita, k, MATERIAIS_DA_PAREDE.findIndex((x) => x.id === g.material))
    quinaDoTrecho(g.cima, c, k)
  }
  for (const { p, g } of visiveis) {
    topoDoPilar(g.cima, p, materialDoCatalogo(g.material).receita, k)
    quinaDoPilar(g.cima, p, k)
  }
  const malhas: MalhaEmPecas[] = []
  for (const g of grupos.values()) {
    if (g.cima.vazia && g.baixo.vazia) continue
    malhas.push({ material: g.material, alpha: g.alpha, baixo: g.baixo.fechar(), cima: g.cima.fechar() })
  }
  return malhas
}

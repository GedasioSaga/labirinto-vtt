import { Matrix, type Graphics } from 'pixi.js'
import { FOLHA_DA_ESCADA, type AparenciaDaEscada } from '../lib/materialDaEscada'
import { TREAD_PITCH_RATIO } from './stairFlight'
import { texturaDaEscada } from './texturaDaEscada'
import type { Point } from './world'

/**
 * OS DEGRAUS DA ESCADA COM MATERIAL (pedido de 16/11/2026, item 9). Vale para
 * a reta, a curva, a L, a U e a espiral: quem chama (`drawStairs.ts`) entrega,
 * lance a lance, as LINHAS que separam os degraus (do pé até onde os degraus
 * acabam) e o patamar; aqui cada faixa entre duas linhas vira um degrau:
 *
 *  - a MATÉRIA: uma fiada da folha do material (`lib/materialDaEscada.ts`)
 *    esticada na fundura do degrau, ao comprido dele, e deslocada degrau a
 *    degrau. A fiada que muda de um degrau para o outro (outra tábua, outra
 *    fileira de tijolo) já marca o degrau antes de qualquer sombra;
 *  - a SOMBRA DO FUNDO: o canto onde o degrau encontra o espelho do próximo,
 *    marrom do Meio-Termo (nunca preto), mais forte junto à linha;
 *  - a LUZ DO FOCINHO: uma tira clara na borda que dá para o pé;
 *  - o PÉ MAIS ESCURO: cada degrau um pouco mais claro rumo ao patamar, a mesma
 *    pista de sentido do desenho de linhas (o patamar é o alto);
 *  - a ARESTA: a linha de cada degrau no contorno do material (a própria cor a
 *    60%), com a espessura em px de tela do degrau de linhas.
 *
 * O patamar leva a mesma folha com as fiadas empilhadas (piso de tábuas, de
 * tijolos), sem sombra: é o mais claro, o topo.
 */

export type LinhaDoDegrau = readonly [Point, Point]

export interface LanceComMaterial {
  /** Do pé até o fim dos degraus: a borda do pé, um degrau por linha e a linha onde os degraus acabam. */
  linhas: readonly LinhaDoDegrau[]
  /** Centro do arco na escada curva e na espiral: a faixa segue o arco. `null` no lance reto. */
  centro: Point | null
  /** O patamar (ou os patamares) que este lance alcança, para a matéria seguir o rumo dele. */
  patamares: readonly (readonly Point[])[]
}

/** A sombra e a luz do Meio-Termo (`ESTILO.md` do estúdio): sombra marrom (52, 36, 24), luz quente. */
const COR_DA_SOMBRA = 0x342418
const COR_DA_LUZ = 0xfffaec
/** O degrau do pé escurece até isto; o último antes do patamar, quase nada. */
const ESCURO_DO_PE = 0.32
/** A sombra do fundo em duas tiras sobrepostas (da fração do degrau até a linha): um degradê sem gradiente. */
const SOMBRA_DO_FUNDO = [
  { de: 0.45, alpha: 0.16 },
  { de: 0.75, alpha: 0.2 },
] as const
const LUZ_DO_FOCINHO = { ate: 0.14, alpha: 0.2 } as const
const ALPHA_DA_ARESTA = 0.85
/** Passo entre as fiadas de degraus vizinhos e o deslocamento ao comprido: primos com 8 e 256, a repetição não aparece. */
const SALTO_DA_FIADA = 3
const SALTO_AO_COMPRIDO = 97
/** Flecha máxima do arco das faixas, em px físicos, e o teto de cordas (a espiral grande não vira milhares de pontos). */
const FLECHA_DO_ARCO_PX = 0.25
const MAX_CORDAS = 64
const EPSILON = 1e-9

/**
 * Pinta os degraus e os patamares dos lances, e as arestas por cima. A placa
 * (a moldura que sobra em volta, na cor do contorno) e o traço da moldura são
 * de quem chama, porque a espiral é círculo e a L e a U são uma peça só.
 */
export function pintarDegrausComMaterial(
  graphics: Graphics,
  lances: readonly LanceComMaterial[],
  aparencia: AparenciaDaEscada,
  larguraDaAresta: number,
  pxPorMundo: number,
  opacity: number,
): void {
  const textura = texturaDaEscada(aparencia.folha, aparencia.media)
  const preencher = (matriz: Matrix | null) =>
    textura === null || matriz === null
      ? { color: aparencia.media, alpha: opacity }
      : { texture: textura, matrix: matriz, textureSpace: 'global' as const, color: aparencia.tinta, alpha: opacity }

  for (const lance of lances) {
    const { linhas, centro } = lance
    const faixas = linhas.length - 1
    const escalas: number[] = []
    for (let k = 0; k < faixas; k += 1) {
      const a = linhas[k]
      const b = alinhar(a, linhas[k + 1])
      const mapa = mapaDaFaixa(a, b, k)
      if (mapa !== null) escalas.push(mapa.escala)
      graphics.poly(faixa(a, b, centro, pxPorMundo), true)
      graphics.fill(preencher(mapa?.matriz ?? null))
      // O pé mais escuro: o primeiro degrau inteiro, o último quase nada.
      const escuro = ESCURO_DO_PE * (1 - k / Math.max(1, faixas))
      if (escuro > 0) {
        graphics.poly(faixa(a, b, centro, pxPorMundo), true)
        graphics.fill({ color: COR_DA_SOMBRA, alpha: escuro * opacity })
      }
    }
    // Sombra do fundo e luz do focinho de todos os degraus numa instrução por tira (as tiras de um passe não se cruzam).
    for (const tira of SOMBRA_DO_FUNDO) {
      if (faixas < 1) break
      for (let k = 0; k < faixas; k += 1) {
        const a = linhas[k]
        const b = alinhar(a, linhas[k + 1])
        graphics.poly(faixa(linhaEntre(a, b, tira.de, centro), b, centro, pxPorMundo), true)
      }
      graphics.fill({ color: COR_DA_SOMBRA, alpha: tira.alpha * opacity })
    }
    if (faixas >= 1) {
      for (let k = 0; k < faixas; k += 1) {
        const a = linhas[k]
        const b = alinhar(a, linhas[k + 1])
        graphics.poly(faixa(a, linhaEntre(a, b, LUZ_DO_FOCINHO.ate, centro), centro, pxPorMundo), true)
      }
      graphics.fill({ color: COR_DA_LUZ, alpha: LUZ_DO_FOCINHO.alpha * opacity })
    }

    // O patamar: a folha com as fiadas empilhadas, no rumo da última linha e na escala média dos degraus.
    // Lance sem miolo (sem linha nenhuma): o patamar ainda é chão, na cor média.
    const ultima = linhas[linhas.length - 1]
    const escala = escalas.length > 0 ? escalas.reduce((s, e) => s + e, 0) / escalas.length : ultima === undefined ? 0 : escalaSemDegrau(ultima)
    for (const patamar of lance.patamares) {
      if (patamar.length < 3) continue
      graphics.poly(patamar as Point[], true)
      graphics.fill(preencher(ultima === undefined ? null : mapaDoPatamar(ultima, patamar, escala)))
    }
  }

  // A aresta de cada degrau (o focinho), inclusive a do último degrau com o patamar; a borda do pé é a moldura.
  let algumaAresta = false
  for (const { linhas } of lances) {
    for (let k = 1; k < linhas.length; k += 1) {
      const [p, q] = linhas[k]
      graphics.moveTo(p.x, p.y)
      graphics.lineTo(q.x, q.y)
      algumaAresta = true
    }
  }
  if (algumaAresta) graphics.stroke({ width: larguraDaAresta, color: aparencia.contorno, alpha: ALPHA_DA_ARESTA * opacity, cap: 'butt' })
}

/** `b` com as pontas na ordem de `a` (a faixa não se cruza mesmo se quem chamou desenhou a linha ao contrário). */
function alinhar(a: LinhaDoDegrau, b: LinhaDoDegrau): LinhaDoDegrau {
  const reto = Math.hypot(a[0].x - b[0].x, a[0].y - b[0].y) + Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y)
  const cruzado = Math.hypot(a[0].x - b[1].x, a[0].y - b[1].y) + Math.hypot(a[1].x - b[0].x, a[1].y - b[0].y)
  return cruzado < reto ? [b[1], b[0]] : b
}

/** O ponto a uma fração `t` de `p` a `q`: em reta, ou girando em volta do centro (raio e ângulo juntos). */
function entre(p: Point, q: Point, t: number, centro: Point | null): Point {
  if (centro === null) return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }
  const ap = Math.atan2(p.y - centro.y, p.x - centro.x)
  const aq = Math.atan2(q.y - centro.y, q.x - centro.x)
  const d = voltaCurta(aq - ap)
  const rp = Math.hypot(p.x - centro.x, p.y - centro.y)
  const rq = Math.hypot(q.x - centro.x, q.y - centro.y)
  const angulo = ap + d * t
  const raio = rp + (rq - rp) * t
  return { x: centro.x + Math.cos(angulo) * raio, y: centro.y + Math.sin(angulo) * raio }
}

function voltaCurta(angulo: number): number {
  let d = angulo
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

function linhaEntre(a: LinhaDoDegrau, b: LinhaDoDegrau, t: number, centro: Point | null): LinhaDoDegrau {
  return [entre(a[0], b[0], t, centro), entre(a[1], b[1], t, centro)]
}

/** Os pontos de `p` a `q` (os dois inclusos): reta, ou arco em cordas curtas o bastante para não se ver. */
function arco(p: Point, q: Point, centro: Point | null, pxPorMundo: number): Point[] {
  if (centro === null) return [p, q]
  const raio = Math.max(Math.hypot(p.x - centro.x, p.y - centro.y), Math.hypot(q.x - centro.x, q.y - centro.y))
  const volta = Math.abs(voltaCurta(Math.atan2(q.y - centro.y, q.x - centro.x) - Math.atan2(p.y - centro.y, p.x - centro.x)))
  // Flecha da corda de ângulo θ num raio r: r·θ²/8.
  const maxAngulo = Math.sqrt((8 * FLECHA_DO_ARCO_PX) / Math.max(raio * pxPorMundo, EPSILON))
  const cordas = Math.min(MAX_CORDAS, Math.max(1, Math.ceil(volta / maxAngulo)))
  const pontos: Point[] = []
  for (let i = 0; i <= cordas; i += 1) pontos.push(entre(p, q, i / cordas, centro))
  return pontos
}

/** A faixa entre duas linhas (já alinhadas): `a0 → a1`, o lado de `a1` até `b1`, `b1 → b0`, o lado de `b0` até `a0`. */
function faixa(a: LinhaDoDegrau, b: LinhaDoDegrau, centro: Point | null, pxPorMundo: number): Point[] {
  return [...arco(a[1], b[1], centro, pxPorMundo), ...arco(b[0], a[0], centro, pxPorMundo)]
}

/**
 * A matriz que leva a fiada `k` da folha para a faixa: o x da folha ao
 * comprido do degrau (a linha `a`), o y atravessando até `b`, e a fiada
 * inteira na fundura do degrau. Na faixa em cunha (a espiral, a curva) a
 * fundura é a da ponta mais funda, para nenhuma fresta da fiada vizinha
 * aparecer na borda de fora. A escala é a mesma nos dois eixos: o degrau mais
 * fundo tem tábua e tijolo maiores, como a perspectiva do desenho de linhas.
 */
function mapaDaFaixa(a: LinhaDoDegrau, b: LinhaDoDegrau, k: number): { matriz: Matrix; escala: number } | null {
  const eixo = rumo(a)
  if (eixo === null) return null
  const n = normalPara(eixo, a, b)
  const fundura = Math.max(projecao(b[0], a[0], n), projecao(b[1], a[0], n))
  if (!(fundura > EPSILON)) return null
  const escala = fundura / FOLHA_DA_ESCADA.fiada
  const fiada = (k * SALTO_DA_FIADA) % FOLHA_DA_ESCADA.fiadas
  const desvioX = (k * SALTO_AO_COMPRIDO) % FOLHA_DA_ESCADA.largura
  return { matriz: matrizDaFolha(a[0], eixo, n, escala, desvioX, fiada * FOLHA_DA_ESCADA.fiada), escala }
}

/** O patamar: a folha a partir da última linha, rumo ao centro do patamar, sem desvio (as fiadas empilhadas). */
function mapaDoPatamar(ultima: LinhaDoDegrau, patamar: readonly Point[], escala: number): Matrix | null {
  const eixo = rumo(ultima)
  if (eixo === null || !(escala > EPSILON)) return null
  const centro = patamar.reduce((s, p) => ({ x: s.x + p.x / patamar.length, y: s.y + p.y / patamar.length }), { x: 0, y: 0 })
  const n = normalPara(eixo, ultima, [centro, centro])
  return matrizDaFolha(ultima[0], eixo, n, escala, 0, 0)
}

/** Sem degrau nenhum para medir (escada curtinha): a fundura que o degrau teria, `TREAD_PITCH_RATIO` da largura. */
function escalaSemDegrau(linha: LinhaDoDegrau): number {
  const largura = Math.hypot(linha[1].x - linha[0].x, linha[1].y - linha[0].y)
  return (largura * TREAD_PITCH_RATIO) / FOLHA_DA_ESCADA.fiada
}

function rumo(linha: LinhaDoDegrau): Point | null {
  const dx = linha[1].x - linha[0].x
  const dy = linha[1].y - linha[0].y
  const comprimento = Math.hypot(dx, dy)
  return comprimento > EPSILON ? { x: dx / comprimento, y: dy / comprimento } : null
}

/** A perpendicular a `eixo` que aponta de `a` para `b` (o rumo de quem sobe o degrau). */
function normalPara(eixo: Point, a: LinhaDoDegrau, b: LinhaDoDegrau): Point {
  const n = { x: -eixo.y, y: eixo.x }
  const meioA = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }
  const meioB = { x: (b[0].x + b[1].x) / 2, y: (b[0].y + b[1].y) / 2 }
  return (meioB.x - meioA.x) * n.x + (meioB.y - meioA.y) * n.y >= 0 ? n : { x: -n.x, y: -n.y }
}

function projecao(p: Point, origem: Point, n: Point): number {
  return (p.x - origem.x) * n.x + (p.y - origem.y) * n.y
}

/**
 * A matriz do Pixi que leva o texel (x, y) da folha ao mundo:
 * `origem + eixo·escala·(x − desvioX) + n·escala·(y − desvioY)`. O Pixi inverte
 * a matriz para achar o texel de cada ponto (`textureSpace: 'global'`).
 */
function matrizDaFolha(origem: Point, eixo: Point, n: Point, escala: number, desvioX: number, desvioY: number): Matrix {
  const a = eixo.x * escala
  const b = eixo.y * escala
  const c = n.x * escala
  const d = n.y * escala
  return new Matrix(a, b, c, d, origem.x - a * desvioX - c * desvioY, origem.y - b * desvioX - d * desvioY)
}

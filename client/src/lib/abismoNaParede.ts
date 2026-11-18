/**
 * O ABISMO PARA NA PAREDE (pedido de 17/11/2026: "O abismo eu quero que ele
 * pare quando encontrar uma parede ou seja fique limitado a parede"; decisão do
 * mestre: "Rente à parede, nos dois modos"). O buraco chega até a parede, com a
 * beira reta e rente a ela (a parede cobre a emenda), e nunca passa para o
 * outro lado. Vale para o contornado à mão e para o pintado por pincel, e para
 * os abismos que já existiam: o mapa salvo não muda, o corte é feito na hora
 * de ler (`abismosDoMapa`), uma vez, e todo mundo (desenho, andar, NPC, luz,
 * recorte do jogador) recebe o buraco já cortado.
 *
 * Que parede para o buraco: toda parede do piso que aparece na tela, com porta
 * ABERTA OU FECHADA e janela. A porta conta sempre: o vão dela é a linha da
 * parede, e o buraco não muda de forma quando alguém abre a porta no meio do
 * jogo. A parede invisível não conta (não há parede para cobrir o corte reto).
 *
 * De que lado o buraco fica:
 * - contornado à mão: com o pedaço MAIOR (onde mora a maior parte do buraco);
 * - pintado: com os pedaços que têm o meio de um quadrado cavado; o pincel não
 *   cava através da parede, e o traço fica do lado em que começou
 *   (`lib/abismoPintado.ts`).
 * A parede que entra no buraco e acaba lá dentro (ponta solta) não divide nada:
 * o buraco passa em volta da ponta dela.
 *
 * Tudo aqui é puro: sem Pixi nem store.
 */
import type { Abismo, RegionPoint, Wall } from '../types/map'
import { areaDoContorno, contornoSimplificado, pontoNoContorno, TETO_DE_PONTOS_DO_ABISMO } from './abismo'
import { pisoDe } from './pisos'

/** Um trecho reto em px de mundo. */
export interface Trecho {
  ax: number
  ay: number
  bx: number
  by: number
}

/** O pedaço da boca que as paredes cortam. */
export interface PedacoDaBoca {
  pontos: RegionPoint[]
  /** Paredes fechadas (uma sala inteira) dentro do pedaço: viram ilha, chão de pé. */
  buracos: RegionPoint[][]
  area: number
}

/** A tolerância de "em cima da parede / da beira", em px de mundo. */
const EPS = 0.5
/** A parede é esticada um tanto nas pontas: a quina de sala desenhada à mão quase encostando ainda fecha. */
const ALONGA_EM_PX = 1.5
/** A conta deu um pedaço com área que não bate com a boca (mais que isto): desiste e deixa como estava. */
const FOLGA_DA_AREA = 0.01

// ─────────────────────────────────────────────────────────────
// As paredes que param o buraco
// ─────────────────────────────────────────────────────────────

const paredesPorLista = new WeakMap<readonly Wall[], Map<number, readonly Trecho[]>>()

/** As paredes do piso que param o buraco (as que aparecem; com porta ou janela também), já esticadas nas pontas. */
export function trechosQueParam(walls: readonly Wall[] | undefined, piso: number): readonly Trecho[] {
  if (walls === undefined || walls.length === 0) return []
  let porPiso = paredesPorLista.get(walls)
  if (porPiso === undefined) {
    porPiso = new Map()
    paredesPorLista.set(walls, porPiso)
  }
  const guardados = porPiso.get(piso)
  if (guardados !== undefined) return guardados
  const trechos: Trecho[] = []
  for (const w of walls) {
    if (pisoDe(w) !== piso || w.hidden === true) continue
    const tamanho = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
    if (!(tamanho > EPS)) continue
    const ux = ((w.x2 - w.x1) / tamanho) * ALONGA_EM_PX
    const uy = ((w.y2 - w.y1) / tamanho) * ALONGA_EM_PX
    trechos.push({ ax: w.x1 - ux, ay: w.y1 - uy, bx: w.x2 + ux, by: w.y2 + uy })
  }
  porPiso.set(piso, trechos)
  return trechos
}

const assinaturas = new WeakMap<readonly Wall[], string>()

/**
 * A forma das paredes que param buraco, numa linha: muda quando uma parede
 * nasce, sai ou anda, e NÃO muda quando uma porta abre ou fecha (o corte do
 * buraco não é refeito à toa no meio do jogo).
 */
export function assinaturaDasParedes(walls: readonly Wall[] | undefined): string {
  if (walls === undefined || walls.length === 0) return ''
  const guardada = assinaturas.get(walls)
  if (guardada !== undefined) return guardada
  const partes: string[] = []
  for (const w of walls) if (w.hidden !== true) partes.push(`${pisoDe(w)}:${w.x1},${w.y1},${w.x2},${w.y2}`)
  const assinatura = partes.join('|')
  assinaturas.set(walls, assinatura)
  return assinatura
}

/** Os trechos cuja caixa encosta na caixa dada (com folga). */
export function trechosNaCaixa(trechos: readonly Trecho[], minX: number, minY: number, maxX: number, maxY: number, folga: number): Trecho[] {
  return trechos.filter(
    (t) => Math.max(t.ax, t.bx) >= minX - folga && Math.min(t.ax, t.bx) <= maxX + folga && Math.max(t.ay, t.by) >= minY - folga && Math.min(t.ay, t.by) <= maxY + folga,
  )
}

// ─────────────────────────────────────────────────────────────
// Geometria de trechos
// ─────────────────────────────────────────────────────────────

function distanciaAoTrecho(px: number, py: number, t: Trecho): number {
  const dx = t.bx - t.ax
  const dy = t.by - t.ay
  const tamanho = dx * dx + dy * dy
  const s = tamanho === 0 ? 0 : Math.max(0, Math.min(1, ((px - t.ax) * dx + (py - t.ay) * dy) / tamanho))
  return Math.hypot(px - (t.ax + s * dx), py - (t.ay + s * dy))
}

/** A distância do ponto à reta inteira do trecho. */
function distanciaAReta(px: number, py: number, t: Trecho): number {
  const dx = t.bx - t.ax
  const dy = t.by - t.ay
  const tamanho = Math.hypot(dx, dy)
  return tamanho === 0 ? Math.hypot(px - t.ax, py - t.ay) : Math.abs((px - t.ax) * dy - (py - t.ay) * dx) / tamanho
}

/** Os dois trechos andam na mesma reta (dentro da tolerância)? */
function naMesmaReta(s: Trecho, r: Trecho): boolean {
  return (distanciaAReta(r.ax, r.ay, s) <= EPS && distanciaAReta(r.bx, r.by, s) <= EPS) || (distanciaAReta(s.ax, s.ay, r) <= EPS && distanciaAReta(s.bx, s.by, r) <= EPS)
}

/** Onde, no trecho `s` (0 a 1), ele cruza o `r`; `null` se não cruzam. As pontas valem, com a tolerância. */
function cruzamento(s: Trecho, r: Trecho): { t: number; u: number } | null {
  const sx = s.bx - s.ax
  const sy = s.by - s.ay
  const rx = r.bx - r.ax
  const ry = r.by - r.ay
  const d = sx * ry - sy * rx
  const ls = Math.hypot(sx, sy)
  const lr = Math.hypot(rx, ry)
  if (ls === 0 || lr === 0 || Math.abs(d) < 1e-9 * ls * lr) return null
  const qx = r.ax - s.ax
  const qy = r.ay - s.ay
  const t = (qx * ry - qy * rx) / d
  const u = (qx * sy - qy * sx) / d
  const ts = EPS / ls
  const tr = EPS / lr
  if (t < -ts || t > 1 + ts || u < -tr || u > 1 + tr) return null
  return { t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)) }
}

/** O caminho reto de `a` a `b` bate em alguma parede? (encostar conta) */
export function paredeNoCaminho(a: RegionPoint, b: RegionPoint, trechos: readonly Trecho[]): boolean {
  const caminho = { ax: a.x, ay: a.y, bx: b.x, by: b.y }
  return trechos.some((t) => cruzamento(caminho, t) !== null)
}

function caixaDosPontos(pontos: readonly RegionPoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

/** A distância do ponto à beira do contorno (sem criar objeto por lado: roda muito no corte). */
function distanciaABeira(pontos: readonly RegionPoint[], px: number, py: number): number {
  let menor = Infinity
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i, i += 1) {
    const a = pontos[j]
    const b = pontos[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const tamanho = dx * dx + dy * dy
    const s = tamanho === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / tamanho))
    const ex = px - (a.x + s * dx)
    const ey = py - (a.y + s * dy)
    menor = Math.min(menor, ex * ex + ey * ey)
  }
  return Math.sqrt(menor)
}

/** Chave numérica de uma casa inteira (de -2^20 a 2^20 em cada eixo): Map com número é bem mais barato que com texto. */
function chaveDaCasa(x: number, y: number): number {
  return (x + 1048576) * 2097152 + (y + 1048576)
}

/** Dentro da boca e longe da beira (o ponto em cima da beira não conta como dentro). */
function dentroDeVerdade(pontos: readonly RegionPoint[], px: number, py: number): boolean {
  return pontoNoContorno(pontos, { x: px, y: py }) && distanciaABeira(pontos, px, py) > EPS
}

/** A parede entra na boca: atravessa a beira (fora da mesma reta) ou tem um pedaço lá dentro. */
function paredeEntraNaBoca(parede: Trecho, boca: readonly RegionPoint[], lados: readonly Trecho[]): boolean {
  if (dentroDeVerdade(boca, (parede.ax + parede.bx) / 2, (parede.ay + parede.by) / 2)) return true
  if (dentroDeVerdade(boca, parede.ax, parede.ay) || dentroDeVerdade(boca, parede.bx, parede.by)) return true
  return lados.some((lado) => cruzamento(lado, parede) !== null && !naMesmaReta(lado, parede))
}

// ─────────────────────────────────────────────────────────────
// O corte: a boca dividida pelas paredes
// ─────────────────────────────────────────────────────────────

/** Os vértices do corte, juntando os que caem a menos de `EPS` um do outro. */
function criarVertices(): { indice: (x: number, y: number) => number; xs: number[]; ys: number[] } {
  const xs: number[] = []
  const ys: number[] = []
  const porCasa = new Map<number, number[]>()
  const indice = (x: number, y: number): number => {
    const cx = Math.floor(x / EPS)
    const cy = Math.floor(y / EPS)
    // A própria casa primeiro: quase toda ponta repetida cai nela.
    for (let k = 0; k < 9; k += 1) {
      const dx = k === 0 ? 0 : ((k - 1) % 3) - 1
      const dy = k === 0 ? 0 : Math.floor((k - 1) / 3) - 1
      const lista = porCasa.get(chaveDaCasa(cx + dx, cy + dy))
      if (lista !== undefined) for (const v of lista) if (Math.abs(xs[v] - x) <= EPS && Math.abs(ys[v] - y) <= EPS && Math.hypot(xs[v] - x, ys[v] - y) <= EPS) return v
    }
    const v = xs.length
    xs.push(x)
    ys.push(y)
    const chave = chaveDaCasa(cx, cy)
    const lista = porCasa.get(chave)
    if (lista === undefined) porCasa.set(chave, [v])
    else lista.push(v)
    return v
  }
  return { indice, xs, ys }
}

/**
 * Onde cada trecho é partido (0 a 1): nas pontas, em cada cruzamento e, na
 * mesma reta, onde o outro começa ou acaba. `bocaSeCruza`: dois lados da boca
 * se cruzam (o contorno à mão que deu uma volta por cima de si).
 */
function pontosDeCorte(trechos: readonly Trecho[], lados: number, bocaSimples: boolean): { cortes: number[][]; bocaSeCruza: boolean } {
  const cortes = trechos.map(() => [0, 1])
  let bocaSeCruza = false
  const projetar = (p: number, q: number, t: Trecho): number => {
    const dx = t.bx - t.ax
    const dy = t.by - t.ay
    return ((p - t.ax) * dx + (q - t.ay) * dy) / (dx * dx + dy * dy)
  }
  for (let i = 0; i < trechos.length; i += 1) {
    // A boca que não se cruza (a do pintado, que sai dos quadrados) pula a conta lado com lado.
    for (let j = bocaSimples && i < lados ? lados : i + 1; j < trechos.length; j += 1) {
      // Lados vizinhos da boca só se tocam na ponta em comum.
      if (j < lados && (j === i + 1 || (i === 0 && j === lados - 1))) continue
      const s = trechos[i]
      const r = trechos[j]
      if (Math.max(s.ax, s.bx) < Math.min(r.ax, r.bx) - EPS || Math.max(r.ax, r.bx) < Math.min(s.ax, s.bx) - EPS) continue
      if (Math.max(s.ay, s.by) < Math.min(r.ay, r.by) - EPS || Math.max(r.ay, r.by) < Math.min(s.ay, s.by) - EPS) continue
      if (naMesmaReta(s, r)) {
        // Na mesma reta: cada um parte onde o outro começa e acaba (os pedaços iguais viram uma aresta só).
        for (const k of [projetar(r.ax, r.ay, s), projetar(r.bx, r.by, s)]) if (k > 0 && k < 1) cortes[i].push(k)
        for (const k of [projetar(s.ax, s.ay, r), projetar(s.bx, s.by, r)]) if (k > 0 && k < 1) cortes[j].push(k)
        continue
      }
      const c = cruzamento(s, r)
      if (c === null) continue
      cortes[i].push(c.t)
      cortes[j].push(c.u)
      if (j < lados) bocaSeCruza = true
    }
  }
  return { cortes, bocaSeCruza }
}

interface Aresta {
  a: number
  b: number
  daBoca: boolean
}

/** As arestas do corte, sem repetir: cada trecho partido nos seus cortes. */
function arestasDoCorte(trechos: readonly Trecho[], lados: number, cortes: readonly number[][], indice: (x: number, y: number) => number): Aresta[] {
  const porPar = new Map<number, Aresta>()
  // Cada canto da boca é ponta de dois lados: o vértice dele sai uma vez só.
  const cantos = trechos.slice(0, lados).map((t) => indice(t.ax, t.ay))
  trechos.forEach((t, i) => {
    const ks = cortes[i].sort((p, q) => p - q)
    let anterior = i < lados ? cantos[i] : indice(t.ax, t.ay)
    for (let n = 1; n < ks.length; n += 1) {
      if (ks[n] === ks[n - 1]) continue
      const v = i < lados && ks[n] === 1 ? cantos[(i + 1) % lados] : indice(t.ax + (t.bx - t.ax) * ks[n], t.ay + (t.by - t.ay) * ks[n])
      if (v !== anterior) {
        const chave = Math.min(anterior, v) * 2097152 + Math.max(anterior, v)
        const existente = porPar.get(chave)
        if (existente === undefined) porPar.set(chave, { a: anterior, b: v, daBoca: i < lados })
        else existente.daBoca = existente.daBoca || i < lados
      }
      anterior = v
    }
  })
  return [...porPar.values()]
}

/** Tira, de novo e de novo, a aresta com uma ponta solta (a parede que acaba dentro do buraco não divide nada). */
function semPontasSoltas(arestas: readonly Aresta[]): Aresta[] {
  let vivas = [...arestas]
  for (;;) {
    const grau = new Map<number, number>()
    for (const e of vivas) {
      grau.set(e.a, (grau.get(e.a) ?? 0) + 1)
      grau.set(e.b, (grau.get(e.b) ?? 0) + 1)
    }
    const ficam = vivas.filter((e) => (grau.get(e.a) ?? 0) > 1 && (grau.get(e.b) ?? 0) > 1)
    if (ficam.length === vivas.length) return vivas
    vivas = ficam
  }
}

interface Face {
  vertices: number[]
  /** As arestas da face, na ordem (a do vértice i ao i + 1). */
  arestas: number[]
  area: number
}

/** As faces do desenho plano das arestas: cada uma fica à esquerda de quem anda por ela (a de fora sai com área negativa). */
function facesDoCorte(arestas: readonly Aresta[], xs: readonly number[], ys: readonly number[]): Face[] | null {
  // Meia-aresta 2k vai de a para b; 2k + 1, de b para a. Os vértices são 0..n-1: listas por índice, sem Map.
  const origem = (h: number): number => (h % 2 === 0 ? arestas[h >> 1].a : arestas[h >> 1].b)
  const meias = arestas.length * 2
  const angulo = new Float64Array(meias)
  const saidas: number[][] = xs.map(() => [])
  for (let h = 0; h < meias; h += 1) {
    const v = origem(h)
    const w = origem(h ^ 1)
    angulo[h] = Math.atan2(ys[w] - ys[v], xs[w] - xs[v])
    saidas[v].push(h)
  }
  const posicao = new Int32Array(meias)
  for (const lista of saidas) {
    if (lista.length > 1) lista.sort((p, q) => angulo[p] - angulo[q])
    lista.forEach((h, i) => {
      posicao[h] = i
    })
  }
  const visitada = new Uint8Array(meias)
  const faces: Face[] = []
  for (let h0 = 0; h0 < meias; h0 += 1) {
    if (visitada[h0]) continue
    const vertices: number[] = []
    const daFace: number[] = []
    let h = h0
    let passos = 0
    while (!visitada[h]) {
      visitada[h] = 1
      vertices.push(origem(h))
      daFace.push(h >> 1)
      const gemea = h ^ 1
      const lista = saidas[origem(gemea)]
      const i = posicao[gemea]
      h = lista[(i - 1 + lista.length) % lista.length]
      passos += 1
      if (passos > meias) return null
    }
    if (h !== h0) return null
    let soma = 0
    for (let k = 0; k < vertices.length; k += 1) {
      const p = vertices[k]
      const q = vertices[(k + 1) % vertices.length]
      soma += xs[p] * ys[q] - xs[q] * ys[p]
    }
    faces.push({ vertices, arestas: daFace, area: soma / 2 })
  }
  return faces
}

/** Um ponto logo à esquerda do meio da aresta mais comprida da face (do lado de dentro dela). */
function pontoDaFace(face: Face, xs: readonly number[], ys: readonly number[]): RegionPoint {
  let melhor = 0
  let maior = -1
  for (let k = 0; k < face.vertices.length; k += 1) {
    const p = face.vertices[k]
    const q = face.vertices[(k + 1) % face.vertices.length]
    const tamanho = Math.hypot(xs[q] - xs[p], ys[q] - ys[p])
    if (tamanho > maior) {
      maior = tamanho
      melhor = k
    }
  }
  const p = face.vertices[melhor]
  const q = face.vertices[(melhor + 1) % face.vertices.length]
  const dx = (xs[q] - xs[p]) / (maior || 1)
  const dy = (ys[q] - ys[p]) / (maior || 1)
  const passo = Math.min(EPS / 2, maior / 8)
  return { x: (xs[p] + xs[q]) / 2 - dy * passo, y: (ys[p] + ys[q]) / 2 + dx * passo }
}

function pontosDaFace(face: Face, xs: readonly number[], ys: readonly number[]): RegionPoint[] {
  return face.vertices.map((v) => ({ x: xs[v], y: ys[v] }))
}

/** Quanto (px) um ponto pode sair da reta dos vizinhos e ainda sair do contorno do pedaço. */
const RETA_EM_PX = 0.1

/**
 * O pedaço sem os pontos que caem na reta dos vizinhos (o corte parte a beira
 * em muitos pedacinhos colineares), com 0,1 px de arredondamento, como o
 * contorno enxuto. Passou do teto de pontos: Douglas-Peucker (`contornoSimplificado`).
 */
function enxuto(pontos: readonly RegionPoint[]): RegionPoint[] {
  const ficam: RegionPoint[] = []
  for (let i = 0; i < pontos.length; i += 1) {
    const a = ficam.length > 0 ? ficam[ficam.length - 1] : pontos[pontos.length - 1]
    const b = pontos[i]
    const c = pontos[(i + 1) % pontos.length]
    if (distanciaAReta(b.x, b.y, { ax: a.x, ay: a.y, bx: c.x, by: c.y }) > RETA_EM_PX) ficam.push(b)
  }
  const redondos = ficam.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }))
  return redondos.length > TETO_DE_PONTOS_DO_ABISMO ? contornoSimplificado(redondos, EPS) : redondos
}

/**
 * A boca dividida pelas paredes: os pedaços (do maior para o menor) em que as
 * paredes que a atravessam a partem, cada um com a beira reta onde encosta na
 * parede. `null` quando nenhuma parede entra na boca (o buraco fica como
 * estava) ou quando a conta não fecha (a boca torta demais: fica como estava,
 * em vez de sumir). `bocaSimples`: quem chama garante que a boca não se cruza
 * (a do pintado), e a conta lado com lado é pulada.
 */
export function pedacosDaBoca(boca: readonly RegionPoint[], paredes: readonly Trecho[], bocaSimples = false): PedacoDaBoca[] | null {
  const n = boca.length
  if (n < 3 || paredes.length === 0) return null
  const lados: Trecho[] = boca.map((a, i) => {
    const b = boca[(i + 1) % n]
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y }
  })
  const caixa = caixaDosPontos(boca)
  const entram = trechosNaCaixa(paredes, caixa.minX, caixa.minY, caixa.maxX, caixa.maxY, EPS).filter((p) => paredeEntraNaBoca(p, boca, lados))
  if (entram.length === 0) return null
  const trechos = [...lados, ...entram]
  const { indice, xs, ys } = criarVertices()
  const { cortes, bocaSeCruza } = pontosDeCorte(trechos, n, bocaSimples)
  const todas = arestasDoCorte(trechos, n, cortes, indice)
  // Só o pedaço de parede que está DENTRO da boca corta.
  const valem = semPontasSoltas(todas.filter((e) => e.daBoca || dentroDeVerdade(boca, (xs[e.a] + xs[e.b]) / 2, (ys[e.a] + ys[e.b]) / 2)))
  if (!valem.some((e) => !e.daBoca)) return null
  const faces = facesDoCorte(valem, xs, ys)
  if (faces === null) return null
  const pedacos: { face: Face; pontos: RegionPoint[]; buracos: RegionPoint[][] }[] = []
  for (const face of faces) {
    if (face.area <= EPS * EPS) continue
    const p = pontoDaFace(face, xs, ys)
    if (pontoNoContorno(boca, p)) pedacos.push({ face, pontos: pontosDaFace(face, xs, ys), buracos: [] })
  }
  // A parede fechada dentro do buraco (sem tocar a beira) dá uma face de área negativa: vira ilha do pedaço em volta dela.
  for (const face of faces) {
    if (face.area >= 0 || face.arestas.some((k) => valem[k].daBoca)) continue
    const fora = pontoDaFace(face, xs, ys)
    const dono = pedacos.filter((d) => pontoNoContorno(d.pontos, fora)).sort((a, b) => a.face.area - b.face.area)[0]
    if (dono !== undefined) dono.buracos.push(pontosDaFace(face, xs, ys).reverse())
  }
  if (pedacos.length === 0) return null
  // A conta tem de fechar: os pedaços juntos dão a boca (na boca que não se cruza).
  const somaDosPedacos = pedacos.reduce((t, d) => t + d.face.area - d.buracos.reduce((s, b) => s + areaDoContorno(b), 0), 0)
  const daBoca = areaDoContorno(boca)
  if (!bocaSeCruza && Math.abs(somaDosPedacos - daBoca) > daBoca * FOLGA_DA_AREA) return null
  return pedacos
    .map((d) => {
      const pontos = enxuto(d.pontos)
      return { pontos, buracos: d.buracos.map(enxuto), area: areaDoContorno(pontos) }
    })
    .filter((d) => d.pontos.length >= 3)
    .sort((a, b) => b.area - a.area)
}

// ─────────────────────────────────────────────────────────────
// O contornado à mão: fica o pedaço maior
// ─────────────────────────────────────────────────────────────

/** Algum ponto do contorno está dentro da boca? */
export function algumPontoDentro(contorno: readonly RegionPoint[], boca: readonly RegionPoint[]): boolean {
  return contorno.some((p) => pontoNoContorno(boca, p))
}

const porAbismo = new WeakMap<Abismo, { assinatura: string; rente: Abismo }>()

/** O abismo contornado, cortado pelas paredes: fica o pedaço maior. O MESMO abismo quando nenhuma parede entra nele. */
function contornadoRente(abismo: Abismo, trechos: readonly Trecho[]): Abismo {
  if (abismo.pontos.length < 3) return abismo
  const caixa = caixaDosPontos(abismo.pontos)
  const perto = trechosNaCaixa(trechos, caixa.minX, caixa.minY, caixa.maxX, caixa.maxY, EPS)
  const assinatura = perto.map((t) => `${t.ax},${t.ay},${t.bx},${t.by}`).join('|')
  const guardado = porAbismo.get(abismo)
  if (guardado !== undefined && guardado.assinatura === assinatura) return guardado.rente
  const pedacos = perto.length === 0 ? null : pedacosDaBoca(abismo.pontos, perto)
  let rente = abismo
  const maior = pedacos?.[0]
  if (maior !== undefined) {
    const ilhas = [...(abismo.ilhas ?? []).filter((ilha) => algumPontoDentro(ilha, maior.pontos)), ...maior.buracos]
    const { ilhas: _antes, ...resto } = abismo
    rente = { ...resto, pontos: maior.pontos, ...(ilhas.length > 0 ? { ilhas } : {}) }
  }
  porAbismo.set(abismo, { assinatura, rente })
  return rente
}

const contornadosPorLista = new WeakMap<readonly Abismo[], { assinatura: string; lista: readonly Abismo[] }>()

/**
 * Os abismos contornados à mão (`map.abismos`) cortados pelas paredes do piso
 * de cada um. A PRÓPRIA lista quando nenhuma parede entra em nenhum deles; a
 * mesma lista com as mesmas paredes devolve o MESMO array (as paredes de andar
 * e a luz guardam cache pela referência).
 */
export function contornadosRentesAParede(lista: readonly Abismo[] | undefined, walls: readonly Wall[] | undefined): readonly Abismo[] | undefined {
  if (lista === undefined || lista.length === 0 || walls === undefined || walls.length === 0) return lista
  const assinatura = assinaturaDasParedes(walls)
  const guardada = contornadosPorLista.get(lista)
  if (guardada !== undefined && guardada.assinatura === assinatura) return guardada.lista
  const rentes = lista.map((abismo) => contornadoRente(abismo, trechosQueParam(walls, pisoDe(abismo))))
  const mudou = rentes.some((a, i) => a !== lista[i])
  const anterior = guardada?.lista
  const resultado = !mudou ? lista : anterior !== undefined && anterior.length === rentes.length && anterior.every((a, i) => a === rentes[i]) ? anterior : rentes
  contornadosPorLista.set(lista, { assinatura, lista: resultado })
  return resultado
}

// ─────────────────────────────────────────────────────────────
// O pintado: as paredes quadrado por quadrado
// ─────────────────────────────────────────────────────────────

/** Um quadrado da grade do abismo pintado. */
export interface Quadrado {
  x: number
  y: number
}

/** As paredes em volta dos quadrados do abismo pintado (o pincel e o buraco perguntam aqui, sem varrer o mapa todo). */
export interface ParedesNosQuadrados {
  /** As paredes que passam perto destes quadrados, sem repetir. */
  perto: (quadrados: Iterable<Quadrado>) => Trecho[]
  /** Uma parede passa entre os quadrados vizinhos (pelo lado) `a` e `b`, de ponta a ponta do lado em comum? */
  separa: (a: Quadrado, b: Quadrado) => boolean
}

/** As retas paralelas (fração do quadrado, de cada lado do meio) que a parede tem de cortar para separar dois quadrados. */
const RAIOS_DA_SEPARACAO: readonly number[] = [-0.45, 0, 0.45]
/** De quanto em quanto (em quadrados) a parede é amostrada para saber em que quadrados ela passa. */
const PASSO_DA_AMOSTRA = 0.5

const indicesPorLista = new WeakMap<readonly Wall[], Map<string, ParedesNosQuadrados | null>>()

/**
 * As paredes do piso por quadrado da grade do pintado (`quadrado`, `origem`):
 * cada parede fica registrada nos quadrados por onde passa e nos vizinhos
 * deles. `null` sem parede nenhuma no piso. Guardado pela lista de paredes.
 */
export function paredesNosQuadrados(walls: readonly Wall[] | undefined, piso: number, quadrado: number, origem: RegionPoint): ParedesNosQuadrados | null {
  if (walls === undefined || quadrado <= 0) return null
  let porChave = indicesPorLista.get(walls)
  if (porChave === undefined) {
    porChave = new Map()
    indicesPorLista.set(walls, porChave)
  }
  const chave = `${piso}:${quadrado}:${origem.x},${origem.y}`
  const guardado = porChave.get(chave)
  if (guardado !== undefined) return guardado
  const indice = criarIndice(trechosQueParam(walls, piso), quadrado, origem)
  porChave.set(chave, indice)
  return indice
}

function criarIndice(trechos: readonly Trecho[], q: number, origem: RegionPoint): ParedesNosQuadrados | null {
  if (trechos.length === 0) return null
  const noQuadrado = new Map<number, Trecho[]>()
  for (const t of trechos) {
    const passos = Math.max(1, Math.ceil(Math.hypot(t.bx - t.ax, t.by - t.ay) / (q * PASSO_DA_AMOSTRA)))
    const vistos = new Set<number>()
    for (let k = 0; k <= passos; k += 1) {
      const cx = Math.floor((t.ax + ((t.bx - t.ax) * k) / passos - origem.x) / q)
      const cy = Math.floor((t.ay + ((t.by - t.ay) * k) / passos - origem.y) / q)
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const chave = chaveDaCasa(cx + dx, cy + dy)
          if (vistos.has(chave)) continue
          vistos.add(chave)
          const lista = noQuadrado.get(chave)
          if (lista === undefined) noQuadrado.set(chave, [t])
          else lista.push(t)
        }
      }
    }
  }
  const no = (x: number, y: number): readonly Trecho[] | undefined => noQuadrado.get(chaveDaCasa(x, y))
  const perto = (quadrados: Iterable<Quadrado>): Trecho[] => {
    const juntos = new Set<Trecho>()
    for (const c of quadrados) {
      const lista = no(c.x, c.y)
      if (lista !== undefined) for (const t of lista) juntos.add(t)
    }
    return [...juntos]
  }
  // Os dois lados registram as paredes vizinhas; perguntar às duas listas (a repetida só custa uma conta a mais).
  const bate = (caminho: Trecho, lista: readonly Trecho[] | undefined): boolean => lista !== undefined && lista.some((t) => cruzamento(caminho, t) !== null)
  const separa = (a: Quadrado, b: Quadrado): boolean => {
    const deA = no(a.x, a.y)
    const deB = deA === no(b.x, b.y) ? undefined : no(b.x, b.y)
    if (deA === undefined && deB === undefined) return false
    const ax = origem.x + (a.x + 0.5) * q
    const ay = origem.y + (a.y + 0.5) * q
    const bx = origem.x + (b.x + 0.5) * q
    const by = origem.y + (b.y + 0.5) * q
    const dx = Math.sign(b.x - a.x)
    const dy = Math.sign(b.y - a.y)
    return RAIOS_DA_SEPARACAO.every((k) => {
      const ox = -dy * k * q
      const oy = dx * k * q
      const caminho = { ax: ax + ox, ay: ay + oy, bx: bx + ox, by: by + oy }
      return bate(caminho, deA) || bate(caminho, deB)
    })
  }
  return { perto, separa }
}

/**
 * Os carimbos do traço que ficam do lado em que ele começou: cada um vale se o
 * caminho reto desde o último que valeu (`ancora`) não bate em parede. A mão
 * que passa da parede deixa de cavar e volta a cavar quando volta para o lado
 * de cá (a porta é parede: o traço não passa pelo vão).
 */
export function centrosDoMesmoLado(ancora: RegionPoint, centros: readonly RegionPoint[], walls: readonly Wall[] | undefined, piso: number): { ficam: RegionPoint[]; ancora: RegionPoint } {
  const trechos = trechosQueParam(walls, piso)
  if (trechos.length === 0) return { ficam: [...centros], ancora: centros.length > 0 ? centros[centros.length - 1] : ancora }
  const ficam: RegionPoint[] = []
  let ultimo = ancora
  for (const c of centros) {
    const perto = trechosNaCaixa(trechos, Math.min(ultimo.x, c.x), Math.min(ultimo.y, c.y), Math.max(ultimo.x, c.x), Math.max(ultimo.y, c.y), EPS)
    if (perto.length > 0 && paredeNoCaminho(ultimo, c, perto)) continue
    ficam.push(c)
    ultimo = c
  }
  return { ficam, ancora: ultimo }
}

// ─────────────────────────────────────────────────────────────
// O desenho: que lados da boca são rentes à parede
// ─────────────────────────────────────────────────────────────

/** Fração (do seno do ângulo) abaixo da qual a aresta e a parede contam como paralelas. */
const PARALELA = 0.05
const AMOSTRAS_DO_LADO: readonly number[] = [0.25, 0.5, 0.75]

/**
 * Que lados do contorno (o lado i vai do ponto i ao i + 1) correm em cima de
 * uma parede: ali o desenho faz o corte reto, sem lasca nem contorno escuro (a
 * parede cobre a emenda). Vale para o abismo que já chegou cortado (o recorte
 * do jogador): basta ter as paredes.
 */
export function ladosNaParede(pontos: readonly RegionPoint[], trechos: readonly Trecho[]): boolean[] {
  const lados = pontos.map(() => false)
  if (pontos.length < 3 || trechos.length === 0) return lados
  const caixa = caixaDosPontos(pontos)
  const perto = trechosNaCaixa(trechos, caixa.minX, caixa.minY, caixa.maxX, caixa.maxY, EPS * 2)
  if (perto.length === 0) return lados
  for (let i = 0; i < pontos.length; i += 1) {
    const a = pontos[i]
    const b = pontos[(i + 1) % pontos.length]
    const tamanho = Math.hypot(b.x - a.x, b.y - a.y)
    if (tamanho <= EPS) continue
    const emCima = (k: number): boolean => {
      const px = a.x + (b.x - a.x) * k
      const py = a.y + (b.y - a.y) * k
      return perto.some((t) => {
        const lt = Math.hypot(t.bx - t.ax, t.by - t.ay)
        const seno = Math.abs((b.x - a.x) * (t.by - t.ay) - (b.y - a.y) * (t.bx - t.ax)) / (tamanho * lt || 1)
        return seno <= PARALELA && distanciaAoTrecho(px, py, t) <= EPS * 1.5
      })
    }
    lados[i] = AMOSTRAS_DO_LADO.every(emCima)
  }
  return lados
}

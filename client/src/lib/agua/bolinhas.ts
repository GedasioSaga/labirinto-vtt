import type { RegionPoint } from '../../types/map'

/**
 * ÁGUA: as BOLINHAS do contorno da água escolhida (pedido "MAR MAIS FÁCIL",
 * 13/11/2026). Tudo aqui é conta pura sobre os pontos de controle, em px de
 * mundo; o gesto e o desenho moram em `pixi/aguaNoEditor.ts`.
 *
 * A água traçada à mão guarda um ponto a cada meia casa: uma bolinha por ponto
 * viraria uma fileira grudada. Então só ALGUNS pontos ganham bolinha (os que
 * seguram a forma, `bolinhasDaForma`); os outros vão junto quando a bolinha do
 * lado anda (`arrastarBolinha`, peso pela distância ao longo do contorno). Só
 * escolher a água não muda ponto nenhum.
 */

/** O que a forma pode afastar-se da linha entre duas bolinhas sem ganhar mais uma, em casas. */
const DESVIO_SEM_BOLINHA = 0.2
/** Bolinhas mais perto que isto (casas) viram uma só: a mão treme no traço. */
const BOLINHA_MAIS_PERTO = 0.75
/** Menos que isto de bolinhas numa água fechada não dá para mexer na forma. */
const BOLINHAS_MINIMAS_FECHADA = 4

const arredondar = (v: number): number => Math.round(v * 10) / 10

/** Distância do ponto ao segmento a-b. */
function distanciaAoSegmento(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const l2 = vx * vx + vy * vy
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2))
  return Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t)
}

/** Douglas-Peucker sobre os índices [de, ate] (inclusive), marcando os que ficam. */
function marcarPorDesvio(pontos: readonly RegionPoint[], de: number, ate: number, tolerancia: number, ficam: boolean[]): void {
  const pilha: [number, number][] = [[de, ate]]
  for (let par = pilha.pop(); par !== undefined; par = pilha.pop()) {
    const [a, b] = par
    if (b - a < 2) continue
    let pior = -1
    let maior = tolerancia
    for (let i = a + 1; i < b; i += 1) {
      const d = distanciaAoSegmento(pontos[i], pontos[a], pontos[b])
      if (d > maior) {
        maior = d
        pior = i
      }
    }
    if (pior < 0) continue
    ficam[pior] = true
    pilha.push([a, pior], [pior, b])
  }
}

/**
 * Quais pontos ganham bolinha, em ordem. `todas` (a água de linhas retas, o
 * retângulo e o ponto a ponto): todos. Na curva à mão, os que seguram a forma
 * (desvio de até 0,2 casa sem bolinha), sem duas grudadas. O rio guarda as
 * duas pontas.
 */
export function bolinhasDaForma(pontos: readonly RegionPoint[], fechada: boolean, grid: number, todas: boolean): number[] {
  const n = pontos.length
  if (todas || n <= (fechada ? BOLINHAS_MINIMAS_FECHADA : 2)) return pontos.map((_, i) => i)
  const ficam = new Array<boolean>(n).fill(false)
  ficam[0] = true
  if (fechada) {
    // O ponto mais longe do primeiro parte o anel em dois caminhos abertos.
    let longe = 1
    for (let i = 1; i < n; i += 1) {
      if (Math.hypot(pontos[i].x - pontos[0].x, pontos[i].y - pontos[0].y) > Math.hypot(pontos[longe].x - pontos[0].x, pontos[longe].y - pontos[0].y)) longe = i
    }
    ficam[longe] = true
    marcarPorDesvio(pontos, 0, longe, DESVIO_SEM_BOLINHA * grid, ficam)
    marcarPorDesvio([...pontos, pontos[0]], longe, n, DESVIO_SEM_BOLINHA * grid, ficam)
  } else {
    ficam[n - 1] = true
    marcarPorDesvio(pontos, 0, n - 1, DESVIO_SEM_BOLINHA * grid, ficam)
  }
  const perto = BOLINHA_MAIS_PERTO * grid
  const indices: number[] = []
  for (let i = 0; i < n; i += 1) {
    if (!ficam[i]) continue
    const ultima = indices[indices.length - 1]
    const ehPonta = !fechada && i === n - 1
    if (ultima !== undefined && !ehPonta && Math.hypot(pontos[i].x - pontos[ultima].x, pontos[i].y - pontos[ultima].y) < perto) continue
    if (ultima !== undefined && ehPonta && indices.length > 1 && Math.hypot(pontos[i].x - pontos[ultima].x, pontos[i].y - pontos[ultima].y) < perto) indices.pop()
    indices.push(i)
  }
  if (fechada && indices.length > 2) {
    const ultima = indices[indices.length - 1]
    if (Math.hypot(pontos[0].x - pontos[ultima].x, pontos[0].y - pontos[ultima].y) < perto) indices.pop()
  }
  // Forma pequena demais para o desvio separar: bolinhas espalhadas por igual.
  const minimo = fechada ? BOLINHAS_MINIMAS_FECHADA : 2
  if (indices.length < minimo) {
    const passo = n / minimo
    return Array.from({ length: minimo }, (_, k) => (k === minimo - 1 && !fechada ? n - 1 : Math.floor(k * passo)))
  }
  return indices
}

/** Os índices entre `de` e `ate` (sem os dois), andando para a frente (com a volta, na fechada). */
function entre(de: number, ate: number, n: number): number[] {
  const out: number[] = []
  for (let i = (de + 1) % n; i !== ate; i = (i + 1) % n) {
    out.push(i)
    if (out.length > n) break
  }
  return out
}

/** Comprimento ao longo dos pontos de controle, de `de` até cada índice de `caminho` e até `ate`. */
function aoLongo(pontos: readonly RegionPoint[], de: number, caminho: readonly number[], ate: number): { s: number[]; total: number } {
  const s: number[] = []
  let anterior = pontos[de]
  let soma = 0
  for (const i of caminho) {
    soma += Math.hypot(pontos[i].x - anterior.x, pontos[i].y - anterior.y)
    s.push(soma)
    anterior = pontos[i]
  }
  soma += Math.hypot(pontos[ate].x - anterior.x, pontos[ate].y - anterior.y)
  return { s, total: soma }
}

/** As bolinhas vizinhas da bolinha `k` (`null` na ponta do rio). */
function vizinhas(marcadas: readonly number[], k: number, fechada: boolean): { antes: number | null; depois: number | null } {
  const m = marcadas.length
  if (m < 2) return { antes: null, depois: null }
  if (fechada) return { antes: marcadas[(k - 1 + m) % m], depois: marcadas[(k + 1) % m] }
  return { antes: k > 0 ? marcadas[k - 1] : null, depois: k < m - 1 ? marcadas[k + 1] : null }
}

/**
 * A bolinha `k` (posição em `marcadas`) levada até `alvo`. Os pontos sem
 * bolinha entre ela e as vizinhas vão junto, cada um pelo peso da distância
 * (a vizinha fica, a arrastada anda inteira): a curva dobra, sem bico. Sempre
 * a partir da forma do COMEÇO do arrasto (`pontos`), para o erro não somar.
 */
export function arrastarBolinha(pontos: readonly RegionPoint[], marcadas: readonly number[], k: number, alvo: RegionPoint, fechada: boolean): RegionPoint[] {
  const n = pontos.length
  const i = marcadas[k]
  const dx = alvo.x - pontos[i].x
  const dy = alvo.y - pontos[i].y
  const out = pontos.slice()
  out[i] = { x: arredondar(alvo.x), y: arredondar(alvo.y) }
  const { antes, depois } = vizinhas(marcadas, k, fechada)
  const levar = (caminho: number[], de: number, ate: number, pesoDe: (s: number, total: number) => number) => {
    const { s, total } = aoLongo(pontos, de, caminho, ate)
    caminho.forEach((h, j) => {
      const w = total === 0 ? 0 : pesoDe(s[j], total)
      out[h] = { x: arredondar(pontos[h].x + dx * w), y: arredondar(pontos[h].y + dy * w) }
    })
  }
  if (antes !== null) levar(entre(antes, i, n), antes, i, (s, total) => s / total)
  if (depois !== null) levar(entre(i, depois, n), i, depois, (s, total) => 1 - s / total)
  // A ponta do rio sem vizinha do outro lado: os pontos além dela (não há) — nada a fazer.
  return out
}

/** A água inteira deslocada. */
export function moverForma(pontos: readonly RegionPoint[], dx: number, dy: number): RegionPoint[] {
  return pontos.map((p) => ({ x: arredondar(p.x + dx), y: arredondar(p.y + dy) }))
}

/**
 * O "meio da linha" entre a bolinha `k` e a seguinte: o ponto sem bolinha do
 * meio do caminho, quando há (já fica na curva), ou `null` quando as duas são
 * vizinhas na lista (o meio é um ponto novo, `pontoNoMeio`).
 */
export function pontoDoMeio(pontos: readonly RegionPoint[], marcadas: readonly number[], k: number, fechada: boolean): number | null {
  const m = marcadas.length
  if (!fechada && k >= m - 1) return null
  const de = marcadas[k]
  const ate = marcadas[(k + 1) % m]
  const caminho = entre(de, ate, pontos.length)
  if (caminho.length === 0) return null
  const { s, total } = aoLongo(pontos, de, caminho, ate)
  let melhor = 0
  for (let j = 1; j < caminho.length; j += 1) if (Math.abs(s[j] - total / 2) < Math.abs(s[melhor] - total / 2)) melhor = j
  return caminho[melhor]
}

/**
 * Onde fica, na curva, o meio entre os pontos `i` e `i + 1` (vizinhos na
 * lista). `reto`: o meio do segmento; curva suave: a Catmull-Rom em t = 0,5,
 * a mesma de `curvaPelosPontos` (`forma.ts`).
 */
export function pontoNoMeio(pontos: readonly RegionPoint[], i: number, fechada: boolean, reto: boolean): RegionPoint {
  const n = pontos.length
  const pega = (j: number): RegionPoint => (fechada ? pontos[((j % n) + n) % n] : pontos[Math.min(n - 1, Math.max(0, j))])
  const p1 = pega(i)
  const p2 = pega(i + 1)
  if (reto) return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const p0 = pega(i - 1)
  const p3 = pega(i + 2)
  // Catmull-Rom em t = 0,5: (-p0 + 9 p1 + 9 p2 - p3) / 16.
  return { x: (-p0.x + 9 * p1.x + 9 * p2.x - p3.x) / 16, y: (-p0.y + 9 * p1.y + 9 * p2.y - p3.y) / 16 }
}

/** Onde desenhar o meio de cada linha entre bolinhas (o rio não liga a última à primeira). */
export function meiosDasBolinhas(pontos: readonly RegionPoint[], marcadas: readonly number[], fechada: boolean, reto: boolean): RegionPoint[] {
  const m = marcadas.length
  const out: RegionPoint[] = []
  const linhas = fechada ? m : m - 1
  for (let k = 0; k < linhas; k += 1) {
    const meio = pontoDoMeio(pontos, marcadas, k, fechada)
    out.push(meio === null ? pontoNoMeio(pontos, marcadas[k], fechada, reto) : pontos[meio])
  }
  return out
}

/**
 * A bolinha `k` tirada: ela e os pontos sem bolinha dos dois lados saem, e a
 * linha passa direto de uma vizinha à outra. `null` = ficaria com menos pontos
 * (ou bolinhas) do que a água precisa.
 */
export function tirarBolinha(
  pontos: readonly RegionPoint[],
  marcadas: readonly number[],
  k: number,
  fechada: boolean,
  minimo: number,
): { pontos: RegionPoint[]; marcadas: number[] } | null {
  const n = pontos.length
  const m = marcadas.length
  if (m - 1 < minimo) return null
  const { antes, depois } = vizinhas(marcadas, k, fechada)
  const sai = new Set<number>([marcadas[k]])
  if (antes !== null) for (const h of entre(antes, marcadas[k], n)) sai.add(h)
  if (depois !== null) for (const h of entre(marcadas[k], depois, n)) sai.add(h)
  if (n - sai.size < minimo) return null
  const novoIndice = new Map<number, number>()
  const restam: RegionPoint[] = []
  pontos.forEach((p, i) => {
    if (sai.has(i)) return
    novoIndice.set(i, restam.length)
    restam.push(p)
  })
  const novas: number[] = []
  for (const i of marcadas) {
    const j = novoIndice.get(i)
    if (j !== undefined) novas.push(j)
  }
  return { pontos: restam, marcadas: novas }
}

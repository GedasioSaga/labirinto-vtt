import type { Agua, RegionPoint } from '../../types/map'
import { larguraDoRio } from './dados'

/**
 * ÁGUA: a forma de cada água, em px de mundo. O traço da mão vira curva suave
 * (Catmull-Rom pelos pontos de controle), como no protótipo
 * (`docs/design/agua/prototipo-agua.html`, `curva`). O rio é aberto; o lago e o
 * mar fecham. É daqui que saem o clique que escolhe, a regra do passo e o
 * corte do jogador; o campo do desenho (`campo.ts`) usa a mesma curva.
 */

/** Distância entre amostras da curva, em frações da casa (6 px numa casa de 40, como no protótipo). */
export const AMOSTRA_DA_CURVA = 0.15

/** A curva pelos pontos de controle, amostrada a cada `amostra` px: [x, y, x, y...]. */
export function curvaPelosPontos(ctrl: readonly RegionPoint[], fechada: boolean, amostra: number): number[] {
  const n = ctrl.length
  if (n === 0) return []
  if (n === 1) return [ctrl[0].x, ctrl[0].y]
  const pega = (i: number): RegionPoint => (fechada ? ctrl[((i % n) + n) % n] : ctrl[Math.min(n - 1, Math.max(0, i))])
  const vaos = fechada ? n : n - 1
  const out: number[] = []
  const passo = Math.max(0.5, amostra)
  for (let i = 0; i < vaos; i += 1) {
    const p0 = pega(i - 1)
    const p1 = pega(i)
    const p2 = pega(i + 1)
    const p3 = pega(i + 2)
    const k = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / passo))
    for (let j = 0; j < k; j += 1) {
      const t = j / k
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y))
    }
  }
  if (!fechada) out.push(ctrl[n - 1].x, ctrl[n - 1].y)
  return out
}

/** A linha reta de ponto a ponto, amostrada a cada `amostra` px, no formato de `curvaPelosPontos` (cada canto é uma amostra). */
function retaPelosPontos(ctrl: readonly RegionPoint[], fechada: boolean, amostra: number): number[] {
  const n = ctrl.length
  if (n === 0) return []
  if (n === 1) return [ctrl[0].x, ctrl[0].y]
  const vaos = fechada ? n : n - 1
  const out: number[] = []
  const passo = Math.max(0.5, amostra)
  for (let i = 0; i < vaos; i += 1) {
    const a = ctrl[i]
    const b = ctrl[(i + 1) % n]
    const k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / passo))
    for (let j = 0; j < k; j += 1) out.push(a.x + ((b.x - a.x) * j) / k, a.y + ((b.y - a.y) * j) / k)
  }
  if (!fechada) out.push(ctrl[n - 1].x, ctrl[n - 1].y)
  return out
}

/**
 * A curva desta água em px de mundo (o rio aberto; o lago e o mar fechados, sem repetir o primeiro ponto).
 * Lago e mar com `reto` (retângulo, ponto a ponto): linha reta entre os pontos, sem a curva que viraria bolha.
 */
export function curvaDaAgua(agua: Pick<Agua, 'tipo' | 'pontos' | 'reto'>, grid: number): number[] {
  if (agua.tipo !== 'rio' && agua.reto === true) return retaPelosPontos(agua.pontos, true, grid * AMOSTRA_DA_CURVA)
  return curvaPelosPontos(agua.pontos, agua.tipo !== 'rio', grid * AMOSTRA_DA_CURVA)
}

/** O traço da mão, sem um ponto por pixel: um ponto a cada `passo` px, e o último. */
export function decimarTraco(bruto: readonly RegionPoint[], passo: number): RegionPoint[] {
  if (bruto.length === 0) return []
  const out: RegionPoint[] = [bruto[0]]
  for (const p of bruto) {
    const u = out[out.length - 1]
    if (Math.hypot(p.x - u.x, p.y - u.y) >= passo) out.push(p)
  }
  const fim = bruto[bruto.length - 1]
  const u = out[out.length - 1]
  if (u !== fim && Math.hypot(fim.x - u.x, fim.y - u.y) > passo * 0.35) out.push(fim)
  return out
}

/** Distância do ponto à polilinha aberta [x, y, ...]. */
export function distanciaAoTraco(xy: readonly number[], x: number, y: number): number {
  let melhor = Infinity
  for (let i = 0; i + 3 < xy.length; i += 2) {
    const ax = xy[i]
    const ay = xy[i + 1]
    const vx = xy[i + 2] - ax
    const vy = xy[i + 3] - ay
    const l2 = vx * vx + vy * vy || 1e-9
    const t = Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / l2))
    melhor = Math.min(melhor, Math.hypot(x - ax - vx * t, y - ay - vy * t))
  }
  if (xy.length === 2) melhor = Math.hypot(x - xy[0], y - xy[1])
  return melhor
}

/** O ponto está dentro do polígono fechado [x, y, ...]? (par ou ímpar) */
export function dentroDoContorno(xy: readonly number[], x: number, y: number): boolean {
  let dentro = false
  const n = xy.length / 2
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const xi = xy[i * 2]
    const yi = xy[i * 2 + 1]
    const xj = xy[j * 2]
    const yj = xy[j * 2 + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

/** A curva amostrada de uma água, guardada pela própria água (o objeto muda quando ela muda). */
const curvas = new WeakMap<Agua, { grid: number; xy: number[] }>()
export function curvaGuardada(agua: Agua, grid: number): number[] {
  const guardada = curvas.get(agua)
  if (guardada !== undefined && guardada.grid === grid) return guardada.xy
  const xy = curvaDaAgua(agua, grid)
  curvas.set(agua, { grid, xy })
  return xy
}

/** O ponto (px de mundo) está na água? O rio pela largura; o lago e o mar pelo contorno. */
export function pontoNaAgua(agua: Agua, grid: number, x: number, y: number): boolean {
  const xy = curvaGuardada(agua, grid)
  if (agua.tipo === 'rio') return distanciaAoTraco(xy, x, y) <= (larguraDoRio(agua) * grid) / 2
  return xy.length >= 6 && dentroDoContorno(xy, x, y)
}

/** A caixa da água em px de mundo (o rio com a meia largura). */
export function caixaDaAgua(agua: Agua, grid: number): { x0: number; y0: number; x1: number; y1: number } {
  const xy = curvaGuardada(agua, grid)
  const folga = agua.tipo === 'rio' ? (larguraDoRio(agua) * grid) / 2 : 0
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i + 1 < xy.length; i += 2) {
    x0 = Math.min(x0, xy[i])
    y0 = Math.min(y0, xy[i + 1])
    x1 = Math.max(x1, xy[i])
    y1 = Math.max(y1, xy[i + 1])
  }
  return { x0: x0 - folga, y0: y0 - folga, x1: x1 + folga, y1: y1 + folga }
}

/** A água de cima (a última da lista) que tem o ponto, ou `null`. */
export function aguaNoPonto(aguas: readonly Agua[], grid: number, x: number, y: number): Agua | null {
  for (let i = aguas.length - 1; i >= 0; i -= 1) if (pontoNaAgua(aguas[i], grid, x, y)) return aguas[i]
  return null
}

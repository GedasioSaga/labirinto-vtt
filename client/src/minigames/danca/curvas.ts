/**
 * Contas pequenas que vários módulos da dança usam: limite, interpolação e as
 * curvas cúbicas com os mesmos números do CSS, para o que anda dentro do canvas
 * andar igual ao que anda no DOM (protótipo `docs/design/minigame-danca/`).
 */

export function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

export function interpolar(a: number, b: number, k: number): number {
  return a + (b - a) * k
}

/** Passos da busca binária que acha o `t` da curva para um `x`: 26 dão erro abaixo de 1e-6. */
const PASSOS_DA_BUSCA = 26
const TOLERANCIA_DA_BUSCA = 1e-6

/** `cubic-bezier(x1, y1, x2, y2)` como função de 0..1 em 0..1. */
export function curvaCubica(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const bx = (t: number): number => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3
  const by = (t: number): number => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    let t = x
    for (let i = 0; i < PASSOS_DA_BUSCA; i += 1) {
      const v = bx(t)
      if (Math.abs(v - x) < TOLERANCIA_DA_BUSCA) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return by(t)
  }
}

export const EASE_OUT = curvaCubica(0.23, 1, 0.32, 1)
export const EASE_IN_OUT = curvaCubica(0.77, 0, 0.175, 1)

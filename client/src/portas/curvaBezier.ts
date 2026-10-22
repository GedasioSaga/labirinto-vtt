/**
 * CURVA DE TEMPO DA PORTA como cubic-bezier: os mesmos 4 números do CSS (x1,
 * y1, x2, y2), para caber no `<id>.json` do pacote (`curvaAbrir`/`curvaFechar`)
 * e no `transition-timing-function` da medalha da ficha.
 *
 * Com os 4 números dentro de [0, 1] a curva é monotônica e nunca passa de 0 nem
 * de 1: o validador recusa o resto, então "sem quique" vale por construção, e
 * não por revisão de cada pacote. (A derivada de y é um polinômio de Bernstein
 * de grau 2 com coeficientes y1, y2 - y1 e 1 - y2; com y1 e y2 em [0, 1] ela
 * nunca fica negativa onde x anda.)
 */
export type CurvaBezier = readonly [number, number, number, number]

export function curvaBezierValida(valor: unknown): valor is CurvaBezier {
  return Array.isArray(valor) && valor.length === 4 && valor.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)
}

/** A curva em CSS, para a medalha andar no mesmo passo do mapa. */
export function curvaBezierEmCss(curva: CurvaBezier): string {
  return `cubic-bezier(${curva.join(', ')})`
}

const PRECISAO = 1e-6

/** A função de tempo: fração do tempo (0..1) para fração do caminho (0..1). */
export function criarCurvaBezier(curva: CurvaBezier): (t: number) => number {
  const [x1, y1, x2, y2] = curva
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const x = (s: number): number => ((ax * s + bx) * s + cx) * s
  const dx = (s: number): number => (3 * ax * s + 2 * bx) * s + cx
  const y = (s: number): number => ((ay * s + by) * s + cy) * s
  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    // Newton primeiro (rápido); se escapar de [0, 1] ou parar, bisseção (sempre converge: x é monotônica).
    let s = t
    for (let i = 0; i < 8; i += 1) {
      const erro = x(s) - t
      if (Math.abs(erro) < PRECISAO) return y(s)
      const d = dx(s)
      if (Math.abs(d) < PRECISAO) break
      s -= erro / d
      if (s < 0 || s > 1) break
    }
    let baixo = 0
    let alto = 1
    s = t
    for (let i = 0; i < 50; i += 1) {
      const valor = x(s)
      if (Math.abs(valor - t) < PRECISAO) break
      if (valor < t) baixo = s
      else alto = s
      s = (baixo + alto) / 2
    }
    return y(s)
  }
}

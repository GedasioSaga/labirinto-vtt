/**
 * FORMAS das peças dos móveis do Meio-Termo, por DISTÂNCIA COM SINAL
 * (negativa dentro, em px do protótipo), portadas de
 * `docs/design/objetos/prototipo/objetos.js:106-230`. Cada forma traz a caixa
 * `b` = [x0, y0, x1, y1] onde ela pode pintar; o pintor (`motor.ts`) só anda
 * dentro dela.
 *
 * Só as formas que os móveis "de cima" usam; o cilindro da vista 3/4 chega com
 * a fatia MT11.
 */

export type Caixa = readonly [number, number, number, number]

export interface Forma {
  readonly b: Caixa
  d(x: number, y: number): number
}

/** Retângulo de cantos arredondados por `raio`. */
export function caixa(x0: number, y0: number, x1: number, y1: number, raio = 0): Forma {
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const r = Math.min(raio, (x1 - x0) / 2, (y1 - y0) / 2)
  const hx = (x1 - x0) / 2 - r
  const hy = (y1 - y0) / 2 - r
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      const qx = Math.abs(x - cx) - hx
      const qy = Math.abs(y - cy) - hy
      const ox = qx > 0 ? qx : 0
      const oy = qy > 0 ? qy : 0
      const dentro = qx > qy ? qx : qy
      return Math.sqrt(ox * ox + oy * oy) + (dentro < 0 ? dentro : 0) - r
    },
  }
}

/** Elipse sem giro (os móveis de cima não giram peça; quem gira é a imagem inteira). */
export function elipse(cx: number, cy: number, rx: number, ry: number): Forma {
  const menor = Math.min(rx, ry)
  return {
    b: [cx - rx, cy - ry, cx + rx, cy + ry],
    d(x, y) {
      const px = x - cx
      const py = y - cy
      // Aproximação de distância à elipse (a de Inigo Quilez): boa perto da borda, onde importa.
      const k0 = Math.sqrt((px * px) / (rx * rx) + (py * py) / (ry * ry))
      const k1 = Math.sqrt((px * px) / (rx * rx * rx * rx) + (py * py) / (ry * ry * ry * ry))
      return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -menor
    },
  }
}

/**
 * Elipse girada `angulo` radianos em volta do centro (as pedras da roda da
 * fogueira, deitadas ao longo da roda), `objetos.js:127-149`.
 */
export function elipseGirada(cx: number, cy: number, rx: number, ry: number, angulo: number): Forma {
  const c = Math.cos(angulo)
  const s = Math.sin(angulo)
  const ex = Math.sqrt(rx * rx * c * c + ry * ry * s * s)
  const ey = Math.sqrt(rx * rx * s * s + ry * ry * c * c)
  const menor = Math.min(rx, ry)
  return {
    b: [cx - ex, cy - ey, cx + ex, cy + ey],
    d(x, y) {
      const dx = x - cx
      const dy = y - cy
      const px = dx * c + dy * s
      const py = -dx * s + dy * c
      const k0 = Math.sqrt((px * px) / (rx * rx) + (py * py) / (ry * ry))
      const k1 = Math.sqrt((px * px) / (rx * rx * rx * rx) + (py * py) / (ry * ry * ry * ry))
      return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -menor
    },
  }
}

/** Cápsula de raio `r` entre dois pontos (a vara da cerca, a corda, o arame, a tora da lenha), `objetos.js:151-167`. */
export function capsula(ax: number, ay: number, bx: number, by: number, r: number): Forma {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy || 1e-9
  return {
    b: [Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r],
    d(x, y) {
      const px = x - ax
      const py = y - ay
      let h = (px * dx + py * dy) / l2
      h = h < 0 ? 0 : h > 1 ? 1 : h
      const qx = px - dx * h
      const qy = py - dy * h
      return Math.sqrt(qx * qx + qy * qy) - r
    },
  }
}

export type Ponto = readonly [number, number]

/** Polígono qualquer (a cantoneira do baú, a tábua inclinada). */
export function poligono(pontos: readonly Ponto[]): Forma {
  const n = pontos.length
  const X = new Float64Array(n)
  const Y = new Float64Array(n)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < n; i += 1) {
    X[i] = pontos[i][0]
    Y[i] = pontos[i][1]
    x0 = Math.min(x0, X[i])
    y0 = Math.min(y0, Y[i])
    x1 = Math.max(x1, X[i])
    y1 = Math.max(y1, Y[i])
  }
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      let d = (x - X[0]) * (x - X[0]) + (y - Y[0]) * (y - Y[0])
      let s = 1
      for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
        const ex = X[j] - X[i]
        const ey = Y[j] - Y[i]
        const wx = x - X[i]
        const wy = y - Y[i]
        let h = (wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-12)
        h = h < 0 ? 0 : h > 1 ? 1 : h
        const bx = wx - ex * h
        const by = wy - ey * h
        const dd = bx * bx + by * by
        if (dd < d) d = dd
        const c1 = y >= Y[i]
        const c2 = y < Y[j]
        const c3 = ex * wy > ey * wx
        if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s
      }
      return s * Math.sqrt(d)
    },
  }
}

/**
 * Cápsulas de raio `r` encadeadas pelos pontos (a vara, a corda e o arame da
 * cerca curva, em pedaços curtos pelo arco): uma forma só, sem emenda de
 * contorno nem de chanfro onde um pedaço encontra o outro.
 */
export function cadeia(pontos: readonly Ponto[], r: number): Forma {
  const n = pontos.length
  const X = new Float64Array(n)
  const Y = new Float64Array(n)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < n; i += 1) {
    X[i] = pontos[i][0]
    Y[i] = pontos[i][1]
    x0 = Math.min(x0, X[i])
    y0 = Math.min(y0, Y[i])
    x1 = Math.max(x1, X[i])
    y1 = Math.max(y1, Y[i])
  }
  return {
    b: [x0 - r, y0 - r, x1 + r, y1 + r],
    d(x, y) {
      let menor = Infinity
      for (let i = 1; i < n; i += 1) {
        const ax = X[i - 1]
        const ay = Y[i - 1]
        const dx = X[i] - ax
        const dy = Y[i] - ay
        const px = x - ax
        const py = y - ay
        let h = (px * dx + py * dy) / (dx * dx + dy * dy || 1e-9)
        h = h < 0 ? 0 : h > 1 ? 1 : h
        const qx = px - dx * h
        const qy = py - dy * h
        const dd = qx * qx + qy * qy
        if (dd < menor) menor = dd
      }
      return Math.sqrt(menor) - r
    },
  }
}

export function uniao(a: Forma, b: Forma): Forma {
  return {
    b: [Math.min(a.b[0], b.b[0]), Math.min(a.b[1], b.b[1]), Math.max(a.b[2], b.b[2]), Math.max(a.b[3], b.b[3])],
    d: (x, y) => Math.min(a.d(x, y), b.d(x, y)),
  }
}

export function menos(a: Forma, b: Forma): Forma {
  return { b: a.b, d: (x, y) => Math.max(a.d(x, y), -b.d(x, y)) }
}

export function dentroDe(a: Forma, b: Forma): Forma {
  return {
    b: [Math.max(a.b[0], b.b[0]), Math.max(a.b[1], b.b[1]), Math.min(a.b[2], b.b[2]), Math.min(a.b[3], b.b[3])],
    d: (x, y) => Math.max(a.d(x, y), b.d(x, y)),
  }
}

/** Anel entre a elipse de fora (rxF, ryF) e a de dentro (rxD, ryD). */
export function anel(cx: number, cy: number, rxF: number, ryF: number, rxD: number, ryD: number): Forma {
  return menos(elipse(cx, cy, rxF, ryF), elipse(cx, cy, rxD, ryD))
}

/** Tábua reta de `larg` px entre dois pontos (pontas retas). */
export function barra(ax: number, ay: number, bx: number, by: number, larg: number): Forma {
  const dx = bx - ax
  const dy = by - ay
  const l = Math.hypot(dx, dy) || 1
  const nx = (-dy / l) * (larg / 2)
  const ny = (dx / l) * (larg / 2)
  return poligono([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]])
}

/**
 * RUÍDO PERIÓDICO para as texturas (`texturas/embutidas.ts` e as do pacote).
 *
 * Toda textura é uma função de cor de `(u, v)` em [0, 1) que REPETE: o valor
 * em u = 1 é o mesmo de u = 0. Por isso todo ruído aqui mora numa grade de
 * período inteiro (o índice da grade dá a volta), e a textura repetida no mapa
 * não tem emenda por construção — não por sorte. As funções são puras e só
 * fazem conta: o teste confere emenda, saturação e contraste sem canvas.
 *
 * Luz: a mesma do relevo (`lib/relevo.ts`), de cima à esquerda. O lado da
 * copa, da duna ou da pedra virado para lá clareia; o outro escurece.
 */

export type Rgb = readonly [number, number, number]

/** Hash inteiro → [0, 1). Só multiplicação de 32 bits (`Math.imul`): o mesmo número em qualquer aparelho. */
export function hash(ix: number, iy: number, semente: number): number {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(semente | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Resto sempre positivo: o índice da grade que dá a volta. */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** Curva quíntica (derivada segunda contínua): sem o quadriculado do `smoothstep` simples no relevo sombreado. */
function suave(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

export function passoSuave(a: number, b: number, t: number): number {
  const x = limitar01((t - a) / (b - a))
  return x * x * (3 - 2 * x)
}

/**
 * Ruído de gradiente (Perlin) periódico: `x` e `y` em unidades da grade, que
 * se repete a cada `periodo` (inteiro). Sai em torno de [-0,7, 0,7].
 */
export function gradiente(x: number, y: number, periodo: number, semente: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const canto = (cx: number, cy: number, dx: number, dy: number): number => {
    const angulo = hash(mod(cx, periodo), mod(cy, periodo), semente) * Math.PI * 2
    return Math.cos(angulo) * dx + Math.sin(angulo) * dy
  }
  const a = canto(x0, y0, fx, fy)
  const b = canto(x0 + 1, y0, fx - 1, fy)
  const c = canto(x0, y0 + 1, fx, fy - 1)
  const d = canto(x0 + 1, y0 + 1, fx - 1, fy - 1)
  const sx = suave(fx)
  return lerp(lerp(a, b, sx), lerp(c, d, sx), suave(fy))
}

/** Ruído de valor periódico em [0, 1): para grão e manchas, onde o quadriculado não aparece. */
export function valor(x: number, y: number, periodo: number, semente: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const sx = suave(x - x0)
  const sy = suave(y - y0)
  const ix0 = mod(x0, periodo)
  const iy0 = mod(y0, periodo)
  const ix1 = mod(x0 + 1, periodo)
  const iy1 = mod(y0 + 1, periodo)
  return lerp(lerp(hash(ix0, iy0, semente), hash(ix1, iy0, semente), sx), lerp(hash(ix0, iy1, semente), hash(ix1, iy1, semente), sx), sy)
}

/**
 * Soma de oitavas do ruído de gradiente em (u, v) do ladrilho. A primeira
 * oitava tem `base` células por lado; cada uma dobra (período inteiro, segue
 * repetindo). Sai normalizada em torno de [-1, 1].
 */
export function fbm(u: number, v: number, base: number, oitavas: number, semente: number, ganho = 0.5): number {
  let soma = 0
  let amplitude = 1
  let total = 0
  let periodo = base
  for (let i = 0; i < oitavas; i += 1) {
    soma += gradiente(u * periodo, v * periodo, periodo, semente + i * 101) * amplitude
    total += amplitude
    amplitude *= ganho
    periodo *= 2
  }
  return (soma / total) * 1.6
}

/**
 * Cristas: o ruído dobrado (`1 - |n|`) ao quadrado, oitava sobre oitava — a
 * forma de serra e rocha. Sai em [0, 1].
 */
export function cristas(u: number, v: number, base: number, oitavas: number, semente: number): number {
  let soma = 0
  let amplitude = 1
  let total = 0
  let periodo = base
  for (let i = 0; i < oitavas; i += 1) {
    const n = 1 - Math.abs(gradiente(u * periodo, v * periodo, periodo, semente + i * 131) * 1.4)
    soma += n * n * amplitude
    total += amplitude
    amplitude *= 0.5
    periodo *= 2
  }
  return limitar01(soma / total)
}

/** Um ponto de célula (copa, pedrinha, tufo): a célula da grade e onde o ponto caiu nela. */
export interface PontoDeCelula {
  /** Distância do (u, v) ao ponto, em células. */
  dx: number
  dy: number
  /** Número da célula já com a volta (o mesmo do outro lado da emenda). */
  ix: number
  iy: number
}

/**
 * Visita os pontos das 3×3 células em volta de (u, v), numa grade de `n`
 * células por lado com um ponto sorteado em cada (`folga` = o quanto ele foge
 * do centro, 0 a 0,5). A grade dá a volta: a copa do lado de lá da emenda
 * aparece inteira do lado de cá.
 */
export function vizinhos(u: number, v: number, n: number, semente: number, folga: number, visita: (p: PontoDeCelula) => void): void {
  const x = u * n
  const y = v * n
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const gx = cx + ox
      const gy = cy + oy
      const ix = mod(gx, n)
      const iy = mod(gy, n)
      const px = gx + 0.5 + (hash(ix, iy, semente) - 0.5) * 2 * folga
      const py = gy + 0.5 + (hash(ix, iy, semente + 7) - 0.5) * 2 * folga
      visita({ dx: x - px, dy: y - py, ix, iy })
    }
  }
}

/** Direção da luz (de cima à esquerda, um tanto alta), já normalizada. */
const LUZ: readonly [number, number, number] = (() => {
  const l = [-1, -1, 1.35]
  const n = Math.hypot(l[0], l[1], l[2])
  return [l[0] / n, l[1] / n, l[2] / n] as const
})()

/** O quanto uma superfície plana recebe da luz: a referência do "sem sombra". */
export const LUZ_NO_PLANO = LUZ[2]

/**
 * Luz numa superfície de inclinação (dhx, dhy): o produto da normal com a luz.
 * Plano = `LUZ_NO_PLANO`; virada para a luz, mais; de costas, menos.
 */
export function luzNaInclinacao(dhx: number, dhy: number): number {
  const n = Math.hypot(dhx, dhy, 1)
  return (-dhx * LUZ[0] - dhy * LUZ[1] + LUZ[2]) / n
}

/**
 * Relevo sombreado de uma altura `h(u, v)`: devolve a variação em torno do
 * plano (negativa na sombra). `forca` é o quanto a inclinação vale.
 */
export function sombreado(h: (u: number, v: number) => number, u: number, v: number, forca: number): number {
  const e = 1 / 1024
  const dhx = ((h(u + e, v) - h(u - e, v)) / (2 * e)) * forca
  const dhy = ((h(u, v + e) - h(u, v - e)) / (2 * e)) * forca
  return luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO
}

/** "#rrggbb" → [r, g, b]. */
export function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  const k = limitar01(t)
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]
}

/** Clareia (f > 0) ou escurece (f < 0) multiplicando: o tom fica, só a luz muda. */
export function luz(c: Rgb, f: number): Rgb {
  const k = 1 + f
  return [c[0] * k, c[1] * k, c[2] * k]
}

/** [r, g, b] (0-255, fora da faixa é cortado) → 0xRRGGBB. */
export function empacotar(c: Rgb): number {
  const r = Math.round(Math.min(255, Math.max(0, c[0])))
  const g = Math.round(Math.min(255, Math.max(0, c[1])))
  const b = Math.round(Math.min(255, Math.max(0, c[2])))
  return (r << 16) | (g << 8) | b
}

/** Curvas e recortes de tempo usados pelas cenas de transição. */

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/** Fração de `t` dentro de [a, b], presa entre 0 e 1. */
export const span = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a))

export const easeInOutSine = (x: number): number => -(Math.cos(Math.PI * x) - 1) / 2
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3)
export const easeInQuad = (x: number): number => x * x
export const easeInOutCubic = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

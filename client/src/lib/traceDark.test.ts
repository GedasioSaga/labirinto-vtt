import { describe, expect, it } from 'vitest'
import { darkGreenBlobs, darkStrokeMask, paintOver, traceDarkLines } from './traceDark'

const GREEN = [0, 107, 0, 255]
const BLACK = [0, 0, 0, 255]
const DARK_GREEN = [0, 51, 0, 255]
const W = 80
const H = 60
const RECT = { x: 0, y: 0, w: W, h: H }

/** Chão verde com fundo preto na borda, 3 barras pretas de 1 px (escada), um pátio preto 12×12 e um poço verde-escuro. */
function scene(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let c = GREEN
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) c = BLACK
      if ((x === 10 || x === 14 || x === 18) && y >= 10 && y < 25) c = BLACK
      if (x >= 40 && x < 52 && y >= 10 && y < 22) c = BLACK
      if (Math.hypot(x + 0.5 - 30, y + 0.5 - 42) <= 7) c = DARK_GREEN
      pixels.set(c, (y * W + x) * 4)
    }
  }
  return pixels
}

describe('darkStrokeMask', () => {
  it('pega as barras finas e deixa de fora o fundo da borda e o pátio cheio', () => {
    const mask = darkStrokeMask(scene(), W, H, RECT)
    expect(mask[15 * W + 14]).toBe(1)
    expect(mask[0]).toBe(0)
    expect(mask[15 * W + 45]).toBe(0)
    expect(mask.reduce((a, b) => a + b, 0)).toBe(45)
  })
})

describe('darkStrokeMask com barra antisserrilhada', () => {
  it('barra de 1 px com bordas antisserrilhadas (3 px escuros) ainda é traço; corredor preto de 5 px não é', () => {
    const pixels = new Uint8ClampedArray(W * H * 4)
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        let c = GREEN
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) c = BLACK
        // Perfil medido na escada do Mapa3: 005200 000a00 003d00.
        if (y >= 10 && y < 28) {
          if (x === 10) c = [0, 82, 0, 255]
          if (x === 11) c = [0, 10, 0, 255]
          if (x === 12) c = [0, 61, 0, 255]
        }
        if (x >= 40 && x < 45 && y >= 10 && y < 40) c = BLACK
        pixels.set(c, (y * W + x) * 4)
      }
    }
    const mask = darkStrokeMask(pixels, W, H, RECT)
    expect(mask[15 * W + 11]).toBe(1)
    expect(mask[15 * W + 42]).toBe(0)
  })
})

describe('darkStrokeMask deixa buraco de verdade como buraco', () => {
  it('glifo que envolve chão e fresta curta ficam fora da máscara', () => {
    const pixels = new Uint8ClampedArray(W * H * 4)
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        let c = GREEN
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) c = BLACK
        // Glifo 7×13 de contorno 1 px com miolo verde.
        const inGlyph = x >= 10 && x < 17 && y >= 10 && y < 23
        const glyphCenter = x >= 11 && x < 16 && y >= 11 && y < 22
        if (inGlyph && !glyphCenter) c = BLACK
        // Fresta 1×9.
        if (x === 40 && y >= 10 && y < 19) c = BLACK
        pixels.set(c, (y * W + x) * 4)
      }
    }
    const mask = darkStrokeMask(pixels, W, H, RECT)
    expect(mask[10 * W + 12]).toBe(0)
    expect(mask[12 * W + 40]).toBe(0)
  })
})

describe('darkStrokeMask com contorno cinza', () => {
  it('fresta longa com contorno cinza (buraco do chão) fica fora; a mesma barra sem cinza entra', () => {
    const GRAY = [123, 124, 123, 255]
    const build = (withGray: boolean) => {
      const pixels = new Uint8ClampedArray(W * H * 4)
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          let c = GREEN
          if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) c = BLACK
          if (y >= 10 && y < 26) {
            if (x === 20) c = BLACK
            if (withGray && (x === 19 || x === 21)) c = GRAY
          }
          pixels.set(c, (y * W + x) * 4)
        }
      }
      return pixels
    }
    expect(darkStrokeMask(build(true), W, H, RECT)[15 * W + 20]).toBe(0)
    expect(darkStrokeMask(build(false), W, H, RECT)[15 * W + 20]).toBe(1)
  })
})

describe('darkGreenBlobs', () => {
  it('poço vira elipse circular com centro e raio certos e cor #003300', () => {
    const { markers, mask } = darkGreenBlobs(scene(), W, H, RECT, (i) => `poco-${i}`)
    expect(markers).toHaveLength(1)
    const [poco] = markers
    expect(poco.shape).toBe('ellipse')
    expect(poco.cx).toBeCloseTo(30, 0)
    expect(poco.cy).toBeCloseTo(42, 0)
    expect(Math.abs(poco.w - 14)).toBeLessThan(1)
    expect(Math.abs(poco.h - 14)).toBeLessThan(1)
    expect(poco.color).toBe('#003300')
    expect(mask[42 * W + 30]).toBe(1)
  })
})

describe('paintOver', () => {
  it('pinta máscara de verde sem mexer no original nem no fundo longe dela', () => {
    const pixels = scene()
    const mask = darkStrokeMask(pixels, W, H, RECT)
    const painted = paintOver(pixels, W, H, mask, [0, 107, 0], 1)
    const at = (buf: ArrayLike<number>, x: number, y: number) => buf[(y * W + x) * 4 + 1]
    expect(at(painted, 14, 15)).toBe(107)
    expect(at(pixels, 14, 15)).toBe(0)
    expect(at(painted, 45, 15)).toBe(0)
  })
})

describe('traceDarkLines', () => {
  it('cada barra vira uma linha preta vertical com largura ~1', () => {
    const pixels = scene()
    const lines = traceDarkLines(pixels, W, H, darkStrokeMask(pixels, W, H, RECT), RECT, (i) => `barra-${i}`)
    expect(lines).toHaveLength(3)
    for (const line of lines) {
      expect(line.color).toBe('#000000')
      expect(new Set(line.points.map((p) => Math.round(p.x * 10) / 10)).size).toBe(1)
      expect(Math.abs(line.width - 1)).toBeLessThan(0.25)
    }
  })
})

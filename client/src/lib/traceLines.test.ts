import { describe, expect, it } from 'vitest'
import { traceLines } from './traceLines'

const GRAY = [127, 133, 127, 255]
const GREEN = [0, 107, 0, 255]

function image(width: number, height: number, paint: (x: number, y: number) => boolean): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels.set(paint(x, y) ? GRAY : GREEN, (y * width + x) * 4)
    }
  }
  return pixels
}

describe('traceLines', () => {
  it('imagem sem traço devolve lista vazia', () => {
    expect(traceLines(image(10, 10, () => false), 10, 10)).toEqual([])
  })

  it('linha horizontal contínua vira polilinha aberta de 2 vértices nos centros de pixel', () => {
    const [line, ...rest] = traceLines(image(30, 10, (x, y) => y === 4 && x >= 3 && x <= 25), 30, 10)
    expect(rest).toHaveLength(0)
    expect(line.closed).toBe(false)
    expect(line.dotted).toBe(false)
    expect(line.points).toHaveLength(2)
    const xs = line.points.map((p) => p.x).sort((a, b) => a - b)
    expect(xs).toEqual([3.5, 25.5])
    expect(line.points[0].y).toBe(4.5)
    expect(line.color).toBe('#7f857f')
  })

  it('pontilhado de 1 px ligado / 1 px desligado vira uma polilinha marcada como pontilhada', () => {
    const lines = traceLines(image(40, 10, (x, y) => y === 5 && x >= 2 && x <= 30 && x % 2 === 0), 40, 10)
    expect(lines).toHaveLength(1)
    expect(lines[0].dotted).toBe(true)
    expect(lines[0].points).toHaveLength(2)
  })

  it('contorno de retângulo vira um laço fechado com os 4 cantos', () => {
    const onBorder = (x: number, y: number) =>
      x >= 5 && x <= 25 && y >= 5 && y <= 15 && (x === 5 || x === 25 || y === 5 || y === 15)
    const lines = traceLines(image(30, 20, onBorder), 30, 20)
    expect(lines).toHaveLength(1)
    expect(lines[0].closed).toBe(true)
    expect(lines[0].points).toHaveLength(4)
  })

  it('excludeNearBackground descarta o traço colado no fundo e mantém o traço interno', () => {
    const width = 40
    const height = 20
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const color = x < 5 ? [0, 0, 0, 255] : x === 6 || x === 20 ? GRAY : GREEN
        pixels.set(y >= 2 && y <= 17 ? color : [0, 0, 0, 255], (y * width + x) * 4)
      }
    }
    const isBackground = (r: number, g: number, b: number) => g < 40 && r + g + b < 120
    const all = traceLines(pixels, width, height)
    const interior = traceLines(pixels, width, height, { excludeNearBackground: { radius: 2, isBackground } })
    expect(all.length).toBe(2)
    expect(interior).toHaveLength(1)
    expect(interior[0].points.every((p) => p.x === 20.5)).toBe(true)
  })

  it('pontilhado não liga pontos por cima de pixel de fundo', () => {
    const width = 30
    const height = 10
    const build = (gapColor: number[]) => {
      const pixels = new Uint8ClampedArray(width * height * 4)
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          let c = GREEN
          if (y === 5 && (x === 10 || x === 12 || x === 14 || x === 16)) c = GRAY
          if (y === 5 && x === 13) c = gapColor
          pixels.set(c, (y * width + x) * 4)
        }
      }
      return pixels
    }
    const isBackground = (r: number, g: number, b: number) => g < 40 && r + g + b < 120
    // Raio 0: não exclui pixel perto do fundo, só liga a checagem da fresta.
    const options = { excludeNearBackground: { radius: 0, isBackground }, minPixels: 3 }
    expect(traceLines(build(GREEN), width, height, options)).toHaveLength(1)
    // Fundo preto no meio: as duas metades (2 pontos cada) ficam abaixo do mínimo de 3 pixels.
    expect(traceLines(build([0, 0, 0, 255]), width, height, options)).toHaveLength(0)
  })

  it('faixa de 2 px com afinamento vira uma polilinha só, de 2 vértices', () => {
    const pixels = image(40, 12, (x, y) => (y === 5 || y === 6) && x >= 4 && x <= 34)
    const thick = traceLines(pixels, 40, 12)
    const thin = traceLines(pixels, 40, 12, { thin: true })
    expect(thin).toHaveLength(1)
    expect(thin[0].points).toHaveLength(2)
    expect(thick.length + thick.reduce((n, l) => n + l.points.length, 0)).toBeGreaterThan(3)
  })

  it('cruzamento em T vira 3 traços que se encontram na junção', () => {
    const lines = traceLines(image(30, 30, (x, y) => (y === 10 && x >= 2 && x <= 27) || (x === 15 && y >= 10 && y <= 27)), 30, 30)
    expect(lines).toHaveLength(3)
    // 43 pixels únicos (26 na horizontal + 18 na vertical, 1 em comum); a junção entra nos 3 caminhos.
    const totalPixels = lines.reduce((sum, l) => sum + l.pixelCount, 0)
    expect(totalPixels).toBe(43 + 2)
  })
})

import { describe, expect, it } from 'vitest'
import { traceMapDetails } from './traceDetails'
import { addMapDetails, createEmptyMap, setMapFrame } from './mapFactory'

const BLACK = [0, 0, 0, 255]
const GREEN = [0, 107, 0, 255]
const GRAY = [127, 133, 127, 255]
const ORANGE = [204, 153, 51, 255]

/** Chão verde em x≥4 com traço cinza na borda (x=4), traço interno (x=20) e uma porta laranja. */
function scene(): { pixels: Uint8ClampedArray; width: number; height: number } {
  const width = 40
  const height = 30
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let color = x < 4 ? BLACK : GREEN
      if (x === 4 || x === 20) color = GRAY
      if (x >= 28 && x < 34 && y >= 10 && y < 12) color = ORANGE
      pixels.set(color, (y * width + x) * 4)
    }
  }
  return { pixels, width, height }
}

describe('traceMapDetails', () => {
  it('traço interno vira MapLine, traço da borda do chão fica de fora, porta vira MapMarker', () => {
    const { pixels, width, height } = scene()
    const details = traceMapDetails(pixels, width, height, {}, (kind, i) => `${kind}-${i}`)
    expect(details.lines).toHaveLength(1)
    expect(details.lines[0]).toMatchObject({ id: 'line-0', closed: false, dotted: false, width: 1, color: '#7f857f' })
    expect(details.lines[0].points.every((p) => p.x === 20.5)).toBe(true)
    expect(details.markers).toHaveLength(1)
    expect(details.markers[0]).toMatchObject({ id: 'marker-0', cx: 31, cy: 11, color: '#cc9933' })
  })

  it('borderRadius 0 mantém o traço da borda', () => {
    const { pixels, width, height } = scene()
    expect(traceMapDetails(pixels, width, height, { borderRadius: 0 }, (kind, i) => `${kind}-${i}`).lines).toHaveLength(2)
  })
})

describe('addMapDetails / setMapFrame', () => {
  it('soma sem mutar; listas vazias devolvem o mesmo mapa', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    expect(addMapDetails(map, [], [])).toBe(map)
    const line = { id: 'l', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], closed: false, dotted: true, color: '#7f857f', width: 1 }
    const marker = { id: 'k', cx: 1, cy: 1, w: 4, h: 2, rotation: 30, color: '#cc9933' }
    const next = addMapDetails(map, [line], [marker])
    expect(map.lines).toHaveLength(0)
    expect(next.lines).toEqual([line])
    expect(next.markers).toEqual([marker])
  })

  it('moldura liga e desliga', () => {
    const map = createEmptyMap('m', 'x', 10, 10, 64)
    const framed = setMapFrame(map, { title: 'Village Lake', x: 36, y: 1, w: 798, h: 862 })
    expect(framed.frame?.title).toBe('Village Lake')
    expect(setMapFrame(framed, null).frame).toBeNull()
  })
})

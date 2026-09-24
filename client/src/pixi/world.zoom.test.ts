import { describe, expect, it } from 'vitest'
import { MAX_SCALE, MIN_SCALE, pinchCamera, pinchStart, zoomToScale, type Camera, type Point } from './world'

/** Ponto do MUNDO sob um ponto da TELA com esta câmera (tela = mundo × escala + deslocamento). */
function worldAt(camera: Camera, screen: Point): Point {
  return { x: (screen.x - camera.x) / camera.scale, y: (screen.y - camera.y) / camera.scale }
}

const CAMERA: Camera = { x: 20, y: -40, scale: 0.5 }

describe('zoomToScale: escala nova em volta de um ponto da tela', () => {
  it('o ponto do mundo sob o ponto escolhido continua sob ele', () => {
    const centro = { x: 180, y: 370 }
    const antes = worldAt(CAMERA, centro)
    const depois = zoomToScale(CAMERA, centro, 1.25)
    expect(depois.scale).toBe(1.25)
    const agora = worldAt(depois, centro)
    expect(agora.x).toBeCloseTo(antes.x, 9)
    expect(agora.y).toBeCloseTo(antes.y, 9)
  })

  it('respeita os mesmos limites da roda do mouse', () => {
    expect(zoomToScale(CAMERA, { x: 0, y: 0 }, 99).scale).toBe(MAX_SCALE)
    expect(zoomToScale(CAMERA, { x: 0, y: 0 }, 0).scale).toBe(MIN_SCALE)
  })
})

describe('pinça: dois dedos aproximam, afastam e arrastam o mapa', () => {
  it('dedos parados onde encostaram: a câmera não muda', () => {
    const a = { x: 100, y: 300 }
    const b = { x: 150, y: 300 }
    const camera = pinchCamera(pinchStart(CAMERA, a, b), a, b)
    expect(camera.scale).toBeCloseTo(CAMERA.scale, 12)
    expect(camera.x).toBeCloseTo(CAMERA.x, 9)
    expect(camera.y).toBeCloseTo(CAMERA.y, 9)
  })

  it('abrindo em volta do mesmo meio: a escala segue a distância dos dedos e o ponto sob o meio não sai do meio', () => {
    const a0 = { x: 180, y: 370 }
    const b0 = { x: 230, y: 370 }
    const meio = { x: 205, y: 370 }
    const sobOMeio = worldAt(CAMERA, meio)
    // 50 px → 130 px, o gesto do aceite (régua zoom-no-celular, jornada 2).
    const camera = pinchCamera(pinchStart(CAMERA, a0, b0), { x: 140, y: 370 }, { x: 270, y: 370 })
    expect(camera.scale / CAMERA.scale).toBeCloseTo(130 / 50, 9)
    const agora = worldAt(camera, meio)
    expect(agora.x).toBeCloseTo(sobOMeio.x, 9)
    expect(agora.y).toBeCloseTo(sobOMeio.y, 9)
  })

  it('fechando afasta na mesma razão', () => {
    const inicio = pinchStart(CAMERA, { x: 90, y: 470 }, { x: 270, y: 470 })
    const camera = pinchCamera(inicio, { x: 150, y: 470 }, { x: 210, y: 470 })
    expect(camera.scale / CAMERA.scale).toBeCloseTo(60 / 180, 9)
  })

  it('os dois dedos andando juntos arrastam o mapa sem mudar o zoom', () => {
    const a0 = { x: 100, y: 100 }
    const b0 = { x: 200, y: 100 }
    const inicio = pinchStart(CAMERA, a0, b0)
    const camera = pinchCamera(inicio, { x: 130, y: 160 }, { x: 230, y: 160 })
    expect(camera.scale).toBeCloseTo(CAMERA.scale, 12)
    // O ponto que estava sob o meio (150,100) agora está sob o meio novo (180,160).
    const agora = worldAt(camera, { x: 180, y: 160 })
    const antes = worldAt(CAMERA, { x: 150, y: 100 })
    expect(agora.x).toBeCloseTo(antes.x, 9)
    expect(agora.y).toBeCloseTo(antes.y, 9)
  })

  it('não passa dos limites de escala, e o ponto sob o meio continua preso', () => {
    const a0 = { x: 170, y: 300 }
    const b0 = { x: 190, y: 300 }
    const inicio = pinchStart(CAMERA, a0, b0)
    const longe = pinchCamera(inicio, { x: -2000, y: 300 }, { x: 2360, y: 300 })
    expect(longe.scale).toBe(MAX_SCALE)
    const agora = worldAt(longe, { x: 180, y: 300 })
    const antes = worldAt(CAMERA, { x: 180, y: 300 })
    expect(agora.x).toBeCloseTo(antes.x, 9)
    expect(agora.y).toBeCloseTo(antes.y, 9)

    const colado = pinchCamera(pinchStart(CAMERA, { x: 0, y: 0 }, { x: 400, y: 0 }), { x: 199, y: 0 }, { x: 201, y: 0 })
    expect(colado.scale).toBe(MIN_SCALE)
  })

  it('dois dedos no mesmo ponto (encostaram juntos) não viram NaN nem zoom infinito', () => {
    const p = { x: 50, y: 50 }
    const inicio = pinchStart(CAMERA, p, p)
    const camera = pinchCamera(inicio, { x: 40, y: 50 }, { x: 60, y: 50 })
    for (const valor of [camera.x, camera.y, camera.scale]) expect(Number.isFinite(valor)).toBe(true)
    expect(camera.scale).toBeLessThanOrEqual(MAX_SCALE)
    const parado = pinchCamera(inicio, p, p)
    expect(parado.scale).toBeCloseTo(CAMERA.scale, 12)
  })
})

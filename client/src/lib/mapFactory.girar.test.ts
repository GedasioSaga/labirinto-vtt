import { describe, expect, it } from 'vitest'
import type { MapData, Region, RegionPoint, Wall } from '../types/map'
import {
  addDoorOnWall,
  addRoom,
  createEmptyMap,
  normalizeRectRoomOrder,
  resizeRoomCornerLive,
  resizeRoomDimensions,
  rotateRegion,
} from './mapFactory'
import { buildRoomFromDraft } from './drawingFactory'
import { placeNewRoom } from './roomNesting'
import { isAxisAlignedRect, roomDimensions } from './roomOps'
import { roomCentroid } from './roomRotation'

/**
 * GIRAR SALA, lado da função pura. O giro é gravado nos PONTOS: estes testes
 * provam que a sala, as sub-salas, as paredes e as portas vão juntas, que o
 * conteúdo fica, e que o pivô não anda — girar e desgirar devolve o mapa
 * idêntico, sem erro de conta sobrando no arquivo.
 */

/** A sala da jornada: 2 x 6 quadrados de 64 px, em pé, com as 4 paredes vinculadas. */
function salaEmPe(): MapData {
  const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 576, y: 256 }, { x: 704, y: 640 })
  return addRoom(createEmptyMap('m', 'M', 30, 20, 64), region, walls)
}

/** Casa 0..640 com um quarto no canto (topo e esquerda sobre a parede da casa) — molde de stores/subRoom.test.ts. */
function casaComQuarto(): MapData {
  let map = createEmptyMap('m', 'M', 30, 20, 64)
  const casa = buildRoomFromDraft('casa', ['c0', 'c1', 'c2', 'c3'], { x: 0, y: 0 }, { x: 640, y: 640 })
  map = addRoom(map, casa.region, casa.walls)
  const quarto = placeNewRoom(map.regions, map.walls, buildRoomFromDraft('quarto', ['q0', 'q1', 'q2', 'q3'], { x: 0, y: 0 }, { x: 320, y: 320 }), null)
  return addRoom(map, quarto.region, quarto.walls)
}

function sala(map: MapData, id = 'sala'): Region {
  const region = map.regions.find((r) => r.id === id)
  if (!region) throw new Error(`sala ${id} não existe no mapa`)
  return region
}

function distanciaAteSegmento(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Cada parede vinculada de `regionId` está em cima da aresta que o índice dela diz. */
function paredesNasArestas(map: MapData, regionId: string): void {
  const region = sala(map, regionId)
  const n = region.points.length
  const paredes = map.walls.filter((w) => w.regionId === regionId)
  expect(paredes.length).toBeGreaterThan(0)
  for (const w of paredes) {
    const i = w.regionEdgeIndex ?? -1
    const a = region.points[i]
    const b = region.points[(i + 1) % n]
    expect(distanciaAteSegmento({ x: w.x1, y: w.y1 }, a, b), `ponta 1 da parede ${w.id} fora da aresta ${i}`).toBeLessThan(1e-6)
    expect(distanciaAteSegmento({ x: w.x2, y: w.y2 }, a, b), `ponta 2 da parede ${w.id} fora da aresta ${i}`).toBeLessThan(1e-6)
  }
}

describe('rotateRegion — ida e volta', () => {
  it('+30° e depois −30° devolve o mapa IDÊNTICO (pontos, paredes e a sala sem o campo rotation)', () => {
    const antes = salaEmPe()
    const ida = rotateRegion(antes, 'sala', 30)
    expect(ida).not.toEqual(antes)
    expect(rotateRegion(ida, 'sala', -30)).toEqual(antes)
  })

  it('doze giros de 30° fecham a volta e voltam ao mapa de partida', () => {
    const antes = salaEmPe()
    let map = antes
    for (let i = 0; i < 12; i += 1) map = rotateRegion(map, 'sala', 30)
    expect(map).toEqual(antes)
  })

  it('0° e 360° não mudam nada: devolve o mesmo mapa (sem entrada vazia de desfazer)', () => {
    const antes = salaEmPe()
    expect(rotateRegion(antes, 'sala', 0)).toBe(antes)
    expect(rotateRegion(antes, 'sala', 360)).toBe(antes)
    expect(rotateRegion(antes, 'nao-existe', 45)).toBe(antes)
  })
})

describe('rotateRegion — o pivô não anda', () => {
  it('o centróide de área da sala fica no mesmo lugar em qualquer ângulo', () => {
    // Sala em L: o centróide de área (110,110) não é o meio da caixa (150,150).
    const pontos = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 300 }, { x: 0, y: 300 }]
    const emL: Region = { id: 'l', points: pontos, tag: '', fillColor: '#000', fillPattern: 'solid', data: {}, room: { shape: 'polygon', name: 'L' } }
    const map = addRoom(createEmptyMap('m', 'M', 30, 20, 64), emL, [])
    const antes = roomCentroid(pontos)
    for (const graus of [13, 37, 90, 135, -61]) {
      const depois = roomCentroid(sala(rotateRegion(map, 'l', graus), 'l').points)
      expect(depois.x).toBeCloseTo(antes.x, 9)
      expect(depois.y).toBeCloseTo(antes.y, 9)
    }
  })
})

describe('rotateRegion — o que gira', () => {
  it('90° de um retângulo troca largura e altura, e a sala continua reta', () => {
    const map = rotateRegion(salaEmPe(), 'sala', 90)
    expect(roomDimensions(sala(map).points)).toEqual({ width: 384, height: 128 })
    expect(isAxisAlignedRect(sala(map).points)).toBe(true)
    // Os quatro cantos exatos, sem erro de conta: 90° é troca de coordenadas.
    expect(sala(map).points).toEqual([
      { x: 832, y: 384 },
      { x: 832, y: 512 },
      { x: 448, y: 512 },
      { x: 448, y: 384 },
    ])
  })

  it('as paredes seguem as arestas novas, em qualquer ângulo', () => {
    for (const graus of [90, 37, -120]) {
      const map = rotateRegion(salaEmPe(), 'sala', graus)
      paredesNasArestas(map, 'sala')
      // E saíram de onde estavam: a parede de cima não ficou no topo velho.
      expect(map.walls.find((w) => w.id === 'w0')).not.toMatchObject({ x1: 576, y1: 256, x2: 704, y2: 256 })
    }
  })

  it('a porta vai junto: mesmo ponto relativo do lado, mesmo estado', () => {
    const comPorta = addDoorOnWall(salaEmPe(), 'w1', { x: 704, y: 448 }, 64, 'normal')
    const porta = comPorta.walls.find((w) => w.door !== null)
    if (!porta) throw new Error('a porta não nasceu')
    const map = rotateRegion(comPorta, 'sala', 90)
    const girada = map.walls.find((w) => w.id === porta.id)
    // Lado direito (x = 704, y 416..480) girado 90° em volta de (640,448): vira o lado de baixo, y = 512.
    expect(girada).toMatchObject({ door: porta.door, regionEdgeIndex: porta.regionEdgeIndex, x1: 672, y1: 512, x2: 608, y2: 512 })
    paredesNasArestas(map, 'sala')
  })

  it('a sub-sala gira em volta do centro da MÃE, junto com ela — o canto compartilhado continua compartilhado', () => {
    const map = rotateRegion(casaComQuarto(), 'casa', 90)
    // Casa 0..640 girada em volta de (320,320): o canto (0,0) vai para (640,0).
    expect(sala(map, 'casa').points[0]).toEqual({ x: 640, y: 0 })
    expect(sala(map, 'quarto').points[0]).toEqual({ x: 640, y: 0 })
    // O quarto (0..320) foi para o canto de cima à DIREITA da casa, não girou no próprio lugar.
    expect(roomDimensions(sala(map, 'quarto').points)).toEqual({ width: 320, height: 320 })
    expect(roomCentroid(sala(map, 'quarto').points)).toEqual({ x: 480, y: 160 })
    paredesNasArestas(map, 'casa')
    paredesNasArestas(map, 'quarto')
    // As duas salas somam o giro no ângulo delas.
    expect(sala(map, 'casa').room?.rotation).toBe(90)
    expect(sala(map, 'quarto').room?.rotation).toBe(90)
  })

  it('girar só o quarto não mexe na casa', () => {
    const antes = casaComQuarto()
    const map = rotateRegion(antes, 'quarto', 45)
    expect(sala(map, 'casa')).toBe(sala(antes, 'casa'))
    expect(map.walls.filter((w) => w.regionId === 'casa')).toEqual(antes.walls.filter((w) => w.regionId === 'casa'))
  })

  it('o conteúdo fica: fichas, móveis, luzes e pinos são os mesmos objetos', () => {
    const base = salaEmPe()
    const cheio: MapData = {
      ...base,
      tokens: [{ id: 't', characterId: null, name: 'Guarda', x: 640, y: 592, size: 1, image: null }],
      lights: [{ id: 'l', x: 640, y: 300, radius: 100, color: '#fff', intensity: 1 }],
    }
    const map = rotateRegion(cheio, 'sala', 90)
    expect(map.tokens).toBe(cheio.tokens)
    expect(map.lights).toBe(cheio.lights)
    expect(map.props).toBe(cheio.props)
    expect(map.pins).toBe(cheio.pins)
    expect(map.stairs).toBe(cheio.stairs)
  })

  it('o ângulo acumula em room.rotation e, de volta a 0, o campo some', () => {
    let map = rotateRegion(salaEmPe(), 'sala', 100)
    expect(sala(map).room?.rotation).toBe(100)
    map = rotateRegion(map, 'sala', 100)
    expect(sala(map).room?.rotation).toBe(-160)
    map = rotateRegion(map, 'sala', 160)
    expect(Object.keys(sala(map).room ?? {})).not.toContain('rotation')
  })

  it('o nome gira junto: o deslocamento do rótulo gira com a sala (o texto continua em pé)', () => {
    const base = salaEmPe()
    const comRotulo: MapData = {
      ...base,
      regions: base.regions.map((r) => (r.room ? { ...r, room: { ...r.room, labelOffset: { x: 0, y: -100 } } } : r)),
    }
    const map = rotateRegion(comRotulo, 'sala', 90)
    // 100 px acima do centro da sala em pé = 100 px à direita da sala deitada.
    expect(sala(map).room?.labelOffset).toEqual({ x: 100, y: 0 })
  })

  it('parede com vínculo mas sem aresta (arquivo antigo) gira inteira, como moveRegion a desloca inteira', () => {
    const base = salaEmPe()
    const solta: Wall = { id: 'x', x1: 640, y1: 300, x2: 640, y2: 400, blocksLight: true, blocksMove: true, door: null, regionId: 'sala' }
    const map = rotateRegion({ ...base, walls: [...base.walls, solta] }, 'sala', 90)
    expect(map.walls.find((w) => w.id === 'x')).toMatchObject({ x1: 788, y1: 448, x2: 688, y2: 448 })
  })
})

describe('normalizeRectRoomOrder — o canto 0 volta a ser o de cima à esquerda', () => {
  it('depois de 90°, reordena os vértices e o índice de aresta das paredes junto', () => {
    const girada = rotateRegion(salaEmPe(), 'sala', 90)
    const map = normalizeRectRoomOrder(girada, new Set(['sala']))
    expect(sala(map).points).toEqual([
      { x: 448, y: 384 },
      { x: 832, y: 384 },
      { x: 832, y: 512 },
      { x: 448, y: 512 },
    ])
    paredesNasArestas(map, 'sala')
    // A parede que era de cima (w0) continua a mesma parede, agora na aresta da direita.
    expect(map.walls.find((w) => w.id === 'w0')).toMatchObject({ regionEdgeIndex: 1, x1: 832, y1: 384, x2: 832, y2: 512 })
  })

  it('sala já na ordem, torta ou polígono: o mesmo mapa', () => {
    const emPe = salaEmPe()
    expect(normalizeRectRoomOrder(emPe, new Set(['sala']))).toBe(emPe)
    const torta = rotateRegion(emPe, 'sala', 37)
    expect(normalizeRectRoomOrder(torta, new Set(['sala']))).toBe(torta)
  })

  it('com a ordem de volta, redimensionar pelo canto puxa o canto certo e não troca as paredes de lado', () => {
    const map = normalizeRectRoomOrder(rotateRegion(salaEmPe(), 'sala', 90), new Set(['sala']))
    // Canto 2 (baixo à direita, 832,512) puxado para (896,576): âncora no canto 0 (448,384).
    const maior = resizeRoomCornerLive(map, 'sala', 2, 896, 576)
    expect(sala(maior).points).toEqual([
      { x: 448, y: 384 },
      { x: 896, y: 384 },
      { x: 896, y: 576 },
      { x: 448, y: 576 },
    ])
    paredesNasArestas(maior, 'sala')
  })
})

describe('sala retangular TORTA não se desmonta', () => {
  it('largura/altura e canto não fazem nada numa sala girada fora de 90°', () => {
    const torta = rotateRegion(salaEmPe(), 'sala', 37)
    expect(resizeRoomDimensions(torta, 'sala', 500, 500)).toBe(torta)
    expect(resizeRoomCornerLive(torta, 'sala', 2, 900, 900)).toBe(torta)
  })
})

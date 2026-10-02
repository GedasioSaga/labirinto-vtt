/**
 * CAMINHO EM GRADE — por onde uma ficha anda sozinha de um lugar a outro
 * quando a reta não passa: contorna parede, entra pela porta aberta, nunca
 * atravessa parede nem porta fechada, e sai alisado (sem zigue-zague de casa
 * em casa).
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import type { MapData, Wall } from '../types/map'
import { acharCaminho } from './caminhoEmGrade'
import { isTokenPathClear, segmentsIntersect } from './collision'
import { createEmptyMap } from './mapFactory'

const GRID = 64

function mapa(walls: Wall[], largura = 15, altura = 10): Pick<MapData, 'walls' | 'grid' | 'width' | 'height'> {
  return { ...createEmptyMap('m', 'M', largura, altura, GRID), walls }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

/** Cada trecho do caminho é um traço reto que a colisão deixa passar e que não cruza parede nenhuma que barra. */
function confereTrechos(caminho: readonly Point[], walls: readonly Wall[]) {
  for (let i = 1; i < caminho.length; i += 1) {
    const de = caminho[i - 1]
    const para = caminho[i]
    if (de === undefined || para === undefined) continue
    expect(isTokenPathClear(de, para, walls, GRID)).toBe(true)
    for (const w of walls) {
      if (w.door !== null && w.door.open && !w.door.locked) continue
      expect(segmentsIntersect(de, para, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })).toBe(false)
    }
  }
}

describe('acharCaminho', () => {
  it('reta livre: o próprio traço', () => {
    expect(acharCaminho({ x: 100, y: 100 }, { x: 500, y: 300 }, mapa([]))).toEqual([
      { x: 100, y: 100 },
      { x: 500, y: 300 },
    ])
  })

  it('mesmo lugar: só o ponto', () => {
    expect(acharCaminho({ x: 100, y: 100 }, { x: 100, y: 100 }, mapa([]))).toEqual([{ x: 100, y: 100 }])
  })

  it('parede sem porta no meio: contorna pela ponta, sem atravessar', () => {
    // O caso do teste no navegador: parede x=384 de y=128 a y=320, pontos (224,224) e (608,224).
    const walls = [parede('w', 384, 128, 384, 320)]
    const caminho = acharCaminho({ x: 224, y: 224 }, { x: 608, y: 224 }, mapa(walls))
    expect(caminho).not.toBeNull()
    if (caminho === null) return
    expect(caminho[0]).toEqual({ x: 224, y: 224 })
    expect(caminho[caminho.length - 1]).toEqual({ x: 608, y: 224 })
    expect(caminho.length).toBeGreaterThan(2)
    confereTrechos(caminho, walls)
  })

  it('alisado: contornar uma parede leva poucas curvas, não uma por casa', () => {
    const walls = [parede('w', 384, 128, 384, 320)]
    const caminho = acharCaminho({ x: 224, y: 224 }, { x: 608, y: 224 }, mapa(walls))
    expect(caminho?.length).toBeLessThanOrEqual(4)
  })

  it('porta aberta numa parede de ponta a ponta: passa pela porta', () => {
    const walls = [
      parede('a', 384, 0, 384, 384),
      parede('porta', 384, 384, 384, 448, { open: true, locked: false, kind: 'normal' }),
      parede('b', 384, 448, 384, 640),
    ]
    const caminho = acharCaminho({ x: 224, y: 96 }, { x: 608, y: 96 }, mapa(walls))
    expect(caminho).not.toBeNull()
    if (caminho === null) return
    confereTrechos(caminho, walls)
    // Atravessou a linha x=384 na altura da porta.
    const cruzou = caminho.some((p, i) => {
      const antes = caminho[i - 1]
      return antes !== undefined && antes.x < 384 && p.x > 384
    })
    expect(cruzou).toBe(true)
  })

  it('porta fechada, trancada ou secreta numa parede de ponta a ponta: sem caminho', () => {
    for (const door of [
      { open: false, locked: false, kind: 'normal' as const },
      { open: true, locked: true, kind: 'normal' as const },
      { open: true, locked: false, kind: 'normal' as const, secret: true },
    ]) {
      const walls = [parede('a', 384, 0, 384, 384), parede('porta', 384, 384, 384, 448, door), parede('b', 384, 448, 384, 640)]
      expect(acharCaminho({ x: 224, y: 96 }, { x: 608, y: 96 }, mapa(walls))).toBeNull()
    }
  })

  it('não corta a quina: diagonal entre duas paredes que se encontram não passa', () => {
    // Sala fechada em L: o canto (384,320) é a junta de duas paredes; o caminho dá a volta.
    const walls = [parede('v', 384, 128, 384, 320), parede('h', 384, 320, 576, 320)]
    const caminho = acharCaminho({ x: 352, y: 352 }, { x: 416, y: 288 }, mapa(walls))
    expect(caminho).not.toBeNull()
    if (caminho !== null) confereTrechos(caminho, walls)
  })

  it('limite de busca: mapa grande sem saída não trava, devolve null', () => {
    // Destino fechado numa caixa, num mapa de 200x200 casas.
    const walls = [parede('n', 6000, 6000, 6128, 6000), parede('s', 6000, 6128, 6128, 6128), parede('o', 6000, 6000, 6000, 6128), parede('l', 6128, 6000, 6128, 6128)]
    const inicio = performance.now()
    expect(acharCaminho({ x: 32, y: 32 }, { x: 6064, y: 6064 }, mapa(walls, 200, 200), 3000)).toBeNull()
    // Com o teto padrão também: a busca para no teto, não varre o mapa inteiro sem fim.
    expect(acharCaminho({ x: 32, y: 32 }, { x: 6064, y: 6064 }, mapa(walls, 200, 200))).toBeNull()
    expect(performance.now() - inicio).toBeLessThan(2000)
  })
})

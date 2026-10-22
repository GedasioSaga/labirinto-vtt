import { describe, expect, it } from 'vitest'
import { viewportCenterWorld, type Bounds, type Camera } from '../pixi/world'
import { cameraOnResize, type OwnDisc } from './playerCamera'

/**
 * A câmera do jogador ao redimensionar (pendência da fatia 10, fechada na 19b):
 * girar o celular ou crescer a janela não pode jogar o que se olhava para o
 * canto, nem a própria ficha para fora da tela.
 */

const EM_PE = { width: 390, height: 844 }
const DEITADO = { width: 844, height: 390 }
const SEM_PAINEL: Bounds[] = []

function naTela(camera: Camera, own: OwnDisc) {
  return { x: own.x * camera.scale + camera.x, y: own.y * camera.scale + camera.y, r: own.radius * camera.scale }
}

function inteiraNaTela(camera: Camera, own: OwnDisc, tela: { width: number; height: number }): boolean {
  const p = naTela(camera, own)
  return p.x - p.r >= 0 && p.y - p.r >= 0 && p.x + p.r <= tela.width && p.y + p.r <= tela.height
}

describe('cameraOnResize: o meio da tela continua no meio', () => {
  it('girar o celular deixa no meio o mesmo ponto do mapa, no mesmo zoom', () => {
    const camera = { x: -310, y: -122, scale: 1.5 }
    const antes = viewportCenterWorld(camera, EM_PE.width, EM_PE.height)
    const nova = cameraOnResize(camera, EM_PE, DEITADO, null, SEM_PAINEL)
    const depois = viewportCenterWorld(nova, DEITADO.width, DEITADO.height)
    expect(nova.scale).toBe(1.5)
    expect(depois.x).toBeCloseTo(antes.x, 6)
    expect(depois.y).toBeCloseTo(antes.y, 6)
  })

  it('tamanho igual (o primeiro aviso do observador) não mexe na câmera', () => {
    const camera = { x: 12, y: -40, scale: 0.8 }
    expect(cameraOnResize(camera, EM_PE, EM_PE, { x: 100, y: 100, radius: 20 }, SEM_PAINEL)).toEqual(camera)
  })

  it('ida e volta (em pé, deitado, em pé) devolve a câmera de antes', () => {
    const camera = { x: 33, y: 71, scale: 2 }
    const ida = cameraOnResize(camera, EM_PE, DEITADO, null, SEM_PAINEL)
    const volta = cameraOnResize(ida, DEITADO, EM_PE, null, SEM_PAINEL)
    expect(volta.x).toBeCloseTo(camera.x, 6)
    expect(volta.y).toBeCloseTo(camera.y, 6)
    expect(volta.scale).toBe(camera.scale)
  })
})

describe('cameraOnResize: a própria ficha à vista continua à vista', () => {
  it('a ficha no alto da tela em pé sairia ao deitar: a câmera vai até ela, no mesmo zoom', () => {
    const camera = { x: 0, y: 0, scale: 1 }
    const ficha = { x: 195, y: 90, radius: 20 }
    expect(inteiraNaTela(camera, ficha, EM_PE)).toBe(true)
    const nova = cameraOnResize(camera, EM_PE, DEITADO, ficha, SEM_PAINEL)
    expect(nova.scale).toBe(1)
    expect(inteiraNaTela(nova, ficha, DEITADO)).toBe(true)
  })

  it('a ficha que o jogador deixou fora da tela fica fora: só o meio é mantido', () => {
    const camera = { x: 0, y: 0, scale: 1 }
    const longe = { x: 2000, y: 2000, radius: 20 }
    const nova = cameraOnResize(camera, EM_PE, DEITADO, longe, SEM_PAINEL)
    expect(nova).toEqual({ scale: 1, x: (DEITADO.width - EM_PE.width) / 2, y: (DEITADO.height - EM_PE.height) / 2 })
  })

  it('a ficha que cairia debaixo do painel sai de baixo dele', () => {
    const camera = { x: 0, y: 0, scale: 1 }
    const ficha = { x: 60, y: 420, radius: 20 }
    // Deitado, a ficha ancorada cai em x 287: a coluna do painel cobre de 0 a 300.
    const painel: Bounds[] = [{ minX: 0, minY: 0, maxX: 300, maxY: 390 }]
    const nova = cameraOnResize(camera, EM_PE, DEITADO, ficha, painel)
    const p = naTela(nova, ficha)
    expect(p.x - p.r).toBeGreaterThanOrEqual(300)
    expect(inteiraNaTela(nova, ficha, DEITADO)).toBe(true)
  })
})

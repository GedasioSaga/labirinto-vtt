import { describe, expect, it } from 'vitest'
import type { Bounds, Camera, Viewport } from '../pixi/world'
import {
  EDGE_SCROLL_MAX_SPEED,
  EDGE_SCROLL_ZONE_PX,
  RECENTER_MS,
  cameraGlideFrame,
  edgeScrollCamera,
  edgeScrollVelocity,
  recenterTarget,
  startCameraGlide,
} from './edgeFollow'

/**
 * A ficha arrastada até a borda rola o mapa, e a câmera recentra quem soltou
 * a ficha perto da borda. Aqui é só a conta; a costura com o dedo e o ticker
 * está em `PlayerView.borda.test.tsx`.
 */

const TELA: Viewport = { width: 800, height: 600 }
/** Mapa de 2000 x 2000 px de mundo, bem maior que a tela no zoom 1. */
const MAPA: Bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 2000 }
/** Câmera no meio do mapa: sobra mapa para os quatro lados. */
const MEIO: Camera = { x: -600, y: -700, scale: 1 }

describe('edgeScrollVelocity — o dedo perto da borda', () => {
  it('longe das bordas: parado', () => {
    expect(edgeScrollVelocity({ x: 400, y: 300 }, TELA)).toEqual({ x: 0, y: 0 })
    // Exatamente no começo da faixa ainda é parado.
    expect(edgeScrollVelocity({ x: TELA.width - EDGE_SCROLL_ZONE_PX, y: 300 }, TELA)).toEqual({ x: 0, y: 0 })
  })

  it('perto da direita: a câmera anda para revelar a direita (x negativo), mais rápido quanto mais perto', () => {
    const longe = edgeScrollVelocity({ x: TELA.width - 40, y: 300 }, TELA)
    const perto = edgeScrollVelocity({ x: TELA.width - 4, y: 300 }, TELA)
    expect(longe.y).toBe(0)
    expect(longe.x).toBeLessThan(0)
    expect(perto.x).toBeLessThan(longe.x)
    // No encosto (ou fora da tela), a velocidade é a máxima, e não passa dela.
    expect(edgeScrollVelocity({ x: TELA.width + 30, y: 300 }, TELA).x).toBe(-EDGE_SCROLL_MAX_SPEED)
  })

  it('perto da esquerda, de cima e de baixo: cada borda puxa para o seu lado, e o canto puxa nos dois', () => {
    expect(edgeScrollVelocity({ x: 10, y: 300 }, TELA).x).toBeGreaterThan(0)
    expect(edgeScrollVelocity({ x: 400, y: 10 }, TELA).y).toBeGreaterThan(0)
    expect(edgeScrollVelocity({ x: 400, y: TELA.height - 10 }, TELA).y).toBeLessThan(0)
    const canto = edgeScrollVelocity({ x: TELA.width - 10, y: TELA.height - 10 }, TELA)
    expect(canto.x).toBeLessThan(0)
    expect(canto.y).toBeLessThan(0)
    expect(canto.x).toBe(canto.y)
  })
})

describe('edgeScrollCamera — um quadro de rolagem', () => {
  it('dedo na borda direita por 40 ms: a câmera anda velocidade x tempo para a esquerda', () => {
    const dedo = { x: TELA.width - 4, y: 300 }
    const v = edgeScrollVelocity(dedo, TELA)
    const next = edgeScrollCamera(MEIO, dedo, TELA, MAPA, 40)
    expect(next).not.toBeNull()
    expect(next?.scale).toBe(1)
    expect(next?.y).toBe(MEIO.y)
    expect(next?.x).toBeCloseTo(MEIO.x + v.x * 0.04, 9)
    expect(next?.x).toBeLessThan(MEIO.x)
  })

  it('dedo longe da borda, ou quadro sem tempo: nada muda (null)', () => {
    expect(edgeScrollCamera(MEIO, { x: 400, y: 300 }, TELA, MAPA, 16)).toBeNull()
    expect(edgeScrollCamera(MEIO, { x: TELA.width - 4, y: 300 }, TELA, MAPA, 0)).toBeNull()
  })

  it('para na beira do mapa: a borda do mapa encosta no começo da faixa e não passa', () => {
    // Faltam 30 px para a borda direita do mapa chegar ao começo da faixa.
    const perto: Camera = { x: TELA.width - EDGE_SCROLL_ZONE_PX - MAPA.maxX + 30, y: MEIO.y, scale: 1 }
    const next = edgeScrollCamera(perto, { x: TELA.width - 1, y: 300 }, TELA, MAPA, 1000)
    const bordaNaTela = MAPA.maxX * 1 + (next?.x ?? Number.NaN)
    expect(bordaNaTela).toBe(TELA.width - EDGE_SCROLL_ZONE_PX)
    // Já na beira: não anda mais.
    expect(edgeScrollCamera({ ...perto, x: perto.x - 30 }, { x: TELA.width - 1, y: 300 }, TELA, MAPA, 1000)).toBeNull()
  })

  it('mapa que já cabe na tela não rola (a conta da beira não empurra a câmera para trás)', () => {
    const pequeno: Bounds = { minX: 0, minY: 0, maxX: 400, maxY: 300 }
    const centrado: Camera = { x: 200, y: 150, scale: 1 }
    expect(edgeScrollCamera(centrado, { x: TELA.width - 1, y: 300 }, TELA, pequeno, 100)).toBeNull()
    expect(edgeScrollCamera(centrado, { x: 1, y: 1 }, TELA, pequeno, 100)).toBeNull()
  })

  it('quadro longo (aba em segundo plano) não vira um salto: o tempo é limitado', () => {
    const dedo = { x: TELA.width - 1, y: 300 }
    const um = edgeScrollCamera(MEIO, dedo, TELA, MAPA, 50)
    const muito = edgeScrollCamera(MEIO, dedo, TELA, MAPA, 5000)
    expect(muito?.x).toBe(um?.x)
    expect(muito?.x).toBeLessThan(MEIO.x)
  })
})

describe('a faixa da borda começa onde o painel termina (a mesma área livre do recentrar)', () => {
  // Coluna do painel à esquerda, como no notebook (12..286 px): mais alta que larga, come a esquerda.
  const PAINEL: Bounds = { minX: 12, minY: 12, maxX: 286, maxY: 588 }

  it('dedo logo à direita do painel: rola para revelar a esquerda; sem painel, o mesmo ponto é miolo', () => {
    const v = edgeScrollVelocity({ x: PAINEL.maxX + 14, y: 300 }, TELA, [PAINEL])
    expect(v.y).toBe(0)
    expect(v.x).toBeGreaterThan(0)
    expect(edgeScrollVelocity({ x: PAINEL.maxX + 14, y: 300 }, TELA)).toEqual({ x: 0, y: 0 })
    // Exatamente no começo da faixa livre ainda é parado.
    expect(edgeScrollVelocity({ x: PAINEL.maxX + EDGE_SCROLL_ZONE_PX, y: 300 }, TELA, [PAINEL])).toEqual({ x: 0, y: 0 })
  })

  it('dedo por baixo do painel: a velocidade é a máxima, como encostado na borda', () => {
    expect(edgeScrollVelocity({ x: 150, y: 300 }, TELA, [PAINEL])).toEqual({ x: EDGE_SCROLL_MAX_SPEED, y: 0 })
  })

  it('a beira do mapa para no começo da faixa livre, e não na borda do canvas', () => {
    // A borda esquerda do mapa (mundo x = 0) está em tela x = câmera.x; faltam 30 px para ela chegar ao começo da faixa.
    const inicioDaFaixa = PAINEL.maxX + EDGE_SCROLL_ZONE_PX
    const perto: Camera = { x: inicioDaFaixa - 30, y: MEIO.y, scale: 1 }
    const next = edgeScrollCamera(perto, { x: 150, y: 300 }, TELA, MAPA, 1000, [PAINEL])
    expect(next).toEqual({ scale: 1, x: inicioDaFaixa, y: MEIO.y })
    expect(edgeScrollCamera({ ...perto, x: inicioDaFaixa }, { x: 150, y: 300 }, TELA, MAPA, 1000, [PAINEL])).toBeNull()
  })
})

describe('recenterTarget — soltou a ficha perto da borda', () => {
  const disco = (x: number, y: number) => ({ x, y, radius: 20 })

  it('ficha no miolo da tela: a câmera fica (null)', () => {
    // Mundo (1000, 1000) aparece em (400, 300): o centro da tela.
    expect(recenterTarget(MEIO, disco(1000, 1000), TELA, [])).toBeNull()
  })

  it('ficha a menos de 15% da borda direita: a câmera a põe no centro, no mesmo zoom', () => {
    // Mundo (1350, 1000) → tela (750, 300): a 50 px da direita, dentro dos 120 px (15% de 800).
    const alvo = recenterTarget(MEIO, disco(1350, 1000), TELA, [])
    expect(alvo).toEqual({ scale: 1, x: 400 - 1350, y: 300 - 1000 })
  })

  it('ficha debaixo do painel: conta como borda e vai para o centro do que sobra livre', () => {
    // Painel alto na esquerda (0..240 de largura): a área livre é 240..800, centro x = 520.
    const painel: Bounds = { minX: 0, minY: 0, maxX: 240, maxY: 600 }
    // Mundo (700, 1000) → tela (100, 300): debaixo do painel.
    const alvo = recenterTarget(MEIO, disco(700, 1000), TELA, [painel])
    expect(alvo).toEqual({ scale: 1, x: 520 - 700, y: 300 - 1000 })
  })
})

describe('cameraGlide — o recentrar suave', () => {
  const de: Camera = { x: 0, y: 0, scale: 1 }
  const para: Camera = { x: -300, y: 120, scale: 1 }

  it('começa onde estava, anda no meio e termina exatamente no alvo em RECENTER_MS', () => {
    const glide = startCameraGlide(de, para, 1000)
    expect(cameraGlideFrame(glide, 1000)).toEqual({ camera: de, done: false })
    const meio = cameraGlideFrame(glide, 1000 + RECENTER_MS / 2)
    expect(meio.done).toBe(false)
    expect(meio.camera.x).toBeLessThan(0)
    expect(meio.camera.x).toBeGreaterThan(-300)
    expect(cameraGlideFrame(glide, 1000 + RECENTER_MS)).toEqual({ camera: para, done: true })
    expect(cameraGlideFrame(glide, 1000 + RECENTER_MS * 3)).toEqual({ camera: para, done: true })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Ticker } from 'pixi.js'
import { createGlideDaCamera } from './glideDaCamera'
import { createZoomDaRoda, ZOOM_DA_RODA_PARADA_MS } from './zoomDaRoda'
import { RECENTER_MS } from '../player/edgeFollow'
import type { Camera } from './world'

/**
 * "IR ATÉ LÁ" COM A CÂMERA DESLIZANDO, montado como o PixiCanvas usa: o
 * `aplicar` faz o papel do `applyCamera` (troca a câmera e, quando a escala
 * muda, avisa o zoom adiado como a assinatura de `camera.scale` avisa), e o
 * zoom adiado é o de verdade (`zoomDaRoda.ts`).
 */
function montar(inicial: Camera = { x: 0, y: 0, scale: 1 }) {
  const ticker = new Ticker()
  let agora = 1000
  let camera = inicial
  const aplicadas: Camera[] = []
  const redesenhar = vi.fn()
  const redesenharNoQuadro = vi.fn()
  const zoom = createZoomDaRoda({ redesenhar, redesenharNoQuadro })
  const aplicarDeFora = (next: Camera) => {
    const mudouEscala = next.scale !== camera.scale
    camera = next
    if (mudouEscala) zoom.escalaMudou()
  }
  const glide = createGlideDaCamera({
    lerCamera: () => camera,
    aplicar: (next) => {
      aplicadas.push(next)
      aplicarDeFora(next)
    },
    redesenhar,
    zoom,
    ticker,
    agora: () => agora,
  })
  return {
    glide,
    ticker,
    zoom,
    aplicadas,
    redesenhar,
    redesenharNoQuadro,
    camera: () => camera,
    /** Gesto do mestre (roda, arrasto da vista, F): troca a câmera sem passar pelo deslize. */
    aplicarDeFora,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

describe('glideDaCamera — o "Ir até lá" corre até o alvo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('parte da câmera de agora, passa pelo meio e chega EXATA no alvo em RECENTER_MS; depois solta o relógio', () => {
    const t = montar()
    const alvo = { x: -600, y: -300, scale: 1 }
    t.glide.deslizar(alvo)
    expect(t.glide.emCurso()).toBe(true)

    t.quadro(RECENTER_MS / 2)
    expect(t.camera().x).toBeLessThan(0)
    expect(t.camera().x).toBeGreaterThan(-600)
    t.quadro(RECENTER_MS / 2)
    expect(t.camera()).toEqual(alvo)
    expect(t.glide.emCurso()).toBe(false)
    expect(t.ticker.count).toBe(0)
  })

  it('só pan (mesma escala): não mexe no zoom adiado nem refaz geometria', () => {
    const t = montar()
    t.glide.deslizar({ x: -600, y: -300, scale: 1 })
    t.quadro(16)
    t.quadro(RECENTER_MS)
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS * 2)
    expect(t.redesenhar).not.toHaveBeenCalled()
    expect(t.redesenharNoQuadro).not.toHaveBeenCalled()
  })

  it('com zoom: os quadros do meio só escalam; a geometria é refeita UMA vez, já no último quadro', () => {
    const t = montar()
    t.glide.deslizar({ x: -600, y: -300, scale: 0.5 })
    for (let i = 0; i < 6; i++) t.quadro(16)
    expect(t.redesenhar).not.toHaveBeenCalled()
    expect(t.redesenharNoQuadro).not.toHaveBeenCalled()

    t.quadro(RECENTER_MS)
    expect(t.camera().scale).toBe(0.5)
    expect(t.redesenhar).toHaveBeenCalledTimes(1)
    // Nem o redesenho do quadro seguinte, nem o da roda parada vêm depois.
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS * 2)
    expect(t.redesenhar).toHaveBeenCalledTimes(1)
    expect(t.redesenharNoQuadro).not.toHaveBeenCalled()
  })

  it('o mestre mexe na câmera no meio (roda, arrasto da vista, F): o deslize para e não briga com o gesto', () => {
    const t = montar()
    t.glide.deslizar({ x: -600, y: -300, scale: 1 })
    t.quadro(16)
    const doGesto = { x: 40, y: 40, scale: 1 }
    t.aplicarDeFora(doGesto)
    const aplicadasAntes = t.aplicadas.length

    t.quadro(16)
    expect(t.camera()).toBe(doGesto)
    expect(t.aplicadas).toHaveLength(aplicadasAntes)
    expect(t.glide.emCurso()).toBe(false)
    expect(t.ticker.count).toBe(0)
  })

  it('parado no meio de um zoom: a geometria ainda é refeita uma vez quando o zoom adiado assenta', () => {
    const t = montar()
    t.glide.deslizar({ x: -600, y: -300, scale: 0.5 })
    t.quadro(16)
    t.quadro(16)
    t.glide.parar()
    expect(t.redesenhar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS)
    expect(t.redesenhar).toHaveBeenCalledTimes(1)
  })

  it('pedido novo no meio: parte de onde a câmera está AGORA, sem voltar, e chega ao alvo novo', () => {
    const t = montar()
    t.glide.deslizar({ x: -600, y: 0, scale: 1 })
    t.quadro(RECENTER_MS / 2)
    const meio = t.camera()

    t.glide.deslizar({ x: 0, y: -400, scale: 1 })
    expect(t.ticker.count).toBe(1)
    t.quadro(1)
    // Do meio em direção ao alvo novo: nem voltou para o começo (x 0 → -600), nem saltou.
    expect(t.camera().x).toBeGreaterThanOrEqual(meio.x)
    expect(t.camera().x - meio.x).toBeLessThan(Math.abs(meio.x) * 0.05)
    expect(t.camera().y).toBeLessThanOrEqual(0)
    t.quadro(RECENTER_MS)
    expect(t.camera()).toEqual({ x: 0, y: -400, scale: 1 })
  })

  it('alvo igual à câmera de agora: aplica uma vez e nem entra no relógio', () => {
    const t = montar({ x: 10, y: 20, scale: 2 })
    t.glide.deslizar({ x: 10, y: 20, scale: 2 })
    expect(t.aplicadas).toHaveLength(1)
    expect(t.ticker.count).toBe(0)
    expect(t.glide.emCurso()).toBe(false)
  })

  it('CASO OBRIGATÓRIO: parar sem deslize em curso, ou duas vezes, não quebra', () => {
    const t = montar()
    expect(() => {
      t.glide.parar()
      t.glide.deslizar({ x: 5, y: 5, scale: 1 })
      t.glide.parar()
      t.glide.parar()
    }).not.toThrow()
    expect(t.ticker.count).toBe(0)
  })
})

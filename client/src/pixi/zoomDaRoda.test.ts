import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZOOM_DA_RODA_PARADA_MS, createZoomDaRoda } from './zoomDaRoda'

/**
 * Como o PixiCanvas usa: a cada evento de ZOOM da roda, `rodaGirou()` antes de
 * mover a câmera; a assinatura de `camera.scale` chama `escalaMudou()`.
 */
function montar() {
  const redesenhar = vi.fn()
  const redesenharNoQuadro = vi.fn()
  const zoom = createZoomDaRoda({ redesenhar, redesenharNoQuadro })
  const passoDeRoda = () => {
    zoom.rodaGirou()
    zoom.escalaMudou()
  }
  return { zoom, redesenhar, redesenharNoQuadro, passoDeRoda }
}

describe('zoom com a roda sem refazer o desenho', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('16 passos de roda seguidos não refazem paredes/escadas/luzes; refaz UMA vez quando a roda para', () => {
    const { redesenhar, redesenharNoQuadro, passoDeRoda } = montar()
    for (let i = 0; i < 16; i++) {
      passoDeRoda()
      vi.advanceTimersByTime(16)
    }
    expect(redesenhar).toHaveBeenCalledTimes(0)
    expect(redesenharNoQuadro).toHaveBeenCalledTimes(0)

    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS)
    expect(redesenhar).toHaveBeenCalledTimes(1)
    expect(redesenharNoQuadro).toHaveBeenCalledTimes(0)
  })

  it('roda girada devagar (entalhes a cada 100 ms) continua contando como o mesmo giro', () => {
    const { redesenhar, passoDeRoda } = montar()
    for (let i = 0; i < 5; i++) {
      passoDeRoda()
      vi.advanceTimersByTime(100)
    }
    expect(redesenhar).toHaveBeenCalledTimes(0)
    // 100 ms já passaram desde o último entalhe; falta o resto do silêncio.
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS - 100 - 1)
    expect(redesenhar).toHaveBeenCalledTimes(0)
    vi.advanceTimersByTime(1)
    expect(redesenhar).toHaveBeenCalledTimes(1)
  })

  it('dois giros separados por uma pausa refazem uma vez cada', () => {
    const { redesenhar, passoDeRoda } = montar()
    passoDeRoda()
    passoDeRoda()
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS)
    expect(redesenhar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    passoDeRoda()
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS)
    expect(redesenhar).toHaveBeenCalledTimes(2)
  })

  it('zoom que não vem da roda (enquadrar, Ctrl+0, trocar de cena) redesenha no quadro, como antes', () => {
    const { zoom, redesenhar, redesenharNoQuadro } = montar()
    zoom.escalaMudou()
    expect(redesenharNoQuadro).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS * 2)
    expect(redesenhar).toHaveBeenCalledTimes(0)
  })

  it('roda no limite do zoom (a escala não muda) não refaz nada ao parar', () => {
    const { zoom, redesenhar, redesenharNoQuadro } = montar()
    zoom.rodaGirou()
    zoom.rodaGirou()
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS)
    expect(redesenhar).toHaveBeenCalledTimes(0)
    expect(redesenharNoQuadro).toHaveBeenCalledTimes(0)
  })

  it('depois que a roda parou, um zoom por outro caminho volta a redesenhar no quadro', () => {
    const { zoom, redesenhar, redesenharNoQuadro, passoDeRoda } = montar()
    passoDeRoda()
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS)
    expect(redesenhar).toHaveBeenCalledTimes(1)
    zoom.escalaMudou()
    expect(redesenharNoQuadro).toHaveBeenCalledTimes(1)
    expect(redesenhar).toHaveBeenCalledTimes(1)
  })

  it('desmontar no meio do giro não redesenha depois', () => {
    const { zoom, redesenhar, redesenharNoQuadro, passoDeRoda } = montar()
    passoDeRoda()
    zoom.cancelar()
    vi.advanceTimersByTime(ZOOM_DA_RODA_PARADA_MS * 2)
    expect(redesenhar).toHaveBeenCalledTimes(0)
    expect(redesenharNoQuadro).toHaveBeenCalledTimes(0)
  })
})

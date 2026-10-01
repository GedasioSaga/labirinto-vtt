import { act, Profiler, type ProfilerOnRenderCallback } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_SCALE, MIN_SCALE } from '../pixi/world'
import { useMapStore } from '../stores/mapStore'
import { ZoomHud } from './ZoomHud'

/**
 * HUD de zoom: lê a escala da câmera direto da store, onde o PixiCanvas grava
 * cada câmera (`applyCamera`, síncrono). Antes o App guardava uma cópia num
 * useState, e cada quadro de zoom re-renderizava o App inteiro, com todos os
 * painéis, só para trocar o "NN%" deste botão.
 */
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useMapStore.getState().setCamera({ x: 0, y: 0, scale: 1 })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function hud(): HTMLButtonElement {
  const botao = container.querySelector('button')
  if (!(botao instanceof HTMLButtonElement)) throw new Error('sem o HUD de zoom')
  return botao
}

/** O que o canvas faz a cada passo de pan ou de roda: grava a câmera na store. */
function moverCamera(x: number, y: number, scale: number) {
  act(() => useMapStore.getState().setCamera({ x, y, scale }))
}

describe('ZoomHud', () => {
  it('mostra a escala da câmera que está na store e acompanha cada passo de zoom', () => {
    act(() => root.render(<ZoomHud onReset={vi.fn()} />))
    expect(hud().getAttribute('aria-label')).toBe('Zoom: 100%')
    moverCamera(0, 0, 1.5)
    expect(hud().getAttribute('aria-label')).toBe('Zoom: 150%')
    expect(hud().textContent).toBe('150%')
  })

  it('nos limites, o nome acessível e a marca visível dizem mínimo e máximo', () => {
    act(() => root.render(<ZoomHud onReset={vi.fn()} />))
    moverCamera(0, 0, MAX_SCALE)
    expect(hud().getAttribute('aria-label')).toBe('Zoom: 400% — zoom máximo')
    expect(hud().textContent).toContain('MÁX')
    moverCamera(0, 0, MIN_SCALE)
    expect(hud().getAttribute('aria-label')).toBe('Zoom: 10% — zoom mínimo')
    expect(hud().textContent).toContain('MÍN')
  })

  it('pan sem mudar a escala não re-renderiza o botão; o passo de zoom, sim', () => {
    let commits = 0
    const contar: ProfilerOnRenderCallback = () => {
      commits += 1
    }
    act(() =>
      root.render(
        <Profiler id="zoom-hud" onRender={contar}>
          <ZoomHud onReset={vi.fn()} />
        </Profiler>,
      ),
    )
    const depoisDeMontar = commits
    for (let passo = 1; passo <= 10; passo += 1) moverCamera(passo * 30, passo * 12, 1)
    expect(commits).toBe(depoisDeMontar)
    moverCamera(300, 120, 2)
    expect(commits).toBe(depoisDeMontar + 1)
    expect(hud().getAttribute('aria-label')).toBe('Zoom: 200%')
  })

  it('clicar pede o reset ao integrador', () => {
    const onReset = vi.fn()
    act(() => root.render(<ZoomHud onReset={onReset} />))
    act(() => hud().click())
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})

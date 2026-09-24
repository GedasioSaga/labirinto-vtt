import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PlayerNoiseCue } from './PlayerNoiseCue'

describe('PlayerNoiseCue (ruído no mapa, tela do jogador)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('texto curto anunciado sem roubar a vez (role status) e seta na borda, virada para a direção', () => {
    act(() => root.render(<PlayerNoiseCue dir="ne" />))
    const aviso = container.querySelector('[role="status"]')
    expect(aviso?.textContent).toBe('Um ruído a nordeste')
    const seta = container.querySelector('.pp-noise__arrow')
    expect(seta).not.toBeNull()
    expect(seta?.getAttribute('data-dir')).toBe('ne')
    expect(seta?.getAttribute('aria-hidden')).toBe('true')
    expect(seta instanceof HTMLElement ? seta.style.transform : '').toBe('rotate(45deg)')
  })

  it('"ao redor" não tem seta: não há para onde apontar', () => {
    act(() => root.render(<PlayerNoiseCue dir="around" />))
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Um ruído bem perto de você')
    expect(container.querySelector('.pp-noise__arrow')).toBeNull()
  })

  it('não rouba o foco nem captura o toque no mapa', () => {
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()
    act(() => root.render(<PlayerNoiseCue dir="s" />))
    expect(document.activeElement).toBe(campo)
    expect(container.querySelector('button')).toBeNull()
    campo.remove()
  })
})

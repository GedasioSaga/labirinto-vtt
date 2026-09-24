/**
 * ABALO no cartão do jogador: a seta diz DE ONDE veio (glifo + nome, que o
 * leitor de tela lê) e o "forte" faz o aparelho vibrar uma vez, ao abrir.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ABALO_VIBRACAO_MS } from '../lib/abalo'
import { PlayerNoteCard } from './PlayerNoteCard'

describe('PlayerNoteCard: abalo com seta e vibração', () => {
  let container: HTMLDivElement
  let root: Root
  const original = Object.getOwnPropertyDescriptor(navigator, 'vibrate')

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    if (original === undefined) Reflect.deleteProperty(navigator, 'vibrate')
    else Object.defineProperty(navigator, 'vibrate', original)
  })

  function comVibrar() {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
    return vibrate
  }

  it('mostra a seta com o nome do rumo e vibra uma vez no forte', () => {
    const vibrate = comVibrar()
    act(() => root.render(<PlayerNoteCard text="O teto treme." seta="ne" forte onClose={() => {}} />))
    const seta = container.querySelector('.pp-note__seta')
    expect(seta?.textContent).toContain('nordeste')
    expect(container.querySelector('.pp-note')?.classList.contains('pp-note--forte')).toBe(true)
    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(ABALO_VIBRACAO_MS)
    // Re-render do mesmo cartão não vibra de novo.
    act(() => root.render(<PlayerNoteCard text="O teto treme." seta="ne" forte onClose={() => {}} />))
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('"aqui": sem rumo, diz que foi bem onde ele está', () => {
    act(() => root.render(<PlayerNoteCard text="Estoura ao seu lado." seta="aqui" onClose={() => {}} />))
    expect(container.querySelector('.pp-note__seta')?.textContent).toContain('bem aqui')
  })

  it('recado comum (sem seta, sem forte): nada de seta, nada de vibrar', () => {
    const vibrate = comVibrar()
    act(() => root.render(<PlayerNoteCard text="oi" onClose={() => {}} />))
    expect(container.querySelector('.pp-note__seta')).toBeNull()
    expect(container.querySelector('.pp-note--forte')).toBeNull()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('navegador sem vibração (iPhone): o cartão abre igual, sem erro', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true, writable: true })
    act(() => root.render(<PlayerNoteCard text="treme" seta="s" forte onClose={() => {}} />))
    expect(container.querySelector('.pp-note__text')?.textContent).toBe('treme')
    expect(container.querySelector('.pp-note__seta')?.textContent).toContain('sul')
  })
})

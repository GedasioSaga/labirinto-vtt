/**
 * RELÓGIO DA CAMPANHA na tela do jogador: a hora aproximada (Manhã, Tarde,
 * Noite) e, quando a cena dele está escura, o aviso de que se enxerga menos.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DARK_HINT_TEXT, PlayerClockBadge } from './PlayerClockBadge'

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

describe('PlayerClockBadge', () => {
  it('mostra o período, sem aviso de escuro de dia', () => {
    act(() => root.render(<PlayerClockBadge relogio={{ periodo: 'tarde' }} />))
    const badge = container.querySelector('.pp-clock')
    expect(badge?.textContent).toBe('Tarde')
    expect(badge?.classList.contains('pp-clock--escuro')).toBe(false)
  })

  it('noite na cena externa: "Noite" e o aviso de que se enxerga menos', () => {
    act(() => root.render(<PlayerClockBadge relogio={{ periodo: 'noite', escuro: true }} />))
    const badge = container.querySelector('.pp-clock')
    expect(badge?.textContent).toBe(`Noite · ${DARK_HINT_TEXT}`)
    expect(badge?.classList.contains('pp-clock--escuro')).toBe(true)
    expect(badge?.getAttribute('aria-label')).toBe(`Hora do dia: Noite. ${DARK_HINT_TEXT}`)
  })

  it('sem relógio: nada na tela', () => {
    act(() => root.render(<PlayerClockBadge relogio={undefined} />))
    expect(container.querySelector('.pp-clock')).toBeNull()
  })
})

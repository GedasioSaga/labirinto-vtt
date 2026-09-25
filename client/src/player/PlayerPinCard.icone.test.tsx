import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * O cartão do jogador mostra o MESMO símbolo que o marcador tem no mapa. O
 * mestre escolheu "Baú": o jogador que toca no pino vê o baú no cartão (e o
 * leitor de tela diz "Baú"), não o "!" genérico do tipo.
 */

function pino(extra: Partial<Pin> = {}): Pin {
  return { id: 'p1', x: 10, y: 10, kind: 'exclamacao', description: 'Um baú velho', image: null, ...extra }
}

describe('PlayerPinCard: ícone do marcador', () => {
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

  function render(pin: Pin): void {
    act(() => root.render(<PlayerPinCard pin={pin} onClose={() => {}} stairs={[]} />))
  }

  function dialogo(): HTMLElement {
    const el = container.querySelector<HTMLElement>('[role="dialog"]')
    if (el === null) throw new Error('cartão não abriu')
    return el
  }

  function selo(): HTMLElement {
    const el = container.querySelector<HTMLElement>('.pp-pincard__glyph')
    if (el === null) throw new Error('cartão sem selo do pino')
    return el
  }

  it('com ícone escolhido, o selo desenha o símbolo e o cartão se chama pelo nome dele', () => {
    render(pino({ icon: 'bau' }))
    expect(dialogo().getAttribute('aria-label')).toBe('Ponto de interesse — Baú')
    // O símbolo, não a pontuação do tipo.
    expect(selo().querySelector('svg')).not.toBeNull()
    expect(selo().textContent).toBe('')
  })

  it('ícones diferentes dão desenhos diferentes no cartão', () => {
    render(pino({ icon: 'bau' }))
    const bau = selo().innerHTML
    render(pino({ icon: 'armadilha' }))
    const armadilha = selo().innerHTML
    expect(dialogo().getAttribute('aria-label')).toBe('Ponto de interesse — Armadilha')
    expect(armadilha).not.toBe(bau)
  })

  it('sem ícone, o cartão continua o de sempre: o "!" ou o "?" do tipo', () => {
    render(pino())
    expect(dialogo().getAttribute('aria-label')).toBe('Ponto de interesse !')
    expect(selo().textContent).toBe('!')
    expect(selo().querySelector('svg')).toBeNull()
  })

  it('ícone desconhecido (arquivo de versão futura) cai no glifo, sem quebrar o cartão', () => {
    render(pino({ kind: 'interrogacao', icon: 'tesouro' as Pin['icon'] })) // as: o cenário é justamente um valor que o tipo não descreve
    expect(dialogo().getAttribute('aria-label')).toBe('Ponto de interesse ?')
    expect(selo().textContent).toBe('?')
  })
})

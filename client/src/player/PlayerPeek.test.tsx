import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Espiada } from '../lib/espiar'
import type { Pin } from '../types/map'
import { PlayerPeek } from './PlayerPeek'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * ESPIAR PELA PASSAGEM na tela do jogador: o botão "Espiar" no cartão do pino
 * que dá vista, e o quadro com o recorte do outro lado no estilo do minimapa
 * (chão chapado, parede em linha fina, porta curta, fichas em ponto).
 */

const VISTA: Espiada = {
  raio: 150,
  grid: 50,
  vision: [
    [
      { x: -150, y: 0 },
      { x: 0, y: -150 },
      { x: 150, y: 0 },
      { x: 0, y: 150 },
    ],
  ],
  walls: [{ x1: 60, y1: -100, x2: 60, y2: 100 }],
  doors: [{ x1: -80, y1: 80, x2: -20, y2: 80, open: false }],
  tokens: [
    { x: 0, y: -80, size: 1, color: '#c0392b' },
    { x: 40, y: 20, size: 2, color: '#5a8fd6' },
  ],
  concealed: [
    [
      { x: -150, y: -150 },
      { x: -50, y: -150 },
      { x: -50, y: -50 },
    ],
  ],
  roofs: [],
}

function pino(extra: Partial<Pin> = {}): Pin {
  return { id: 'grade', x: 200, y: 200, kind: 'viagem', description: 'Grade no chão', image: null, ...extra }
}

describe('ESPIAR — cartão e quadro', () => {
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

  const botao = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto)

  it('pino de viagem que dá vista: o cartão oferece "Espiar", e o toque pede', () => {
    const onPeek = vi.fn()
    act(() => root.render(<PlayerPinCard pin={pino({ daVista: 3 })} onClose={() => {}} onRequestTravel={() => {}} onPeek={onPeek} />))
    const espiar = botao('Espiar')
    expect(espiar).toBeDefined()
    act(() => espiar?.click())
    expect(onPeek).toHaveBeenCalledTimes(1)
  })

  it('sem "Dá vista" o cartão não oferece espiar; trancada com vista ainda oferece', () => {
    act(() => root.render(<PlayerPinCard pin={pino()} onClose={() => {}} onPeek={() => {}} />))
    expect(botao('Espiar')).toBeUndefined()
    act(() => root.render(<PlayerPinCard pin={pino({ daVista: 2, passagem: 'trancada' })} onClose={() => {}} onPeek={() => {}} />))
    expect(botao('Espiar')).toBeDefined()
    expect(container.textContent).toContain('Está trancada')
  })

  it('esperando a resposta, o botão fica desligado e diz o que acontece', () => {
    act(() => root.render(<PlayerPinCard pin={pino({ daVista: 3 })} onClose={() => {}} onPeek={() => {}} peekWaiting />))
    const espiando = botao('Olhando…')
    expect(espiando?.disabled).toBe(true)
  })

  it('o quadro desenha o chão, a parede, a porta e cada ficha na cor dela', () => {
    act(() => root.render(<PlayerPeek view={VISTA} durationMs={4000} onClose={() => {}} />))
    const quadro = container.querySelector('[aria-label="Espiando pela passagem"]')
    expect(quadro).not.toBeNull()
    expect(container.querySelectorAll('.pp-peek__floor').length).toBe(1)
    expect(container.querySelectorAll('.pp-peek__wall').length).toBe(1)
    expect(container.querySelectorAll('.pp-peek__door').length).toBe(1)
    expect(container.querySelectorAll('.pp-peek__concealed').length).toBe(1)
    const fichas = Array.from(container.querySelectorAll('.pp-peek__token'))
    expect(fichas.map((f) => f.getAttribute('fill'))).toEqual(['#c0392b', '#5a8fd6'])
    // Ficha de 2 casas desenha o dobro da de 1.
    expect(Number(fichas[1]?.getAttribute('r'))).toBe(2 * Number(fichas[0]?.getAttribute('r')))
    // Nada de grade, hachura ou nome: só o título do quadro e o botão.
    expect(container.querySelector('pattern')).toBeNull()
    expect(container.textContent).toBe('Espiando pela passagemFechar')
  })

  it('"Fechar" e Escape fecham o quadro', () => {
    const onClose = vi.fn()
    act(() => root.render(<PlayerPeek view={VISTA} durationMs={4000} onClose={onClose} />))
    act(() => botao('Fechar')?.click())
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

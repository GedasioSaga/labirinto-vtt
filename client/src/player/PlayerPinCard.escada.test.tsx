import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * Tocar a ESCADA que leva a outro andar abre "Subir" ou "Descer" — nunca o
 * nome do andar, nunca o cartão de ponto de interesse com imagem vazia.
 */

const PINO: Pin = { id: 'pino-da-escada', x: 0, y: 0, kind: 'viagem', description: '', image: null, passagem: 'livre', escadaId: 'escada' }

describe('PlayerPinCard: escada', () => {
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

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto)
    if (achado === undefined) throw new Error(`sem botão "${texto}"`)
    return achado
  }

  it('escada que sobe: lê "Subir", passa com "Passar" e confirma', () => {
    const onRequestTravel = vi.fn()
    act(() => root.render(<PlayerPinCard pin={PINO} stairDirection="up" onClose={() => {}} onRequestTravel={onRequestTravel} />))
    const dialogo = container.querySelector('[role="dialog"]')
    expect(dialogo?.getAttribute('aria-label')).toBe('Subir')
    expect(container.querySelector('.pp-pincard__text')?.textContent).toBe('Subir')
    // Escada não é ponto de interesse: nem a imagem vazia, nem "O mestre ainda não escreveu".
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).not.toContain('O mestre ainda não escreveu')
    act(() => botao('Passar').click())
    expect(container.textContent).toContain('Subir por aqui?')
    act(() => botao('Passar').click())
    expect(onRequestTravel).toHaveBeenCalledTimes(1)
  })

  it('escada que desce, pedindo ao mestre: lê "Descer" e "Pedir para descer"', () => {
    act(() => root.render(<PlayerPinCard pin={{ ...PINO, passagem: 'pede' }} stairDirection="down" onClose={() => {}} onRequestTravel={() => {}} />))
    expect(container.querySelector('.pp-pincard__text')?.textContent).toBe('Descer')
    expect(botao('Pedir para descer').disabled).toBe(false)
  })

  it('escada trancada: lê o sentido e que não dá para passar, sem botão de passar', () => {
    act(() => root.render(<PlayerPinCard pin={{ ...PINO, passagem: 'trancada' }} stairDirection="up" onClose={() => {}} onRequestTravel={() => {}} />))
    expect(container.querySelector('.pp-pincard__locked')?.textContent).toBe('Está trancada. Não dá para passar por aqui agora.')
    expect(Array.from(container.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Fechar'])
  })
})

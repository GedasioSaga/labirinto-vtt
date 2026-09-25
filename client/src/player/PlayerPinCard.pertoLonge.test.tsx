import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * Cartão do pino "só de perto" do lado do jogador: longe, o recorte manda o
 * pino marcado `longe` e sem texto, e o cartão diz "Chegue mais perto para
 * ler" — nunca "O mestre ainda não escreveu nada", que seria mentira.
 */

const LONGE: Pin = { id: 'carta', x: 400, y: 200, kind: 'interrogacao', description: '', image: null, longe: true }

describe('PlayerPinCard: pino só de perto', () => {
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

  const render = (pin: Pin): void => act(() => root.render(<PlayerPinCard pin={pin} stairs={[]} onClose={() => {}} />))
  const texto = (): string => container.querySelector('.pp-pincard__text')?.textContent ?? ''

  it('longe: "Chegue mais perto para ler", e a imagem diz o mesmo', () => {
    render(LONGE)
    expect(texto()).toBe('Chegue mais perto para ler.')
    expect(container.textContent).not.toContain('ainda não escreveu')
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Chegue mais perto para ver a imagem')
  })

  it('ao chegar perto o recorte manda o texto e o cartão aberto troca sozinho', () => {
    render(LONGE)
    expect(texto()).toBe('Chegue mais perto para ler.')
    render({ ...LONGE, longe: undefined, description: 'Encontrem-me no cais' })
    expect(texto()).toBe('Encontrem-me no cais')
  })

  it('placa de encruzilhada longe: um botão por saída, pela posição, sem o nome escrito na placa', () => {
    const placa: Pin = {
      ...LONGE,
      id: 'placa',
      kind: 'viagem',
      escolhas: [
        { id: 'principal', rotulo: 'Cripta do Rei Morto' },
        { id: 'porto', rotulo: 'Porto' },
      ],
    }
    act(() => root.render(<PlayerPinCard pin={placa} stairs={[]} onClose={() => {}} onRequestTravel={() => {}} />))
    const botoes = Array.from(container.querySelectorAll('.pp-pincard__exits button')).map((b) => b.textContent)
    expect(botoes).toEqual(['Saída 1', 'Saída 2'])
    expect(texto()).toBe('Chegue mais perto para ler.')
    expect(container.textContent).not.toContain('Cripta do Rei Morto')
    expect(container.textContent).not.toContain('Porto')
  })

  it('controle: pino comum sem texto continua dizendo que o mestre não escreveu', () => {
    render({ ...LONGE, longe: undefined })
    expect(texto()).toBe('O mestre ainda não escreveu nada sobre este ponto.')
  })
})

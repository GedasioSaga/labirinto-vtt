import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * Cartão do MARCO que também é passagem, visto de longe: o recorte manda o
 * pino com `soMarco` (a Ana nunca esteve lá) e o host recusa a passagem. O
 * cartão não oferece o botão — um "Passar" que sempre falha só ensinaria a
 * insistir — e diz por quê.
 */

const TEMPLO: Pin = { id: 'templo', x: 1500, y: 300, kind: 'viagem', description: 'Templo de Pelor', image: null, passagem: 'livre', soMarco: true }

describe('PlayerPinCard: marco de viagem visto de longe', () => {
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

  const render = (pin: Pin): void => act(() => root.render(<PlayerPinCard pin={pin} stairs={[]} onClose={() => {}} onRequestTravel={() => {}} />))
  const botoesDePassagem = (): number => container.querySelectorAll('.pp-pincard__travel').length

  it('de longe: sem botão de passagem, com o aviso de que é preciso chegar lá, e o texto do mestre continua', () => {
    render(TEMPLO)
    expect(botoesDePassagem()).toBe(0)
    expect(container.querySelector('.pp-pincard__locked')?.textContent).toBe('Dá para ver daqui, mas para passar é preciso chegar até lá.')
    expect(container.querySelector('.pp-pincard__text')?.textContent).toBe('Templo de Pelor')
  })

  it('encruzilhada de longe também não oferece saída nenhuma', () => {
    render({ ...TEMPLO, escolhas: [{ id: 'principal', rotulo: 'Nave' }, { id: 'cripta', rotulo: 'Cripta' }] })
    expect(botoesDePassagem()).toBe(0)
    expect(container.querySelector('.pp-pincard__exits')).toBeNull()
  })

  it('controle: chegando perto (sem a marca), o botão volta e o aviso some', () => {
    render({ ...TEMPLO, soMarco: undefined })
    expect(botoesDePassagem()).toBe(1)
    expect(container.textContent).not.toContain('preciso chegar')
  })
})

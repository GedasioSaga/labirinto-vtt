import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * PASSAGEM SÓ DE IDA no cartão do jogador: com `semVolta` (o par é a chegada
 * oculta), o cartão mostra a etiqueta "Só ida" e a pergunta de confirmação
 * avisa que não dá para voltar — com o foco começando no "Cancelar", o botão
 * seguro. Numa encruzilhada, a etiqueta vai na saída que é só de ida.
 */

const AVISO = 'Não dá para voltar por este caminho.'

const CALHA: Pin = { id: 'calha', x: 1, y: 1, kind: 'viagem', description: 'Calha de varredura', image: null }

const CRUZ: Pin = {
  id: 'cruz',
  x: 1,
  y: 1,
  kind: 'viagem',
  description: 'Encruzilhada',
  image: null,
  escolhas: [
    { id: 'principal', rotulo: 'Sacada' },
    { id: 'saida_poco', rotulo: 'Poço', soIda: true },
  ],
}

describe('PlayerPinCard: passagem só de ida', () => {
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

  function render(pin: Pin, onRequestTravel: (exitId?: string) => void = () => {}): void {
    act(() => root.render(<PlayerPinCard pin={pin} stairs={[]} onClose={() => {}} onRequestTravel={onRequestTravel} />))
  }

  const botao = (texto: string): HTMLButtonElement | undefined =>
    Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').startsWith(texto))
  const etiquetas = (): string[] => Array.from(container.querySelectorAll('.pp-pincard__oneway')).map((e) => e.textContent ?? '')
  const pergunta = (): string => container.querySelector('.pp-pincard__question')?.textContent ?? ''

  it('semVolta: o cartão mostra a etiqueta "Só ida"', () => {
    render({ ...CALHA, semVolta: true })
    expect(etiquetas()).toEqual(['Só ida'])
  })

  it('sem semVolta: nenhuma etiqueta, e a pergunta é a de sempre', () => {
    render(CALHA)
    expect(etiquetas()).toEqual([])
    act(() => botao('Pedir para passar')?.click())
    expect(pergunta()).toBe('Pedir ao mestre para passar por aqui?')
  })

  it('pedir por passagem só de ida: a pergunta avisa que não tem volta e o foco começa no Cancelar', () => {
    const pedir = vi.fn()
    render({ ...CALHA, semVolta: true }, pedir)
    act(() => botao('Pedir para passar')?.click())
    expect(pergunta()).toBe(`Pedir ao mestre para passar por aqui? ${AVISO}`)
    expect(document.activeElement?.textContent).toBe('Cancelar')
    // Nada foi mandado só por abrir a pergunta: a confirmação é o passo seguinte.
    expect(pedir).not.toHaveBeenCalled()
    act(() => botao('Pedir')?.click())
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(pedir).toHaveBeenCalledWith()
  })

  it('passagem livre só de ida também confirma, com o mesmo aviso', () => {
    render({ ...CALHA, passagem: 'livre', semVolta: true })
    act(() => botao('Passar')?.click())
    expect(pergunta()).toBe(`Passar por aqui? ${AVISO}`)
  })

  it('encruzilhada: a etiqueta vai só na saída só de ida, e só a pergunta dela avisa', () => {
    const pedir = vi.fn()
    render(CRUZ, pedir)
    expect(botao('Poço')?.querySelector('.pp-pincard__oneway')?.textContent).toBe('Só ida')
    expect(botao('Sacada')?.querySelector('.pp-pincard__oneway')).toBeNull()

    act(() => botao('Poço')?.click())
    expect(pergunta()).toBe(`Pedir ao mestre para passar por Poço? ${AVISO}`)
    expect(document.activeElement?.textContent).toBe('Cancelar')
    act(() => botao('Cancelar')?.click())

    act(() => botao('Sacada')?.click())
    expect(pergunta()).toBe('Pedir ao mestre para passar por Sacada?')
    expect(document.activeElement?.textContent).toBe('Pedir')
    act(() => botao('Pedir')?.click())
    expect(pedir).toHaveBeenCalledWith('principal')
  })
})

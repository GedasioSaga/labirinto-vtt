import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * MODO POR SAÍDA no cartão do jogador: numa encruzilhada com saídas de modos
 * diferentes, cada botão diz o modo da saída, e a pergunta e a confirmação
 * seguem o modo DELA — "Passar" na livre, "Pedir" na que pede, "abrir" na
 * trancada. Trancada num pino mudo não oferece pedido nenhum.
 */

const CRUZ: Pin = {
  id: 'cruz',
  x: 1,
  y: 1,
  kind: 'viagem',
  description: 'Encruzilhada',
  image: null,
  escolhas: [
    { id: 'principal', rotulo: 'Porta' },
    { id: 'saida_torre', rotulo: 'Escada', passagem: 'livre' },
    { id: 'saida_poco', rotulo: 'Poço', passagem: 'trancada' },
  ],
}

describe('PlayerPinCard: modo por saída', () => {
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

  const saidas = (): HTMLButtonElement[] => Array.from(container.querySelectorAll<HTMLButtonElement>('.pp-pincard__exits button'))
  const saida = (rotulo: string): HTMLButtonElement | undefined => saidas().find((b) => (b.textContent ?? '').startsWith(rotulo))
  const botao = (texto: string): HTMLButtonElement | undefined => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto)
  const pergunta = (): string => container.querySelector('.pp-pincard__question')?.textContent ?? ''

  it('cada saída diz o modo dela no botão', () => {
    render(CRUZ)
    expect(saidas().map((b) => b.textContent)).toEqual(['Porta Pede ao mestre', 'Escada Livre', 'Poço Trancada'])
    // Nenhum "Está trancada" do pino inteiro: só uma saída é trancada.
    expect(container.textContent).not.toContain('Está trancada')
  })

  it('saída livre: "Passar por Escada?" e o botão de confirmar é "Passar"', () => {
    const pedir = vi.fn()
    render(CRUZ, pedir)
    act(() => saida('Escada')?.click())
    expect(pergunta()).toBe('Passar por Escada?')
    act(() => botao('Passar')?.click())
    expect(pedir).toHaveBeenCalledWith('saida_torre')
  })

  it('saída que pede: "Pedir ao mestre para passar por Porta?" e "Pedir"', () => {
    const pedir = vi.fn()
    render(CRUZ, pedir)
    act(() => saida('Porta')?.click())
    expect(pergunta()).toBe('Pedir ao mestre para passar por Porta?')
    act(() => botao('Pedir')?.click())
    expect(pedir).toHaveBeenCalledWith('principal')
  })

  it('saída trancada que aceita tentativas: pede ao mestre para ABRIR', () => {
    const pedir = vi.fn()
    render(CRUZ, pedir)
    act(() => saida('Poço')?.click())
    expect(pergunta()).toBe('Pedir ao mestre para abrir Poço?')
    act(() => botao('Pedir')?.click())
    expect(pedir).toHaveBeenCalledWith('saida_poco')
  })

  it('saída trancada num pino mudo: o botão dela fica desligado; as outras seguem', () => {
    render({ ...CRUZ, mudo: true })
    expect(saida('Poço')?.disabled).toBe(true)
    expect(saida('Escada')?.disabled).toBe(false)
    expect(saida('Porta')?.disabled).toBe(false)
  })

  it('pino trancado com uma saída livre: a livre passa, as outras dizem Trancada', () => {
    const pedir = vi.fn()
    const pin: Pin = {
      ...CRUZ,
      passagem: 'trancada',
      mudo: true,
      escolhas: [
        { id: 'principal', rotulo: 'Porta' },
        { id: 'saida_torre', rotulo: 'Escada', passagem: 'livre' },
      ],
    }
    render(pin, pedir)
    expect(saidas().map((b) => b.textContent)).toEqual(['Porta Trancada', 'Escada Livre'])
    expect(saida('Porta')?.disabled).toBe(true)
    act(() => saida('Escada')?.click())
    act(() => botao('Passar')?.click())
    expect(pedir).toHaveBeenCalledWith('saida_torre')
  })

  it('controle: todas as saídas no mesmo modo, o cartão é o de sempre (sem etiqueta de modo)', () => {
    render({ ...CRUZ, escolhas: [{ id: 'principal', rotulo: 'Porta' }, { id: 'saida_torre', rotulo: 'Escada' }] })
    expect(saidas().map((b) => b.textContent)).toEqual(['Porta', 'Escada'])
  })
})

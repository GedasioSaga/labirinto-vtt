import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin, PinBlockReason } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * MOTIVO DO BLOQUEIO no cartão do jogador: a passagem fechada diz POR QUE
 * ("Desabou", "Alagada", "Sem energia") em vez do genérico "Está trancada", e
 * oferece "Me avise quando der" — um botão de alternar (`aria-pressed`) que
 * liga e desliga o aviso de quando ela abrir. Pino aberto não oferece aviso.
 */

const CARACOL: Pin = { id: 'caracol', x: 1, y: 1, kind: 'viagem', description: 'Escada em caracol', image: null, passagem: 'trancada' }

describe('PlayerPinCard: passagem fechada diz o motivo', () => {
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

  function render(pin: Pin, extra: { watching?: boolean; onWatch?: (on: boolean) => void } = {}): void {
    act(() => root.render(<PlayerPinCard pin={pin} stairs={[]} onClose={() => {}} onRequestTravel={() => {}} {...extra} />))
  }

  const aviso = (): HTMLElement | null => container.querySelector('.pp-pincard__locked')
  const botaoAvisar = (): HTMLButtonElement | undefined =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Me avise quando der')

  // PINO TRANCADO VIRA PEDIDO: a trancada que aceita pedidos diz "Só o mestre
  // pode abrir."; a muda (`mudo`) segue com "Não dá para passar por aqui agora.".
  it('cada motivo aparece no cartão, com quem pode abrir (ou, na muda, o "não dá para passar")', () => {
    const esperado: [PinBlockReason, string][] = [
      ['desabou', 'Desabou'],
      ['alagada', 'Alagada'],
      ['em-chamas', 'Em chamas'],
      ['sem-energia', 'Sem energia'],
    ]
    for (const [motivo, texto] of esperado) {
      render({ ...CARACOL, motivo })
      expect(aviso()?.textContent, motivo).toContain(texto)
      expect(aviso()?.textContent, motivo).toContain('Só o mestre pode abrir.')
      expect(aviso()?.textContent, motivo).not.toContain('Está trancada')
      render({ ...CARACOL, motivo, mudo: true })
      expect(aviso()?.textContent, `${motivo} mudo`).toContain(texto)
      expect(aviso()?.textContent, `${motivo} mudo`).toContain('Não dá para passar por aqui agora.')
      expect(aviso()?.textContent, `${motivo} mudo`).not.toContain('Está trancada')
    }
  })

  it('sem motivo continua o de sempre: "Está trancada"', () => {
    render(CARACOL)
    expect(aviso()?.textContent).toBe('Está trancada. Só o mestre pode abrir.')
    render({ ...CARACOL, mudo: true })
    expect(aviso()?.textContent).toBe('Está trancada. Não dá para passar por aqui agora.')
  })

  it('motivo desconhecido (host de versão futura) cai no genérico, sem mostrar o valor cru', () => {
    render({ ...CARACOL, motivo: 'VALOR-CRU' } as unknown as Pin) // teste: simula campo fora do tipo vindo da rede
    expect(aviso()?.textContent).toBe('Está trancada. Só o mestre pode abrir.')
    expect(container.textContent).not.toContain('VALOR-CRU')
  })

  it('"Me avise quando der" é botão de alternar: desligado, liga; ligado, desliga e diz que vai avisar', () => {
    const onWatch = vi.fn()
    render({ ...CARACOL, motivo: 'desabou' }, { watching: false, onWatch })
    const botao = botaoAvisar()
    expect(botao).toBeDefined()
    expect(botao?.getAttribute('aria-pressed')).toBe('false')
    act(() => botao?.click())
    expect(onWatch).toHaveBeenCalledWith(true)

    render({ ...CARACOL, motivo: 'desabou' }, { watching: true, onWatch })
    expect(botaoAvisar()?.getAttribute('aria-pressed')).toBe('true')
    expect(container.textContent).toContain('Você recebe um aviso quando abrir.')
    act(() => botaoAvisar()?.click())
    expect(onWatch).toHaveBeenLastCalledWith(false)
  })

  it('pino aberto (pede ou livre) não oferece aviso nem motivo', () => {
    for (const passagem of ['pede', 'livre'] as const) {
      render({ ...CARACOL, passagem, motivo: 'desabou' }, { watching: false, onWatch: () => {} })
      expect(botaoAvisar(), passagem).toBeUndefined()
      expect(aviso(), passagem).toBeNull()
      expect(container.textContent, passagem).not.toContain('Desabou')
    }
  })

  it('sem quem ouça (`onWatch` ausente), o cartão trancado só lê — nenhum botão morto', () => {
    render({ ...CARACOL, motivo: 'alagada' })
    expect(aviso()?.textContent).toContain('Alagada')
    expect(botaoAvisar()).toBeUndefined()
  })
})

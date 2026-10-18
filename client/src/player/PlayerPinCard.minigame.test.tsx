import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * O cartão do MINIGAME no jogador: o controle no selo, o título "Minigame",
 * a descrição do mestre e o aviso de que quem chama é o mestre. Nenhum botão
 * de ação: o convite chega pela rede, não por um toque aqui.
 */

function pino(extra: Partial<Pin> = {}): Pin {
  // Só o que `pinForPlayer` deixa passar: sem `minigame`, sem `portaLigada`.
  return { id: 'm1', x: 10, y: 10, kind: 'minigame', description: 'Uma pista de dança.', image: null, ...extra }
}

describe('PlayerPinCard: minigame', () => {
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

  function render(pin: Pin, extra: { onPescar?: () => void; longe?: boolean } = {}): void {
    act(() => root.render(<PlayerPinCard pin={pin} onClose={() => {}} stairs={[]} {...extra} />))
  }

  const acoes = (): HTMLButtonElement[] => Array.from(container.querySelectorAll('button')).filter((b) => !b.className.includes('close'))

  it('mostra o controle, o título e o aviso, sem botão de ação', () => {
    render(pino())
    const dialogo = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialogo?.getAttribute('aria-label')).toBe('Minigame')
    const selo = container.querySelector<HTMLElement>('.pp-pincard__glyph')
    expect(selo?.querySelector('svg')).not.toBeNull()
    expect(selo?.getAttribute('aria-label')).toBe('Símbolo do pino: controle de videogame')
    expect(container.querySelector('.pp-pincard__title')?.textContent).toBe('Minigame')
    expect(container.textContent).toContain('Uma pista de dança.')
    expect(container.textContent).toContain('Desafio de dança. O mestre chama quando for a hora.')
    const acoes = Array.from(container.querySelectorAll('button')).filter((b) => !b.className.includes('close'))
    expect(acoes.map((b) => b.textContent)).toEqual([])
  })

  it('ícone que sobrou de quando era "!" não troca o controle', () => {
    render(pino({ icon: 'bau' }))
    expect(container.querySelector('.pp-pincard__title')?.textContent).toBe('Minigame')
  })

  it('dança pelo recorte (`minigameVisivel`): igual a hoje, só o aviso', () => {
    render(pino({ minigameVisivel: { jogo: 'danca', entrada: 'mestre' } }), { onPescar: vi.fn() })
    expect(container.textContent).toContain('Desafio de dança. O mestre chama quando for a hora.')
    expect(acoes()).toEqual([])
  })

  it('pesca que o mestre chama: só o aviso, sem botão', () => {
    render(pino({ minigameVisivel: { jogo: 'pesca', entrada: 'mestre' } }), { onPescar: vi.fn() })
    expect(container.textContent).toContain('Pesca. O mestre chama quando for a hora.')
    expect(container.textContent).not.toContain('Desafio de dança')
    expect(acoes()).toEqual([])
  })

  it('pesca "Jogador toca no pino": "Pescar" pede a pesca; com a ficha longe, apagado e dizendo por quê', () => {
    const onPescar = vi.fn()
    render(pino({ minigameVisivel: { jogo: 'pesca', entrada: 'pino' } }), { onPescar })
    const [pescar] = acoes()
    expect(pescar.textContent).toBe('Pescar')
    expect(pescar.disabled).toBe(false)
    act(() => pescar.click())
    expect(onPescar).toHaveBeenCalledTimes(1)
    render(pino({ minigameVisivel: { jogo: 'pesca', entrada: 'pino' } }), { onPescar, longe: true })
    expect(acoes()[0].disabled).toBe(true)
    expect(container.textContent).toContain('Chegue mais perto para pescar.')
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClueDot, ClueRow } from '../lib/clues'
import { CluesSection } from './CluesSection'

/*
 * PAINEL PISTAS na aba Jogo: o mestre olha, antes do confronto, quem recebeu
 * e quem leu cada pista. Clicar na linha leva o editor ao pino; clicar na
 * bolinha revela ou esconde a pista daquele jogador.
 */

const dot = (playerId: string, name: string, state: ClueDot['state'], hidden = false): ClueDot => ({ playerId, name, color: '#aa3333', state, hidden })

const BILHETE: ClueRow = {
  pinId: 'bilhete',
  glyph: '?',
  label: 'Bilhete',
  sceneId: 'cena-andar',
  sceneName: 'Andar de cima',
  x: 450,
  y: 320,
  dots: [dot('p-gabi', 'Gabi', 'recebeu'), dot('p-fabio', 'Fábio', 'recebeu'), dot('p-ana', 'Ana', 'nada')],
}

function linhas(n: number): ClueRow[] {
  return Array.from({ length: n }, (_, i) => (i === 0 ? BILHETE : { ...BILHETE, pinId: `pino-${i}`, label: `Pista ${i}` }))
}

describe('CluesSection', () => {
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

  const render = (rows: ClueRow[], onCenter = vi.fn(), onToggle = vi.fn()) => {
    act(() => root.render(<CluesSection rows={rows} onCenter={onCenter} onToggle={onToggle} />))
    return { onCenter, onToggle }
  }
  const linhaDe = (label: string): HTMLLIElement => {
    const item = Array.from(container.querySelectorAll('li')).find((li) => li.querySelector('.lb-clues__label')?.textContent === label)
    if (item === undefined) throw new Error(`sem linha ${label}`)
    return item
  }
  const bolinha = (linha: HTMLElement, nome: string): HTMLButtonElement => {
    const achada = Array.from(linha.querySelectorAll('button')).find((b) => b.getAttribute('aria-label')?.startsWith(`${nome}:`))
    if (achada === undefined) throw new Error(`sem bolinha de ${nome}`)
    return achada
  }

  it('"Pistas (7)" no título, uma linha por pino', () => {
    render(linhas(7))
    expect(container.querySelector('h3')?.textContent).toBe('Pistas (7)')
    expect(container.querySelectorAll('li').length).toBe(7)
  })

  it('"Bilhete": cheia para Gabi e Fábio, vazia para Ana; a Gabi lê e a bolinha dela enche', () => {
    render([BILHETE])
    const linha = linhaDe('Bilhete')
    expect(bolinha(linha, 'Gabi').getAttribute('aria-label')).toBe('Gabi: recebeu')
    expect(bolinha(linha, 'Gabi').dataset.estado).toBe('recebeu')
    expect(bolinha(linha, 'Fábio').dataset.estado).toBe('recebeu')
    expect(bolinha(linha, 'Ana').dataset.estado).toBe('nada')
    render([{ ...BILHETE, dots: [dot('p-gabi', 'Gabi', 'leu'), ...BILHETE.dots.slice(1)] }])
    expect(bolinha(linhaDe('Bilhete'), 'Gabi').dataset.estado).toBe('leu')
    expect(bolinha(linhaDe('Bilhete'), 'Gabi').getAttribute('aria-label')).toBe('Gabi: leu')
  })

  it('clicar em "Bilhete" pede ao editor para abrir o Andar de cima no pino', () => {
    const { onCenter } = render([BILHETE])
    const botao = linhaDe('Bilhete').querySelector('.lb-clues__pin')
    if (!(botao instanceof HTMLButtonElement)) throw new Error('a linha deveria ter o botão do pino')
    expect(botao.textContent).toContain('Andar de cima')
    act(() => botao.click())
    expect(onCenter).toHaveBeenCalledTimes(1)
    expect(onCenter).toHaveBeenCalledWith(BILHETE)
  })

  it('clicar na bolinha revela ou esconde; o estado vai em aria-pressed', () => {
    const { onToggle } = render([{ ...BILHETE, dots: [dot('p-gabi', 'Gabi', 'recebeu'), dot('p-ana', 'Ana', 'nada', true)] }])
    const linha = linhaDe('Bilhete')
    expect(bolinha(linha, 'Gabi').getAttribute('aria-pressed')).toBe('true')
    expect(bolinha(linha, 'Ana').getAttribute('aria-pressed')).toBe('false')
    expect(bolinha(linha, 'Ana').title).toBe('Revelar para Ana')
    expect(bolinha(linha, 'Gabi').title).toBe('Esconder de Gabi')
    act(() => bolinha(linha, 'Ana').click())
    expect(onToggle).toHaveBeenCalledWith('bilhete', 'p-ana')
  })

  it('sem pino "!" ou "?": o painel diz por que está vazio', () => {
    render([])
    expect(container.querySelector('h3')?.textContent).toBe('Pistas (0)')
    expect(container.textContent).toContain('Nenhum pino ! ou ? nas cenas abertas.')
    expect(container.querySelectorAll('li').length).toBe(0)
  })
})

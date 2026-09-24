/**
 * "Mostrar meu mapa a…" no painel do jogador: um botão pede a lista de quem
 * está na cena, cada colega vira um botão, e a linha de status conta o que o
 * host respondeu — sem nunca dizer para onde foi quem saiu da cena.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mapSharedNoticeText, PlayerMapShare, type PlayerMapShareProps } from './PlayerMapShare'

describe('PlayerMapShare', () => {
  let container: HTMLDivElement
  let root: Root
  let onAskPeers: ReturnType<typeof vi.fn<() => void>>
  let onShare: ReturnType<typeof vi.fn<(name: string) => void>>
  let onClose: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onAskPeers = vi.fn<() => void>()
    onShare = vi.fn<(name: string) => void>()
    onClose = vi.fn<() => void>()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(props: Partial<PlayerMapShareProps> = {}): void {
    act(() => root.render(<PlayerMapShare peers={undefined} result={undefined} onAskPeers={onAskPeers} onShare={onShare} onClose={onClose} {...props} />))
  }

  function botoes(): string[] {
    return Array.from(container.querySelectorAll('button')).map((b) => (b.textContent ?? '').trim())
  }

  function status(): string {
    return Array.from(container.querySelectorAll('[role="status"]'))
      .map((el) => (el.textContent ?? '').trim())
      .join(' | ')
  }

  it('fechado: um botão só, que pede a lista de colegas', () => {
    render()
    expect(botoes()).toEqual(['Mostrar meu mapa a…'])
    const botao = container.querySelector('button')
    if (botao === null) throw new Error('sem botão')
    act(() => botao.click())
    expect(onAskPeers).toHaveBeenCalledTimes(1)
  })

  it('procurando: diz que está procurando; ninguém na cena: diz isso', () => {
    render({ peers: { phase: 'loading' } })
    expect(status()).toBe('Procurando quem está nesta cena…')
    render({ peers: { phase: 'ready', names: [] } })
    expect(status()).toBe('Ninguém mais está nesta cena agora.')
    // Ninguém agora: o botão continua ali para perguntar de novo quando alguém chegar.
    expect(botoes()).toEqual(['Mostrar meu mapa a…', 'Fechar'])
    act(() => container.querySelector('button')?.click())
    expect(onAskPeers).toHaveBeenCalledTimes(1)
  })

  it('procurando: o botão trava até a lista chegar (um toque, uma pergunta)', () => {
    render({ peers: { phase: 'loading' } })
    expect(container.querySelector('button')?.disabled).toBe(true)
  })

  it('com colegas: um botão por nome, dentro de uma lista rotulada; tocar mostra a ele', () => {
    render({ peers: { phase: 'ready', names: ['Bruno', 'Carla'] } })
    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe('Mostrar meu mapa a')
    expect(botoes()).toEqual(['Mostrar meu mapa a…', 'Bruno', 'Carla', 'Fechar'])
    const bruno = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Bruno')
    if (bruno === undefined) throw new Error('sem Bruno')
    act(() => bruno.click())
    expect(onShare).toHaveBeenCalledWith('Bruno')
  })

  it('enviando: os nomes travam até a resposta; depois, o resultado em palavras', () => {
    render({ peers: { phase: 'ready', names: ['Bruno'] }, result: { to: 'Bruno', phase: 'sending' } })
    expect(Array.from(container.querySelectorAll('button')).every((b) => b.disabled)).toBe(true)
    expect(status()).toBe('Mostrando o mapa a Bruno…')
    render({ peers: { phase: 'ready', names: ['Bruno'] }, result: { to: 'Bruno', phase: 'ok' } })
    expect(status()).toBe('Bruno agora conhece o que você explorou nesta cena.')
    render({ peers: { phase: 'ready', names: ['Bruno'] }, result: { to: 'Bruno', phase: 'too_soon' } })
    expect(status()).toBe('Espere um instante e toque em Bruno de novo.')
    render({ peers: { phase: 'ready', names: ['Bruno'] }, result: { to: 'Bruno', phase: 'failed' } })
    expect(status()).toBe('Não deu para mostrar a Bruno: não está mais nesta cena.')
  })

  it('aberta, a lista tem "Fechar": tocar fecha e o foco volta ao "Mostrar meu mapa a…"', () => {
    render({ peers: { phase: 'ready', names: ['Bruno'] }, result: { to: 'Bruno', phase: 'ok' } })
    const fechar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Fechar')
    if (fechar === undefined) throw new Error('sem Fechar')
    act(() => fechar.click())
    expect(onClose).toHaveBeenCalledTimes(1)
    // O dono fecha: sem lista nem resultado, o foco fica no botão que a abre.
    render()
    expect(botoes()).toEqual(['Mostrar meu mapa a…'])
    expect(document.activeElement?.textContent).toBe('Mostrar meu mapa a…')
  })

  it('Escape num nome da lista fecha, e não chega à gaveta (window)', () => {
    const naJanela = vi.fn<() => void>()
    const ouvir = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') naJanela()
    }
    window.addEventListener('keydown', ouvir)
    try {
      render({ peers: { phase: 'ready', names: ['Bruno'] } })
      const bruno = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Bruno')
      if (bruno === undefined) throw new Error('sem Bruno')
      act(() => {
        bruno.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(naJanela).toHaveBeenCalledTimes(0)
    } finally {
      window.removeEventListener('keydown', ouvir)
    }
  })

  it('"Ninguém na cena" ou só o resultado também fecham; fechada, não há "Fechar"; procurando, ele trava', () => {
    render()
    expect(botoes()).not.toContain('Fechar')
    render({ peers: { phase: 'ready', names: [] } })
    expect(botoes()).toEqual(['Mostrar meu mapa a…', 'Fechar'])
    render({ result: { to: 'Bruno', phase: 'failed' } })
    expect(botoes()).toEqual(['Mostrar meu mapa a…', 'Fechar'])
    render({ peers: { phase: 'loading' } })
    expect(Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Fechar')?.disabled).toBe(true)
  })

  it('o aviso de quem recebe diz quem mostrou, e nada de lugar', () => {
    expect(mapSharedNoticeText('Ana')).toBe('Ana mostrou o próprio mapa a você. O trecho explorado já aparece no seu.')
  })
})

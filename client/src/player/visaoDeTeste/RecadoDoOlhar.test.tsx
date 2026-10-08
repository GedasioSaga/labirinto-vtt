import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DURACAO_DO_RECADO_MS, RECADO_COM_JOGAR, RECADO_DO_OLHAR, RECADO_SEM_JOGAR, RecadoDoOlhar } from './RecadoDoOlhar'

/*
 * VISÃO DE JOGADOR — o recado do Olhar (maquete 3A, nota 5): o mestre tentou
 * agir como o jogador e o Olhar só vê. Diz por quê, leva ao Jogar quando ele
 * existe e some sozinho, sem sumir debaixo do ponteiro de quem está lendo.
 */

describe('RecadoDoOlhar', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function recado(): HTMLElement {
    const achado = container.querySelector<HTMLElement>('.vj-recado-do-olhar')
    if (achado === null) throw new Error('sem o recado')
    return achado
  }

  function passar(ms: number): void {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  it('sem o Jogar nesta versão: explica e não oferece botão que não existe', () => {
    act(() => root.render(<RecadoDoOlhar onFechar={vi.fn()} />))
    expect(recado().querySelector('[role="status"]')?.textContent).toBe(`${RECADO_DO_OLHAR} ${RECADO_SEM_JOGAR}`)
    expect(recado().querySelector('button')).toBeNull()
  })

  it('com o Jogar: "Passar para Jogar" muda o modo e fecha o recado', () => {
    const onPassarParaJogar = vi.fn()
    const onFechar = vi.fn()
    act(() => root.render(<RecadoDoOlhar onPassarParaJogar={onPassarParaJogar} onFechar={onFechar} />))
    expect(recado().textContent).toContain(RECADO_COM_JOGAR)
    const botao = recado().querySelector('button')
    expect(botao?.textContent).toBe('Passar para Jogar')
    act(() => {
      botao?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onPassarParaJogar).toHaveBeenCalledOnce()
    expect(onFechar).toHaveBeenCalledOnce()
  })

  it('some sozinho; quem monta passando função nova a cada render não reinicia a contagem', () => {
    const onFechar = vi.fn()
    act(() => root.render(<RecadoDoOlhar onFechar={() => onFechar()} />))
    passar(DURACAO_DO_RECADO_MS - 1000)
    act(() => root.render(<RecadoDoOlhar onFechar={() => onFechar()} />))
    passar(999)
    expect(onFechar).not.toHaveBeenCalled()
    passar(1)
    expect(onFechar).toHaveBeenCalledOnce()
  })

  it('com o ponteiro em cima não some; ao sair, recomeça a contagem', () => {
    const onFechar = vi.fn()
    act(() => root.render(<RecadoDoOlhar onFechar={onFechar} />))
    act(() => {
      recado().dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
    })
    passar(DURACAO_DO_RECADO_MS * 3)
    expect(onFechar).not.toHaveBeenCalled()
    act(() => {
      recado().dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body }))
    })
    passar(DURACAO_DO_RECADO_MS)
    expect(onFechar).toHaveBeenCalledOnce()
  })

  it('Esc com o foco nele fecha só o recado (não chega aos atalhos do jogador)', () => {
    const onFechar = vi.fn()
    const atalho = vi.fn()
    act(() => root.render(<RecadoDoOlhar onPassarParaJogar={vi.fn()} onFechar={onFechar} />))
    window.addEventListener('keydown', atalho)
    try {
      const botao = recado().querySelector('button')
      act(() => {
        botao?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      })
    } finally {
      window.removeEventListener('keydown', atalho)
    }
    expect(onFechar).toHaveBeenCalledOnce()
    expect(atalho).not.toHaveBeenCalled()
  })
})

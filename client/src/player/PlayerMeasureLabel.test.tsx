import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PlayerMeasureLabel, writeMeasureText } from './PlayerMeasureLabel'

/**
 * O "medir" do jogador fala. O rótulo visível aparece e some com a régua, mas
 * quem ANUNCIA é uma região viva que existe desde o começo, fora do `hidden`:
 * região que nasce escondida e só aparece junto com o primeiro texto muitas
 * vezes não é ouvida pelo leitor de tela — a primeira medida se perdia.
 */

describe('PlayerMeasureLabel: a medida é anunciada desde a primeira', () => {
  let container: HTMLDivElement
  let root: Root
  const labelRef = createRef<HTMLDivElement>()
  const announcerRef = createRef<HTMLDivElement>()

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<PlayerMeasureLabel labelRef={labelRef} announcerRef={announcerRef} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function elementos(): { label: HTMLDivElement; announcer: HTMLDivElement } {
    const label = labelRef.current
    const announcer = announcerRef.current
    if (label === null || announcer === null) throw new Error('rótulo da régua não montou')
    return { label, announcer }
  }

  /** Nada no caminho até a raiz tira a região da árvore de acessibilidade. */
  function naArvoreAcessivel(el: HTMLElement): boolean {
    for (let atual: HTMLElement | null = el; atual !== null; atual = atual.parentElement) {
      if (atual.hidden || atual.getAttribute('aria-hidden') === 'true') return false
    }
    return true
  }

  it('antes de medir: a região viva já existe, vazia e acessível; o rótulo visível está escondido', () => {
    const { label, announcer } = elementos()
    expect(announcer.getAttribute('aria-live')).toBe('polite')
    // Sem papel de status: a tela do jogador já tem o dela (espera, aviso de porta).
    expect(announcer.hasAttribute('role')).toBe(false)
    expect(announcer.getAttribute('aria-atomic')).toBe('true')
    expect(naArvoreAcessivel(announcer)).toBe(true)
    expect(announcer.textContent).toBe('')
    expect(label.hidden).toBe(true)
  })

  it('a primeira medida chega à região viva sem ela ter de aparecer antes', () => {
    const { label, announcer } = elementos()
    writeMeasureText({ label, announcer }, '3 quadrados (4,5 m)')
    expect(announcer.textContent).toBe('3 quadrados (4,5 m)')
    expect(naArvoreAcessivel(announcer)).toBe(true)
    // O rótulo desenhado aparece, mas não fala de novo: é só para os olhos.
    expect(label.hidden).toBe(false)
    expect(label.textContent).toBe('3 quadrados (4,5 m)')
    expect(label.getAttribute('aria-hidden')).toBe('true')
  })

  it('apagar a régua esvazia os dois: medida apagada não fica legível para ninguém', () => {
    const { label, announcer } = elementos()
    writeMeasureText({ label, announcer }, '2 quadrados (3 m)')
    writeMeasureText({ label, announcer }, null)
    expect(announcer.textContent).toBe('')
    expect(label.textContent).toBe('')
    expect(label.hidden).toBe(true)
    // E a região continua lá para a PRÓXIMA medida.
    expect(naArvoreAcessivel(announcer)).toBe(true)
  })

  it('o mesmo texto não é reescrito: a região não repete a medida a cada pixel do dedo', () => {
    const { label, announcer } = elementos()
    writeMeasureText({ label, announcer }, '1 quadrado (1,5 m)')
    const noAntes = announcer.firstChild
    writeMeasureText({ label, announcer }, '1 quadrado (1,5 m)')
    expect(announcer.firstChild).toBe(noAntes)
    expect(announcer.textContent).toBe('1 quadrado (1,5 m)')
  })
})

import { act } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarBloqueioDoOlhar, instalarGuardaDeTeclado } from './bloqueioDeEntrada'

/**
 * O bloqueio do modo Olhar em volta da tela do jogador: a HUD (e os portais
 * dela) não age; o mapa, o zoom e a barra da janela de teste (que é irmã, com
 * portais próprios) continuam respondendo.
 */

function apertar(alvo: Element): PointerEvent | MouseEvent {
  const Evento = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent
  const evento = new Evento('pointerdown', { bubbles: true, cancelable: true })
  alvo.dispatchEvent(evento)
  return evento
}

function teclar(alvo: EventTarget, key: string, tipo: 'keydown' | 'keyup' = 'keydown'): KeyboardEvent {
  const evento = new KeyboardEvent(tipo, { key, bubbles: true, cancelable: true })
  alvo.dispatchEvent(evento)
  return evento
}

function botao(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`sem #${id}`)
  return el
}

describe('criarBloqueioDoOlhar', () => {
  let raiz: HTMLDivElement
  let root: Root
  let ativo: boolean
  const recado = vi.fn()
  const cliques = vi.fn()
  const naJanela = vi.fn()

  function Tela() {
    const bloqueio = criarBloqueioDoOlhar(() => ativo, recado)
    return (
      <>
        <div {...bloqueio}>
          <div data-camera-livre="">
            <button id="mapa" onClick={() => cliques('mapa')} />
          </div>
          <div className="pp-zoom">
            <button id="zoom" onClick={() => cliques('zoom')} />
          </div>
          <button id="hud" onClick={() => cliques('hud')} onPointerDown={() => cliques('hud-apertou')} />
          {createPortal(<button id="mochila" onClick={() => cliques('mochila')} />, document.body)}
        </div>
        <button id="barra" onClick={() => cliques('barra')} />
        {createPortal(<button id="trocar-ficha" onClick={() => cliques('trocar-ficha')} />, document.body)}
      </>
    )
  }

  beforeEach(async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    ativo = true
    recado.mockClear()
    cliques.mockClear()
    naJanela.mockClear()
    window.addEventListener('click', naJanela)
    raiz = document.createElement('div')
    document.body.appendChild(raiz)
    root = createRoot(raiz)
    await act(async () => {
      root.render(<Tela />)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    raiz.remove()
    window.removeEventListener('click', naJanela)
  })

  it('apertar e clicar na HUD dá o recado e nada da tela do jogador ouve, nem a window', () => {
    const evento = apertar(botao('hud'))
    botao('hud').click()

    expect(recado).toHaveBeenCalledTimes(1)
    expect(evento.defaultPrevented).toBe(true)
    expect(cliques).not.toHaveBeenCalled()
    expect(naJanela).not.toHaveBeenCalled()
  })

  it('o portal da tela do jogador (mochila no body) conta como dentro', () => {
    apertar(botao('mochila'))
    botao('mochila').click()

    expect(recado).toHaveBeenCalledTimes(1)
    expect(cliques).not.toHaveBeenCalled()
  })

  it('o mapa e o zoom são a câmera: passam, sem recado', () => {
    apertar(botao('mapa'))
    botao('mapa').click()
    botao('zoom').click()

    expect(recado).not.toHaveBeenCalled()
    expect(cliques.mock.calls).toEqual([['mapa'], ['zoom']])
  })

  it('a barra da janela de teste e o portal dela ficam de fora do bloqueio', () => {
    botao('barra').click()
    botao('trocar-ficha').click()

    expect(recado).not.toHaveBeenCalled()
    expect(cliques.mock.calls).toEqual([['barra'], ['trocar-ficha']])
  })

  it('Enter e Espaço no controle com foco dão o recado; outras teclas morrem quietas; Tab passa', () => {
    const naTela = vi.fn()
    botao('hud').addEventListener('keydown', naTela)

    const enter = teclar(botao('hud'), 'Enter')
    const espacoSolto = teclar(botao('hud'), ' ', 'keyup')
    teclar(botao('hud'), 'i')
    const tab = teclar(botao('hud'), 'Tab')

    expect(enter.defaultPrevented).toBe(true)
    expect(espacoSolto.defaultPrevented).toBe(true)
    expect(recado).toHaveBeenCalledTimes(1)
    expect(tab.defaultPrevented).toBe(false)
    expect(naTela).toHaveBeenCalledTimes(1)
    expect(naTela.mock.calls[0]?.[0]?.key).toBe('Tab')
  })

  it('fora do Olhar (Jogar) tudo passa', () => {
    ativo = false
    apertar(botao('hud'))
    botao('hud').click()

    expect(recado).not.toHaveBeenCalled()
    expect(cliques.mock.calls).toEqual([['hud-apertou'], ['hud']])
  })
})

describe('instalarGuardaDeTeclado', () => {
  let desinstalar: () => void = () => {}
  const atalho = vi.fn()
  let ativo = true

  beforeEach(() => {
    ativo = true
    atalho.mockClear()
    window.addEventListener('keydown', atalho)
    desinstalar = instalarGuardaDeTeclado(window, () => ativo)
  })

  afterEach(() => {
    desinstalar()
    window.removeEventListener('keydown', atalho)
  })

  it('com nada em foco, o atalho da tela do jogador na window não ouve a tecla', () => {
    teclar(document.body, 'i')
    expect(atalho).not.toHaveBeenCalled()
  })

  it('Escape passa (fechar o que estiver aberto não é ação do jogador)', () => {
    teclar(document.body, 'Escape')
    expect(atalho).toHaveBeenCalledTimes(1)
  })

  it('tecla num elemento com foco é com o bloqueio do React, não com esta guarda', () => {
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    teclar(campo, 'i')
    campo.remove()
    expect(atalho).toHaveBeenCalledTimes(1)
  })

  it('fora do Olhar, nada é barrado', () => {
    ativo = false
    teclar(document.body, 'i')
    expect(atalho).toHaveBeenCalledTimes(1)
  })
})

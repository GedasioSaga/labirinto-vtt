import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AcaoDeFerrolho } from '../lib/ferrolho'
import { PlayerFerrolho } from './PlayerFerrolho'

/**
 * O botão do ferrolho na tela do jogador: aparece encostado numa porta que ele
 * alcança, diz o que vai acontecer em palavras de quem joga ("Trancar deste
 * lado", "Fechar e trancar deste lado", "Destrancar deste lado") e, depois do
 * toque, espera a resposta do host no próprio botão (desligado) até a porta mudar.
 */
describe('PlayerFerrolho', () => {
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

  function render(acao: AcaoDeFerrolho | null, onAct: (wallId: string, on: boolean) => void = () => {}, revisao = 'rev-1'): void {
    act(() => root.render(<PlayerFerrolho acao={acao} revisao={revisao} onAct={onAct} />))
  }

  function botao(): HTMLButtonElement {
    const found = container.querySelector('button')
    if (!(found instanceof HTMLButtonElement)) throw new Error('sem botão')
    return found
  }

  it('sem porta ao alcance, nada aparece', () => {
    render(null)
    expect(container.querySelector('button')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('porta fechada: "Trancar deste lado" manda trancar aquela porta, e o botão espera a resposta', () => {
    const onAct = vi.fn()
    render({ wallId: 'porta', acao: 'passar', aberta: false }, onAct)
    expect(botao().textContent).toBe('Trancar deste lado')
    act(() => botao().click())
    expect(onAct).toHaveBeenCalledWith('porta', true)
    expect(botao().disabled).toBe(true)
    expect(botao().textContent).toBe('Trancando…')
    // O rótulo de repouso fica guardado para o CSS segurar a largura da pílula.
    expect(botao().dataset.reserva).toBe('Trancar deste lado')
  })

  it('porta aberta: o botão diz que fecha junto', () => {
    render({ wallId: 'porta', acao: 'passar', aberta: true })
    expect(botao().textContent).toBe('Fechar e trancar deste lado')
  })

  it('a porta mudou (trancou): o botão volta a ser tocável, agora para destrancar, e espera de novo', () => {
    const onAct = vi.fn()
    render({ wallId: 'porta', acao: 'passar', aberta: false }, onAct)
    act(() => botao().click())
    render({ wallId: 'porta', acao: 'tirar', aberta: false }, onAct, 'rev-2')
    expect(botao().disabled).toBe(false)
    expect(botao().textContent).toBe('Destrancar deste lado')
    act(() => botao().click())
    expect(onAct).toHaveBeenLastCalledWith('porta', false)
    expect(botao().disabled).toBe(true)
    expect(botao().textContent).toBe('Destrancando…')
  })

  it('recusado ("Trancada"): a porta não mudou, mas a resposta chegou, e o botão volta a ser tocável', () => {
    render({ wallId: 'porta', acao: 'passar', aberta: false })
    act(() => botao().click())
    expect(botao().disabled).toBe(true)
    render({ wallId: 'porta', acao: 'passar', aberta: false }, () => {}, 'rev-1|aviso-7')
    expect(botao().disabled).toBe(false)
    expect(botao().textContent).toBe('Trancar deste lado')
  })
})

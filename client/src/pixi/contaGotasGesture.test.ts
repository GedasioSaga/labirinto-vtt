/**
 * CONTA-GOTAS DO MAPA: a pipeta de um campo arma; o próximo clique esquerdo no
 * mapa lê a cor ali, entrega ao campo e desarma. O gesto inteiro (down e up)
 * fica com o conta-gotas: a ferramenta ativa não roda por baixo.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContaGotasStore } from '../stores/contaGotasStore'
import { createContaGotasGesture } from './contaGotasGesture'

beforeEach(() => {
  useContaGotasStore.setState({ donoId: null, aoPegar: null })
})

describe('contaGotasStore', () => {
  it('liga com um dono, entrega a cor a ele e desliga', () => {
    const aoPegar = vi.fn()
    useContaGotasStore.getState().ligar('campo-a', aoPegar)
    expect(useContaGotasStore.getState().donoId).toBe('campo-a')
    useContaGotasStore.getState().entregar('#123456')
    expect(aoPegar).toHaveBeenCalledWith('#123456')
    expect(useContaGotasStore.getState().donoId).toBeNull()
  })

  it('armar outro campo troca o dono; desligar não entrega nada', () => {
    const primeiro = vi.fn()
    const segundo = vi.fn()
    useContaGotasStore.getState().ligar('a', primeiro)
    useContaGotasStore.getState().ligar('b', segundo)
    useContaGotasStore.getState().entregar('#abcdef')
    expect(primeiro).not.toHaveBeenCalled()
    expect(segundo).toHaveBeenCalledWith('#abcdef')

    useContaGotasStore.getState().ligar('c', primeiro)
    useContaGotasStore.getState().desligar()
    expect(useContaGotasStore.getState().donoId).toBeNull()
    expect(primeiro).not.toHaveBeenCalled()
  })
})

describe('createContaGotasGesture', () => {
  it('desarmado: não consome nada e não lê pixel', () => {
    const lerCor = vi.fn(() => '#ffffff')
    const gesto = createContaGotasGesture(lerCor)
    expect(gesto.pointerDown(0, 10, 10)).toBe(false)
    expect(gesto.pointerUp()).toBe(false)
    expect(lerCor).not.toHaveBeenCalled()
  })

  it('armado: o clique esquerdo lê a cor no ponto, entrega, desarma e fica com o up', () => {
    const aoPegar = vi.fn()
    const lerCor = vi.fn(() => '#3a5f0b')
    useContaGotasStore.getState().ligar('campo', aoPegar)
    const gesto = createContaGotasGesture(lerCor)

    expect(gesto.pointerDown(0, 120.5, 44)).toBe(true)
    expect(lerCor).toHaveBeenCalledWith(120.5, 44)
    expect(aoPegar).toHaveBeenCalledWith('#3a5f0b')
    expect(useContaGotasStore.getState().donoId).toBeNull()
    expect(gesto.pointerUp()).toBe(true)
    // Um clique, uma cor: o seguinte já é da ferramenta.
    expect(gesto.pointerUp()).toBe(false)
    expect(gesto.pointerDown(0, 1, 1)).toBe(false)
  })

  it('botão do meio e direito seguem com o mapa, e a pipeta continua armada', () => {
    const lerCor = vi.fn(() => '#000000')
    useContaGotasStore.getState().ligar('campo', vi.fn())
    const gesto = createContaGotasGesture(lerCor)
    expect(gesto.pointerDown(1, 5, 5)).toBe(false)
    expect(gesto.pointerDown(2, 5, 5)).toBe(false)
    expect(lerCor).not.toHaveBeenCalled()
    expect(useContaGotasStore.getState().donoId).toBe('campo')
  })

  it('ponto sem pixel (fora da tela): consome o clique e desarma sem entregar', () => {
    const aoPegar = vi.fn()
    useContaGotasStore.getState().ligar('campo', aoPegar)
    const gesto = createContaGotasGesture(() => null)
    expect(gesto.pointerDown(0, -5, -5)).toBe(true)
    expect(aoPegar).not.toHaveBeenCalled()
    expect(useContaGotasStore.getState().donoId).toBeNull()
  })

  it('cancel (janela perdeu o foco) larga o up pendente', () => {
    useContaGotasStore.getState().ligar('campo', vi.fn())
    const gesto = createContaGotasGesture(() => '#ffffff')
    gesto.pointerDown(0, 1, 1)
    gesto.cancel()
    expect(gesto.pointerUp()).toBe(false)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acompanharTeclado, alturaDoTeclado, VARIAVEL_DO_TECLADO } from './tecladoDoCelular'

/** A vista visível de mentira: a do navegador não muda no jsdom, e é ela que o teclado encolhe. */
class VistaDeTeste extends EventTarget {
  height = 844
  offsetTop = 0
  scale = 1
  ouvintes = 0
  override addEventListener(...args: Parameters<EventTarget['addEventListener']>): void {
    this.ouvintes++
    super.addEventListener(...args)
  }
  override removeEventListener(...args: Parameters<EventTarget['removeEventListener']>): void {
    this.ouvintes--
    super.removeEventListener(...args)
  }
  abrirTeclado(altura: number): void {
    this.height = 844 - altura
    this.dispatchEvent(new Event('resize'))
  }
}

describe('alturaDoTeclado', () => {
  it('teclado de 300 px no celular de 844: cobre 300', () => {
    expect(alturaDoTeclado(844, { height: 544, offsetTop: 0, scale: 1 })).toBe(300)
  })

  it('o Safari que empurrou a vista para cima: o que já subiu não conta como coberto', () => {
    expect(alturaDoTeclado(844, { height: 504, offsetTop: 40, scale: 1 })).toBe(300)
  })

  it('a barra do navegador (56 px) não é teclado', () => {
    expect(alturaDoTeclado(844, { height: 788, offsetTop: 0, scale: 1 })).toBe(0)
  })

  it('pinça de zoom encolhe a vista e não é teclado', () => {
    expect(alturaDoTeclado(844, { height: 422, offsetTop: 0, scale: 2 })).toBe(0)
  })

  it('sem teclado: 0', () => {
    expect(alturaDoTeclado(844, { height: 844, offsetTop: 0, scale: 1 })).toBe(0)
  })
})

describe('acompanharTeclado', () => {
  let vista: VistaDeTeste
  let folha: HTMLElement
  let campo: HTMLTextAreaElement
  let rolou: ReturnType<typeof vi.fn<HTMLElement['scrollIntoView']>>

  beforeEach(() => {
    vista = new VistaDeTeste()
    vi.stubGlobal('visualViewport', vista)
    vi.stubGlobal('innerHeight', 844)
    folha = document.createElement('aside')
    campo = document.createElement('textarea')
    folha.appendChild(campo)
    document.body.appendChild(folha)
    // O jsdom não rola nada: só registra o pedido.
    rolou = vi.fn<HTMLElement['scrollIntoView']>()
    campo.scrollIntoView = rolou
  })

  afterEach(() => {
    folha.remove()
    vi.unstubAllGlobals()
  })

  it('abrir o teclado desconta a altura dele na folha e rola o campo com o foco para o que sobrou', () => {
    const parar = acompanharTeclado(folha)
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('0px')
    campo.focus()
    vista.abrirTeclado(320)
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('320px')
    expect(rolou).toHaveBeenCalledWith({ block: 'nearest' })
    parar()
  })

  it('fechar o teclado devolve o teto, sem rolar nada', () => {
    const parar = acompanharTeclado(folha)
    vista.abrirTeclado(320)
    rolou.mockClear()
    vista.abrirTeclado(0)
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('0px')
    expect(rolou).not.toHaveBeenCalled()
    parar()
  })

  it('o foco fora da folha não é rolado', () => {
    const fora = document.createElement('input')
    document.body.appendChild(fora)
    const parar = acompanharTeclado(folha)
    fora.focus()
    vista.abrirTeclado(300)
    expect(rolou).not.toHaveBeenCalled()
    parar()
    fora.remove()
  })

  it('parar tira os ouvintes e a variável', () => {
    const parar = acompanharTeclado(folha)
    expect(vista.ouvintes).toBe(2)
    parar()
    expect(vista.ouvintes).toBe(0)
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('')
  })

  it('sem visualViewport (navegador antigo) não faz nada', () => {
    vi.stubGlobal('visualViewport', null)
    const parar = acompanharTeclado(folha)
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('')
    parar()
  })
})

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
  /** O dedo arrasta a vista com o teclado aberto: no iPhone só o `offsetTop` muda, e o evento é `scroll`. */
  rolar(offsetTop: number): void {
    this.offsetTop = offsetTop
    this.dispatchEvent(new Event('scroll'))
  }
}

/** Os quadros de mentira: o teste diz quando o navegador pintaria o próximo. */
class Quadros {
  private pedidos = new Map<number, FrameRequestCallback>()
  private ultimo = 0
  pedir = (pedido: FrameRequestCallback): number => {
    this.ultimo++
    this.pedidos.set(this.ultimo, pedido)
    return this.ultimo
  }
  cancelar = (id: number): void => {
    this.pedidos.delete(id)
  }
  get pendentes(): number {
    return this.pedidos.size
  }
  passar(): void {
    const agora = [...this.pedidos.values()]
    this.pedidos.clear()
    for (const pedido of agora) pedido(performance.now())
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
  let quadros: Quadros

  beforeEach(() => {
    vista = new VistaDeTeste()
    quadros = new Quadros()
    vi.stubGlobal('visualViewport', vista)
    vi.stubGlobal('innerHeight', 844)
    vi.stubGlobal('requestAnimationFrame', quadros.pedir)
    vi.stubGlobal('cancelAnimationFrame', quadros.cancelar)
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
    // Nada no meio do evento: a medida espera o quadro.
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('0px')
    quadros.passar()
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('320px')
    expect(rolou).toHaveBeenCalledWith({ block: 'nearest' })
    parar()
  })

  it('o teclado subindo animado, um evento por px no mesmo quadro: uma medida e uma rolagem só', () => {
    const parar = acompanharTeclado(folha)
    campo.focus()
    const definir = vi.spyOn(folha.style, 'setProperty')
    for (let altura = 100; altura <= 320; altura += 20) vista.abrirTeclado(altura)
    expect(quadros.pendentes).toBe(1)
    quadros.passar()
    expect(definir).toHaveBeenCalledTimes(1)
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('320px')
    expect(rolou).toHaveBeenCalledTimes(1)
    parar()
  })

  it('o dedo arrastando a vista com o teclado aberto: o teto acompanha, e o campo não é rolado', () => {
    const parar = acompanharTeclado(folha)
    campo.focus()
    vista.abrirTeclado(320)
    quadros.passar()
    rolou.mockClear()
    for (const offsetTop of [10, 20, 30, 40]) vista.rolar(offsetTop)
    expect(quadros.pendentes).toBe(1)
    quadros.passar()
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('280px')
    expect(rolou).not.toHaveBeenCalled()
    parar()
  })

  it('o teclado que aparece num scroll (a altura sai de 0) ainda rola o campo para cima dele', () => {
    const parar = acompanharTeclado(folha)
    campo.focus()
    vista.height = 544
    vista.rolar(0)
    quadros.passar()
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('300px')
    expect(rolou).toHaveBeenCalledTimes(1)
    parar()
  })

  it('fechar o teclado devolve o teto, sem rolar nada', () => {
    const parar = acompanharTeclado(folha)
    vista.abrirTeclado(320)
    quadros.passar()
    rolou.mockClear()
    vista.abrirTeclado(0)
    quadros.passar()
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
    quadros.passar()
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

  it('parar com uma medida esperando o quadro: o quadro é cancelado e a folha fica sem a variável', () => {
    const parar = acompanharTeclado(folha)
    campo.focus()
    vista.abrirTeclado(320)
    expect(quadros.pendentes).toBe(1)
    parar()
    expect(quadros.pendentes).toBe(0)
    quadros.passar()
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('')
    expect(rolou).not.toHaveBeenCalled()
  })

  it.each([null, undefined])('sem visualViewport (%s: navegador antigo, jsdom) não faz nada', (ausente) => {
    vi.stubGlobal('visualViewport', ausente)
    const parar = acompanharTeclado(folha)
    expect(folha.style.getPropertyValue(VARIAVEL_DO_TECLADO)).toBe('')
    parar()
  })
})

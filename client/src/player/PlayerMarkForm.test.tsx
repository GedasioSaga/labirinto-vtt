/**
 * "Deixar marca aqui…" no painel do jogador: um bilhete de até 80 letras ou
 * uma seta de giz, cravados onde a ficha está. O formulário segue as
 * convenções de campo: rótulo ligado, contador do que falta, Enter envia,
 * enviar vazio avisa e devolve o foco ao campo, e o texto nunca some numa recusa.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARCA_TEXTO_MAX } from '../lib/marcas'
import { PlayerMarkForm, type MarkPlaceIntent, type PlayerMarkFormProps } from './PlayerMarkForm'

describe('PlayerMarkForm', () => {
  let container: HTMLDivElement
  let root: Root
  let onPlace: ReturnType<typeof vi.fn<(intent: MarkPlaceIntent) => void>>
  let onClose: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onPlace = vi.fn<(intent: MarkPlaceIntent) => void>()
    onClose = vi.fn<() => void>()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(props: Partial<PlayerMarkFormProps> = {}): void {
    act(() => root.render(<PlayerMarkForm result={undefined} onPlace={onPlace} onClose={onClose} {...props} />))
  }

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === texto)
    if (achado === undefined) throw new Error(`sem botão "${texto}"`)
    return achado
  }

  function campo(): HTMLInputElement {
    const input = container.querySelector('input[type="text"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('sem campo do bilhete')
    return input
  }

  function digitar(valor: string): void {
    const input = campo()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function status(): string {
    return Array.from(container.querySelectorAll('[role="status"], [role="alert"]'))
      .map((el) => (el.textContent ?? '').trim())
      .join(' | ')
  }

  it('fechado: um botão só, que abre o formulário', () => {
    render()
    expect(Array.from(container.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual(['Deixar marca aqui…'])
    act(() => botao('Deixar marca aqui…').click())
    expect(container.querySelector('form')).not.toBeNull()
  })

  it('o rótulo está ligado ao campo, o teto é de 80 letras e o contador diz quanto falta', () => {
    render()
    act(() => botao('Deixar marca aqui…').click())
    const input = campo()
    const rotulo = container.querySelector(`label[for="${input.id}"]`)
    expect(rotulo?.textContent).toBe('Bilhete')
    expect(input.maxLength).toBe(MARCA_TEXTO_MAX)
    expect(container.textContent).toContain(`Faltam ${MARCA_TEXTO_MAX} letras`)
    digitar('GUI ESPERA')
    expect(container.textContent).toContain(`Faltam ${MARCA_TEXTO_MAX - 10} letras`)
  })

  it('Enter (enviar) deixa o bilhete com o texto aparado', () => {
    render()
    act(() => botao('Deixar marca aqui…').click())
    digitar('  GUI ESPERA NO POÇO  ')
    act(() => container.querySelector('form')?.requestSubmit())
    expect(onPlace).toHaveBeenCalledTimes(1)
    expect(onPlace).toHaveBeenCalledWith({ tipo: 'bilhete', texto: 'GUI ESPERA NO POÇO' })
  })

  it('enviar vazio não envia: avisa junto do campo e o foco volta a ele', () => {
    render()
    act(() => botao('Deixar marca aqui…').click())
    digitar('   ')
    act(() => container.querySelector('form')?.requestSubmit())
    expect(onPlace).not.toHaveBeenCalled()
    expect(status()).toContain('Escreva o bilhete')
    expect(document.activeElement).toBe(campo())
    expect(campo().getAttribute('aria-invalid')).toBe('true')
  })

  it('seta de giz: cada rumo é um botão com nome, e tocar deixa a seta', () => {
    render()
    act(() => botao('Deixar marca aqui…').click())
    act(() => botao('Seta de giz').click())
    const rumos = Array.from(container.querySelectorAll('button[aria-label^="Seta para"]')).map((b) => b.getAttribute('aria-label'))
    expect(rumos).toEqual([
      'Seta para o noroeste',
      'Seta para o norte',
      'Seta para o nordeste',
      'Seta para o oeste',
      'Seta para o leste',
      'Seta para o sudoeste',
      'Seta para o sul',
      'Seta para o sudeste',
    ])
    const leste = container.querySelector('button[aria-label="Seta para o leste"]')
    if (!(leste instanceof HTMLButtonElement)) throw new Error('sem seta para o leste')
    act(() => leste.click())
    expect(onPlace).toHaveBeenCalledWith({ tipo: 'seta', rumo: 'l' })
  })

  it('enquanto o mestre confere, o botão diz "Deixando…" e não envia de novo', () => {
    render()
    act(() => botao('Deixar marca aqui…').click())
    digitar('oi')
    render({ result: { phase: 'sending' } })
    const enviar = botao('Deixando…')
    expect(enviar.disabled).toBe(true)
    act(() => container.querySelector('form')?.requestSubmit())
    expect(onPlace).not.toHaveBeenCalled()
  })

  it('recusa: o texto fica no campo e a mensagem diz o que houve', () => {
    render()
    act(() => botao('Deixar marca aqui…').click())
    digitar('volto já')
    render({ result: { phase: 'refused', reason: 'unavailable' } })
    expect(campo().value).toBe('volto já')
    expect(status()).toContain('Não dá para deixar marca aqui')
    render({ result: { phase: 'refused', reason: 'full' } })
    expect(status()).toContain('marcas demais nesta cena')
    render({ result: { phase: 'refused', reason: 'too_soon' } })
    expect(status()).toContain('Espere um instante')
  })

  it('deixou: confirma e limpa o campo para o próximo', () => {
    render()
    act(() => botao('Deixar marca aqui…').click())
    digitar('volto já')
    render({ result: { phase: 'ok' } })
    expect(status()).toContain('Quem passar por aqui vai ver')
    expect(campo().value).toBe('')
  })

  it('Fechar recolhe o formulário, avisa o dono e devolve o foco ao botão que abre', () => {
    render()
    act(() => botao('Deixar marca aqui…').click())
    act(() => botao('Fechar').click())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(container.querySelector('form')).toBeNull()
    expect(document.activeElement).toBe(botao('Deixar marca aqui…'))
  })
})

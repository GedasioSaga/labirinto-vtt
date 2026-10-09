import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarriedItem, Token } from '../types/map'
import { TOKEN_ACTION_TEXT_MAX_LENGTH } from '../lib/tokenActions'
import { PlayerTokenCard, type TokenCardGive, type TokenCardPortrait } from './PlayerTokenCard'

function ficha(name: string): Token {
  return { id: 'severa', characterId: null, name, x: 200, y: 100, size: 1, image: null }
}

const FOTO = 'data:image/png;base64,iVBORw0KGgo='
const ALEXEI: TokenCardPortrait = { name: 'Alexei Volkov', image: FOTO }

describe('PlayerTokenCard (cartão da ficha alheia)', () => {
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

  interface Props {
    name?: string
    waiting?: boolean
    portrait?: TokenCardPortrait
    give?: TokenCardGive
    onSend?: (action: string, text: string) => void
    onClose?: () => void
  }

  function render(props: Props): void {
    act(() =>
      root.render(
        <PlayerTokenCard
          token={ficha(props.name ?? 'Mulher de capuz')}
          waiting={props.waiting ?? false}
          portrait={props.portrait ?? ALEXEI}
          give={props.give ?? { kind: 'npc' }}
          onSend={props.onSend ?? (() => {})}
          onClose={props.onClose ?? (() => {})}
        />,
      ),
    )
  }

  function botao(texto: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
    if (!(found instanceof HTMLButtonElement)) throw new Error(`sem botão "${texto}"`)
    return found
  }

  function clica(texto: string): void {
    act(() => botao(texto).click())
  }

  function digita(valor: string): void {
    const campo = container.querySelector('input')
    if (!(campo instanceof HTMLInputElement)) throw new Error('sem campo')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function envia(): void {
    act(() => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
  }

  function acoes(): string[] {
    return [...container.querySelectorAll('.pp-tokencard__actions button')].map((b) => b.textContent?.trim() ?? '')
  }

  it('mostra o nome que o jogador vê, o retrato DELE ao lado e só Falar, Ação e Entregar item', () => {
    render({})
    const dialogo = container.querySelector('[role="dialog"]')
    expect(dialogo?.getAttribute('aria-label')).toBe('Ficha: Mulher de capuz')
    expect(acoes()).toEqual(['Falar', 'Ação', 'Entregar item'])
    for (const velha of ['Oferecer', 'Pedir ajuda', 'Empurrar', 'Outro']) expect(container.textContent).not.toContain(velha)
    const retrato = container.querySelector('.pp-tokencard__me')
    expect(retrato?.querySelector('img')?.getAttribute('src')).toBe(FOTO)
    expect(retrato?.textContent).toContain('Alexei Volkov')
    render({ name: '' })
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Ficha: Alguém')
  })

  it('sem foto na ficha dele, o retrato são as iniciais do nome', () => {
    render({ portrait: { name: 'Alexei Volkov', image: null } })
    const retrato = container.querySelector('.pp-tokencard__me')
    expect(retrato?.querySelector('img')).toBeNull()
    expect(retrato?.querySelector('.lb-ficha__iniciais')?.textContent).toBe('AV')
  })

  it('Falar exige texto: o envio só liga depois de escrever, e o contador diz quanto falta', () => {
    const onSend = vi.fn()
    render({ onSend })
    clica('Falar')
    expect(botao('Enviar ao mestre').disabled).toBe(true)
    const campo = container.querySelector('input')
    expect(campo?.maxLength).toBe(TOKEN_ACTION_TEXT_MAX_LENGTH)
    // O rótulo é do campo: tocar nele leva o foco para lá.
    const rotulo = container.querySelector('label')
    expect(rotulo?.htmlFor).toBe(campo?.id)
    expect(document.activeElement).toBe(campo)
    digita('Você viu o Lemos?')
    expect(container.textContent).toContain(`Faltam ${TOKEN_ACTION_TEXT_MAX_LENGTH - 'Você viu o Lemos?'.length} caracteres`)
    envia()
    expect(onSend).toHaveBeenCalledWith('falar', 'Você viu o Lemos?')
  })

  it('Ação: o jogador escreve o que faz ("O que você faz?"); só espaço não envia', () => {
    const onSend = vi.fn()
    render({ onSend })
    clica('Ação')
    expect(container.querySelector('label')?.textContent).toBe('Ação: O que você faz?')
    digita('   ')
    expect(botao('Enviar ao mestre').disabled).toBe(true)
    envia()
    expect(onSend).not.toHaveBeenCalled()
    digita('  beijar a mão dela  ')
    envia()
    expect(onSend).toHaveBeenCalledWith('acao', 'beijar a mão dela')
  })

  it('"Voltar" desfaz a escolha sem enviar nada', () => {
    const onSend = vi.fn()
    render({ onSend })
    clica('Ação')
    clica('Voltar')
    expect(onSend).not.toHaveBeenCalled()
    expect(acoes()).toEqual(['Falar', 'Ação', 'Entregar item'])
  })

  it('com um pedido esperando o mestre, Falar e Ação ficam desligadas, Entregar item não, e o foco vai a ele', () => {
    render({ waiting: true })
    expect(botao('Falar').disabled).toBe(true)
    expect(botao('Ação').disabled).toBe(true)
    expect(botao('Entregar item').disabled).toBe(false)
    expect(document.activeElement).toBe(botao('Entregar item'))
    expect(container.textContent).toContain('Você já tem um pedido esperando o mestre')
  })

  it('Entregar item lista a mochila (foto ou iniciais, quantidade) e tocar entrega aquele item', () => {
    const onGive = vi.fn()
    const itens: CarriedItem[] = [
      { id: 'pocao', nome: 'Poção de cura', quantidade: 3 },
      { id: 'chave', nome: 'Chave de ferro', imagem: FOTO },
    ]
    render({ give: { kind: 'ready', items: itens, onGive } })
    clica('Entregar item')
    expect(container.textContent).toContain('Entregar a Mulher de capuz')
    const linhas = [...container.querySelectorAll('.pp-tokencard__item')]
    expect(linhas.map((b) => b.textContent)).toEqual(['PDPoção de cura×3', 'Chave de ferro'])
    expect(linhas[1]?.querySelector('img')?.getAttribute('src')).toBe(FOTO)
    expect(document.activeElement).toBe(linhas[0])
    act(() => {
      linhas[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onGive).toHaveBeenCalledWith('chave')
  })

  it('Entregar item sem como entregar diz por quê, antes de mandar algo que voltaria recusado', () => {
    render({ give: { kind: 'npc' } })
    clica('Entregar item')
    expect(container.textContent).toContain('Só dá para entregar a outro jogador. Para oferecer algo a Mulher de capuz, use Ação.')
    expect(container.querySelector('.pp-tokencard__item')).toBeNull()
    render({ give: { kind: 'far' } })
    expect(container.textContent).toContain('Chegue perto de Mulher de capuz para entregar.')
    render({ give: { kind: 'empty' } })
    expect(container.textContent).toContain('Sua mochila está vazia.')
    clica('Voltar')
    expect(acoes()).toEqual(['Falar', 'Ação', 'Entregar item'])
  })

  it('Escape e "Fechar" fecham', () => {
    const onClose = vi.fn()
    render({ onClose })
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    clica('Fechar')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('o nome da ficha é texto, nunca HTML', () => {
    render({ name: '<img src=x onerror="alert(1)">', portrait: { name: 'Alexei', image: null } })
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  })
})

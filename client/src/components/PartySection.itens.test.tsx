import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ITEM_NAME_MAX_LENGTH } from '../lib/items'
import type { PartyItemAction, PartyMember } from '../lib/party'
import { PARTY_ITEM_FAILED, PartySection } from './PartySection'

/**
 * ITEM PEGÁVEL no Grupo: o mestre vê a mochila de cada jogador e, na própria
 * linha dele, TIRA um item, DEVOLVE ao chão ou DÁ um item novo.
 */

const DIEGO: PartyMember = {
  playerId: 'p-diego',
  name: 'Diego',
  connected: true,
  sceneId: 'cena-mansao',
  sceneName: 'Mansão',
  token: { id: 'diego', color: '#3cff00', x: 0, y: 0 },
  travelPending: false,
  mochila: [{ id: 'pino-chave', nome: 'Chave do Escudo', tokenId: 'diego', sceneId: 'cena-mansao' }],
}

describe('PartySection: ações de mochila do mestre', () => {
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

  function render(onItem?: (action: PartyItemAction) => boolean, members: PartyMember[] = [DIEGO]): void {
    act(() => root.render(<PartySection members={members} destinations={[]} onGoTo={() => {}} onSend={() => true} onItem={onItem} />))
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  }

  function campo(): HTMLInputElement | null {
    return container.querySelector('input[type="text"]')
  }

  function digita(texto: string): void {
    const alvo = campo()
    if (alvo === null) throw new Error('campo do item não abriu')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('mostra a mochila e, por item, Tirar e Devolver ao chão com nome que diz de quem é', () => {
    const onItem = vi.fn(() => true)
    render(onItem)
    expect(container.textContent).toContain('Mochila: 1')
    act(() => botao('Tirar Chave do Escudo de Diego')?.click())
    expect(onItem).toHaveBeenLastCalledWith({ kind: 'tirar', item: DIEGO.mochila[0] })
    act(() => botao('Devolver ao chão Chave do Escudo de Diego')?.click())
    expect(onItem).toHaveBeenLastCalledWith({ kind: 'devolver', item: DIEGO.mochila[0] })
  })

  it('Dar item…: abre o campo com rótulo e foco; vazio não dá; "Dar" entrega e o formulário fecha', () => {
    const onItem = vi.fn(() => true)
    render(onItem)
    const abrir = botao('Dar item a Diego')
    act(() => abrir?.click())
    const input = campo()
    expect(input?.maxLength).toBe(ITEM_NAME_MAX_LENGTH)
    expect(container.querySelector(`label[for="${input?.id ?? ''}"]`)?.textContent).toBe('Item para Diego')
    expect(document.activeElement).toBe(input)
    // Vazio não dá: o botão fica indisponível.
    expect(botao('Dar')?.disabled).toBe(true)
    digita('Tocha')
    act(() => botao('Dar')?.click())
    expect(onItem).toHaveBeenLastCalledWith({ kind: 'dar', member: DIEGO, nome: 'Tocha' })
    expect(campo()).toBeNull()
  })

  it('Esc cancela sem dar e não chega ao canvas', () => {
    const onItem = vi.fn(() => true)
    render(onItem)
    act(() => botao('Dar item a Diego')?.click())
    const input = campo()
    const evento = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      input?.dispatchEvent(evento)
    })
    expect(evento.defaultPrevented).toBe(true)
    expect(campo()).toBeNull()
    expect(onItem).not.toHaveBeenCalled()
  })

  it('não deu (a ficha mudou): avisa e mantém o que foi digitado', () => {
    render(() => false)
    act(() => botao('Dar item a Diego')?.click())
    digita('Tocha')
    act(() => botao('Dar')?.click())
    expect(campo()?.value).toBe('Tocha')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(PARTY_ITEM_FAILED)
  })

  it('sem onItem (quem monta não grava mochila): só o resumo, nenhum botão de item', () => {
    render(undefined)
    expect(container.textContent).toContain('Mochila: 1 — Chave do Escudo')
    expect(botao('Tirar Chave do Escudo de Diego')).toBeUndefined()
    expect(botao('Dar item a Diego')).toBeUndefined()
  })

  it('jogador sem ficha no mapa: não há a quem dar', () => {
    render(vi.fn(() => true), [{ ...DIEGO, token: null, mochila: [] }])
    expect(botao('Dar item a Diego')).toBeUndefined()
  })
})

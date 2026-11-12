import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarriedItem, Token } from '../types/map'
import { TOKEN_ACTION_TEXT_MAX_LENGTH } from '../lib/tokenActions'
import { PlayerTokenCard, SEM_COLEGA_NO_TESTE, type TokenCardGive } from './PlayerTokenCard'
import { NoTeste } from './visaoDeTeste/noTeste'

const FOTO = 'data:image/png;base64,iVBORw0KGgo='

function ficha(name: string, imageData: string | null = FOTO): Token {
  return { id: 'severa', characterId: null, name, x: 200, y: 100, size: 1, image: null, imageData }
}

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
    /** A foto da ficha tocada; ausente = `FOTO`. */
    imageData?: string | null
    give?: TokenCardGive
    onSend?: (action: string, text: string) => void
    onClose?: () => void
  }

  function render(props: Props): void {
    act(() =>
      root.render(
        <PlayerTokenCard
          token={ficha(props.name ?? 'Mulher de capuz', props.imageData === undefined ? FOTO : props.imageData)}
          waiting={props.waiting ?? false}
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

  const PRONTO: TokenCardGive = { kind: 'ready', items: [{ id: 'pocao', nome: 'Poção de cura' }], onGive: () => {} }

  /**
   * Decisões 2 e 8 do mestre (12/11/2026): NPC nunca recebe item, então o
   * cartão do NPC fica só com "Falar" e "Ação"; o do colega ganha "Dar item"
   * (um nome só nos três caminhos).
   */
  it('mostra o nome que o jogador vê, a foto DA FICHA TOCADA ao lado; NPC só Falar e Ação, colega também Dar item', () => {
    render({})
    const dialogo = container.querySelector('[role="dialog"]')
    expect(dialogo?.getAttribute('aria-label')).toBe('Ficha: Mulher de capuz')
    expect(acoes()).toEqual(['Falar', 'Ação'])
    expect(container.textContent).not.toContain('Dar item')
    expect(container.textContent).not.toContain('Entregar')
    render({ give: PRONTO })
    expect(acoes()).toEqual(['Falar', 'Ação', 'Dar item'])
    render({})
    for (const velha of ['Oferecer', 'Pedir ajuda', 'Empurrar', 'Outro']) expect(container.textContent).not.toContain(velha)
    const retrato = container.querySelector('.pp-tokencard__face')
    expect(retrato?.querySelector('img')?.getAttribute('src')).toBe(FOTO)
    // O nome aparece uma vez só, no título.
    expect(container.querySelector('.pp-tokencard__name')?.textContent).toBe('Mulher de capuz')
    expect(retrato?.textContent).toBe('')
    render({ name: '' })
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Ficha: Alguém')
  })

  it('sem foto na ficha tocada, o retrato são as iniciais do nome dela', () => {
    render({ name: 'Rigel Antares', imageData: null })
    const retrato = container.querySelector('.pp-tokencard__face')
    expect(retrato?.querySelector('img')).toBeNull()
    expect(retrato?.querySelector('.lb-ficha__iniciais')?.textContent).toBe('RA')
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
    expect(acoes()).toEqual(['Falar', 'Ação'])
  })

  it('com um pedido esperando o mestre, Falar e Ação ficam desligadas, Dar item não, e o foco vai a ele', () => {
    render({ waiting: true, give: PRONTO })
    expect(botao('Falar').disabled).toBe(true)
    expect(botao('Ação').disabled).toBe(true)
    expect(botao('Dar item').disabled).toBe(false)
    expect(document.activeElement).toBe(botao('Dar item'))
    expect(container.textContent).toContain('Você já tem um pedido esperando o mestre. Dar item continua valendo.')
    // NPC (sem "Dar item"): a frase não promete o que não há.
    render({ waiting: true })
    expect(container.textContent).toContain('Você já tem um pedido esperando o mestre.')
    expect(container.textContent).not.toContain('continua valendo')
  })

  it('Dar item lista a mochila (foto ou iniciais, quantidade) e tocar entrega aquele item, sem pergunta', () => {
    const onGive = vi.fn()
    const itens: CarriedItem[] = [
      { id: 'pocao', nome: 'Poção de cura', quantidade: 3 },
      { id: 'chave', nome: 'Chave de ferro', imagem: FOTO },
    ]
    render({ give: { kind: 'ready', items: itens, onGive } })
    clica('Dar item')
    expect(container.textContent).toContain('Dar a Mulher de capuz')
    const linhas = [...container.querySelectorAll('.pp-tokencard__item')]
    expect(linhas.map((b) => b.textContent)).toEqual(['PDPoção de cura×3', 'Chave de ferro'])
    expect(linhas[1]?.querySelector('img')?.getAttribute('src')).toBe(FOTO)
    expect(document.activeElement).toBe(linhas[0])
    act(() => {
      linhas[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onGive).toHaveBeenCalledTimes(1)
    expect(onGive).toHaveBeenCalledWith('chave')
    expect([...container.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Sim')).toBe(false)
  })

  /**
   * Decisão 2 do mestre (12/11/2026): para o NPC o botão SOME; com o colega
   * longe ou a mochila vazia, "Dar item" aparece APAGADO com o motivo à vista
   * ANTES do toque, em vez de mandar algo que voltaria recusado.
   */
  it('Dar item sem como dar: some para o NPC; apagado com o motivo à vista para o colega longe e a mochila vazia', () => {
    render({ give: { kind: 'npc' } })
    expect(acoes()).toEqual(['Falar', 'Ação'])
    expect(container.textContent).not.toContain('Dar item')

    const motivoDe = (b: HTMLButtonElement): string | null => {
      const id = b.getAttribute('aria-describedby')
      return id === null ? null : (document.getElementById(id)?.textContent ?? null)
    }
    render({ give: { kind: 'far' } })
    expect(acoes()).toEqual(['Falar', 'Ação', 'Dar item'])
    expect(botao('Dar item').disabled).toBe(true)
    expect(motivoDe(botao('Dar item'))).toBe('Chegue perto de Mulher de capuz para dar um item.')
    clica('Dar item')
    expect(container.querySelector('.pp-tokencard__item')).toBeNull()
    expect(acoes()).toEqual(['Falar', 'Ação', 'Dar item'])

    render({ give: { kind: 'empty' } })
    expect(botao('Dar item').disabled).toBe(true)
    expect(motivoDe(botao('Dar item'))).toBe('Sua mochila está vazia.')

    // Na janela de teste, a ficha que seria de um colega: apagado, com o porquê do teste.
    act(() =>
      root.render(
        <NoTeste.Provider value={{ fichasDeJogador: new Set(['severa']) }}>
          <PlayerTokenCard token={ficha('Mulher de capuz')} waiting={false} give={{ kind: 'npc' }} onSend={() => {}} onClose={() => {}} />
        </NoTeste.Provider>,
      ),
    )
    expect(botao('Dar item').disabled).toBe(true)
    expect(motivoDe(botao('Dar item'))).toBe(SEM_COLEGA_NO_TESTE)
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
    render({ name: '<img src=x onerror="alert(1)">', imageData: null })
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  })
})

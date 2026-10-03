import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MasterChatState } from '../net/hostSession'
import type { ChatEntry } from '../net/protocol'
import { MasterChatPanel } from './MasterChatPanel'

/**
 * CHAT DOS JOGADORES na tela do mestre (docs/plano-chat.md, fatia D): o mestre
 * lê o Global e cada cena, escreve só no Global, vê o que não leu por canal e
 * a menção a ele em destaque; o texto do jogador é sempre texto.
 */

const AS_20_30 = new Date(2026, 8, 27, 20, 30).getTime()

function linha(id: string, from: string, text: string, mentions: string[] = []): ChatEntry {
  return { id, at: AS_20_30, from, text, mentions }
}

function conversa(over: Partial<MasterChatState> = {}): MasterChatState {
  return {
    global: [linha('g1', 'Bruno', 'Alguém no Salão?')],
    scenes: [
      { key: 'm-salao', name: 'Salao Norte', messages: [linha('s1', 'Ana', 'segredo do salão')] },
      { key: 'm-cripta', name: 'Cripta Rubra', messages: [linha('c1', 'Bruno', 'aqui embaixo está escuro')] },
    ],
    ...over,
  }
}

describe('MasterChatPanel', () => {
  let container: HTMLDivElement
  let root: Root
  let enviados: string[]
  let aceita: boolean

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    enviados = []
    aceita = true
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(chat: MasterChatState): void {
    act(() =>
      root.render(
        <MasterChatPanel
          chat={chat}
          onSend={(text) => {
            enviados.push(text)
            return aceita
          }}
        />,
      ),
    )
  }

  function botaoChat(): HTMLButtonElement {
    const achado = container.querySelector<HTMLButtonElement>('button.lb-mchat__toggle')
    if (!achado) throw new Error('sem o botão Chat')
    return achado
  }

  function painel(): HTMLElement {
    const achado = container.querySelector<HTMLElement>('section.lb-mchat__panel')
    if (!achado) throw new Error('sem o painel')
    return achado
  }

  function abrir(): void {
    act(() => botaoChat().click())
  }

  function canal(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button.lb-mchat__channel')).find((b) => b.querySelector('.lb-mchat__channel-name')?.textContent === nome)
    if (!achado) throw new Error(`sem o canal ${nome}`)
    return achado
  }

  function textos(): (string | null)[] {
    return Array.from(container.querySelectorAll('.lb-mchat__text')).map((t) => t.textContent)
  }

  function campo(): HTMLTextAreaElement | null {
    return container.querySelector<HTMLTextAreaElement>('textarea.lb-mchat__input')
  }

  function digitar(texto: string): void {
    const alvo = campo()
    if (!alvo) throw new Error('sem o campo')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    if (!setter) throw new Error('jsdom sem o setter de value')
    act(() => {
      setter.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function tecla(alvo: HTMLElement, key: string, extra: KeyboardEventInit = {}): KeyboardEvent {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })
    act(() => {
      alvo.dispatchEvent(evento)
    })
    return evento
  }

  it('o botão Chat abre e fecha o painel; o Global vem primeiro, depois cada cena pelo nome', () => {
    render(conversa())
    expect(painel().hidden).toBe(true)
    abrir()
    expect(painel().hidden).toBe(false)
    expect(botaoChat().getAttribute('aria-expanded')).toBe('true')
    const nomes = Array.from(container.querySelectorAll('.lb-mchat__channel-name')).map((n) => n.textContent)
    expect(nomes).toEqual(['Global', 'Salao Norte', 'Cripta Rubra'])
    expect(canal('Global').getAttribute('aria-pressed')).toBe('true')
    expect(textos()).toEqual(['Alguém no Salão?'])
    act(() => botaoChat().click())
    expect(painel().hidden).toBe(true)
  })

  it('trocar de canal mostra a conversa daquela cena, e a cena é só leitura', () => {
    render(conversa())
    abrir()
    expect(campo()).not.toBeNull()
    act(() => canal('Cripta Rubra').click())
    expect(canal('Cripta Rubra').getAttribute('aria-pressed')).toBe('true')
    expect(textos()).toEqual(['aqui embaixo está escuro'])
    expect(campo()).toBeNull()
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('.lb-mchat__readonly')?.textContent).toContain('Só leitura')
    act(() => canal('Global').click())
    expect(campo()).not.toBeNull()
  })

  it('texto do jogador com HTML aparece literal: nada de imagem, script ou link', () => {
    render(conversa({ global: [linha('g1', 'Bruno', '<img src=x onerror=alert(1)>'), linha('g2', '<b>Caio</b>', 'veja https://exemplo.com')] }))
    abrir()
    expect(textos()).toEqual(['<img src=x onerror=alert(1)>', 'veja https://exemplo.com'])
    expect(container.querySelector('.lb-mchat__log img, .lb-mchat__log a, .lb-mchat__log b, .lb-mchat__log script')).toBeNull()
    expect(container.querySelectorAll('.lb-mchat__from')[1]?.textContent).toBe('<b>Caio</b>')
  })

  it('o mestre aparece como Mestre pela marca do host; o jogador chamado Mestre, como "(jogador)"', () => {
    render(conversa({ global: [{ ...linha('g1', 'Mestre', 'Pausa'), fromMaster: true }, linha('g2', 'Mestre', 'sou eu')] }))
    abrir()
    const itens = Array.from(container.querySelectorAll('li.lb-mchat__msg'))
    expect(itens.map((i) => i.querySelector('.lb-mchat__from')?.textContent)).toEqual(['Mestre', 'Mestre (jogador)'])
    expect(itens[0].classList.contains('lb-mchat__msg--master')).toBe(true)
  })

  it('o que chegou com o canal fechado conta como não lido, por canal; abrir o canal lê', () => {
    render(conversa())
    // Tudo chegou com o painel fechado: 3 novas no botão.
    expect(botaoChat().getAttribute('aria-label')).toBe('Chat (3 novas)')
    expect(botaoChat().querySelector('.lb-mchat__badge')?.textContent).toBe('3')
    abrir()
    // O Global, aberto, foi lido; as cenas continuam com 1 cada.
    expect(canal('Global').querySelector('.lb-mchat__badge')).toBeNull()
    expect(canal('Salao Norte').querySelector('.lb-mchat__badge')?.textContent).toContain('1')
    expect(botaoChat().getAttribute('aria-label')).toBe('Chat (2 novas)')
    act(() => canal('Salao Norte').click())
    expect(canal('Salao Norte').querySelector('.lb-mchat__badge')).toBeNull()
    // Linha nova na Cripta, com o painel no Salão: acende só a Cripta.
    render(conversa({ scenes: [conversa().scenes[0], { key: 'm-cripta', name: 'Cripta Rubra', messages: [...conversa().scenes[1].messages, linha('c2', 'Bruno', 'ouvi algo')] }] }))
    expect(canal('Cripta Rubra').querySelector('.lb-mchat__badge')?.textContent).toContain('2')
    expect(canal('Salao Norte').querySelector('.lb-mchat__badge')).toBeNull()
  })

  it('@mestre acende forte: na linha, no canal e no botão Chat', () => {
    render(conversa({ scenes: [{ key: 'm-salao', name: 'Salao Norte', messages: [linha('s1', 'Ana', '@mestre posso abrir o baú?', ['mestre'])] }] }))
    expect(botaoChat().getAttribute('aria-label')).toBe('Chat (2 novas, menciona você)')
    expect(botaoChat().querySelector('.lb-mchat__badge--mention')).not.toBeNull()
    abrir()
    expect(canal('Salao Norte').querySelector('.lb-mchat__badge--mention')?.textContent).toContain('@1')
    act(() => canal('Salao Norte').click())
    const item = container.querySelector('li.lb-mchat__msg')
    expect(item?.classList.contains('lb-mchat__msg--mention')).toBe(true)
    expect(item?.textContent).toContain('(menciona você)')
    expect(botaoChat().querySelector('.lb-mchat__badge')).toBeNull()
  })

  it('a fala do próprio mestre nunca conta como não lida', () => {
    render(conversa({ global: [{ ...linha('g1', 'Mestre', 'Pausa'), fromMaster: true }], scenes: [] }))
    expect(botaoChat().getAttribute('aria-label')).toBe('Chat')
  })

  it('Enter manda no Global e limpa o campo; Shift+Enter não manda; vazio pede a mensagem', () => {
    render(conversa())
    abrir()
    const alvo = campo()
    if (!alvo) throw new Error('sem campo')
    tecla(alvo, 'Enter')
    expect(enviados).toEqual([])
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Escreva a mensagem antes de mandar.')
    digitar('  Pausa de 5 minutos  ')
    tecla(alvo, 'Enter', { shiftKey: true })
    expect(enviados).toEqual([])
    tecla(alvo, 'Enter')
    expect(enviados).toEqual(['Pausa de 5 minutos'])
    expect(campo()?.value).toBe('')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('a mensagem que não saiu fica no campo, com o aviso', () => {
    render(conversa())
    abrir()
    aceita = false
    digitar('oi')
    act(() => container.querySelector<HTMLButtonElement>('button.lb-mchat__send')?.click())
    expect(enviados).toEqual(['oi'])
    expect(campo()?.value).toBe('oi')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('não saiu')
  })

  it('Esc fecha o painel sem chegar ao editor; fechado, o Esc passa', () => {
    render(conversa())
    abrir()
    let chegou = 0
    const ouvinte = () => {
      chegou += 1
    }
    document.addEventListener('keydown', ouvinte)
    try {
      const alvo = campo()
      if (!alvo) throw new Error('sem campo')
      tecla(alvo, 'Escape')
      expect(painel().hidden).toBe(true)
      expect(chegou).toBe(0)
      tecla(botaoChat(), 'Escape')
      expect(chegou).toBe(1)
    } finally {
      document.removeEventListener('keydown', ouvinte)
    }
  })

  it('cena que saiu da aventura aparece como "Cena fora da aventura"', () => {
    render(conversa({ scenes: [{ key: 'm-x', name: null, messages: [linha('x1', 'Ana', 'oi')] }] }))
    abrir()
    expect(canal('Cena fora da aventura')).toBeTruthy()
  })
})

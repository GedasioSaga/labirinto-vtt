import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MasterChatState } from '../net/hostSession'
import type { ChatEntry } from '../net/protocol'
import { chatUnreadLabel, MasterChatPanel, type ChatUnread } from './MasterChatPanel'

/**
 * CHAT DOS JOGADORES na tela do mestre (docs/plano-chat.md, fatia D), agora o
 * painel da aba Chat da coluna da direita: o mestre lê o Global e cada cena,
 * escreve só no Global, vê o que não leu por canal e a menção a ele em
 * destaque; o texto do jogador é sempre texto. O total não lido sai por
 * `onUnreadChange` para a aba e o botão de reabrir a coluna.
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
  let apagados: [string | null, string][]
  let naoLidas: ChatUnread[]
  let atual: MasterChatState

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    enviados = []
    aceita = true
    apagados = []
    naoLidas = []
    atual = conversa()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  /** `active` = a aba Chat à vista com a coluna aberta; fora da vista nada conta como lido. */
  function render(chat: MasterChatState, active = false): void {
    atual = chat
    act(() =>
      root.render(
        <MasterChatPanel
          chat={chat}
          active={active}
          onUnreadChange={(unread) => naoLidas.push(unread)}
          onSend={(text) => {
            enviados.push(text)
            return aceita
          }}
          onDelete={(sceneKey, id) => apagados.push([sceneKey, id])}
        />,
      ),
    )
  }

  /** O nome que a aba Chat ganharia com o último contador avisado. */
  function nomeDaAba(): string {
    return chatUnreadLabel('Chat', naoLidas.at(-1) ?? { count: 0, mention: false })
  }

  /** A aba Chat escolhida: o painel fica à vista. */
  function abrir(): void {
    render(atual, true)
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

  it('é o painel da aba, sem botão flutuante; o Global vem primeiro, depois cada cena pelo nome', () => {
    render(conversa(), true)
    const painel = container.querySelector('section.lb-mchat')
    expect(painel?.getAttribute('aria-label')).toBe('Chat dos jogadores')
    expect(painel?.hasAttribute('hidden')).toBe(false)
    // O botão "Chat" do canto do mapa saiu: o painel não abre nem fecha sozinho.
    expect(container.querySelector('.lb-mchat__toggle')).toBeNull()
    expect(container.querySelector('[aria-expanded]')).toBeNull()
    const nomes = Array.from(container.querySelectorAll('.lb-mchat__channel-name')).map((n) => n.textContent)
    expect(nomes).toEqual(['Global', 'Salao Norte', 'Cripta Rubra'])
    expect(canal('Global').getAttribute('aria-pressed')).toBe('true')
    expect(textos()).toEqual(['Alguém no Salão?'])
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

  it('o que chegou com o canal fora da vista conta como não lido, por canal; ver o canal lê', () => {
    render(conversa())
    // Tudo chegou com a aba fora da vista: 3 novas avisadas para a aba e o botão de reabrir.
    expect(naoLidas.at(-1)).toEqual({ count: 3, mention: false })
    expect(nomeDaAba()).toBe('Chat (3 novas)')
    abrir()
    // O Global, à vista, foi lido; as cenas continuam com 1 cada.
    expect(canal('Global').querySelector('.lb-mchat__badge')).toBeNull()
    expect(canal('Salao Norte').querySelector('.lb-mchat__badge')?.textContent).toContain('1')
    expect(nomeDaAba()).toBe('Chat (2 novas)')
    act(() => canal('Salao Norte').click())
    expect(canal('Salao Norte').querySelector('.lb-mchat__badge')).toBeNull()
    // Linha nova na Cripta, com o painel no Salão: acende só a Cripta.
    render(conversa({ scenes: [conversa().scenes[0], { key: 'm-cripta', name: 'Cripta Rubra', messages: [...conversa().scenes[1].messages, linha('c2', 'Bruno', 'ouvi algo')] }] }), true)
    expect(canal('Cripta Rubra').querySelector('.lb-mchat__badge')?.textContent).toContain('2')
    expect(canal('Salao Norte').querySelector('.lb-mchat__badge')).toBeNull()
  })

  it('@mestre acende forte: na linha, no canal e no contador da aba', () => {
    render(conversa({ scenes: [{ key: 'm-salao', name: 'Salao Norte', messages: [linha('s1', 'Ana', '@mestre posso abrir o baú?', ['mestre'])] }] }))
    expect(naoLidas.at(-1)).toEqual({ count: 2, mention: true })
    expect(nomeDaAba()).toBe('Chat (2 novas, menciona você)')
    abrir()
    expect(canal('Salao Norte').querySelector('.lb-mchat__badge--mention')?.textContent).toContain('@1')
    act(() => canal('Salao Norte').click())
    const item = container.querySelector('li.lb-mchat__msg')
    expect(item?.classList.contains('lb-mchat__msg--mention')).toBe(true)
    expect(item?.textContent).toContain('(menciona você)')
    expect(naoLidas.at(-1)).toEqual({ count: 0, mention: false })
  })

  it('chat salvo: o que voltou do disco (restoredIds) não conta como não lido nem acende o @mestre', () => {
    const salvo = linha('s1', 'Ana', '@mestre lembra do baú?', ['mestre'])
    render(conversa({ scenes: [{ key: 'm-salao', name: 'Salao Norte', messages: [salvo] }], restoredIds: new Set(['g1', 's1']) }))
    expect(nomeDaAba()).toBe('Chat')
    // A linha nova, dita nesta sala, conta normalmente.
    render(conversa({ scenes: [{ key: 'm-salao', name: 'Salao Norte', messages: [salvo, linha('s2', 'Ana', 'e agora?')] }], restoredIds: new Set(['g1', 's1']) }))
    expect(nomeDaAba()).toBe('Chat (1 nova)')
  })

  it('a fala do próprio mestre nunca conta como não lida', () => {
    render(conversa({ global: [{ ...linha('g1', 'Mestre', 'Pausa'), fromMaster: true }], scenes: [] }))
    expect(nomeDaAba()).toBe('Chat')
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

  it('o Esc passa direto para o editor: o painel da aba não fecha nada', () => {
    render(conversa(), true)
    let chegou = 0
    const ouvinte = () => {
      chegou += 1
    }
    document.addEventListener('keydown', ouvinte)
    try {
      const alvo = campo()
      if (!alvo) throw new Error('sem campo')
      tecla(alvo, 'Escape')
      expect(chegou).toBe(1)
      expect(container.querySelector('section.lb-mchat')?.hasAttribute('hidden')).toBe(false)
    } finally {
      document.removeEventListener('keydown', ouvinte)
    }
  })

  it('desmontar (a sala fechou) zera o contador da aba', () => {
    render(conversa())
    expect(naoLidas.at(-1)).toEqual({ count: 3, mention: false })
    act(() => root.render(<p>sem sala</p>))
    expect(naoLidas.at(-1)).toEqual({ count: 0, mention: false })
  })

  it('Apagar pede confirmação na linha; confirmar apaga do canal certo, Cancelar não apaga', () => {
    render(conversa())
    abrir()
    act(() => canal('Cripta Rubra').click())
    const apagar = container.querySelector<HTMLButtonElement>('button.lb-mchat__delete')
    expect(apagar?.getAttribute('aria-label')).toBe('Apagar a mensagem de Bruno das 20:30')
    act(() => apagar?.click())
    expect(apagados).toEqual([])
    const confirmar = () => container.querySelector('.lb-mchat__confirm')
    expect(confirmar()?.textContent).toContain('Apagar para todos?')
    act(() => Array.from(confirmar()?.querySelectorAll('button') ?? []).find((b) => b.textContent === 'Cancelar')?.click())
    expect(confirmar()).toBeNull()
    expect(apagados).toEqual([])
    act(() => container.querySelector<HTMLButtonElement>('button.lb-mchat__delete')?.click())
    act(() => container.querySelector<HTMLButtonElement>('button.lb-mchat__confirm-yes')?.click())
    expect(apagados).toEqual([['m-cripta', 'c1']])
    act(() => canal('Global').click())
    act(() => container.querySelector<HTMLButtonElement>('button.lb-mchat__delete')?.click())
    act(() => container.querySelector<HTMLButtonElement>('button.lb-mchat__confirm-yes')?.click())
    expect(apagados).toEqual([['m-cripta', 'c1'], [null, 'g1']])
  })

  it('trocar de canal desfaz a confirmação pendente', () => {
    render(conversa())
    abrir()
    act(() => container.querySelector<HTMLButtonElement>('button.lb-mchat__delete')?.click())
    expect(container.querySelector('.lb-mchat__confirm')).not.toBeNull()
    act(() => canal('Salao Norte').click())
    act(() => canal('Global').click())
    expect(container.querySelector('.lb-mchat__confirm')).toBeNull()
  })

  it('cena que saiu da aventura aparece como "Cena fora da aventura"', () => {
    render(conversa({ scenes: [{ key: 'm-x', name: null, messages: [linha('x1', 'Ana', 'oi')] }] }))
    abrir()
    expect(canal('Cena fora da aventura')).toBeTruthy()
  })
})

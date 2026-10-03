import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHAT_TEXT_MAX_LENGTH, type ChatChannel } from '../lib/chat'
import type { ChatEntry, PartyMember } from '../net/protocol'
import { PlayerChat } from './PlayerChat'
import type { ChatLog, ChatSend, ChatUnread } from './playerConnection'

/**
 * CHAT dos jogadores, a tela (docs/plano-chat.md, fatia A): a aba mostra o
 * canal da cena ou o Global, cada linha só como texto do React, e o campo
 * com @ sugere quem está no canal e o mestre.
 */

const AS_20_30 = new Date(2026, 8, 27, 20, 30).getTime()

const GRUPO: PartyMember[] = [
  { playerId: 'p2', name: 'Bruno', where: 'aqui' },
  { playerId: 'p3', name: 'Caio', where: 'longe' },
  { playerId: 'p4', name: 'Dora', where: 'fora' },
]

function linha(id: string, from: string, text: string, mentions: string[] = []): ChatEntry {
  return { id, at: AS_20_30, from, text, mentions }
}

interface Montagem {
  log?: ChatLog
  unread?: ChatUnread
  status?: ChatSend
  selfName?: string
  party?: PartyMember[]
  visible?: boolean
  onSend?: (channel: ChatChannel, text: string, mentions: readonly string[]) => boolean
  onRead?: (channel: ChatChannel) => void
}

describe('PlayerChat', () => {
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

  function render(m: Montagem = {}): void {
    act(() =>
      root.render(
        <PlayerChat
          log={m.log ?? { cena: [], global: [] }}
          unread={m.unread}
          status={m.status}
          selfName={'selfName' in m ? m.selfName : 'Ana'}
          party={'party' in m ? m.party : GRUPO}
          visible={m.visible ?? true}
          onSend={m.onSend ?? (() => true)}
          onRead={m.onRead ?? (() => {})}
        />,
      ),
    )
  }

  function campo(): HTMLTextAreaElement {
    const achado = container.querySelector<HTMLTextAreaElement>('textarea.pc-input')
    if (!achado) throw new Error('sem o campo do chat')
    return achado
  }

  function canal(nome: 'Cena' | 'Global'): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button.pc-channel')).find((b) => (b.textContent ?? '').startsWith(nome))
    if (!achado) throw new Error(`sem o botão ${nome}`)
    return achado
  }

  function botaoEnviar(): HTMLButtonElement {
    const achado = container.querySelector<HTMLButtonElement>('button.pc-send')
    if (!achado) throw new Error('sem o botão de enviar')
    return achado
  }

  /** Escreve no campo como o navegador faz (o React só vê a troca pelo setter do protótipo) e põe o cursor. */
  function digitar(texto: string, cursor = texto.length): void {
    const alvo = campo()
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    if (!setter) throw new Error('jsdom sem o setter de value')
    act(() => {
      setter.call(alvo, texto)
      alvo.setSelectionRange(cursor, cursor)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function tecla(key: string, extra: KeyboardEventInit = {}): KeyboardEvent {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })
    act(() => {
      campo().dispatchEvent(evento)
    })
    return evento
  }

  function opcoes(): string[] {
    return Array.from(container.querySelectorAll('[role="listbox"] [role="option"]')).map((o) => o.textContent ?? '')
  }

  function ativa(): string | null {
    const id = campo().getAttribute('aria-activedescendant')
    if (id === null || id === '') return null
    return document.getElementById(id)?.textContent ?? null
  }

  function alerta(): string | null {
    return container.querySelector('[role="alert"]')?.textContent ?? null
  }

  it('texto com HTML ou endereço aparece literal: nem imagem, nem link', () => {
    render({
      log: {
        cena: [linha('c1', 'Bruno', '<img src=x onerror=alert(1)>'), linha('c2', 'Bruno', 'veja https://exemplo.com/mapa')],
        global: [],
      },
    })
    const textos = Array.from(container.querySelectorAll('.pc-msg__text')).map((t) => t.textContent)
    expect(textos).toEqual(['<img src=x onerror=alert(1)>', 'veja https://exemplo.com/mapa'])
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })

  it('cada linha diz quem falou e a hora; Cena e Global mostram cada um o seu', () => {
    render({ log: { cena: [linha('c1', 'Bruno', 'na cripta')], global: [linha('g1', 'Caio', 'alguém me ouve?')] } })
    const log = container.querySelector('[role="log"]')
    expect(log?.getAttribute('aria-label')).toBe('Mensagens da cena')
    expect(canal('Cena').getAttribute('aria-pressed')).toBe('true')
    expect(log?.textContent).toContain('Bruno')
    expect(log?.textContent).toContain('20:30')
    expect(log?.textContent).toContain('na cripta')
    expect(log?.textContent).not.toContain('alguém me ouve?')

    act(() => canal('Global').click())
    expect(canal('Global').getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[role="log"]')?.getAttribute('aria-label')).toBe('Mensagens do Global')
    expect(container.querySelector('[role="log"]')?.textContent).toContain('alguém me ouve?')
    expect(container.querySelector('[role="log"]')?.textContent).not.toContain('na cripta')
  })

  it('jogador chamado "Mestre" aparece como "Mestre (jogador)": a fala dele não se passa pela do mestre', () => {
    render({ log: { cena: [linha('c1', 'Mestre', 'sou eu'), linha('c2', 'MESTRE', 'eu também'), linha('c3', 'Mestrado', 'e eu')], global: [] } })
    const quem = Array.from(container.querySelectorAll('.pc-msg__from')).map((f) => f.textContent)
    expect(quem).toEqual(['Mestre (jogador)', 'MESTRE (jogador)', 'Mestrado'])
  })

  it('a fala do mestre (marca do host) aparece como "Mestre", em destaque próprio', () => {
    render({ log: { cena: [], global: [{ ...linha('g1', 'Mestre', 'Pausa de 5 minutos'), fromMaster: true }, linha('g2', 'Mestre', 'sou eu')] } })
    act(() => canal('Global').click())
    const itens = Array.from(container.querySelectorAll('li.pc-msg'))
    expect(itens.map((item) => item.querySelector('.pc-msg__from')?.textContent)).toEqual(['Mestre', 'Mestre (jogador)'])
    expect(itens[0].classList.contains('pc-msg--master')).toBe(true)
    expect(itens[1].classList.contains('pc-msg--master')).toBe(false)
  })

  it('mensagem que me menciona fica destacada e diz "(menciona você)"; a dos outros não', () => {
    render({ log: { cena: [linha('c1', 'Bruno', '@Ana abre a porta', ['Ana']), linha('c2', 'Bruno', '@Caio vem', ['Caio'])], global: [] } })
    const itens = Array.from(container.querySelectorAll('li.pc-msg'))
    expect(itens).toHaveLength(2)
    expect(itens[0].classList.contains('pc-msg--me')).toBe(true)
    expect(itens[0].textContent).toContain('(menciona você)')
    expect(itens[1].classList.contains('pc-msg--me')).toBe(false)
    expect(itens[1].textContent).not.toContain('(menciona você)')
  })

  it('marca no Global acende o ponto no botão Global, não no da Cena', () => {
    render({ unread: { cena: [], global: ['g1'] } })
    expect(canal('Global').querySelector('.pc-unread')?.textContent).toBe(' (menção nova)')
    expect(canal('Cena').querySelector('.pc-unread')).toBeNull()
  })

  it('@ na cena sugere quem está aqui e o mestre; no Global, o grupo inteiro', () => {
    render()
    digitar('oi @')
    expect(opcoes()).toEqual(['@Bruno', '@mestre'])
    expect(ativa()).toBe('@Bruno')
    digitar('oi @M')
    expect(opcoes()).toEqual(['@mestre'])
    digitar('oi @zz')
    expect(opcoes()).toEqual([])
    expect(container.querySelector('.pc-suggest__none')?.textContent).toBe('Nenhum jogador com esse nome')

    act(() => canal('Global').click())
    digitar('@')
    expect(opcoes()).toEqual(['@Bruno', '@Caio', '@Dora', '@mestre'])
    digitar('email ana@')
    expect(opcoes()).toEqual([])
    expect(container.querySelector('.pc-suggest__none')).toBeNull()
  })

  it('setas escolhem, Enter põe "@Nome " no lugar do que foi digitado, sem mandar', () => {
    let enviados = 0
    render({
      onSend: () => {
        enviados += 1
        return true
      },
    })
    digitar('oi @ e tchau', 4)
    tecla('ArrowDown')
    expect(ativa()).toBe('@mestre')
    tecla('ArrowUp')
    expect(ativa()).toBe('@Bruno')
    const enter = tecla('Enter')
    expect(enter.defaultPrevented).toBe(true)
    expect(campo().value).toBe('oi @Bruno  e tchau')
    expect(opcoes()).toEqual([])
    expect(enviados).toBe(0)
  })

  it('Esc fecha as sugestões sem chegar à janela; sem sugestões, o Esc segue (fecha a gaveta)', () => {
    let escNaJanela = 0
    const contar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') escNaJanela += 1
    }
    window.addEventListener('keydown', contar)
    try {
      render()
      digitar('oi @')
      const esc = tecla('Escape')
      expect(esc.defaultPrevented).toBe(true)
      expect(opcoes()).toEqual([])
      expect(container.querySelector('[role="listbox"]')).toBeNull()
      expect(escNaJanela).toBe(0)
      tecla('Escape')
      expect(escNaJanela).toBe(1)
    } finally {
      window.removeEventListener('keydown', contar)
    }
  })

  it('Enter manda para o canal à vista com as menções do texto; Shift+Enter não manda', () => {
    const enviados: [ChatChannel, string, readonly string[]][] = []
    render({
      onSend: (channel, text, mentions) => {
        enviados.push([channel, text, mentions])
        return true
      },
    })
    digitar('oi @Bruno e @mestre, tudo bem?')
    const quebra = tecla('Enter', { shiftKey: true })
    expect(quebra.defaultPrevented).toBe(false)
    expect(enviados).toEqual([])
    const enter = tecla('Enter')
    expect(enter.defaultPrevented).toBe(true)
    expect(enviados).toEqual([['cena', 'oi @Bruno e @mestre, tudo bem?', ['Bruno', 'mestre']]])
  })

  it('o texto só some quando o mestre confirma; recusado, fica e o aviso diz o motivo', () => {
    const onSend = (): boolean => true
    render({ onSend })
    digitar('primeira')
    tecla('Enter')
    render({ onSend, status: { reqId: 'c1', channel: 'cena', phase: 'sending' } })
    expect(campo().value).toBe('primeira')
    expect(botaoEnviar().textContent).toBe('Enviando…')
    expect(botaoEnviar().disabled).toBe(true)
    render({ onSend, status: { reqId: 'c1', channel: 'cena', phase: 'ok' } })
    expect(campo().value).toBe('')
    expect(botaoEnviar().textContent).toBe('Enviar')
    expect(alerta()).toBeNull()

    digitar('segunda')
    tecla('Enter')
    render({ onSend, status: { reqId: 'c2', channel: 'cena', phase: 'too_soon' } })
    expect(campo().value).toBe('segunda')
    expect(alerta()).toBe('Espere um instante e mande de novo.')

    tecla('Enter')
    render({ onSend, status: { reqId: 'c3', channel: 'cena', phase: 'no_scene' } })
    expect(alerta()).toBe('Você não está em nenhuma cena agora. Fale no Global.')

    tecla('Enter')
    render({ onSend, status: { reqId: 'c4', channel: 'cena', phase: 'failed' } })
    expect(alerta()).toBe('O mestre não aceitou a mensagem. Tente de novo.')
    expect(campo().value).toBe('segunda')

    tecla('Enter')
    render({ onSend, status: { reqId: 'c5', channel: 'cena', phase: 'not_seated' } })
    expect(alerta()).toBe('Você está sem ficha agora: o chat volta quando o mestre te der uma.')
    expect(campo().value).toBe('segunda')
  })

  it('sem conexão, o texto fica; vazio, pede a mensagem e não manda', () => {
    let enviados = 0
    const onSend = (): boolean => {
      enviados += 1
      return false
    }
    render({ onSend })
    digitar('oi')
    tecla('Enter')
    expect(alerta()).toBe('Sem conexão com o mestre. Tente de novo.')
    expect(campo().value).toBe('oi')

    digitar('   ')
    act(() => botaoEnviar().click())
    expect(alerta()).toBe('Escreva a mensagem antes de mandar.')
    expect(document.activeElement).toBe(campo())
    expect(enviados).toBe(1)
  })

  it('o contador e o aviso de texto longo falam em caracteres, no singular e no plural', () => {
    let enviados = 0
    render({
      onSend: () => {
        enviados += 1
        return true
      },
    })
    const contador = (): string | null => container.querySelector('.pc-count')?.textContent ?? null
    digitar('a'.repeat(CHAT_TEXT_MAX_LENGTH - 2))
    expect(contador()).toBe('Faltam 2 caracteres')
    digitar('a'.repeat(CHAT_TEXT_MAX_LENGTH - 1))
    expect(contador()).toBe('Falta 1 caractere')
    digitar('a'.repeat(CHAT_TEXT_MAX_LENGTH))
    expect(contador()).toBe('Faltam 0 caracteres')
    digitar('a'.repeat(CHAT_TEXT_MAX_LENGTH + 1))
    expect(contador()).toBe('Passou 1 caractere do limite')
    digitar('a'.repeat(CHAT_TEXT_MAX_LENGTH + 3))
    expect(contador()).toBe('Passou 3 caracteres do limite')
    tecla('Enter')
    expect(alerta()).toBe(`Passou de ${CHAT_TEXT_MAX_LENGTH} caracteres. Corte um pouco e mande de novo.`)
    expect(enviados).toBe(0)
  })

  it('à vista e com marca no canal, avisa que leu; escondida, não', () => {
    const lidos: ChatChannel[] = []
    const onRead = (channel: ChatChannel): void => {
      lidos.push(channel)
    }
    render({ visible: false, unread: { cena: ['c1'], global: [] }, onRead })
    expect(lidos).toEqual([])
    render({ visible: true, unread: { cena: ['c1'], global: [] }, onRead })
    expect(lidos).toEqual(['cena'])
    render({ visible: true, unread: { cena: [], global: [] }, onRead })
    expect(lidos).toEqual(['cena'])
  })

  it('sem grupo, sem nome e sem histórico: mostra o vazio e o @ só sugere o mestre', () => {
    render({ party: undefined, selfName: undefined, log: { cena: [linha('c1', 'Bruno', 'oi', ['Ana'])], global: [] } })
    expect(container.querySelector('.pc-msg--me')).toBeNull()
    act(() => canal('Global').click())
    expect(container.textContent).toContain('Ninguém falou no Global ainda.')
    digitar('@')
    expect(opcoes()).toEqual(['@mestre'])
  })
})

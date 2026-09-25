import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LETTER_TEXT_MAX_LENGTH, letterTitle } from '../lib/correio'
import type { LetterPeers, LetterSend } from './playerConnection'
import { PlayerLetterForm } from './PlayerLetterForm'
import { PlayerNotebook } from './PlayerNotebook'

/**
 * CORREIO DE BILHETES na tela do jogador: o formulário "Bilhete" do Painel
 * (pedir colegas, escolher meio, escrever e mandar) e o bilhete entregue no
 * Caderno, com o nome de quem escreveu no lugar de "Mestre".
 */

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

interface Tela {
  peers?: LetterPeers
  status?: LetterSend
  onAskPeers?: () => void
  onSend?: (to: string, via: string, text: string) => boolean
}

function desenha({ peers, status, onAskPeers = () => {}, onSend = () => true }: Tela): void {
  act(() => {
    root.render(<PlayerLetterForm peers={peers} status={status} onAskPeers={onAskPeers} onSend={onSend} />)
  })
}

function botao(texto: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
  if (!achado) throw new Error(`sem o botão "${texto}"`)
  return achado
}

function campo(): HTMLTextAreaElement {
  const achado = container.querySelector('textarea')
  if (!achado) throw new Error('sem o campo do bilhete')
  return achado
}

function escreve(texto: string): void {
  const area = campo()
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(area, texto)
    area.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function escolheMeio(rotulo: string): void {
  const radio = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find((r) => r.closest('label')?.textContent?.trim() === rotulo)
  if (!radio) throw new Error(`sem o meio "${rotulo}"`)
  act(() => radio.click())
}

function envia(): void {
  const form = container.querySelector('form')
  if (!form) throw new Error('sem o formulário')
  act(() => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

const PRONTO: LetterPeers = { phase: 'ready', names: ['Bruno', 'Caio'] }

describe('PlayerLetterForm', () => {
  it('"Escrever bilhete" pede a lista de colegas e abre o formulário', () => {
    const onAskPeers = vi.fn()
    desenha({ onAskPeers })
    expect(container.querySelector('form')).toBeNull()
    act(() => botao('Escrever bilhete').click())
    expect(onAskPeers).toHaveBeenCalledTimes(1)
    expect(container.querySelector('form')).not.toBeNull()
  })

  it('enquanto a lista não chega, diz que procura e não deixa mandar', () => {
    desenha({ peers: { phase: 'loading' } })
    act(() => botao('Escrever bilhete').click())
    expect(container.textContent).toContain('Procurando quem está na sala…')
    expect(botao('Mandar').disabled).toBe(true)
  })

  it('sala sem mais ninguém: diz isso e não deixa mandar', () => {
    desenha({ peers: { phase: 'ready', names: [] } })
    act(() => botao('Escrever bilhete').click())
    expect(container.textContent).toContain('Ninguém mais na sala para receber.')
    expect(botao('Mandar').disabled).toBe(true)
  })

  it('mandar vazio avisa junto do campo e põe o foco nele', () => {
    const onSend = vi.fn(() => true)
    desenha({ peers: PRONTO, onSend })
    act(() => botao('Escrever bilhete').click())
    envia()
    expect(onSend).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Escreva o bilhete antes de mandar.')
    expect(document.activeElement).toBe(campo())
  })

  it('manda para o colega escolhido, pelo meio escolhido, com o contador do que falta', () => {
    const onSend = vi.fn(() => true)
    desenha({ peers: PRONTO, onSend })
    act(() => botao('Escrever bilhete').click())
    expect(container.textContent).toContain(`Faltam ${LETTER_TEXT_MAX_LENGTH} letras`)
    const para = container.querySelector('select')
    if (!para) throw new Error('sem o campo Para')
    act(() => {
      para.value = 'Caio'
      para.dispatchEvent(new Event('change', { bubbles: true }))
    })
    escolheMeio('Cápsula')
    escreve('  No poço.  ')
    expect(container.textContent).toContain(`Faltam ${LETTER_TEXT_MAX_LENGTH - 12} letras`)
    envia()
    expect(onSend).toHaveBeenCalledWith('Caio', 'capsula', 'No poço.')
  })

  it('mandando: o botão diz e trava; saiu: confirma, limpa o texto e não conta quem entrega', () => {
    const onSend = vi.fn(() => true)
    desenha({ peers: PRONTO, onSend })
    act(() => botao('Escrever bilhete').click())
    escreve('No poço.')
    envia()
    desenha({ peers: PRONTO, onSend, status: { to: 'Bruno', via: 'pombo', phase: 'sending' } })
    expect(botao('Mandando…').disabled).toBe(true)
    desenha({ peers: PRONTO, onSend, status: { to: 'Bruno', via: 'pombo', phase: 'ok' } })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Saiu pelo pombo para Bruno. Quem entrega é o mestre.')
    expect(campo().value).toBe('')
  })

  it('recusa do host: o texto continua e a mensagem diz o que fazer', () => {
    desenha({ peers: PRONTO })
    act(() => botao('Escrever bilhete').click())
    escreve('No poço.')
    envia()
    desenha({ peers: PRONTO, status: { to: 'Bruno', via: 'pombo', phase: 'full' } })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('O mestre ainda não respondeu aos seus bilhetes. Espere um pouco.')
    expect(campo().value).toBe('No poço.')
    desenha({ peers: PRONTO, status: { to: 'Bruno', via: 'pombo', phase: 'failed' } })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('O bilhete não saiu. Confira o nome e tente de novo.')
  })

  it('conexão caída na hora de mandar: avisa e guarda o texto', () => {
    desenha({ peers: PRONTO, onSend: () => false })
    act(() => botao('Escrever bilhete').click())
    escreve('No poço.')
    envia()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Sem conexão com o mestre. Tente de novo.')
    expect(campo().value).toBe('No poço.')
  })
})

describe('bilhete no Caderno', () => {
  it('mostra quem escreveu e por onde veio, no lugar de "Mestre"', () => {
    act(() => {
      root.render(
        <PlayerNotebook
          notes={[
            { id: 'n1', text: 'A porta range.', at: 0 },
            { id: 'b1', text: 'No poço.', at: 0, from: 'Bruno', via: 'pombo' },
          ]}
        />,
      )
    })
    const itens = [...container.querySelectorAll('li')].map((li) => li.textContent)
    expect(itens[0]).toContain('Bilhete de Bruno, pelo pombo: No poço.')
    expect(itens[1]).toContain('Mestre: A porta range.')
  })

  it('título do cartão do bilhete, com o artigo de cada meio', () => {
    expect(letterTitle('Ana', 'tubo')).toBe('Bilhete de Ana, pelo tubo')
    expect(letterTitle('Ana', 'pombo')).toBe('Bilhete de Ana, pelo pombo')
    expect(letterTitle('Ana', 'capsula')).toBe('Bilhete de Ana, pela cápsula')
  })
})

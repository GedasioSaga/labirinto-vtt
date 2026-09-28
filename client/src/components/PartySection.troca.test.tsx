import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PartyItemAction, PartyMember } from '../lib/party'
import type { TradeProposal } from '../lib/troca'
import type { TunnelState } from '../net/hostBridge'
import type { PlayerInfo, TradeProposeResult } from '../net/hostSession'
import { PARTY_TRADE_REFUSAL_TEXT } from './PartySection'
import { RoomPanel } from './RoomPanel'

/**
 * MOEDAS E TROCA no Grupo do mestre: a linha mostra a bolsa e, no "…" dela
 * (seção "Mochila e bolsa", pedido 13), "Moedas…" acerta o valor e "Propor
 * troca…" monta a oferta — quem oferece, o que dá (itens novos e moedas) e o
 * que pede (itens da mochila dele e moedas).
 */

const IDLE: TunnelState = { kind: 'idle' }
const noop = (): void => {}
const handlers = {
  onStart: noop,
  onStop: noop,
  onStartTunnel: noop,
  onStopTunnel: noop,
  onAssign: noop,
  onUnassign: noop,
  onKick: noop,
  onVisionRadiusChange: noop,
  onVisionFactorChange: noop,
  onRevealPlan: noop,
  onHidePlan: noop,
  clues: { rows: [], onCenter: noop, onToggle: noop },
}

function jogadorDe(member: PartyMember): PlayerInfo {
  const tokenIds = member.token === null ? [] : [member.token.id]
  return { clientId: 'c-' + member.playerId, playerId: member.playerId, name: member.name, status: 'playing', connected: member.connected, tokenIds, visionRadius: 700, visionFactor: 1 }
}

const BRUNO: PartyMember = {
  playerId: 'p-bruno',
  name: 'Bruno',
  connected: true,
  sceneId: 'cena-mansao',
  sceneName: 'Mansão',
  token: { id: 'bruno', color: '#3cff00', x: 0, y: 0 },
  travelPending: false,
  mochila: [
    { id: 'faca', nome: 'Faca de rede', tokenId: 'bruno', sceneId: 'cena-mansao' },
    { id: 'vela', nome: 'Vela', tokenId: 'bruno', sceneId: 'cena-mansao' },
  ],
  moedas: 5,
}

describe('Grupo: moedas e troca do mestre', () => {
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

  /** Monta o Grupo e abre o "…" da linha de Bruno, onde moram "Moedas…" e "Propor troca…". */
  function render(onItem: (action: PartyItemAction) => boolean, onTrade: (member: PartyMember, proposta: TradeProposal) => TradeProposeResult): void {
    const party = { members: [BRUNO], destinations: [], onGoTo: noop, onSend: () => true, onItem, onTrade }
    act(() =>
      root.render(<RoomPanel room={{ code: 'TROCA1', urls: [], qrSvg: '<svg/>' }} players={[jogadorDe(BRUNO)]} tokens={[{ id: 'bruno', name: 'Bruno' }]} party={party} tunnel={IDLE} {...handlers} />),
    )
    act(() => botao('Mais de Bruno').click())
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
    if (achado === undefined) throw new Error(`sem botão ${nome}`)
    return achado
  }

  function digita(seletor: string, texto: string): void {
    const alvo = container.querySelector<HTMLInputElement>(seletor)
    if (alvo === null) throw new Error(`sem campo ${seletor}`)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('a linha mostra a bolsa e "Moedas…" grava o valor novo', () => {
    const onItem = vi.fn(() => true)
    render(onItem, () => 'sent')
    expect(container.textContent).toContain('Bolsa: 5 moedas')
    act(() => botao('Moedas de Bruno').click())
    digita('form[aria-label="Moedas de Bruno"] input[type="number"]', '12')
    act(() => botao('Salvar moedas').click())
    expect(onItem).toHaveBeenCalledWith({ kind: 'moedas', member: BRUNO, moedas: 12 })
  })

  it('"Propor troca…" monta a oferta com quem oferece, o que dá e o que pede', () => {
    const onTrade = vi.fn((_member: PartyMember, _proposta: TradeProposal): TradeProposeResult => 'sent')
    render(() => true, onTrade)
    act(() => botao('Propor troca a Bruno').click())
    const propor = botao('Propor')
    expect(propor.disabled).toBe(true)
    digita('form[aria-label="Troca com Bruno"] input[name="de"]', 'Zulmira')
    digita('form[aria-label="Troca com Bruno"] input[name="dou-itens"]', 'Xarope, Vela nova')
    const faca = container.querySelector<HTMLInputElement>('form[aria-label="Troca com Bruno"] input[type="checkbox"][value="faca"]')
    if (faca === null) throw new Error('sem a faca')
    act(() => faca.click())
    digita('form[aria-label="Troca com Bruno"] input[name="peco-moedas"]', '3')
    act(() => botao('Propor').click())
    expect(onTrade).toHaveBeenCalledWith(BRUNO, { de: 'Zulmira', dou: { itens: ['Xarope', 'Vela nova'], moedas: 0 }, peco: { itemIds: ['faca'], moedas: 3 } })
    expect(container.querySelector('form[aria-label="Troca com Bruno"]')).toBeNull()
  })

  it('mais de 10 itens em "Dá itens": diz o motivo certo e não deixa propor', () => {
    const onTrade = vi.fn((_member: PartyMember, _proposta: TradeProposal): TradeProposeResult => 'sent')
    render(() => true, onTrade)
    act(() => botao('Propor troca a Bruno').click())
    const onze = Array.from({ length: 11 }, (_, i) => `Item ${i + 1}`).join(', ')
    digita('form[aria-label="Troca com Bruno"] input[name="dou-itens"]', onze)
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(PARTY_TRADE_REFUSAL_TEXT.too_many)
    expect(PARTY_TRADE_REFUSAL_TEXT.too_many).toContain('10')
    expect(botao('Propor').disabled).toBe(true)
    // Voltando a 10, a oferta sai.
    digita('form[aria-label="Troca com Bruno"] input[name="dou-itens"]', onze.split(', ').slice(0, 10).join(', '))
    expect(container.querySelector('[role="alert"]')).toBeNull()
    act(() => botao('Propor').click())
    expect(onTrade).toHaveBeenCalledTimes(1)
  })

  it('o host recusa por excesso de itens: a linha diz o motivo, não "a ficha mudou"', () => {
    render(() => true, () => 'too_many')
    act(() => botao('Propor troca a Bruno').click())
    digita('form[aria-label="Troca com Bruno"] input[name="peco-moedas"]', '1')
    act(() => botao('Propor').click())
    const alerta = container.querySelector('[role="alert"]')?.textContent
    expect(alerta).toBe(PARTY_TRADE_REFUSAL_TEXT.too_many)
    expect(alerta).not.toBe(PARTY_TRADE_REFUSAL_TEXT.unavailable)
  })

  it('não saiu: o formulário fica e diz por quê', () => {
    render(() => true, () => 'pending')
    act(() => botao('Propor troca a Bruno').click())
    digita('form[aria-label="Troca com Bruno"] input[name="peco-moedas"]', '1')
    act(() => botao('Propor').click())
    expect(container.querySelector('form[aria-label="Troca com Bruno"]')).not.toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(PARTY_TRADE_REFUSAL_TEXT.pending)
  })

  it('ficha escondida do jogador: o mestre lê que precisa mostrá-la antes', () => {
    render(() => true, () => 'hidden')
    act(() => botao('Propor troca a Bruno').click())
    digita('form[aria-label="Troca com Bruno"] input[name="peco-moedas"]', '1')
    act(() => botao('Propor').click())
    expect(container.querySelector('form[aria-label="Troca com Bruno"]')).not.toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A ficha está escondida do jogador: mostre-a antes de propor a troca.')
  })
})

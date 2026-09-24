import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinControls, type PinControlsProps } from './PinControls'
import { SHOW_PIN_NOW_LABEL, ShowPinNowControls, canShowPinNow, showPinNowCandidates, showPinNowWithNotice } from './ShowPinNowControls'
import type { PartyMember } from '../lib/party'

/**
 * "MOSTRAR AGORA A…" no painel do pino: o botão abre a lista de quem está
 * nesta cena com ficha; um toque no nome manda o cartão e fecha a lista.
 * Esc fecha sem mandar nada.
 */

const GABI = { playerId: 'p-gabi', name: 'Gabi', color: '#ff0000' }
const DIEGO = { playerId: 'p-diego', name: 'Diego', color: '#00ff00' }

describe('ShowPinNowControls', () => {
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

  function botao(texto: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto)
    if (!(found instanceof HTMLButtonElement)) throw new Error(`sem botão "${texto}"`)
    return found
  }

  it('"Mostrar agora a Gabi": um toque no nome manda o cartão só a ela e fecha a lista', () => {
    const onShow = vi.fn()
    act(() => root.render(<ShowPinNowControls candidates={[GABI, DIEGO]} onShow={onShow} />))
    const abrir = botao(SHOW_PIN_NOW_LABEL)
    expect(abrir.getAttribute('aria-expanded')).toBe('false')
    act(() => abrir.click())
    expect(abrir.getAttribute('aria-expanded')).toBe('true')
    act(() => botao('Gabi').click())
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(onShow).toHaveBeenCalledWith('p-gabi')
    expect(container.querySelector('[aria-label="Mostrar o cartão a"]')).toBeNull()
    expect(document.activeElement).toBe(abrir)
  })

  it('Esc fecha a lista sem mandar nada', () => {
    const onShow = vi.fn()
    act(() => root.render(<ShowPinNowControls candidates={[GABI]} onShow={onShow} />))
    act(() => botao(SHOW_PIN_NOW_LABEL).click())
    const lista = container.querySelector('[aria-label="Mostrar o cartão a"]')
    expect(lista).not.toBeNull()
    act(() => {
      lista?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('[aria-label="Mostrar o cartão a"]')).toBeNull()
    expect(onShow).not.toHaveBeenCalled()
  })

  it('ninguém nesta cena: a lista diz por quê, sem botão de jogador', () => {
    act(() => root.render(<ShowPinNowControls candidates={[]} onShow={vi.fn()} />))
    act(() => botao(SHOW_PIN_NOW_LABEL).click())
    expect(container.textContent).toContain('Ninguém com ficha nesta cena.')
    // Só o "Cancelar" sobra: nenhum botão de jogador.
    expect(container.querySelectorAll('[aria-label="Mostrar o cartão a"] li button')).toHaveLength(0)
    expect(botao('Cancelar')).toBe(document.activeElement)
  })

  it('no painel do pino, aparece com a sala aberta e some sem ela', () => {
    const base: PinControlsProps = {
      kind: 'exclamacao',
      onKindChange: () => {},
      description: 'Carta',
      onDescriptionChange: () => {},
      locked: false,
      onLockedChange: () => {},
      marco: false,
      onMarcoChange: () => {},
      lerDePerto: null,
      onLerDePertoChange: () => {},
      image: null,
      onChooseImage: () => {},
      onClearImage: () => {},
      onDelete: () => {},
    }
    act(() => root.render(<PinControls {...base} showNow={{ pinId: 'carta', candidates: [GABI], onShow: vi.fn() }} />))
    expect(container.textContent).toContain(SHOW_PIN_NOW_LABEL)
    act(() => root.render(<PinControls {...base} showNow={null} />))
    expect(container.textContent).not.toContain(SHOW_PIN_NOW_LABEL)
  })
})

describe('canShowPinNow (quando o App oferece o botão)', () => {
  it('ponto de interesse visível com a sala aberta: oferece', () => {
    expect(canShowPinNow({ kind: 'exclamacao' }, true)).toBe(true)
    expect(canShowPinNow({ kind: 'interrogacao', secret: false }, true)).toBe(true)
  })

  it('pino de viagem, pino oculto para jogadores ou sala fechada: não oferece', () => {
    expect(canShowPinNow({ kind: 'viagem' }, true)).toBe(false)
    expect(canShowPinNow({ kind: 'exclamacao', secret: true }, true)).toBe(false)
    expect(canShowPinNow({ kind: 'exclamacao' }, false)).toBe(false)
  })
})

describe('showPinNowWithNotice (o aviso que o mestre lê)', () => {
  const jogadores = [
    { playerId: 'p-gabi', name: 'Gabi' },
    { playerId: 'p-diego', name: 'Diego' },
  ]

  it('saiu: manda só à escolhida e avisa em tom de informação, com o nome dela', () => {
    const showPin = vi.fn((_playerId: string, _pinId: string): boolean | null => true)
    const notify = vi.fn()
    showPinNowWithNotice({ players: () => jogadores, showPin }, 'carta', 'p-gabi', notify)
    expect(showPin).toHaveBeenCalledTimes(1)
    expect(showPin).toHaveBeenCalledWith('p-gabi', 'carta')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('info', 'Cartão aberto na tela de Gabi.')
  })

  it('não deu (saiu da cena, caiu ou sala fechada): aviso de erro, nunca silêncio', () => {
    const notify = vi.fn()
    const players = () => jogadores
    showPinNowWithNotice({ players, showPin: () => false }, 'carta', 'p-diego', notify)
    showPinNowWithNotice({ players, showPin: () => null }, 'carta', 'p-diego', notify)
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenNthCalledWith(1, 'error', 'Não deu para mostrar o cartão a Diego: saiu desta cena ou perdeu a conexão.')
    expect(notify).toHaveBeenNthCalledWith(2, 'error', 'Não deu para mostrar o cartão a Diego: saiu desta cena ou perdeu a conexão.')
  })

  it('jogador que já saiu da lista: o aviso fala "o jogador"', () => {
    const notify = vi.fn()
    showPinNowWithNotice({ players: () => [], showPin: () => false }, 'carta', 'p-sumiu', notify)
    expect(notify).toHaveBeenCalledWith('error', 'Não deu para mostrar o cartão a o jogador: saiu desta cena ou perdeu a conexão.')
  })
})

describe('showPinNowCandidates', () => {
  const membro = (playerId: string, sceneId: string | null, extra: Partial<PartyMember> = {}): PartyMember => ({
    playerId,
    name: playerId,
    connected: true,
    sceneId,
    sceneName: null,
    token: { id: `ficha-${playerId}`, color: '#123456', x: 0, y: 0 },
    travelPending: false,
    ...extra,
  })

  it('só quem está conectado, com ficha e na cena aberta', () => {
    const lista = showPinNowCandidates(
      [
        membro('gabi', 'salao'),
        membro('rui', 'cripta'),
        membro('caiu', 'salao', { connected: false }),
        membro('semficha', null, { token: null }),
      ],
      'salao',
    )
    expect(lista).toEqual([{ playerId: 'gabi', name: 'gabi', color: '#123456' }])
  })

  it('mapa solto (sem cena): todo mundo conectado com ficha', () => {
    expect(showPinNowCandidates([membro('gabi', null), membro('diego', null)], null).map((c) => c.playerId)).toEqual(['gabi', 'diego'])
  })
})

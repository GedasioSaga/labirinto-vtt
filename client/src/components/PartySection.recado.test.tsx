/**
 * "Recado" na linha de cada jogador do Grupo: o mestre escreve para UM
 * jogador. Ctrl+Enter envia, Esc cancela, e a linha diz o que aconteceu —
 * enviado, guardado para quando ele voltar, ou que a sala não está aberta.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { partyMembers } from '../lib/party'
import type { HostWorld, PlayerInfo, PlayerNoteDelivery } from '../net/hostSession'
import { NOTE_MAX_LENGTH } from '../net/protocol'
import type { Token } from '../types/map'
import { playerNoteFeedbackText } from './PartySection'
import { RoomPanel, roomPanelTokensOf } from './RoomPanel'

function ficha(id: string): Token {
  return { id, characterId: null, name: `ficha-${id}`, x: 100, y: 100, size: 1, image: null }
}

function mundo(): HostWorld {
  const sala = { ...createEmptyMap('m-a', 'Biblioteca', 30, 10, 50), tokens: [ficha('gabi'), ficha('elisa')] }
  return { open: { sceneId: 's-a', name: 'Biblioteca', map: sala }, background: [] }
}

function jogador(over: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: 'X', status: 'playing', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...over }
}

const JOGADORES: PlayerInfo[] = [
  jogador({ playerId: 'gabi', name: 'Gabi', tokenIds: ['gabi'], sceneId: 's-a', sceneName: 'Biblioteca' }),
  jogador({ playerId: 'elisa', name: 'Elisa', tokenIds: ['elisa'], sceneId: 's-a', sceneName: 'Biblioteca' }),
  // Sem ficha: também pode receber recado (chega quando o mapa dele aparecer).
  jogador({ playerId: 'caio', name: 'Caio', status: 'waiting', tokenIds: [], connected: false, clientId: null }),
]

describe('PartySection: "Recado" para um jogador só', () => {
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

  /** O Grupo é a lista única da aba Jogo (RoomPanel): a linha de cada jogador leva o "Recado". */
  function render(onNote?: (playerId: string, text: string) => PlayerNoteDelivery): void {
    const world = mundo()
    const party = { members: partyMembers(JOGADORES, world), destinations: [], onGoTo: noop, onSend: () => true, onNote }
    act(() =>
      root.render(<RoomPanel room={{ code: 'GRUPO1', urls: [], qrSvg: '<svg/>' }} players={JOGADORES} tokens={roomPanelTokensOf(world)} party={party} tunnel={{ kind: 'idle' }} {...handlers} />),
    )
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  }

  function linha(nome: string): HTMLLIElement | undefined {
    return Array.from(container.querySelectorAll('li')).find((li) => li.querySelector('.lb-player__name')?.textContent === nome)
  }

  function campo(): HTMLTextAreaElement | null {
    return container.querySelector('textarea')
  }

  /** Digita como o React espera: setter nativo + evento `input`. */
  function digita(texto: string): void {
    const alvo = campo()
    if (alvo === null) throw new Error('campo do recado não abriu')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function tecla(key: string, ctrlKey = false): void {
    const alvo = campo()
    if (alvo === null) throw new Error('campo do recado não abriu')
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }))
    })
  }

  it('sem sala (sem onNote) não há "Recado"; com sala, um por jogador, inclusive quem está sem ficha', () => {
    render()
    expect(botao('Recado para Gabi')).toBeUndefined()
    render(vi.fn((): PlayerNoteDelivery => 'sent'))
    expect(botao('Recado para Gabi')?.textContent).toBe('Recado')
    expect(botao('Recado para Elisa')).toBeDefined()
    expect(botao('Recado para Caio')).toBeDefined()
  })

  it('Recado na Gabi, Ctrl+Enter: manda só para ela e a linha DELA diz "Recado enviado a Gabi"', () => {
    const onNote = vi.fn((): PlayerNoteDelivery => 'sent')
    render(onNote)
    act(() => botao('Recado para Gabi')?.click())
    expect(botao('Recado para Gabi')?.getAttribute('aria-expanded')).toBe('true')
    const label = container.querySelector(`label[for="${campo()?.id ?? ''}"]`)
    expect(label?.textContent).toBe('Recado só para Gabi')
    expect(campo()?.maxLength).toBe(NOTE_MAX_LENGTH)
    expect(document.activeElement).toBe(campo())

    digita('A carta tem o seu nome.')
    tecla('Enter')
    expect(onNote).not.toHaveBeenCalled()
    tecla('Enter', true)
    expect(onNote).toHaveBeenCalledTimes(1)
    expect(onNote).toHaveBeenCalledWith('gabi', 'A carta tem o seu nome.')
    expect(campo()).toBeNull()
    expect(linha('Gabi')?.querySelector('[role="status"]')?.textContent).toBe('Recado enviado a Gabi')
    expect(linha('Elisa')?.querySelector('[role="status"]')).toBeNull()
  })

  it('quem está fora: a linha diz que ele recebe ao voltar', () => {
    render(vi.fn((): PlayerNoteDelivery => 'queued'))
    act(() => botao('Recado para Caio')?.click())
    digita('Quando voltar, leia isto.')
    act(() => botao('Enviar')?.click())
    expect(linha('Caio')?.querySelector('[role="status"]')?.textContent).toBe('Caio recebe ao voltar')
  })

  it('Esc cancela sem enviar; texto vazio não envia', () => {
    const onNote = vi.fn((): PlayerNoteDelivery => 'sent')
    render(onNote)
    act(() => botao('Recado para Elisa')?.click())
    digita('   ')
    expect(botao('Enviar')?.disabled).toBe(true)
    tecla('Enter', true)
    digita('não vai')
    tecla('Escape')
    expect(campo()).toBeNull()
    expect(onNote).not.toHaveBeenCalled()
  })

  it('aviso de cada desfecho', () => {
    expect(playerNoteFeedbackText('Gabi', 'sent')).toBe('Recado enviado a Gabi')
    expect(playerNoteFeedbackText('Gabi', 'queued')).toBe('Gabi recebe ao voltar')
    expect(playerNoteFeedbackText('Gabi', null)).toMatch(/Não deu/)
  })
})

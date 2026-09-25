import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerCharacter } from './PlayerPanel'
import type { OwnTokenElsewhere } from '../net/protocol'

const HEROI: PlayerCharacter = { id: 'heroi', name: 'Heroi' }
const BATEDOR: OwnTokenElsewhere = { tokenId: 'batedor', name: 'Batedor', room: 'Poço de corda' }
const SOMBRA: OwnTokenElsewhere = { tokenId: 'sombra', name: 'Sombra', room: '' }

describe('PlayerPanel: minhas fichas em outras cenas', () => {
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
    vi.unstubAllGlobals()
  })

  function render(elsewhere: OwnTokenElsewhere[] | undefined, onSwitchView: (tokenId: string) => void = () => {}): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[HEROI]}
          characterColor="#3b82f6"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={() => {}}
          signalArmed={false}
          onToggleSignal={() => {}}
          measureArmed={false}
          onToggleMeasure={() => {}}
          laserArmed={false}
          onToggleLaser={() => {}}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => {}}
          elsewhere={elsewhere}
          onSwitchView={onSwitchView}
        />,
      ),
    )
  }

  function botao(nomeAcessivel: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nomeAcessivel)
  }

  function lista(): string[] {
    const itens = container.querySelectorAll('section[aria-labelledby$="-chars"] li')
    return Array.from(itens).map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim())
  }

  it('lista as fichas daqui e as de fora, com "Em outro lugar" e a Sala quando ela tem nome', () => {
    render([BATEDOR, SOMBRA])
    expect(lista()).toEqual(['Heroi', 'Batedor Em outro lugar · Poço de corda', 'Sombra Em outro lugar'])
    expect(botao('Centralizar em Heroi')).toBeDefined()
    expect(botao('Olhar por Batedor')).toBeDefined()
    expect(botao('Olhar por Sombra')).toBeDefined()
  })

  it('tocar numa ficha de fora pede para olhar por ela', () => {
    const onSwitchView = vi.fn()
    render([BATEDOR], onSwitchView)
    const alvo = botao('Olhar por Batedor')
    if (alvo === undefined) throw new Error('sem o botão da ficha de fora')
    act(() => alvo.click())
    expect(onSwitchView).toHaveBeenCalledTimes(1)
    expect(onSwitchView).toHaveBeenCalledWith('batedor')
  })

  it('sem fichas de fora, só as daqui (tela de antes)', () => {
    render(undefined)
    expect(lista()).toEqual(['Heroi'])
    expect(container.textContent).not.toContain('Em outro lugar')
  })
})

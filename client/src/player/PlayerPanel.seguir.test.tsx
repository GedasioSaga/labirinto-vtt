import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageLike } from './playerConnection'
import {
  DEFAULT_PLAYER_SETTINGS,
  PLAYER_SETTINGS_KEY,
  PlayerPanel,
  followsOwnToken,
  loadPlayerSettings,
  savePlayerSettings,
  type PlayerViewSettings,
} from './PlayerPanel'

/**
 * "Câmera segue minha ficha", no Painel — a terceira parte do relato da Fabi
 * (torre, lote 1, n. 47): soltar a própria ficha perto da borda recentra a
 * câmera nela. Ligado no celular (dedo), desligado no notebook (mouse), e o
 * jogador troca quando quiser.
 */

const ROTULO = 'Câmera segue minha ficha'

/** jsdom não tem matchMedia: o stub faz o papel do aparelho. */
function aparelho(tipo: 'dedo' | 'mouse'): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: tipo === 'dedo' && query === '(pointer: coarse)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function memoria(inicial: Record<string, string> = {}): StorageLike & { dados: Record<string, string> } {
  const dados = { ...inicial }
  return {
    dados,
    getItem: (key) => dados[key] ?? null,
    setItem: (key, value) => {
      dados[key] = value
    },
    removeItem: (key) => {
      delete dados[key]
    },
  }
}

describe('followsOwnToken: o ajuste salvo manda; sem ele, o aparelho decide', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sem ajuste salvo: ligado com dedo, desligado com mouse', () => {
    aparelho('dedo')
    expect(followsOwnToken(DEFAULT_PLAYER_SETTINGS)).toBe(true)
    aparelho('mouse')
    expect(followsOwnToken(DEFAULT_PLAYER_SETTINGS)).toBe(false)
  })

  it('o que o jogador escolheu vale em qualquer aparelho', () => {
    aparelho('dedo')
    expect(followsOwnToken({ ...DEFAULT_PLAYER_SETTINGS, followOwnToken: false })).toBe(false)
    aparelho('mouse')
    expect(followsOwnToken({ ...DEFAULT_PLAYER_SETTINGS, followOwnToken: true })).toBe(true)
  })
})

describe('loadPlayerSettings e savePlayerSettings: o interruptor sobrevive a recarregar a página', () => {
  it('lê a escolha salva; ausente ou fora do formato fica sem escolha (o aparelho decide)', () => {
    expect(loadPlayerSettings(memoria({ [PLAYER_SETTINGS_KEY]: JSON.stringify({ followOwnToken: false }) })).followOwnToken).toBe(false)
    expect(loadPlayerSettings(memoria({ [PLAYER_SETTINGS_KEY]: JSON.stringify({ followOwnToken: true }) })).followOwnToken).toBe(true)
    expect(loadPlayerSettings(memoria({ [PLAYER_SETTINGS_KEY]: JSON.stringify({ followOwnToken: 'sim' }) })).followOwnToken).toBeUndefined()
    expect(loadPlayerSettings(memoria({ [PLAYER_SETTINGS_KEY]: JSON.stringify({ showGrid: true }) })).followOwnToken).toBeUndefined()
    expect(loadPlayerSettings(memoria()).followOwnToken).toBeUndefined()
  })

  it('sem escolha, nada do interruptor vai para o armazenamento (o padrão continua sendo do aparelho)', () => {
    const guardado = memoria()
    savePlayerSettings(guardado, { ...DEFAULT_PLAYER_SETTINGS, exploredBrightness: 0.8 })
    expect(JSON.parse(guardado.dados[PLAYER_SETTINGS_KEY] ?? 'null')).toEqual({ exploredBrightness: 0.8, showGrid: false, showNames: true })
    savePlayerSettings(guardado, { ...DEFAULT_PLAYER_SETTINGS, followOwnToken: false })
    expect(loadPlayerSettings(guardado).followOwnToken).toBe(false)
  })
})

describe('PlayerPanel: o interruptor "Câmera segue minha ficha"', () => {
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

  function render(settings: PlayerViewSettings, onSettingsChange: (next: PlayerViewSettings) => void): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 'tok-fabi', name: 'Fabi' }]}
          characterColor="#3b82f6"
          settings={settings}
          onSettingsChange={onSettingsChange}
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
        />,
      ),
    )
  }

  /** A caixinha pelo rótulo, como o leitor de tela a anuncia. */
  function interruptor(): HTMLInputElement {
    const rotulo = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === ROTULO)
    const caixa = rotulo?.querySelector('input')
    if (!(caixa instanceof HTMLInputElement)) throw new Error(`o Painel não tem o interruptor "${ROTULO}"`)
    return caixa
  }

  it('no notebook (mouse), sem escolha salva, aparece desligado; marcar liga e guarda o resto dos ajustes', () => {
    aparelho('mouse')
    const onSettingsChange = vi.fn()
    const ajustes: PlayerViewSettings = { ...DEFAULT_PLAYER_SETTINGS, exploredBrightness: 0.7 }
    render(ajustes, onSettingsChange)
    const caixa = interruptor()
    expect(caixa.type).toBe('checkbox')
    expect(caixa.checked).toBe(false)

    act(() => caixa.click())
    expect(onSettingsChange).toHaveBeenCalledTimes(1)
    expect(onSettingsChange).toHaveBeenCalledWith({ ...ajustes, followOwnToken: true })
  })

  it('no celular (dedo), sem escolha salva, aparece ligado; desmarcar desliga', () => {
    aparelho('dedo')
    const onSettingsChange = vi.fn()
    render(DEFAULT_PLAYER_SETTINGS, onSettingsChange)
    const caixa = interruptor()
    expect(caixa.checked).toBe(true)

    act(() => caixa.click())
    expect(onSettingsChange).toHaveBeenCalledWith({ ...DEFAULT_PLAYER_SETTINGS, followOwnToken: false })
  })

  it('a escolha salva manda no que o interruptor mostra', () => {
    aparelho('dedo')
    render({ ...DEFAULT_PLAYER_SETTINGS, followOwnToken: false }, () => {})
    expect(interruptor().checked).toBe(false)
  })
})

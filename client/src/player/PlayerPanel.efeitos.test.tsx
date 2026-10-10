import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageLike } from './playerConnection'
import {
  DEFAULT_PLAYER_SETTINGS,
  PLAYER_SETTINGS_KEY,
  PlayerPanel,
  efeitosDoMapaLigados,
  loadPlayerSettings,
  savePlayerSettings,
  type PlayerViewSettings,
} from './PlayerPanel'

/**
 * "Efeitos do mapa", no Painel: o modo leve do relevo (`lib/relevo.ts`) que o
 * jogador escolhe no celular fraco. Ligado até ele desligar; só a escolha feita
 * vai para o armazenamento.
 */

const ROTULO = 'Efeitos do mapa'

function memoria(inicial: Record<string, string> = {}): StorageLike {
  const dados = { ...inicial }
  return {
    getItem: (key) => dados[key] ?? null,
    setItem: (key, value) => {
      dados[key] = value
    },
    removeItem: (key) => {
      delete dados[key]
    },
  }
}

describe('efeitosDoMapaLigados e o ajuste salvo', () => {
  it('sem escolha: ligados; a escolha do jogador manda', () => {
    expect(efeitosDoMapaLigados(DEFAULT_PLAYER_SETTINGS)).toBe(true)
    expect(efeitosDoMapaLigados({ ...DEFAULT_PLAYER_SETTINGS, mapEffects: false })).toBe(false)
    expect(efeitosDoMapaLigados({ ...DEFAULT_PLAYER_SETTINGS, mapEffects: true })).toBe(true)
  })

  it('armazenamento: booleano volta; ausente ou torto volta sem o campo (ligado)', () => {
    expect(loadPlayerSettings(memoria({ [PLAYER_SETTINGS_KEY]: JSON.stringify({ mapEffects: false }) })).mapEffects).toBe(false)
    expect(loadPlayerSettings(memoria({ [PLAYER_SETTINGS_KEY]: JSON.stringify({ mapEffects: 'nao' }) })).mapEffects).toBeUndefined()
    expect(loadPlayerSettings(memoria()).mapEffects).toBeUndefined()
    const guardado = memoria()
    savePlayerSettings(guardado, { ...DEFAULT_PLAYER_SETTINGS, mapEffects: false })
    expect(loadPlayerSettings(guardado).mapEffects).toBe(false)
  })
})

describe('PlayerPanel: o interruptor "Efeitos do mapa"', () => {
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

  function render(settings: PlayerViewSettings, onSettingsChange: (next: PlayerViewSettings) => void): HTMLInputElement {
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
        />,
      ),
    )
    const rotulo = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === ROTULO)
    const caixa = rotulo?.querySelector('input')
    if (!(caixa instanceof HTMLInputElement)) throw new Error(`o Painel não tem o interruptor "${ROTULO}"`)
    return caixa
  }

  it('aparece ligado sem escolha; desmarcar avisa o desligado e guarda o resto dos ajustes', () => {
    const onSettingsChange = vi.fn()
    const ajustes: PlayerViewSettings = { ...DEFAULT_PLAYER_SETTINGS, showGrid: true }
    const caixa = render(ajustes, onSettingsChange)
    expect(caixa.type).toBe('checkbox')
    expect(caixa.checked).toBe(true)
    act(() => caixa.click())
    expect(onSettingsChange).toHaveBeenCalledWith({ ...ajustes, mapEffects: false })
  })

  it('desligado pelo jogador: aparece desmarcado', () => {
    expect(render({ ...DEFAULT_PLAYER_SETTINGS, mapEffects: false }, () => {}).checked).toBe(false)
  })
})

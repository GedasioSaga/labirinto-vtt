import { useEffect, useId, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { StorageLike } from './playerConnection'

// Painel do jogador: meus personagens, ajustes de visão e centralizar a câmera.
// Fica sobre o canvas (não ao lado) para o enquadramento do mapa não depender
// da largura do painel; abaixo de 700 px vira um botão que abre uma gaveta.

export interface PlayerViewSettings {
  /** Quanto do explorado fora da visão continua visível: 1 − alpha da camada escurecida. */
  exploredBrightness: number
  showGrid: boolean
  /** Nomes das salas, textos da ferramenta Texto e rótulos dos tokens. */
  showNames: boolean
}

export const EXPLORED_BRIGHTNESS_MIN = 0.3
export const EXPLORED_BRIGHTNESS_MAX = 0.8
const EXPLORED_BRIGHTNESS_STEP = 0.05
export const DEFAULT_PLAYER_SETTINGS: PlayerViewSettings = { exploredBrightness: 0.55, showGrid: true, showNames: true }
export const PLAYER_SETTINGS_KEY = 'labirinto.jogador.ajustes'

export interface PlayerCharacter {
  id: string
  name: string
}

function clampBrightness(value: number): number {
  return Math.min(EXPLORED_BRIGHTNESS_MAX, Math.max(EXPLORED_BRIGHTNESS_MIN, value))
}

/** Ajuste salvo vem de fora do código: campo ausente ou fora do formato cai no padrão, nunca lança. */
export function loadPlayerSettings(storage: StorageLike | null): PlayerViewSettings {
  let raw: string | null = null
  try {
    raw = storage?.getItem(PLAYER_SETTINGS_KEY) ?? null
  } catch {
    return { ...DEFAULT_PLAYER_SETTINGS }
  }
  if (raw === null) return { ...DEFAULT_PLAYER_SETTINGS }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_PLAYER_SETTINGS }
  }
  if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PLAYER_SETTINGS }
  const { exploredBrightness, showGrid, showNames } = parsed as Record<string, unknown>
  return {
    exploredBrightness:
      typeof exploredBrightness === 'number' && Number.isFinite(exploredBrightness)
        ? clampBrightness(exploredBrightness)
        : DEFAULT_PLAYER_SETTINGS.exploredBrightness,
    showGrid: typeof showGrid === 'boolean' ? showGrid : DEFAULT_PLAYER_SETTINGS.showGrid,
    showNames: typeof showNames === 'boolean' ? showNames : DEFAULT_PLAYER_SETTINGS.showNames,
  }
}

/** Armazenamento cheio ou bloqueado (aba anônima) não pode derrubar a partida. */
export function savePlayerSettings(storage: StorageLike | null, settings: PlayerViewSettings): void {
  try {
    storage?.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Sem persistência: o ajuste vale só nesta aba.
  }
}

interface PlayerPanelProps {
  characters: PlayerCharacter[]
  /** Cor CSS da bolinha: a mesma do token do jogador no canvas. */
  characterColor: string
  settings: PlayerViewSettings
  onSettingsChange: (settings: PlayerViewSettings) => void
  onFocusToken: (tokenId: string) => void
}

export function PlayerPanel({ characters, characterColor, settings, onSettingsChange, onFocusToken }: PlayerPanelProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const brightnessId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function focusToken(tokenId: string) {
    onFocusToken(tokenId)
    // Na gaveta o painel cobre o mapa: fecha para mostrar onde a câmera foi. No desktop não tem efeito.
    setOpen(false)
  }

  function changeBrightness(event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value)
    if (Number.isFinite(value)) onSettingsChange({ ...settings, exploredBrightness: clampBrightness(value) })
  }

  const first = characters[0]

  return (
    <>
      <button
        type="button"
        className="pp-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Fechar painel' : 'Painel'}
      </button>
      <aside id={panelId} className={open ? 'pp-panel is-open' : 'pp-panel'} aria-label="Painel do jogador">
        <section className="pp-section" aria-labelledby={`${panelId}-chars`}>
          <h2 id={`${panelId}-chars`} className="pp-heading">
            Meus personagens
          </h2>
          {characters.length === 0 ? (
            <p className="pp-empty">Nenhum personagem seu no mapa.</p>
          ) : (
            <ul className="pp-list">
              {characters.map((character) => (
                <li key={character.id}>
                  <button
                    type="button"
                    className="pp-character"
                    aria-label={`Centralizar em ${character.name}`}
                    onClick={() => focusToken(character.id)}
                  >
                    <span className="pp-dot" style={{ background: characterColor }} aria-hidden="true" />
                    <span className="pp-character__name">{character.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="pp-button" disabled={first === undefined} onClick={() => first && focusToken(first.id)}>
            Centralizar no meu personagem
          </button>
        </section>

        <section className="pp-section" aria-labelledby={`${panelId}-vision`}>
          <h2 id={`${panelId}-vision`} className="pp-heading">
            Visão
          </h2>
          <div className="pp-field">
            <label htmlFor={brightnessId} className="pp-field__row">
              <span>Brilho do explorado</span>
              {/* span, não <output>: <output> tem papel implícito "status" e se confundiria com as mensagens de conexão da página. */}
              <span className="pp-value">{Math.round(settings.exploredBrightness * 100)}%</span>
            </label>
            <input
              id={brightnessId}
              className="pp-range"
              type="range"
              min={EXPLORED_BRIGHTNESS_MIN}
              max={EXPLORED_BRIGHTNESS_MAX}
              step={EXPLORED_BRIGHTNESS_STEP}
              value={settings.exploredBrightness}
              onChange={changeBrightness}
            />
          </div>
          <label className="pp-check">
            <input type="checkbox" checked={settings.showGrid} onChange={(e) => onSettingsChange({ ...settings, showGrid: e.target.checked })} />
            <span>Grade</span>
          </label>
          <label className="pp-check">
            <input type="checkbox" checked={settings.showNames} onChange={(e) => onSettingsChange({ ...settings, showNames: e.target.checked })} />
            <span>Nomes</span>
          </label>
        </section>
      </aside>
    </>
  )
}

import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { RoomMeta } from '../types/map'
import { MIN_ROOM_DIMENSION } from '../lib/roomOps'
import { Toggle } from './Toggle'

export interface RoomControlsProps {
  name: string
  onNameChange: (name: string) => void
  /** Verdadeiro só logo depois de desenhar a Sala: foca e seleciona o Nome
   *  para o usuário digitar direto. `onAutoFocusDone` avisa o App para
   *  desligar, senão reselecionar a sala depois roubaria o foco de novo. */
  autoFocusName?: boolean
  onAutoFocusDone?: () => void
  /** Ctrl+Z / Ctrl+Y com o Nome recém-focado e ainda sem digitação: o
   *  usuário quer desfazer o desenho, não um texto que ele não escreveu. */
  onHistoryKey?: (action: 'undo' | 'redo') => void
  /** A5 — `RoomMeta.nameHiddenFromPlayers`. O toggle mostra o inverso
   *  ("Jogadores veem o nome", ligado por padrão). Ausente omite o toggle. */
  nameHiddenFromPlayers?: boolean
  onNameHiddenFromPlayersChange?: (hidden: boolean) => void
  /** 'polygon' (Sala Circular/Polígono Regular) esconde os campos de
   *  largura/altura — resize numérico só vale pra 'rect' (ver
   *  RoomMeta.shape em types/map.ts e lib/roomOps.ts). O nome continua
   *  editável nos dois casos. */
  shape: RoomMeta['shape']
  width: number
  height: number
  onWidthChange: (width: number) => void
  onHeightChange: (height: number) => void
}

/**
 * Identidade e dimensão de uma Sala (`Region.room` definido). Resize por
 * canto arrastável vive em `pixi/drawRoomHandles.ts` (desenho) +
 * `lib/roomOps.ts` (`findRoomCornerAt`, hit-test, chamado pelo PixiCanvas) —
 * os campos numéricos aqui e o arrasto de canto convergem na MESMA função de
 * geometria (`lib/roomOps.ts` → `resizeRoomCorner`/`resizeRoomDimensions`),
 * então os dois jeitos de redimensionar nunca divergem.
 *
 * `width`/`height` já vêm calculados pelo chamador via `roomDimensions`
 * (`lib/roomOps.ts`) a partir de `region.points` — este componente só exibe
 * e repassa o número editado, não faz geometria.
 */
export function RoomControls({
  name,
  onNameChange,
  autoFocusName = false,
  onAutoFocusDone,
  onHistoryKey,
  nameHiddenFromPlayers,
  onNameHiddenFromPlayersChange,
  shape,
  width,
  height,
  onWidthChange,
  onHeightChange,
}: RoomControlsProps) {
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  // Verdadeiro entre o foco automático e a primeira edição. O atalho global
  // de desfazer ignora campos de texto; sem isto, Ctrl+Z logo depois de
  // desenhar a Sala caía no campo e a Sala não era desfeita.
  const pristineAutoFocusRef = useRef(false)

  useEffect(() => {
    if (!autoFocusName) return
    const input = nameInputRef.current
    if (input) {
      input.focus()
      // Selecionado: a primeira tecla substitui o "Sala" padrão.
      input.select()
      pristineAutoFocusRef.current = true
    }
    onAutoFocusDone?.()
  }, [autoFocusName, onAutoFocusDone])

  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!pristineAutoFocusRef.current || !(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    const action = key === 'y' || (key === 'z' && event.shiftKey) ? 'redo' : key === 'z' ? 'undo' : null
    if (action === null) return
    event.preventDefault()
    pristineAutoFocusRef.current = false
    event.currentTarget.blur()
    onHistoryKey?.(action)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Sala</h2>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-room-name">
          Nome
        </label>
        <input
          ref={nameInputRef}
          id="lb-room-name"
          className="lb-input"
          value={name}
          onKeyDown={onNameKeyDown}
          onChange={(event) => {
            pristineAutoFocusRef.current = false
            onNameChange(event.target.value)
          }}
          onBlur={() => {
            pristineAutoFocusRef.current = false
          }}
        />
      </div>

      {nameHiddenFromPlayers !== undefined && onNameHiddenFromPlayersChange !== undefined && (
        <Toggle
          label="Jogadores veem o nome"
          checked={!nameHiddenFromPlayers}
          onChange={(visible) => onNameHiddenFromPlayersChange(!visible)}
        />
      )}

      {shape === 'rect' && (
        <>
          <div className="lb-field">
            <label className="lb-label" htmlFor="lb-room-width">
              Largura
            </label>
            <div className="lb-inputgroup">
              <input
                id="lb-room-width"
                className="lb-input"
                type="number"
                min={MIN_ROOM_DIMENSION}
                step={1}
                value={Math.round(width)}
                onChange={(event) => onWidthChange(Number(event.target.value))}
              />
              <span className="lb-inputgroup__suffix">px</span>
            </div>
          </div>

          <div className="lb-field">
            <label className="lb-label" htmlFor="lb-room-height">
              Altura
            </label>
            <div className="lb-inputgroup">
              <input
                id="lb-room-height"
                className="lb-input"
                type="number"
                min={MIN_ROOM_DIMENSION}
                step={1}
                value={Math.round(height)}
                onChange={(event) => onHeightChange(Number(event.target.value))}
              />
              <span className="lb-inputgroup__suffix">px</span>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

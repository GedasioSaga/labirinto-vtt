import type { RoomMeta } from '../types/map'
import { MIN_ROOM_DIMENSION } from '../lib/roomOps'

export interface RoomControlsProps {
  name: string
  onNameChange: (name: string) => void
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
export function RoomControls({ name, onNameChange, shape, width, height, onWidthChange, onHeightChange }: RoomControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Sala</h2>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-room-name">
          Nome
        </label>
        <input
          id="lb-room-name"
          className="lb-input"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>

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

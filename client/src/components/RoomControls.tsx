import { useId } from 'react'
import type { RoomMeta } from '../types/map'
import { MIN_ROOM_DIMENSION } from '../lib/roomOps'
import { Toggle } from './Toggle'

export interface RoomControlsProps {
  name: string
  onNameChange: (name: string) => void
  /** A5 — `RoomMeta.nameHiddenFromPlayers`. O toggle mostra o inverso
   *  ("Jogadores veem o nome", ligado por padrão). Ausente omite o toggle. */
  nameHiddenFromPlayers?: boolean
  onNameHiddenFromPlayersChange?: (hidden: boolean) => void
  /** TETO DE CONSTRUÇÃO — `RoomMeta.roof`. Aqui o toggle é DIRETO ("Teto
   *  fechado para jogadores", desligado por padrão): o irmão acima mostra o
   *  inverso porque o padrão dele é "ligado", e inverter os dois deixaria um
   *  interruptor com o nome negado sem motivo. Ausente omite o toggle. */
  roof?: boolean
  onRoofChange?: (roof: boolean) => void
  /** 'polygon' (Sala Circular/Polígono Regular) esconde os campos de
   *  largura/altura — resize numérico só vale pra 'rect' (ver
   *  RoomMeta.shape em types/map.ts e lib/roomOps.ts). O nome continua
   *  editável nos dois casos. */
  shape: RoomMeta['shape']
  width: number
  height: number
  onWidthChange: (width: number) => void
  onHeightChange: (height: number) => void
  /** Sub-sala: nome da sala de fora ("Sala sem nome" se vazio). Ausente = sala de topo. */
  parentName?: string
  /** "Criar sala dentro": arma a ferramenta Sala com esta sala como mãe. Ausente omite o botão. */
  onCreateRoomInside?: () => void
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
 *
 * O Nome aqui nunca ganha foco sozinho: logo depois de desenhar, o nome é
 * pedido num campo sobre a própria Sala (`pixi/PixiCanvas.tsx`). Um foco
 * escondido neste painel fazia a próxima tecla de atalho (V) renomear a Sala.
 */
export function RoomControls({
  name,
  onNameChange,
  nameHiddenFromPlayers,
  onNameHiddenFromPlayersChange,
  roof,
  onRoofChange,
  shape,
  width,
  height,
  onWidthChange,
  onHeightChange,
  parentName,
  onCreateRoomInside,
}: RoomControlsProps) {
  const roofHintId = `${useId()}-roof-hint`
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Sala</h2>

      {parentName !== undefined && (
        <p className="lb-label" data-testid="room-parent">
          Dentro de: {parentName}
        </p>
      )}

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-room-name">
          Nome
        </label>
        <input id="lb-room-name" className="lb-input" value={name} onChange={(event) => onNameChange(event.target.value)} />
      </div>

      {nameHiddenFromPlayers !== undefined && onNameHiddenFromPlayersChange !== undefined && (
        <Toggle
          label="Jogadores veem o nome"
          checked={!nameHiddenFromPlayers}
          onChange={(visible) => onNameHiddenFromPlayersChange(!visible)}
        />
      )}

      {roof !== undefined && onRoofChange !== undefined && (
        <>
          <Toggle label="Teto fechado para jogadores" checked={roof} onChange={onRoofChange} describedBy={roofHintId} />
          <p className="lb-field__hint" id={roofHintId}>
            De fora o jogador vê só a silhueta do prédio; ele entra e o teto abre. Você continua vendo tudo.
          </p>
        </>
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

      {onCreateRoomInside !== undefined && (
        <button type="button" className="lb-btn lb-btn--block" onClick={onCreateRoomInside}>
          Criar sala dentro
        </button>
      )}
    </section>
  )
}

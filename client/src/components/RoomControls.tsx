import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { RoomMeta } from '../types/map'
import { MIN_ROOM_DIMENSION } from '../lib/roomOps'
import { ROTATION_SHIFT_STEP } from '../lib/roomRotation'
import { ROOM_TEXT_MAX_LENGTH } from '../lib/roomText'
import { Toggle } from './Toggle'
import { HazardControls, type HazardControlsProps } from './HazardControls'
import { ConveyorControls, type ConveyorControlsProps } from './ConveyorControls'

/** Passo dos botões do painel: deitar ou pôr em pé, o giro que mais se faz num mapa de masmorra. */
const QUARTO_DE_VOLTA = 90

/** O ângulo como o campo mostra: inteiro quando é inteiro, senão uma casa ("37,5" chega como 37.5). */
function formatRotationField(degrees: number): string {
  return String(Math.round(degrees * 10) / 10)
}

/** O número que está digitado no campo; vazio ou lixo = nada a confirmar. Aceita vírgula. */
function parseRotationText(text: string | null): number | null {
  if (text === null || text.trim() === '') return null
  const typed = Number(text.replace(',', '.'))
  return Number.isFinite(typed) ? typed : null
}

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
  /** TEXTO DA SALA — `RoomMeta.textoAoEntrar` ("Ao entrar, o jogador lê").
   *  Sem `onTextoAoEntrarChange` o campo não aparece. */
  textoAoEntrar?: string
  onTextoAoEntrarChange?: (text: string) => void
  /** `RoomMeta.notaDoMestre` — nunca sai para o jogador. Sem `onNotaDoMestreChange` o campo não aparece. */
  notaDoMestre?: string
  onNotaDoMestreChange?: (text: string) => void
  /** 'polygon' (Sala Circular/Polígono Regular) esconde os campos de
   *  largura/altura — resize numérico só vale pra 'rect' (ver
   *  RoomMeta.shape em types/map.ts e lib/roomOps.ts). O nome continua
   *  editável nos dois casos. */
  shape: RoomMeta['shape']
  /** Lados na horizontal/vertical (`isAxisAlignedRect`). Sala 'rect' girada
   *  torta perde largura/altura — a conta a desmontaria — e ganha a frase
   *  que diz como tê-los de volta. */
  axisAligned: boolean
  width: number
  height: number
  onWidthChange: (width: number) => void
  onHeightChange: (height: number) => void
  /** Ângulo acumulado da sala, em (−180, 180] (`RoomMeta.rotation`, 0 se ausente). */
  rotation: number
  /** O campo "Rotação": o ângulo que a pessoa digitou (a store gira pela diferença). */
  onRotationChange: (degrees: number) => void
  /** Os botões −90°/+90° e as setas do campo: girar MAIS `degrees` a partir de onde está. */
  onRotateBy: (degrees: number) => void
  /** Sala travada: o campo e os botões de girar ficam desabilitados, com o motivo escrito. */
  locked: boolean
  /** Sub-sala: nome da sala de fora ("Sala sem nome" se vazio). Ausente = sala de topo. */
  parentName?: string
  /** "Criar sala dentro": arma a ferramenta Sala com esta sala como mãe. Ausente omite o botão. */
  onCreateRoomInside?: () => void
  /** ZONA DE PERIGO da sala (fogo, fumaça, vapor, água). Ausente omite o bloco. */
  hazard?: HazardControlsProps
  /** ESTEIRA da sala (direção, passo e o Avançar). Ausente omite o bloco. */
  conveyor?: ConveyorControlsProps
}

interface RoomRotationFieldProps {
  rotation: number
  onRotationChange: (degrees: number) => void
  onRotateBy: (degrees: number) => void
  locked: boolean
  /** Frase extra embaixo do campo, ligada a ele por `aria-describedby`. */
  note?: string
}

/**
 * "Rotação" da sala: campo em graus e botões −90°/+90°, no padrão visual do
 * campo de rotação de `ItemTransformControls`.
 *
 * Diferente de lá, o campo NÃO gira a cada tecla: digitar "90" passaria por
 * 9° no caminho e deixaria dois Ctrl+Z para um giro só. Enter (ou sair do
 * campo) confirma; Esc desiste do que foi digitado. Seta para cima/baixo gira
 * 1° na hora (Shift: 15°, a mesma trava da alça), como o teclado de um
 * controle deslizante. Fora da digitação o campo acompanha a sala: girar pela
 * alça atualiza o número enquanto o arrasto anda.
 */
function RoomRotationField({ rotation, onRotationChange, onRotateBy, locked, note }: RoomRotationFieldProps) {
  const inputId = useId()
  const lockedHintId = `${inputId}-travada`
  const noteId = `${inputId}-nota`
  // `null` = ninguém está digitando: o campo mostra o ângulo da sala.
  const [draft, setDraftState] = useState<string | null>(null)
  // O mesmo rascunho num ref, para a limpeza de desmontagem (abaixo) ler o que
  // estava digitado — o estado ela veria velho.
  const draftRef = useRef<string | null>(null)
  const setDraft = (text: string | null) => {
    draftRef.current = text
    setDraftState(text)
  }
  const onRotationChangeRef = useRef(onRotationChange)
  useEffect(() => {
    onRotationChangeRef.current = onRotationChange
  })
  // Número digitado e não confirmado, e o campo SOME: outra sala foi escolhida
  // no mapa. O clique no mapa seleciona a outra ANTES de o campo perder o
  // foco, então o `blur` confirmaria o número na sala errada — por isso o
  // painel remonta a cada sala (`key` em `PropertiesPanel`) e é aqui, com o
  // callback do último render DESTE campo, que "sair do campo confirma" vale.
  useEffect(
    () => () => {
      const typed = parseRotationText(draftRef.current)
      if (typed !== null) onRotationChangeRef.current(typed)
    },
    [],
  )

  const commit = () => {
    if (draft === null) return
    const typed = parseRotationText(draft)
    setDraft(null)
    if (typed !== null) onRotationChange(typed)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape' && draft !== null) {
      // Só engole o Esc quando há digitação a desfazer: sem ela, o Esc segue
      // viagem e larga a seleção, como em qualquer campo do painel.
      event.preventDefault()
      event.stopPropagation()
      setDraft(null)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const step = (event.shiftKey ? ROTATION_SHIFT_STEP : 1) * (event.key === 'ArrowUp' ? 1 : -1)
      const base = parseRotationText(draft) ?? rotation
      setDraft(null)
      onRotationChange(base + step)
    }
  }

  const describedBy = [locked ? lockedHintId : null, note ? noteId : null].filter((id) => id !== null).join(' ')

  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={inputId}>
        Rotação
      </label>
      <div className="lb-rotation">
        <div className="lb-inputgroup lb-rotation__value">
          <input
            id={inputId}
            className="lb-input"
            type="number"
            step={1}
            value={draft ?? formatRotationField(rotation)}
            disabled={locked}
            aria-describedby={describedBy || undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={commit}
          />
          <span className="lb-inputgroup__suffix">°</span>
        </div>
        <button
          type="button"
          className="lb-btn lb-rotation__step"
          disabled={locked}
          title="Girar 90° no sentido anti-horário"
          onClick={() => onRotateBy(-QUARTO_DE_VOLTA)}
        >
          −90°
        </button>
        <button
          type="button"
          className="lb-btn lb-rotation__step"
          disabled={locked}
          title="Girar 90° no sentido horário"
          onClick={() => onRotateBy(QUARTO_DE_VOLTA)}
        >
          +90°
        </button>
      </div>
      {locked && (
        <p className="lb-field__hint" id={lockedHintId}>
          Sala travada. Desligue Travado, mais abaixo, para girar.
        </p>
      )}
      {note && (
        <p className="lb-field__hint" id={noteId}>
          {note}
        </p>
      )}
    </div>
  )
}

/** Por que a Sala retangular torta está sem largura/altura, e como tê-las de volta. */
const NOTA_SALA_TORTA = 'Largura e altura voltam quando a sala fica reta: 0°, 90°, 180° ou −90°.'

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
 *
 * A Rotação vale para toda Sala, de qualquer forma, e é o par numérico da
 * alça de girar do mapa (`pixi/roomRotateGesture.ts`): os dois terminam em
 * `lib/mapFactory.ts` → `rotateRegion`, então nunca divergem.
 */
export function RoomControls({
  name,
  onNameChange,
  nameHiddenFromPlayers,
  onNameHiddenFromPlayersChange,
  roof,
  onRoofChange,
  textoAoEntrar,
  onTextoAoEntrarChange,
  notaDoMestre,
  onNotaDoMestreChange,
  shape,
  axisAligned,
  width,
  height,
  onWidthChange,
  onHeightChange,
  rotation,
  onRotationChange,
  onRotateBy,
  locked,
  parentName,
  onCreateRoomInside,
  hazard,
  conveyor,
}: RoomControlsProps) {
  const baseId = useId()
  const roofHintId = `${baseId}-roof-hint`
  const enterTextId = `${baseId}-texto-ao-entrar`
  const enterHintId = `${baseId}-texto-ao-entrar-hint`
  const noteId = `${baseId}-nota-do-mestre`
  const noteHintId = `${baseId}-nota-do-mestre-hint`
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

      {onTextoAoEntrarChange !== undefined && (
        <div className="lb-field">
          <label className="lb-label" htmlFor={enterTextId}>
            Ao entrar, o jogador lê
          </label>
          <textarea
            id={enterTextId}
            className="lb-input lb-textarea"
            rows={3}
            maxLength={ROOM_TEXT_MAX_LENGTH}
            value={textoAoEntrar ?? ''}
            aria-describedby={enterHintId}
            onChange={(event) => onTextoAoEntrarChange(event.target.value)}
          />
          <p className="lb-field__hint" id={enterHintId}>
            Aparece só para quem entra, na primeira vez. Tocar no nome da sala mostra de novo.
          </p>
        </div>
      )}

      {onNotaDoMestreChange !== undefined && (
        <div className="lb-field">
          <label className="lb-label" htmlFor={noteId}>
            Nota do mestre
          </label>
          <textarea
            id={noteId}
            className="lb-input lb-textarea"
            rows={3}
            maxLength={ROOM_TEXT_MAX_LENGTH}
            value={notaDoMestre ?? ''}
            aria-describedby={noteHintId}
            onChange={(event) => onNotaDoMestreChange(event.target.value)}
          />
          <p className="lb-field__hint" id={noteHintId}>
            Só você lê. Nunca vai para a tela dos jogadores.
          </p>
        </div>
      )}

      {hazard !== undefined && <HazardControls {...hazard} />}

      {conveyor !== undefined && <ConveyorControls {...conveyor} />}

      {shape === 'rect' && axisAligned && (
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

      <RoomRotationField
        rotation={rotation}
        onRotationChange={onRotationChange}
        onRotateBy={onRotateBy}
        locked={locked}
        note={shape === 'rect' && !axisAligned ? NOTA_SALA_TORTA : undefined}
      />

      {onCreateRoomInside !== undefined && (
        <button type="button" className="lb-btn lb-btn--block" onClick={onCreateRoomInside}>
          Criar sala dentro
        </button>
      )}
    </section>
  )
}

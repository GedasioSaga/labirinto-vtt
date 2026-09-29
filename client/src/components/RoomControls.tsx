import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { RoomMeta } from '../types/map'
import { MIN_ROOM_DIMENSION } from '../lib/roomOps'
import { ROTATION_SHIFT_STEP } from '../lib/roomRotation'
import { ROOM_TEXT_MAX_LENGTH } from '../lib/roomText'
import { FACCAO_MAX_LENGTH } from '../lib/faccoes'
import { VISION_RADIUS_MAX, VISION_RADIUS_MIN, VISION_RADIUS_STEP } from '../net/hostSession'
import type { RoomLabelStyle, RoomLabelStylePatch } from '../lib/roomLabelStyle'
import { Toggle } from './Toggle'
import { RoomLabelStyleControls } from './RoomLabelStyleControls'
import { HazardControls, type HazardControlsProps } from './HazardControls'
import { ConveyorControls, type ConveyorControlsProps } from './ConveyorControls'
import './RoomControls.css'

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
  /** ESTILO DO TÍTULO — plaquinha, tamanho, cor e orientação do nome no mapa
   *  (`lib/roomLabelStyle.ts`). Sem `onLabelStyleChange` o bloco não aparece. */
  labelStyle?: RoomLabelStyle
  onLabelStyleChange?: (patch: RoomLabelStylePatch) => void
  /** TETO DE CONSTRUÇÃO — `RoomMeta.roof`. Aqui o toggle é DIRETO ("Teto
   *  fechado para jogadores", desligado por padrão): o irmão acima mostra o
   *  inverso porque o padrão dele é "ligado", e inverter os dois deixaria um
   *  interruptor com o nome negado sem motivo. Ausente omite o toggle. */
  roof?: boolean
  onRoofChange?: (roof: boolean) => void
  /** CÔMODO LEMBRADO — `RoomMeta.comodo`, toggle direto e desligado por
   *  padrão, como o do teto logo acima. Ligar um desliga o outro (quem garante
   *  é `lib/mapFactory.ts`). Sem `onComodoChange` o toggle não aparece. */
  comodo?: boolean
  onComodoChange?: (comodo: boolean) => void
  /** TEXTO DA SALA — `RoomMeta.textoAoEntrar` ("Ao entrar, o jogador lê").
   *  Sem `onTextoAoEntrarChange` o campo não aparece. */
  textoAoEntrar?: string
  onTextoAoEntrarChange?: (text: string) => void
  /** `RoomMeta.notaDoMestre` — nunca sai para o jogador. Sem `onNotaDoMestreChange` o campo não aparece. */
  notaDoMestre?: string
  onNotaDoMestreChange?: (text: string) => void
  /** SALA ESCURA — `RoomMeta.dark`. Toggle direto ("Sala escura", desligado
   *  por padrão), como o do teto. Ausente omite o toggle. */
  dark?: boolean
  onDarkChange?: (dark: boolean) => void
  /** FACÇÃO — `RoomMeta.faccao`, o que foi digitado. Sem `onFaccaoChange` o campo não aparece. */
  faccao?: string
  onFaccaoChange?: (faccao: string) => void
  /** Sala sem facção própria dentro de um distrito: quem manda nele (a dica diz de quem herda). */
  faccaoHerdada?: string
  /** Facções que já existem no mapa: viram sugestões do campo, para "Guarda" não virar "guarda". */
  faccoesConhecidas?: readonly string[]
  /** "Raio de visão aqui" — `RoomMeta.raioDeVisao`; `null` = vale o raio do
   *  jogador. Sem `onRaioDeVisaoChange` o campo não aparece. */
  raioDeVisao?: number | null
  onRaioDeVisaoChange?: (raio: number | null) => void
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

/** O raio que está digitado: vazio = volta ao do jogador; lixo = nada a confirmar; número = dentro dos limites do raio. */
function parseVisionRadiusText(text: string): number | null | undefined {
  if (text.trim() === '') return null
  const typed = Number(text.replace(',', '.'))
  if (!Number.isFinite(typed)) return undefined
  return Math.min(VISION_RADIUS_MAX, Math.max(VISION_RADIUS_MIN, Math.round(typed)))
}

interface RoomVisionRadiusFieldProps {
  raioDeVisao: number | null
  onRaioDeVisaoChange: (raio: number | null) => void
  /** Id da frase que explica o campo: vem de fora porque a linha "+" do opcional também a lê. */
  hintId: string
}

/**
 * "Raio de visão aqui": enquanto a ficha do jogador está na Sala, este raio
 * vence o dele (`lib/fogFilter.ts`). Como a Rotação, grava só no Enter ou ao
 * sair do campo — digitar "700" passaria por 7, que o limite viraria 50 — e
 * Esc desiste. O painel remonta a cada sala, então o número digitado e não
 * confirmado vai para a sala DESTE campo ao desmontar.
 */
function RoomVisionRadiusField({ raioDeVisao, onRaioDeVisaoChange, hintId }: RoomVisionRadiusFieldProps) {
  const inputId = useId()
  const [draft, setDraftState] = useState<string | null>(null)
  const draftRef = useRef<string | null>(null)
  const setDraft = (text: string | null) => {
    draftRef.current = text
    setDraftState(text)
  }
  const onChangeRef = useRef(onRaioDeVisaoChange)
  useEffect(() => {
    onChangeRef.current = onRaioDeVisaoChange
  })
  useEffect(
    () => () => {
      if (draftRef.current === null) return
      const typed = parseVisionRadiusText(draftRef.current)
      if (typed !== undefined) onChangeRef.current(typed)
    },
    [],
  )

  const commit = () => {
    if (draft === null) return
    const typed = parseVisionRadiusText(draft)
    setDraft(null)
    if (typed !== undefined && typed !== raioDeVisao) onRaioDeVisaoChange(typed)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape' && draft !== null) {
      event.preventDefault()
      event.stopPropagation()
      setDraft(null)
    }
  }

  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={inputId}>
        Raio de visão aqui
      </label>
      <div className="lb-inputgroup">
        <input
          id={inputId}
          className="lb-input"
          type="number"
          min={VISION_RADIUS_MIN}
          max={VISION_RADIUS_MAX}
          step={VISION_RADIUS_STEP}
          placeholder="o do jogador"
          value={draft ?? (raioDeVisao === null ? '' : String(raioDeVisao))}
          aria-describedby={hintId}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
        <span className="lb-inputgroup__suffix">px</span>
      </div>
      <p className="lb-field__hint" id={hintId}>
        Com a ficha aqui dentro, o jogador enxerga até esta distância: maior num mirante, menor num caracol. Vazio usa o raio do jogador.
      </p>
    </div>
  )
}

/** O "+" das linhas de opcional: só desenho (quem dá nome à linha é o texto dela), no traço da família de `icons.tsx`. */
function PlusGlyph() {
  return (
    <span className="lb-room-opt__plus" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" focusable="false">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </span>
  )
}

/** O primeiro controle que o teclado alcança dentro do campo recém-aberto. */
const CONTROLE_FOCAVEL = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'

/** Texto com letra de verdade: só espaço não conta como preenchido. */
function temTexto(texto: string | undefined): boolean {
  return (texto ?? '').trim() !== ''
}

interface OpcionalDaSalaProps {
  /** O nome do campo, igual ao rótulo que ele mostra aberto: a linha e o campo são a mesma coisa. */
  rotulo: string
  /** Já tem valor: nasce aberto, e abre sozinho se o valor chegar depois (um desfazer, por exemplo). */
  preenchido: boolean
  /** A frase que explica o campo, lida também pela linha "+" antes de abrir. */
  dicaId?: string
  children: ReactNode
}

/**
 * Opcional da Sala no molde do Figma UI3 ("Click Add stroke in the Stroke
 * section"): vazio, é UMA linha com "+"; o "+" abre o campo de verdade já com
 * o foco nele, para a próxima tecla ir para o campo. Com valor, nasce aberto.
 *
 * Fechado, o campo continua no DOM sob `hidden` (o molde de
 * `CollapsibleSection`): fora da vista e da ordem de Tab, mas com a frase que
 * o explica no mesmo lugar, ligada ao campo e à linha "+" por
 * `aria-describedby`. Aberto uma vez, fica aberto até a sala sair do painel,
 * mesmo esvaziado: apagar o texto (ou escolher "Nenhum" no perigo) não pode
 * sumir com o campo debaixo do cursor. O painel remonta a cada sala (`key` em
 * `PropertiesPanel`), e aí volta a valer o que está gravado.
 */
function OpcionalDaSala({ rotulo, preenchido, dicaId, children }: OpcionalDaSalaProps) {
  const corpoId = `${useId()}-corpo`
  const corpoRef = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(preenchido)
  // Valor que chega com o campo fechado (um desfazer) abre o campo — ajuste de
  // estado no próprio render, o molde do React para estado que segue uma prop.
  if (preenchido && !aberto) setAberto(true)
  // Só o clique no "+" leva o foco: o valor que chega por fora abre o campo
  // sem roubar o foco de quem está em outro lugar.
  const focarAoAbrir = useRef(false)

  // Antes da pintura: o botão "+" some neste mesmo commit, e o foco não pode
  // ficar um quadro no `body` (o anel piscaria e a tecla seguinte se perderia).
  useLayoutEffect(() => {
    if (!aberto || !focarAoAbrir.current) return
    focarAoAbrir.current = false
    corpoRef.current?.querySelector<HTMLElement>(CONTROLE_FOCAVEL)?.focus()
  }, [aberto])

  return (
    <div className="lb-room-opt">
      {!aberto && (
        <button
          type="button"
          className="lb-room-opt__add"
          aria-expanded={false}
          aria-controls={corpoId}
          aria-describedby={dicaId}
          onClick={() => {
            focarAoAbrir.current = true
            setAberto(true)
          }}
        >
          <span>{rotulo}</span>
          <PlusGlyph />
        </button>
      )}
      <div id={corpoId} ref={corpoRef} className="lb-room-opt__body" hidden={!aberto}>
        {children}
      </div>
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
 *
 * ORDEM DA TAREFA (o painel de propriedades do Figma UI3, aba Design): o que
 * se mexe logo depois de desenhar vem primeiro — Nome, Largura | Altura numa
 * linha, Rotação —, depois os interruptores do que o jogador vê, e por último
 * o que se ACRESCENTA à sala (texto ao entrar, nota, facção, raio de visão,
 * perigo, esteira, sala dentro), cada um vazio numa linha só com "+"
 * (`OpcionalDaSala`). Até 26/09/2026 Largura, Altura e Rotação moravam depois
 * de todos esses, a 8–10 giros de roda do topo em 1280x800.
 */
export function RoomControls({
  name,
  onNameChange,
  nameHiddenFromPlayers,
  onNameHiddenFromPlayersChange,
  labelStyle,
  onLabelStyleChange,
  roof,
  onRoofChange,
  comodo,
  onComodoChange,
  textoAoEntrar,
  onTextoAoEntrarChange,
  notaDoMestre,
  onNotaDoMestreChange,
  dark,
  onDarkChange,
  faccao,
  onFaccaoChange,
  faccaoHerdada,
  faccoesConhecidas,
  raioDeVisao,
  onRaioDeVisaoChange,
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
  const comodoHintId = `${baseId}-comodo-hint`
  const enterTextId = `${baseId}-texto-ao-entrar`
  const enterHintId = `${baseId}-texto-ao-entrar-hint`
  const noteId = `${baseId}-nota-do-mestre`
  const noteHintId = `${baseId}-nota-do-mestre-hint`
  const darkHintId = `${baseId}-dark-hint`
  const faccaoId = `${baseId}-faccao`
  const faccaoHintId = `${baseId}-faccao-hint`
  const faccaoListId = `${baseId}-faccao-lista`
  const raioHintId = `${baseId}-raio-de-visao-hint`
  const showNameToggle = nameHiddenFromPlayers !== undefined && onNameHiddenFromPlayersChange !== undefined
  const showRoof = roof !== undefined && onRoofChange !== undefined
  const showComodo = onComodoChange !== undefined
  const showDark = dark !== undefined && onDarkChange !== undefined
  const hasExtras =
    onTextoAoEntrarChange !== undefined ||
    onNotaDoMestreChange !== undefined ||
    onFaccaoChange !== undefined ||
    onRaioDeVisaoChange !== undefined ||
    hazard !== undefined ||
    conveyor !== undefined ||
    onCreateRoomInside !== undefined
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

      {labelStyle !== undefined && onLabelStyleChange !== undefined && (
        <RoomLabelStyleControls style={labelStyle} onChange={onLabelStyleChange} />
      )}

      {shape === 'rect' && axisAligned && (
        <div className="lb-room-dims">
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
        </div>
      )}

      <RoomRotationField
        rotation={rotation}
        onRotationChange={onRotationChange}
        onRotateBy={onRotateBy}
        locked={locked}
        note={shape === 'rect' && !axisAligned ? NOTA_SALA_TORTA : undefined}
      />

      {(showNameToggle || showRoof || showComodo || showDark) && (
        <div className="lb-room-switches">
          {showNameToggle && (
            <Toggle
              label="Jogadores veem o nome"
              checked={!nameHiddenFromPlayers}
              onChange={(visible) => onNameHiddenFromPlayersChange(!visible)}
            />
          )}

          {showRoof && (
            <div className="lb-room-switch">
              <Toggle label="Teto fechado para jogadores" checked={roof} onChange={onRoofChange} describedBy={roofHintId} />
              <p className="lb-field__hint" id={roofHintId}>
                De fora o jogador vê só a silhueta do prédio; ele entra e o teto abre. Você continua vendo tudo.
              </p>
            </div>
          )}

          {showComodo && (
            <div className="lb-room-switch">
              <Toggle label="Cômodo: aparece só depois de visto" checked={comodo === true} onChange={onComodoChange} describedBy={comodoHintId} />
              <p className="lb-field__hint" id={comodoHintId}>
                O jogador não vê este cômodo até entrar ou olhar pela porta. Depois ele fica lembrado, mais apagado, com os pinos de
                dentro.
              </p>
            </div>
          )}

          {showDark && (
            <div className="lb-room-switch">
              <Toggle label="Sala escura" checked={dark} onChange={onDarkChange} describedBy={darkHintId} />
              <p className="lb-field__hint" id={darkHintId}>
                Aqui dentro o jogador só vê a casa em volta da ficha e o que uma Luz ilumina. Você continua vendo tudo.
              </p>
            </div>
          )}
        </div>
      )}

      {hasExtras && (
        <div className="lb-room-extras">
          {onTextoAoEntrarChange !== undefined && (
            <OpcionalDaSala rotulo="Ao entrar, o jogador lê" preenchido={temTexto(textoAoEntrar)} dicaId={enterHintId}>
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
            </OpcionalDaSala>
          )}

          {onNotaDoMestreChange !== undefined && (
            <OpcionalDaSala rotulo="Nota do mestre" preenchido={temTexto(notaDoMestre)} dicaId={noteHintId}>
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
            </OpcionalDaSala>
          )}

          {onFaccaoChange !== undefined && (
            // A facção herdada do distrito também conta como valor: a sala TEM
            // dono, e o campo aberto é o que mostra de quem ela herda.
            <OpcionalDaSala rotulo="Facção" preenchido={temTexto(faccao) || faccaoHerdada !== undefined} dicaId={faccaoHintId}>
              <div className="lb-field">
                <label className="lb-label" htmlFor={faccaoId}>
                  Facção
                </label>
                <input
                  id={faccaoId}
                  className="lb-input"
                  maxLength={FACCAO_MAX_LENGTH}
                  value={faccao ?? ''}
                  placeholder={faccaoHerdada}
                  list={faccaoListId}
                  aria-describedby={faccaoHintId}
                  onChange={(event) => onFaccaoChange(event.target.value)}
                />
                <datalist id={faccaoListId}>
                  {(faccoesConhecidas ?? []).map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>
                <p className="lb-field__hint" id={faccaoHintId}>
                  {faccaoHerdada !== undefined && (faccao ?? '').trim() === ''
                    ? `Herda do distrito: ${faccaoHerdada}. Só você vê.`
                    : 'Quem manda aqui. Só você vê; as salas de dentro herdam.'}
                </p>
              </div>
            </OpcionalDaSala>
          )}

          {onRaioDeVisaoChange !== undefined && (
            <OpcionalDaSala rotulo="Raio de visão aqui" preenchido={raioDeVisao !== undefined && raioDeVisao !== null} dicaId={raioHintId}>
              <RoomVisionRadiusField raioDeVisao={raioDeVisao ?? null} onRaioDeVisaoChange={onRaioDeVisaoChange} hintId={raioHintId} />
            </OpcionalDaSala>
          )}

          {hazard !== undefined && (
            <OpcionalDaSala rotulo="Perigo" preenchido={hazard.kind !== null}>
              <HazardControls {...hazard} />
            </OpcionalDaSala>
          )}

          {conveyor !== undefined && (
            // Mecânica da sala como o perigo: sem direção ("Nenhuma") é uma
            // linha "+"; com esteira ligada nasce aberta, com o Avançar à mão.
            <OpcionalDaSala rotulo="Esteira" preenchido={conveyor.direction !== null}>
              <ConveyorControls {...conveyor} />
            </OpcionalDaSala>
          )}

          {onCreateRoomInside !== undefined && (
            // Já é UMA ação: a linha "+" age na hora (arma a ferramenta Sala
            // com esta sala como mãe), sem campo a abrir. `--acao`: o alvo não
            // encolhe — era um botão de 34 px de altura.
            <button type="button" className="lb-room-opt__add lb-room-opt__add--acao" onClick={onCreateRoomInside}>
              <span>Criar sala dentro</span>
              <PlusGlyph />
            </button>
          )}
        </div>
      )}
    </section>
  )
}

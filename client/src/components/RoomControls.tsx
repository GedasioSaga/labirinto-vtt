import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { RoomMeta } from '../types/map'
import { MIN_ROOM_DIMENSION } from '../lib/roomOps'
import { ROTATION_SHIFT_STEP } from '../lib/roomRotation'
import { ROOM_TEXT_MAX_LENGTH } from '../lib/roomText'
import { FACCAO_MAX_LENGTH } from '../lib/faccoes'
import { VISION_RADIUS_MAX, VISION_RADIUS_MIN, VISION_RADIUS_STEP } from '../net/hostSession'
import { isDefaultRoomLabelStyle, type RoomLabelStyle, type RoomLabelStylePatch } from '../lib/roomLabelStyle'
import { selectNomeNaPilula, useMapStore } from '../stores/mapStore'
import { Toggle } from './Toggle'
import { EstiloDoTelhado } from './EstiloDoTelhado'
import type { RoomRoofStylePatch } from '../lib/mapFactory'
import { MODELO_PADRAO_DO_TETO, corDoTetoOuPadrao, type ModeloDoTeto } from '../lib/telhado/paletas'
import { RoomLabelStyleControls } from './RoomLabelStyleControls'
import { HazardControls, type HazardControlsProps } from './HazardControls'
import { ConveyorControls, type ConveyorControlsProps } from './ConveyorControls'
import { classes } from './grimorio/comum'
import { Fichas } from './grimorio/Ficha'
import { FichaLembrada, type FichaLembradaProps } from './livro/FichaLembrada'
import { IconeDoLivro } from './livro/icones'
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
  /** MODELO E COR DO TELHADO — `RoomMeta.modeloDoTeto` / `corDoTeto` como estão
   *  no mapa (`undefined` === telha barro). Aparecem só com o teto ligado e
   *  `onRoofStyleChange`. */
  modeloDoTeto?: ModeloDoTeto
  corDoTeto?: string
  onRoofStyleChange?: (patch: RoomRoofStylePatch) => void
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
  /** VER ATRAVÉS DAS PAREDES — `RoomMeta.dentroVeFora` ("De dentro, vê lá
   *  fora") e `RoomMeta.foraVeDentro` ("De fora, vê aqui dentro"), toggles
   *  diretos e desligados por padrão. Com o teto ligado o segundo fica
   *  apagado, com o motivo: quem vence é o teto. Ausente omite o toggle. */
  dentroVeFora?: boolean
  onDentroVeForaChange?: (ligado: boolean) => void
  foraVeDentro?: boolean
  onForaVeDentroChange?: (ligado: boolean) => void
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
  /** Id da Sala no mapa: a dica da pílula ("Nomes dos lugares") lê a store por
   *  ele. "Abrir para o corredor" mora no "Mais ações" da cabeça desde a fatia
   *  15 (`abrirCorredorAction`, montado em `PropertiesPanel`). */
  salaId?: string
  /** ZONA DE PERIGO da sala (fogo, fumaça, vapor, água). Ausente omite o opcional. */
  hazard?: HazardControlsProps
  /** ESTEIRA da sala (direção, passo e o Avançar). Ausente omite o opcional. */
  conveyor?: ConveyorControlsProps
  /** Ficha APARÊNCIA: Região, Preenchimento, Duas cores e o Avançado, que o
   *  painel monta sem título (os mesmos blocos da região). Ausente omite a ficha. */
  aparencia?: ReactNode
  /** O resumo da Aparência fechada: "Sólido" ou "Hachurado". */
  resumoDaAparencia?: string
  /** Ficha TRAVA: Travado e Oculto para jogadores, montados pelo painel sem título. Ausente omite a ficha. */
  trava?: ReactNode
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

/**
 * A sala tem estilo de título próprio (Continente de antes da pílula)? A
 * decisão é tomada quando a sala é selecionada e só pode virar `true` depois:
 * arrastar o tamanho de volta a 100% ou clicar "Padrão" deixa o estilo igual
 * ao padrão, e os controles não podem desmontar no meio do gesto (o slider
 * prendia em 1 e o foco sumia). Outra sala refaz a conta.
 */
function useEstiloProprioDaSala(salaId: string | undefined, labelStyle: RoomLabelStyle | undefined): boolean {
  const agora = labelStyle !== undefined && !isDefaultRoomLabelStyle(labelStyle)
  const [congelado, setCongelado] = useState({ salaId, valor: agora })
  const outraSala = congelado.salaId !== salaId
  // Ajuste de estado durante o render (padrão do React para estado derivado de prop): sem efeito, sem um quadro com a decisão velha.
  if (outraSala || (agora && !congelado.valor)) setCongelado({ salaId, valor: agora })
  return outraSala ? agora : congelado.valor || agora
}

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-sala-'

/** O primeiro controle que o teclado alcança dentro do campo recém-aberto. */
const CONTROLE_FOCAVEL = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'

/** Texto com letra de verdade: só espaço não conta como preenchido. */
function temTexto(texto: string | undefined): boolean {
  return (texto ?? '').trim() !== ''
}

/** O sistema pede movimento reduzido? Sem `matchMedia` (o jsdom dos testes) conta como não. */
function movimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Um opcional da ficha Acrescentar: chip "+" enquanto vazio, o campo de verdade depois. */
interface Opcional {
  /** O nome do chip, igual ao rótulo do campo aberto: o chip e o campo são a mesma coisa. */
  rotulo: string
  /** Já tem valor: nasce aberto, e abre sozinho se o valor chegar depois (um desfazer, por exemplo). */
  preenchido: boolean
  /** A frase que explica o campo, lida também pelo chip antes de abrir. */
  dicaId?: string
  campo: ReactNode
}

interface AcrescimosProps {
  opcionais: readonly Opcional[]
  /** "Criar sala dentro": um chip que age na hora (arma a ferramenta Sala com esta sala como mãe). */
  onCreateRoomInside?: () => void
}

/**
 * Ficha ACRESCENTAR (o `extras` do protótipo): vazio, cada opcional é um chip
 * "+"; o chip abre o campo de verdade ACIMA dos chips, já com o foco nele, para
 * a próxima tecla ir para o campo. Com valor, nasce aberto.
 *
 * Fechado, o campo continua no DOM sob `hidden` (o molde de
 * `CollapsibleSection`): fora da vista e da ordem de Tab, mas com a frase que
 * o explica ligada ao chip por `aria-describedby`. Aberto uma vez, fica aberto
 * até a sala sair do painel, mesmo esvaziado: apagar o texto (ou escolher
 * "Nenhum" no perigo) não pode sumir com o campo debaixo do cursor. O painel
 * remonta a cada sala (`key` em `PropertiesPanel`), e aí volta a valer o que
 * está gravado.
 *
 * MOVIMENTO: aberto pelo mouse, o campo sobe 4 px e acende em 180 ms
 * (`gr-entra`, a entrada da ficha nova do pino) e mostra onde o chip foi
 * parar. Pelo teclado, ou com movimento reduzido, aparece na hora: o foco já
 * diz onde ele está, e animar atrasaria a próxima tecla.
 */
function Acrescimos({ opcionais, onCreateRoomInside }: AcrescimosProps) {
  const baseId = useId()
  const idDoCampo = (indice: number) => `${baseId}-opcional-${indice}`
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(
    () => new Set(opcionais.filter((opcional) => opcional.preenchido).map((opcional) => opcional.rotulo)),
  )
  // Valor que chega com o campo fechado (um desfazer) abre o campo — ajuste de
  // estado no próprio render, o molde do React para estado que segue uma prop.
  const chegaram = opcionais.filter((opcional) => opcional.preenchido && !abertos.has(opcional.rotulo))
  if (chegaram.length > 0) setAbertos(new Set([...abertos, ...chegaram.map((opcional) => opcional.rotulo)]))
  // Só o chip leva o foco, e só o clique de mouse anima: o valor que chega por
  // fora abre o campo sem roubar o foco de quem está em outro lugar.
  const [recemAberto, setRecemAberto] = useState<{ rotulo: string; animar: boolean } | null>(null)
  const focarAoAbrir = useRef<string | null>(null)

  // Antes da pintura: o chip some neste mesmo commit, e o foco não pode ficar
  // um quadro no `body` (o anel piscaria e a tecla seguinte se perderia).
  useLayoutEffect(() => {
    const id = focarAoAbrir.current
    if (id === null) return
    focarAoAbrir.current = null
    document.getElementById(id)?.querySelector<HTMLElement>(CONTROLE_FOCAVEL)?.focus()
  }, [abertos])

  const abrir = (opcional: Opcional, indice: number, peloMouse: boolean) => {
    focarAoAbrir.current = idDoCampo(indice)
    setRecemAberto({ rotulo: opcional.rotulo, animar: peloMouse && !movimentoReduzido() })
    setAbertos(new Set([...abertos, opcional.rotulo]))
  }
  const temChip = onCreateRoomInside !== undefined || opcionais.some((opcional) => !abertos.has(opcional.rotulo))

  return (
    <>
      {opcionais.map((opcional, indice) => (
        <div
          key={opcional.rotulo}
          id={idDoCampo(indice)}
          className={classes('lb-sala-opcional', recemAberto !== null && recemAberto.animar && recemAberto.rotulo === opcional.rotulo && 'gr-e-nova')}
          hidden={!abertos.has(opcional.rotulo)}
        >
          {opcional.campo}
        </div>
      ))}
      {temChip && (
        <div className="gr-chips">
          {opcionais.map((opcional, indice) =>
            abertos.has(opcional.rotulo) ? null : (
              <button
                key={opcional.rotulo}
                type="button"
                className="gr-chip gr-chip--mais"
                aria-expanded={false}
                aria-controls={idDoCampo(indice)}
                aria-describedby={opcional.dicaId}
                // `detail` 0 = Enter ou Espaço: pelo teclado o campo entra sem animar.
                onClick={(evento) => abrir(opcional, indice, evento.detail > 0)}
              >
                <IconeDoLivro nome="mais" />
                {opcional.rotulo}
              </button>
            ),
          )}
          {onCreateRoomInside !== undefined && (
            <button type="button" className="gr-chip gr-chip--mais" onClick={onCreateRoomInside}>
              <IconeDoLivro nome="mais" />
              Criar sala dentro
            </button>
          )}
        </div>
      )}
    </>
  )
}

/** Por que a Sala retangular torta está sem largura/altura, e como tê-las de volta. */
const NOTA_SALA_TORTA = 'Largura e altura voltam quando a sala fica reta: 0°, 90°, 180° ou −90°.'

/** Ficha da sala com a escolha lembrada (Sala, O que veem e Acrescentar nascem abertas; as outras, fechadas, como no protótipo). */
function FichaDaSalaLembrada(props: Omit<FichaLembradaProps, 'prefixo'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} {...props} />
}

/**
 * FICHA DA SALA (fatia 15 do design consolidado, docs/design/consolidado/PLANO.md):
 * sem bloco essencial, seis fichas lembradas — Sala (o nome, o texto ao entrar
 * e de que sala ela é), O que os jogadores veem (os interruptores, com ajuda
 * curta), Acrescentar (os opcionais em chips "+"), Aparência, Medidas e título
 * e Trava. As três de cima nascem abertas; as outras, fechadas com o resumo.
 * Os controles e os handlers são os de antes: muda o lugar e o visual.
 * "Endireitar" e "Abrir para o corredor" moram no "Mais ações" da cabeça.
 *
 * `width`/`height` já vêm calculados pelo chamador (`roomDimensions`, em
 * `lib/roomOps.ts`): os campos e o arrasto de canto convergem na mesma função
 * de geometria, e a Rotação é o par numérico da alça de girar do mapa (os dois
 * terminam em `lib/mapFactory.ts` → `rotateRegion`).
 *
 * O Nome nunca ganha foco sozinho: logo depois de desenhar, o nome é pedido
 * num campo sobre a própria Sala (`pixi/PixiCanvas.tsx`). Um foco escondido
 * neste painel fazia a próxima tecla de atalho (V) renomear a Sala.
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
  modeloDoTeto,
  corDoTeto,
  onRoofStyleChange,
  comodo,
  onComodoChange,
  textoAoEntrar,
  onTextoAoEntrarChange,
  notaDoMestre,
  onNotaDoMestreChange,
  dark,
  onDarkChange,
  dentroVeFora,
  onDentroVeForaChange,
  foraVeDentro,
  onForaVeDentroChange,
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
  salaId,
  hazard,
  conveyor,
  aparencia,
  resumoDaAparencia,
  trava,
}: RoomControlsProps) {
  // Da store: ligar a chave "Nomes dos lugares" no Configurar cena, ou apagar
  // o nome, troca o estilo do título pela dica sem passar pelo App.
  const nomeNaPilula = useMapStore((state) => salaId !== undefined && selectNomeNaPilula(state, salaId))
  const estiloProprio = useEstiloProprioDaSala(salaId, labelStyle)
  const baseId = useId()
  const roofHintId = `${baseId}-roof-hint`
  const comodoHintId = `${baseId}-comodo-hint`
  const darkHintId = `${baseId}-dark-hint`
  const foraVeDentroHintId = `${baseId}-fora-ve-dentro-hint`
  const enterTextId = `${baseId}-texto-ao-entrar`
  const enterHintId = `${baseId}-texto-ao-entrar-hint`
  const noteId = `${baseId}-nota-do-mestre`
  const noteHintId = `${baseId}-nota-do-mestre-hint`
  const faccaoId = `${baseId}-faccao`
  const faccaoHintId = `${baseId}-faccao-hint`
  const faccaoListId = `${baseId}-faccao-lista`
  const raioHintId = `${baseId}-raio-de-visao-hint`
  const showNameToggle = nameHiddenFromPlayers !== undefined && onNameHiddenFromPlayersChange !== undefined
  const showRoof = roof !== undefined && onRoofChange !== undefined
  const showComodo = onComodoChange !== undefined
  const showDark = dark !== undefined && onDarkChange !== undefined
  const showDentroVeFora = dentroVeFora !== undefined && onDentroVeForaChange !== undefined
  const showForaVeDentro = foraVeDentro !== undefined && onForaVeDentroChange !== undefined
  const temInterruptores = showNameToggle || showRoof || showComodo || showDark || showDentroVeFora || showForaVeDentro
  // O teto vence (`lib/fogFilter.ts`): o interruptor guarda a escolha, mas fica apagado enquanto o teto estiver ligado.
  const tetoTapaInterior = roof === true
  const mostraDimensoes = shape === 'rect' && axisAligned
  const temEstiloDoTitulo = labelStyle !== undefined && onLabelStyleChange !== undefined

  // Os opcionais da ficha Acrescentar, na ordem do protótipo.
  const opcionais: Opcional[] = []
  if (onNotaDoMestreChange !== undefined) {
    opcionais.push({
      rotulo: 'Nota do mestre',
      preenchido: temTexto(notaDoMestre),
      dicaId: noteHintId,
      campo: (
        <div className="gr-campo">
          <label className="gr-campo__rot" htmlFor={noteId}>
            Nota do mestre
          </label>
          <textarea
            id={noteId}
            className="gr-entrada"
            rows={3}
            maxLength={ROOM_TEXT_MAX_LENGTH}
            value={notaDoMestre ?? ''}
            aria-describedby={noteHintId}
            onChange={(event) => onNotaDoMestreChange(event.target.value)}
          />
          <p className="gr-nota" id={noteHintId}>
            Só você lê. Nunca vai para a tela dos jogadores.
          </p>
        </div>
      ),
    })
  }
  if (onFaccaoChange !== undefined) {
    // A facção herdada do distrito também conta como valor: a sala TEM dono, e
    // o campo aberto é o que mostra de quem ela herda.
    opcionais.push({
      rotulo: 'Facção',
      preenchido: temTexto(faccao) || faccaoHerdada !== undefined,
      dicaId: faccaoHintId,
      campo: (
        <div className="gr-campo">
          <label className="gr-campo__rot" htmlFor={faccaoId}>
            Facção
          </label>
          <input
            id={faccaoId}
            className="gr-entrada"
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
          <p className="gr-nota" id={faccaoHintId}>
            {faccaoHerdada !== undefined && (faccao ?? '').trim() === ''
              ? `Herda do distrito: ${faccaoHerdada}. Só você vê.`
              : 'Quem manda aqui. Só você vê; as salas de dentro herdam.'}
          </p>
        </div>
      ),
    })
  }
  if (onRaioDeVisaoChange !== undefined) {
    opcionais.push({
      rotulo: 'Raio de visão aqui',
      preenchido: raioDeVisao !== undefined && raioDeVisao !== null,
      dicaId: raioHintId,
      campo: <RoomVisionRadiusField raioDeVisao={raioDeVisao ?? null} onRaioDeVisaoChange={onRaioDeVisaoChange} hintId={raioHintId} />,
    })
  }
  if (hazard !== undefined) opcionais.push({ rotulo: 'Perigo', preenchido: hazard.kind !== null, campo: <HazardControls {...hazard} /> })
  // Mecânica da sala como o perigo: sem direção ("Nenhuma") é um chip; com esteira ligada nasce aberta, com o Avançar à mão.
  if (conveyor !== undefined) opcionais.push({ rotulo: 'Esteira', preenchido: conveyor.direction !== null, campo: <ConveyorControls {...conveyor} /> })

  return (
    <div className="lb-ficha-da-sala">
      {/* O título da ficha para o leitor de tela; na tela, a cabeça já diz "Sala". */}
      <h2 className="gr-sr">Sala</h2>
      <Fichas>
        <FichaDaSalaLembrada id="sala" titulo="Sala" icone="sala" padrao>
          <div className="gr-campo">
            <label className="gr-campo__rot" htmlFor="lb-room-name">
              Nome
            </label>
            <input id="lb-room-name" className="gr-entrada" value={name} onChange={(event) => onNameChange(event.target.value)} />
          </div>
          {onTextoAoEntrarChange !== undefined && (
            <div className="gr-campo">
              <label className="gr-campo__rot" htmlFor={enterTextId}>
                Ao entrar, o jogador lê
              </label>
              <textarea
                id={enterTextId}
                className="gr-entrada"
                rows={3}
                maxLength={ROOM_TEXT_MAX_LENGTH}
                placeholder="O que o jogador lê ao entrar"
                value={textoAoEntrar ?? ''}
                aria-describedby={enterHintId}
                onChange={(event) => onTextoAoEntrarChange(event.target.value)}
              />
              <p className="gr-nota" id={enterHintId}>
                Aparece na primeira vez que o jogador entra.
              </p>
            </div>
          )}
          {parentName !== undefined && (
            <p className="lb-sala-dentro" data-testid="room-parent">
              Dentro de: <b>{parentName}</b>
            </p>
          )}
        </FichaDaSalaLembrada>

        {temInterruptores && (
          <FichaDaSalaLembrada id="veem" titulo="O que os jogadores veem" icone="olho" padrao>
            {showNameToggle && (
              <Toggle label="Jogadores veem o nome" checked={!nameHiddenFromPlayers} onChange={(visible) => onNameHiddenFromPlayersChange(!visible)} />
            )}
            {showRoof && (
              <div className="lb-switch-com-ajuda">
                <Toggle label="Teto fechado para jogadores" checked={roof} onChange={onRoofChange} describedBy={roofHintId} />
                <p className="gr-nota" id={roofHintId}>
                  Quem está fora não vê o que há dentro.
                </p>
                {roof === true && onRoofStyleChange !== undefined && (
                  <EstiloDoTelhado
                    modelo={modeloDoTeto ?? MODELO_PADRAO_DO_TETO}
                    cor={corDoTetoOuPadrao(modeloDoTeto ?? MODELO_PADRAO_DO_TETO, corDoTeto)}
                    onChange={onRoofStyleChange}
                  />
                )}
              </div>
            )}
            {showComodo && (
              <div className="lb-switch-com-ajuda">
                <Toggle label="Cômodo: aparece só depois de visto" checked={comodo === true} onChange={onComodoChange} describedBy={comodoHintId} />
                <p className="gr-nota" id={comodoHintId}>
                  Depois de visto, fica lembrado, mais apagado.
                </p>
              </div>
            )}
            {showDark && (
              <div className="lb-switch-com-ajuda">
                <Toggle label="Sala escura" checked={dark} onChange={onDarkChange} describedBy={darkHintId} />
                <p className="gr-nota" id={darkHintId}>
                  Só se vê com luz.
                </p>
              </div>
            )}
            {showDentroVeFora && <Toggle label="De dentro, vê lá fora" checked={dentroVeFora} onChange={onDentroVeForaChange} />}
            {showForaVeDentro && (
              <div className="lb-switch-com-ajuda">
                <Toggle
                  label="De fora, vê aqui dentro"
                  checked={foraVeDentro}
                  onChange={onForaVeDentroChange}
                  describedBy={tetoTapaInterior ? foraVeDentroHintId : undefined}
                  disabled={tetoTapaInterior}
                />
                {/* Estado, não ajuda: com o teto ligado, o motivo de estar apagado. */}
                {tetoTapaInterior && (
                  <p className="gr-nota" id={foraVeDentroHintId}>
                    O teto fechado esconde o interior de quem está fora. Desligue o teto para usar.
                  </p>
                )}
              </div>
            )}
          </FichaDaSalaLembrada>
        )}

        {(opcionais.length > 0 || onCreateRoomInside !== undefined) && (
          <FichaDaSalaLembrada id="extras" titulo="Acrescentar" icone="mais" padrao>
            <Acrescimos opcionais={opcionais} onCreateRoomInside={onCreateRoomInside} />
          </FichaDaSalaLembrada>
        )}

        {aparencia !== undefined && (
          <FichaDaSalaLembrada id="aparencia" titulo="Aparência" icone="chao" padrao={false} resumo={resumoDaAparencia}>
            {aparencia}
          </FichaDaSalaLembrada>
        )}

        <FichaDaSalaLembrada
          id="medidas"
          titulo="Medidas e título"
          icone="regua"
          padrao={false}
          resumo={mostraDimensoes ? `${Math.round(width)} × ${Math.round(height)} px` : undefined}
        >
          {mostraDimensoes && (
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
          {/* Sala com estilo próprio (mapa Continente de antes da pílula) mostra os
              controles mesmo com a pílula: esconder o que o mestre já escolheu
              parece que o estilo se perdeu. Sem estilo próprio, fica só a dica. */}
          {temEstiloDoTitulo && (!nomeNaPilula || estiloProprio) && <RoomLabelStyleControls style={labelStyle} onChange={onLabelStyleChange} />}
          {/* O estilo gravado continua na sala: desligar a chave traz a plaquinha de volta como era. */}
          {temEstiloDoTitulo && nomeNaPilula && (
            <p className="lb-field__hint" data-testid="nome-na-pilula">
              {estiloProprio
                ? 'O nome aparece na pílula de “Nomes dos lugares”, com tamanho e cor da cena. O estilo do título acima continua guardado e volta quando essa chave é desligada em Configurar cena.'
                : 'O nome aparece na pílula de “Nomes dos lugares”, com tamanho e cor da cena. Para mudar o estilo do título, desligue essa chave em Configurar cena.'}
            </p>
          )}
        </FichaDaSalaLembrada>

        {trava !== undefined && (
          <FichaDaSalaLembrada id="trava" titulo="Trava" icone="cadeado" padrao={false}>
            {trava}
          </FichaDaSalaLembrada>
        )}
      </Fichas>
    </div>
  )
}

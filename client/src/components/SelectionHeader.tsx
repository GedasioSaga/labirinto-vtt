import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import type { Drawing, FloorPiece, Light, Prop, Region, Stair, Token, Wall } from '../types/map'
import { PISO_MAX, PISO_MIN, nomeDoPiso } from '../lib/pisos'
import type { SelectionSummary } from './SelectionControls'
import { deleteSelectionLabel } from './labels'
import {
  BrushIcon,
  DoorIcon,
  FloorIcon,
  LightIcon,
  PropIcon,
  RegionIcon,
  RoomIcon,
  StairIcon,
  TextIcon,
  TokenIcon,
  WallIcon,
} from './icons'
import './SelectionHeader.css'

/** De que tipo é o que está selecionado — decide o ícone da faixa. */
export type SelectionIconKind =
  | 'room'
  | 'region'
  | 'token'
  | 'wall'
  | 'door'
  | 'light'
  | 'stair'
  | 'prop'
  | 'text'
  | 'drawing'
  | 'floor'
  | 'several'

/** O que a faixa diz da seleção. */
export interface SelectionIdentity {
  icon: SelectionIconKind
  /** O tipo, com o nome do botão da ferramenta que cria a coisa ("Sala", "Porta", "Token"). */
  type: string
  /** O nome do item, quando ele tem um; `null` = a faixa diz só o tipo. */
  name: string | null
}

/** Os itens que o painel já recebe; com UM item selecionado, só um deles não é `null`. */
export interface SelectedItems {
  region: Region | null
  token: Token | null
  wall: Wall | null
  prop: Prop | null
  light: Light | null
  stair: Stair | null
  textLabel: Extract<Drawing, { kind: 'text' }> | null
  floorPiece: FloorPiece | null
}

/** Texto vazio (sala sem nome, rótulo em branco) não é nome: a faixa cai no tipo. */
function nameOrNull(text: string | undefined): string | null {
  const trimmed = text?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/**
 * Tipo e nome da seleção. O tipo repete o rótulo do botão da barra que cria a
 * coisa (`TOOL_LABELS`), o mesmo acordo do título "Ferramenta · X": quem
 * desenhou com "Sala" lê "Sala", não "Região". Vários itens não têm um tipo
 * só, então a faixa conta quantos são.
 */
export function selectionIdentity(summary: SelectionSummary, items: SelectedItems): SelectionIdentity {
  if (summary.count > 1) return { icon: 'several', type: 'Seleção', name: `${summary.count} itens` }
  switch (summary.kind) {
    case 'region': {
      const room = items.region?.room
      if (room !== undefined) return { icon: 'room', type: 'Sala', name: nameOrNull(room.name) }
      return { icon: 'region', type: 'Região', name: null }
    }
    case 'token':
      return { icon: 'token', type: 'Token', name: nameOrNull(items.token?.name) }
    case 'wall':
      return items.wall?.door ? { icon: 'door', type: 'Porta', name: null } : { icon: 'wall', type: 'Parede', name: null }
    case 'light':
      return { icon: 'light', type: 'Luz', name: null }
    case 'stair':
      return { icon: 'stair', type: 'Escada', name: null }
    case 'prop':
      return { icon: 'prop', type: 'Peça', name: null }
    case 'drawing':
      // Rótulo de texto se chama pelo que diz; a primeira linha basta para achar.
      return items.textLabel !== null
        ? { icon: 'text', type: 'Texto', name: nameOrNull(items.textLabel.text.split('\n')[0]) }
        : { icon: 'drawing', type: 'Desenho', name: null }
    case 'floor':
      return { icon: 'floor', type: 'Peça de chão', name: null }
  }
}

/**
 * Nome do botão Apagar — o MESMO de antes da faixa, letra por letra: os testes
 * e2e o procuram pelo nome e pelo texto (`toHaveText('Apagar parede
 * selecionada')`). "Apagar sala" diria melhor, mas a sala é uma região para o
 * resto do app, e o nome não é desta peça mudar.
 */
export function deleteLabelFor(summary: SelectionSummary): string {
  return summary.count === 1 ? deleteSelectionLabel(summary.kind) : `Apagar ${summary.count} itens selecionados`
}

/** Um item do menu "Mais ações". */
export interface SelectionAction {
  /** Texto do item e o nome acessível dele ("Levar ao 1º piso"). */
  label: string
  onSelect: () => void
  /** Presente = o item fica no lugar, esmaecido, e diz por que não age agora. */
  disabledReason?: string
}

/**
 * PISOS NA MESMA CENA — "Levar ao piso" da seleção inteira, um piso acima e um
 * abaixo do piso em edição. Na ponta da faixa de pisos o item continua no
 * menu, esmaecido, com o motivo: o mestre aprende onde ele mora.
 */
export function floorActions(pisoAtivo: number, onLevar: (piso: number) => void): SelectionAction[] {
  const acima = pisoAtivo + 1
  const abaixo = pisoAtivo - 1
  return [
    {
      label: `Levar ao ${nomeDoPiso(acima)}`,
      onSelect: () => onLevar(acima),
      disabledReason: acima > PISO_MAX ? 'Não há piso acima deste.' : undefined,
    },
    {
      label: `Levar ao ${nomeDoPiso(abaixo)}`,
      onSelect: () => onLevar(abaixo),
      disabledReason: abaixo < PISO_MIN ? 'Não há subsolo abaixo deste.' : undefined,
    },
  ]
}

export interface SelectionHeaderProps {
  identity: SelectionIdentity
  /** Nome acessível (e texto) do Apagar: `deleteLabelFor`. */
  deleteLabel: string
  onDelete: () => void
  /** Itens do "Mais ações". Vazio = o botão não aparece (menu sem ação é controle falso). */
  actions: SelectionAction[]
  /** Frase que explica os itens do menu, no pé dele e ligada a cada item. */
  actionsHint: string | null
}

const MORE_ACTIONS_LABEL = 'Mais ações'
/** A tecla de "Apagar a seleção", com o nome que a tela de atalhos usa (`shortcutSheet.ts`). */
const DELETE_KEY = 'Delete'

/**
 * Faixa da seleção, fixa no topo do corpo do inspetor (referência: o cabeçalho
 * "Frame ▾ … ⋯" da aba Design do Figma UI3). Diz o que está selecionado — o
 * ícone da ferramenta que o cria, o nome e o tipo — e traz as ações sobre ele:
 * Apagar, que antes morava no fim da coluna (24 rolagens na sala), e "Mais
 * ações", o menu das ações raras ("Levar ao piso"), que antes ocupavam a
 * coluna em toda seleção.
 *
 * Sem título (`h2`) de propósito: o primeiro título da coluna continua sendo o
 * do item ("Sala", "Token") ou o da ferramenta, que as jornadas leem.
 * `role="toolbar"` como a barra de ações do rodapé (`ActionBar`): os botões
 * ficam na ordem de Tab, e as setas continuam sendo atalho do mapa.
 */
export function SelectionHeader({ identity, deleteLabel, onDelete, actions, actionsHint }: SelectionHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const identityId = useId()
  const hasMenu = actions.length > 0

  const closeMenu = (focusTrigger: boolean) => {
    setMenuOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  return (
    <div className="lb-selhead" role="toolbar" aria-label="Ações da seleção" aria-describedby={identityId}>
      <span className="lb-selhead__mark" aria-hidden="true">
        {selectionIcon(identity.icon)}
      </span>
      <span className="lb-selhead__id" id={identityId}>
        {identity.name === null ? (
          <span className="lb-selhead__name">{identity.type}</span>
        ) : (
          <>
            {/* `title`: nome longo corta com reticências; o ponteiro lê inteiro.
                O espaço entre os dois não aparece (são itens de flex), mas
                separa as palavras na descrição que o leitor de tela lê. */}
            <span className="lb-selhead__name" title={identity.name}>
              {identity.name}
            </span>{' '}
            <span className="lb-selhead__type">{identity.type}</span>
          </>
        )}
      </span>
      {/* Só ícone, como no Figma: o texto inteiro fica para o leitor de tela e
          para o texto do botão (o e2e lê `toHaveText`), e o balão mostra, com
          a tecla, como o "Desfazer (Ctrl+Z)" da barra de ações. */}
      <button
        type="button"
        className="lb-selhead__btn lb-selhead__btn--apagar lb-tip"
        aria-label={deleteLabel}
        data-tip={`${deleteLabel} (${DELETE_KEY})`}
        aria-keyshortcuts={DELETE_KEY}
        onClick={onDelete}
      >
        <span className="lb-selhead__chip">
          <TrashIcon />
          <span className="lb-sr-only">{deleteLabel}</span>
        </span>
      </button>
      {hasMenu && (
        <button
          ref={triggerRef}
          type="button"
          className="lb-selhead__btn lb-tip"
          aria-label={MORE_ACTIONS_LABEL}
          data-tip={MORE_ACTIONS_LABEL}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="lb-selhead__chip">
            <MoreIcon />
          </span>
        </button>
      )}
      {hasMenu && menuOpen && (
        <SelectionMenu id={menuId} actions={actions} hint={actionsHint} trigger={triggerRef.current} onClose={closeMenu} />
      )}
    </div>
  )
}

interface SelectionMenuProps {
  id: string
  actions: SelectionAction[]
  hint: string | null
  /** O "⋯" que abriu: o clique nele alterna o menu, então fica fora do "clique fora". */
  trigger: HTMLElement | null
  /** `focusTrigger`: Esc e escolha devolvem o foco ao "⋯"; Tab e clique fora, não. */
  onClose: (focusTrigger: boolean) => void
}

/**
 * O menu "Mais ações", no molde do menu "…" da cena (`ScenesSection`) e do de
 * imagem de fundo (`ActionBar`): o foco entra no primeiro item que age, as
 * setas andam pulando o esmaecido, Home/End vão às pontas, Esc fecha e devolve
 * o foco ao "⋯", Tab e clique fora fecham. Nenhuma tecla daqui vira atalho do
 * mapa (Esc largaria a seleção; setas a moveriam).
 */
function SelectionMenu({ id, actions, hint, trigger, onClose }: SelectionMenuProps) {
  const popRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const baseId = useId()
  const hintId = `${baseId}-dica`

  /** Os itens que agem, na ordem: é por eles que as setas andam. */
  const enabledItems = (): HTMLButtonElement[] =>
    actions.flatMap((action, index) => {
      const item = itemRefs.current[index]
      return action.disabledReason === undefined && item !== null && item !== undefined ? [item] : []
    })

  // Só ao abrir (o menu monta a cada abertura): o foco não volta ao primeiro a cada render.
  useEffect(() => {
    enabledItems()[0]?.focus()
  }, [])

  useEffect(() => {
    // `pointerdown`, como nos outros menus: fecha antes de o clique acertar o que está por baixo.
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (popRef.current?.contains(event.target) || trigger?.contains(event.target)) return
      onClose(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [trigger, onClose])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const list = enabledItems()
    const current = list.findIndex((item) => item === document.activeElement)
    const focusAt = (index: number) => {
      event.preventDefault()
      list[(index + list.length) % list.length]?.focus()
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        onClose(true)
        return
      case 'Tab':
        onClose(false)
        return
      case 'ArrowDown':
        focusAt(current + 1)
        return
      case 'ArrowUp':
        focusAt(current < 0 ? list.length - 1 : current - 1)
        return
      case 'Home':
        focusAt(0)
        return
      case 'End':
        focusAt(list.length - 1)
        return
    }
  }

  const choose = (action: SelectionAction) => {
    if (action.disabledReason !== undefined) return
    onClose(true)
    action.onSelect()
  }

  return (
    <div ref={popRef} className="lb-panel lb-selhead__pop" onKeyDown={onKeyDown}>
      <div id={id} role="menu" aria-label={MORE_ACTIONS_LABEL} className="lb-selhead__menu">
        {actions.map((action, index) => {
          const labelId = `${baseId}-item-${index}`
          const reasonId = `${baseId}-motivo-${index}`
          const describedBy = [action.disabledReason !== undefined ? reasonId : null, hint !== null ? hintId : null]
            .filter((part): part is string => part !== null)
            .join(' ')
          return (
            <button
              key={action.label}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="lb-selhead__item"
              aria-labelledby={labelId}
              aria-describedby={describedBy === '' ? undefined : describedBy}
              aria-disabled={action.disabledReason !== undefined ? 'true' : undefined}
              onClick={() => choose(action)}
            >
              <span id={labelId}>{action.label}</span>
              {action.disabledReason !== undefined && (
                <>
                  {' '}
                  <span id={reasonId} className="lb-selhead__reason">
                    {action.disabledReason}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
      {hint !== null && (
        <p id={hintId} className="lb-selhead__hint">
          {hint}
        </p>
      )}
    </div>
  )
}

/** Ícone da faixa: o mesmo desenho do botão da ferramenta que cria a coisa. */
function selectionIcon(kind: SelectionIconKind): ReactElement {
  const size = 16
  switch (kind) {
    case 'room':
      return <RoomIcon size={size} />
    case 'region':
      return <RegionIcon size={size} />
    case 'token':
      return <TokenIcon size={size} />
    case 'wall':
      return <WallIcon size={size} />
    case 'door':
      return <DoorIcon size={size} />
    case 'light':
      return <LightIcon size={size} />
    case 'stair':
      return <StairIcon size={size} />
    case 'prop':
      return <PropIcon size={size} />
    case 'text':
      return <TextIcon size={size} />
    case 'drawing':
      return <BrushIcon size={size} />
    case 'floor':
      return <FloorIcon size={size} />
    case 'several':
      return <SeveralIcon />
  }
}

/**
 * Os três ícones abaixo seguem a família de `icons.tsx` (contorno em
 * `currentColor`, traço 1,6, `viewBox` 24, decorativos). Moram aqui porque só
 * esta faixa os usa.
 */
function HeaderIcon({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Lixeira: tampa, alça e o corpo com duas ripas. */
function TrashIcon() {
  return (
    <HeaderIcon>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.2c0-.4.3-.7.7-.7h3.6c.4 0 .7.3.7.7V7" />
      <path d="M6.5 7l.9 11.6c.1.8.7 1.4 1.5 1.4h6.2c.8 0 1.4-.6 1.5-1.4L17.5 7" />
      <path d="M10.3 11v5M13.7 11v5" />
    </HeaderIcon>
  )
}

/** "⋯": três pontos. O traço redondo num raio mínimo fecha cada um num ponto cheio. */
function MoreIcon() {
  return (
    <HeaderIcon>
      <circle cx="6" cy="12" r="0.9" />
      <circle cx="12" cy="12" r="0.9" />
      <circle cx="18" cy="12" r="0.9" />
    </HeaderIcon>
  )
}

/** Vários itens: duas folhas, uma atrás da outra. */
function SeveralIcon() {
  return (
    <HeaderIcon size={16}>
      <rect x="4" y="8.5" width="11.5" height="11.5" rx="1.5" />
      <path d="M8.5 8.5V5.5c0-.6.4-1 1-1h9c.6 0 1 .4 1 1v9c0 .6-.4 1-1 1h-3" />
    </HeaderIcon>
  )
}

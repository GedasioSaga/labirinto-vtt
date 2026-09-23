import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { BackIcon, ExportIcon, FolderIcon, HomeIcon, ImageIcon, ImportIcon, RedoIcon, SaveIcon, UndoIcon } from './icons'
import './ActionBar.css'

export interface ActionBarProps {
  onSave: () => void
  onOpen: () => void
  onImportBackground: () => void
  onExportFolder: () => void
  onImportFolder: () => void
  onGoHome: () => void
  onGoBack?: () => void
  /**
   * Onda 3, item 20 do `docs/PLANO-REFINAMENTO.md` — histórico deixa de ser
   * invisível. Opcionais no mesmo padrão de `onGoBack` acima: enquanto o
   * integrador não pluga os quatro em `App.tsx` (lendo `past.length > 0` /
   * `future.length > 0` de `stores/mapStore.ts` e passando `undo`/`redo`),
   * a ActionBar renderiza exatamente como hoje, sem os dois botões novos —
   * a chamada existente em `App.tsx:905` continua compilando sem tocar lá.
   * `canUndo`/`canRedo` controlam só o atributo `disabled`; quem decide a
   * regra ("há algo no past/future?") é o integrador, não este componente.
   */
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  /**
   * Com imagem de fundo, o botão de imagem deixa de importar direto e abre o
   * menu de conversão: as três conversões só fazem sentido com imagem, e ali
   * elas nunca aparecem desabilitadas sem motivo.
   */
  hasBackgroundImage: boolean
  onFloorFromBackground: () => void
  onDetailsFromBackground: () => void
  /** Pipeline completo (chão + linhas + portas + calibração) com render fiel ligado. */
  onRecreateMinimapFromBackground: () => void
}

interface ActionBarAction {
  label: string
  icon: ReactElement
  onClick: () => void
  disabled?: boolean
}

interface BackgroundMenuItem {
  label: string
  description: string
  onSelect: () => void
}

const IMPORT_BACKGROUND_LABEL = 'Importar imagem de fundo'
const BACKGROUND_MENU_LABEL = 'Imagem de fundo e conversão'

function ActionButton({ action }: { action: ActionBarAction }) {
  return (
    <button
      type="button"
      className="lb-iconbtn lb-tip lb-tip--up"
      aria-label={action.label}
      data-tip={action.label}
      onClick={action.onClick}
      disabled={action.disabled}
    >
      {action.icon}
    </button>
  )
}

/**
 * Ações de arquivo, no rodapé da coluna esquerda.
 *
 * São operações ocasionais, então ficam como ícone + tooltip para não competir
 * com as ferramentas de desenho. O rótulo completo continua sendo o nome
 * acessível de cada botão — nada se perde para leitor de tela.
 */
export function ActionBar(props: ActionBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()
  // Imagem removida com o menu aberto: o menu some junto, sem estado preso.
  const showMenu = menuOpen && props.hasBackgroundImage

  const historyActions: ActionBarAction[] = [
    ...(props.onUndo
      ? [{ label: 'Desfazer (Ctrl+Z)', icon: <UndoIcon />, onClick: props.onUndo, disabled: !props.canUndo }]
      : []),
    ...(props.onRedo
      ? [{ label: 'Refazer (Ctrl+Y)', icon: <RedoIcon />, onClick: props.onRedo, disabled: !props.canRedo }]
      : []),
  ]

  const actionsBeforeBackground: ActionBarAction[] = [
    ...(props.onGoBack ? [{ label: 'Voltar', icon: <BackIcon />, onClick: props.onGoBack }] : []),
    { label: 'Salvar', icon: <SaveIcon />, onClick: props.onSave },
    { label: 'Abrir...', icon: <FolderIcon />, onClick: props.onOpen },
  ]
  const actionsAfterBackground: ActionBarAction[] = [
    { label: 'Exportar mapa (pasta)', icon: <ExportIcon />, onClick: props.onExportFolder },
    { label: 'Importar mapa (pasta)', icon: <ImportIcon />, onClick: props.onImportFolder },
    { label: 'Início', icon: <HomeIcon />, onClick: props.onGoHome },
  ]

  const menuItems: BackgroundMenuItem[] = [
    {
      label: 'Trocar imagem de fundo',
      description: 'Escolhe outra imagem para ficar atrás do mapa.',
      onSelect: props.onImportBackground,
    },
    {
      label: 'Chão a partir da imagem',
      description: 'Cria o chão por peças seguindo as áreas da imagem.',
      onSelect: props.onFloorFromBackground,
    },
    {
      label: 'Linhas e portas a partir da imagem',
      description: 'Traça paredes, linhas e portas desenhadas na imagem.',
      onSelect: props.onDetailsFromBackground,
    },
    {
      label: 'Recriar minimapa completo',
      description: 'Chão, linhas, portas e render fiel. Leva alguns segundos.',
      onSelect: props.onRecreateMinimapFromBackground,
    },
  ]

  // Foco entra no primeiro item ao abrir, como num menu nativo.
  useEffect(() => {
    if (showMenu) itemRefs.current[0]?.focus()
  }, [showMenu])

  // Clique fora fecha. `pointerdown` pelo mesmo motivo do Toolbar: fecha antes
  // do clique seguinte acertar o que estiver por baixo. O botão de imagem fica
  // de fora porque o próprio clique nele alterna o menu.
  useEffect(() => {
    if (!showMenu) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return
      setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [showMenu])

  function closeMenuAndFocusTrigger() {
    setMenuOpen(false)
    triggerRef.current?.focus()
  }

  function onBackgroundButtonClick() {
    if (!props.hasBackgroundImage) {
      props.onImportBackground()
      return
    }
    setMenuOpen((open) => !open)
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Nenhuma tecla do menu vale como atalho do editor (Esc desmarcando a
    // seleção, setas movendo o item selecionado no canvas).
    event.stopPropagation()
    const items = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null)
    const current = items.findIndex((item) => item === document.activeElement)
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        closeMenuAndFocusTrigger()
        return
      case 'Tab':
        // Tab sai do menu seguindo a ordem normal da página.
        setMenuOpen(false)
        return
      case 'ArrowDown':
        event.preventDefault()
        items[(current + 1) % items.length]?.focus()
        return
      case 'ArrowUp':
        event.preventDefault()
        items[(current - 1 + items.length) % items.length]?.focus()
        return
      case 'Home':
        event.preventDefault()
        items[0]?.focus()
        return
      case 'End':
        event.preventDefault()
        items[items.length - 1]?.focus()
        return
    }
  }

  function selectItem(item: BackgroundMenuItem) {
    closeMenuAndFocusTrigger()
    item.onSelect()
  }

  const backgroundLabel = props.hasBackgroundImage ? BACKGROUND_MENU_LABEL : IMPORT_BACKGROUND_LABEL

  return (
    <div className="lb-panel lb-actionbar" role="toolbar" aria-label="Ações do mapa">
      {historyActions.map((action) => (
        <ActionButton key={action.label} action={action} />
      ))}
      {historyActions.length > 0 && <span className="lb-actionbar__divider" aria-hidden="true" />}
      {actionsBeforeBackground.map((action) => (
        <ActionButton key={action.label} action={action} />
      ))}
      <button
        ref={triggerRef}
        type="button"
        className="lb-iconbtn lb-tip lb-tip--up"
        aria-label={backgroundLabel}
        data-tip={backgroundLabel}
        aria-haspopup={props.hasBackgroundImage ? 'menu' : undefined}
        aria-expanded={props.hasBackgroundImage ? showMenu : undefined}
        aria-controls={showMenu ? menuId : undefined}
        onClick={onBackgroundButtonClick}
      >
        <ImageIcon />
      </button>
      {actionsAfterBackground.map((action) => (
        <ActionButton key={action.label} action={action} />
      ))}
      {showMenu && (
        <div
          ref={menuRef}
          id={menuId}
          className="lb-panel lb-actionbar-menu"
          role="menu"
          aria-label={BACKGROUND_MENU_LABEL}
          onKeyDown={onMenuKeyDown}
        >
          {menuItems.map((item, index) => (
            <BackgroundMenuItemButton
              key={item.label}
              item={item}
              buttonRef={(node) => {
                itemRefs.current[index] = node
              }}
              onSelect={() => selectItem(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BackgroundMenuItemButton({
  item,
  buttonRef,
  onSelect,
}: {
  item: BackgroundMenuItem
  buttonRef: (node: HTMLButtonElement | null) => void
  onSelect: () => void
}) {
  const labelId = useId()
  const descriptionId = useId()
  return (
    <button
      ref={buttonRef}
      type="button"
      role="menuitem"
      tabIndex={-1}
      className="lb-actionbar-menu__item"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      onClick={onSelect}
    >
      <span id={labelId} className="lb-actionbar-menu__label">
        {item.label}
      </span>
      <span id={descriptionId} className="lb-actionbar-menu__desc">
        {item.description}
      </span>
    </button>
  )
}

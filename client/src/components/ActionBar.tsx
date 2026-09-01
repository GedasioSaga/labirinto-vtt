import type { ReactElement } from 'react'
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
}

interface ActionBarAction {
  label: string
  icon: ReactElement
  onClick: () => void
  disabled?: boolean
}

/**
 * Ações de arquivo, no rodapé da coluna esquerda.
 *
 * São operações ocasionais, então ficam como ícone + tooltip para não competir
 * com as ferramentas de desenho. O rótulo completo continua sendo o nome
 * acessível de cada botão — nada se perde para leitor de tela.
 */
export function ActionBar(props: ActionBarProps) {
  const historyActions: ActionBarAction[] = [
    ...(props.onUndo
      ? [{ label: 'Desfazer (Ctrl+Z)', icon: <UndoIcon />, onClick: props.onUndo, disabled: !props.canUndo }]
      : []),
    ...(props.onRedo
      ? [{ label: 'Refazer (Ctrl+Y)', icon: <RedoIcon />, onClick: props.onRedo, disabled: !props.canRedo }]
      : []),
  ]

  const fileActions: ActionBarAction[] = [
    ...(props.onGoBack ? [{ label: 'Voltar', icon: <BackIcon />, onClick: props.onGoBack }] : []),
    { label: 'Salvar', icon: <SaveIcon />, onClick: props.onSave },
    { label: 'Abrir...', icon: <FolderIcon />, onClick: props.onOpen },
    { label: 'Importar imagem de fundo', icon: <ImageIcon />, onClick: props.onImportBackground },
    { label: 'Exportar mapa (pasta)', icon: <ExportIcon />, onClick: props.onExportFolder },
    { label: 'Importar mapa (pasta)', icon: <ImportIcon />, onClick: props.onImportFolder },
    { label: 'Início', icon: <HomeIcon />, onClick: props.onGoHome },
  ]

  return (
    <div className="lb-panel lb-actionbar" role="toolbar" aria-label="Ações do mapa">
      {historyActions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="lb-iconbtn lb-tip lb-tip--up"
          aria-label={action.label}
          data-tip={action.label}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.icon}
        </button>
      ))}
      {historyActions.length > 0 && <span className="lb-actionbar__divider" aria-hidden="true" />}
      {fileActions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="lb-iconbtn lb-tip lb-tip--up"
          aria-label={action.label}
          data-tip={action.label}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.icon}
        </button>
      ))}
    </div>
  )
}

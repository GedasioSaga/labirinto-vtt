import type { ReactElement } from 'react'
import { BackIcon, ExportIcon, FolderIcon, HomeIcon, ImageIcon, ImportIcon, SaveIcon } from './icons'

export interface ActionBarProps {
  onSave: () => void
  onOpen: () => void
  onImportBackground: () => void
  onExportFolder: () => void
  onImportFolder: () => void
  onGoHome: () => void
  onGoBack?: () => void
}

/**
 * Ações de arquivo, no rodapé da coluna esquerda.
 *
 * São operações ocasionais, então ficam como ícone + tooltip para não competir
 * com as ferramentas de desenho. O rótulo completo continua sendo o nome
 * acessível de cada botão — nada se perde para leitor de tela.
 */
export function ActionBar(props: ActionBarProps) {
  const actions: Array<{ label: string; icon: ReactElement; onClick: () => void }> = [
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
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="lb-iconbtn lb-tip lb-tip--up"
          aria-label={action.label}
          data-tip={action.label}
          onClick={action.onClick}
        >
          {action.icon}
        </button>
      ))}
    </div>
  )
}

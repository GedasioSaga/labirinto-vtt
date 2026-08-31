import { MenuShell } from './MenuShell'
import { MenuCard } from '../components/MenuCard'
import { NewMapIcon, FolderIcon, SettingsIcon } from '../components/icons'

interface MainMenuProps {
  onCreate: () => void
  onLoad: () => void
  onOptions: () => void
}

/** Raiz da navegação — as três portas do app. */
export function MainMenu({ onCreate, onLoad, onOptions }: MainMenuProps) {
  return (
    <MenuShell title="Labirinto" subtitle="Editor de mapas de mesa" crumbs={[]}>
      <div className="lb-menu__list">
        <MenuCard
          layout="row"
          icon={<NewMapIcon />}
          title="Criar Mapas"
          description="Dungeon, isométrico ou mundo"
          onClick={onCreate}
        />
        <MenuCard
          layout="row"
          icon={<FolderIcon />}
          title="Carregar Mapa existente"
          description="Continuar de onde parou"
          onClick={onLoad}
        />
        <MenuCard
          layout="row"
          icon={<SettingsIcon />}
          title="Opções"
          description="Conexão, personagens, cenário"
          onClick={onOptions}
        />
      </div>
    </MenuShell>
  )
}

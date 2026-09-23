import { MenuShell } from './MenuShell'
import { MenuCard } from '../components/MenuCard'
import { NewMapIcon, FolderIcon, SettingsIcon } from '../components/icons'
import { FEATURES, type FeatureFlags } from '../lib/features'

interface MainMenuProps {
  onCreate: () => void
  onLoad: () => void
  onOptions: () => void
  /** Default `FEATURES`; o teste passa outro valor para provar o estado religado. */
  flags?: Readonly<FeatureFlags>
}

/** Raiz da navegação — as portas do app (Opções só com `flags.optionsScreen`). */
export function MainMenu({ onCreate, onLoad, onOptions, flags = FEATURES }: MainMenuProps) {
  // Sem os outros tipos, "Criar Mapas" cria direto um Dungeon Map: a linha
  // de apoio diz o que ele é, em vez de prometer isométrico e mundo.
  const createDescription = flags.otherMapTypes ? 'Dungeon, isométrico ou mundo' : 'Planta em grade, paredes, portas e tokens'
  return (
    <MenuShell title="Labirinto" subtitle="Editor de mapas de mesa" crumbs={[]}>
      <div className="lb-menu__list">
        <MenuCard
          layout="row"
          icon={<NewMapIcon />}
          title="Criar Mapas"
          description={createDescription}
          onClick={onCreate}
        />
        <MenuCard
          layout="row"
          icon={<FolderIcon />}
          title="Carregar Mapa existente"
          description="Continuar de onde parou"
          onClick={onLoad}
        />
        {flags.optionsScreen && (
          <MenuCard
            layout="row"
            icon={<SettingsIcon />}
            title="Opções"
            description="Conexão, personagens, cenário"
            onClick={onOptions}
          />
        )}
      </div>
    </MenuShell>
  )
}

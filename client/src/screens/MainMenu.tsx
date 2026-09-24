import { MenuShell } from './MenuShell'
import { MenuCard } from '../components/MenuCard'
import { NewMapIcon, FolderIcon, SettingsIcon } from '../components/icons'
import { FEATURES, type FeatureFlags } from '../lib/features'

/** Trabalho não salvo que o salvamento automático guardou antes de o app fechar. */
export interface RecoveryOffer {
  mapName: string
  /** Hora da cópia já escrita para o mestre ("hoje às 14:05"). */
  savedAtLabel: string
  onRecover: () => void
  /** Esconde a oferta nesta abertura do app; a cópia continua no disco. */
  onDismiss: () => void
}

interface MainMenuProps {
  onCreate: () => void
  onLoad: () => void
  onOptions: () => void
  /** Default `FEATURES`; o teste passa outro valor para provar o estado religado. */
  flags?: Readonly<FeatureFlags>
  /** Cópia de recuperação de uma abertura que fechou sem salvar; ausente = nada a oferecer. */
  recovery?: RecoveryOffer | null
}

/**
 * Raiz da navegação — as portas do app (Opções só com `flags.optionsScreen`)
 * e, quando houver, a oferta de recuperar o trabalho não salvo.
 */
export function MainMenu({ onCreate, onLoad, onOptions, flags = FEATURES, recovery }: MainMenuProps) {
  // Sem os outros tipos, "Criar Mapas" cria direto um Dungeon Map: a linha
  // de apoio diz o que ele é, em vez de prometer isométrico e mundo.
  const createDescription = flags.otherMapTypes ? 'Dungeon, isométrico ou mundo' : 'Planta em grade, paredes, portas e tokens'
  return (
    <MenuShell title="Labirinto" subtitle="Editor de mapas de mesa" crumbs={[]}>
      {recovery && (
        // Aviso na própria tela, não modal: o menu continua clicável e o
        // mestre decide quando quiser.
        <section className="lb-recovery" aria-labelledby="lb-recovery-title">
          <div className="lb-recovery__body">
            <h2 id="lb-recovery-title" className="lb-recovery__title">
              Trabalho não salvo
            </h2>
            <p className="lb-recovery__text">
              O app fechou sem salvar <strong>{recovery.mapName}</strong>. Há uma cópia de recuperação de {recovery.savedAtLabel}.
            </p>
          </div>
          <div className="lb-recovery__actions">
            <button type="button" className="lb-btn lb-btn--primary" onClick={recovery.onRecover}>
              Recuperar mapa
            </button>
            <button type="button" className="lb-btn lb-btn--ghost" onClick={recovery.onDismiss}>
              Agora não
            </button>
          </div>
        </section>
      )}
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

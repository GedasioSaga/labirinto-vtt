import { useEffect, useRef, type KeyboardEvent } from 'react'
import { FEATURES, type FeatureFlags } from '../lib/features'
import { HomeMaze } from './HomeMaze'
import { useLampGlow } from './useLampGlow'
import './MainMenu.css'

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
  onRoleplay: () => void
  /** Default `FEATURES`; o teste passa outro valor para provar o estado religado. */
  flags?: Readonly<FeatureFlags>
  /** Cópia de recuperação de uma abertura que fechou sem salvar; ausente = nada a oferecer. */
  recovery?: RecoveryOffer | null
}

interface HomeDoorProps {
  title: string
  description: string
  badge?: string
  /** Classe extra; a de Criar Mapas leva o view-transition-name que vira o formulário. */
  className?: string
  onClick: () => void
}

/**
 * Uma "porta" da tela inicial. O número (01, 02…) vem de um contador CSS e a
 * seta é SVG: nada disso entra no `textContent`, então o nome do botão começa
 * pelo título — é por ele que os testes e o leitor de tela acham a porta.
 */
function HomeDoor({ title, description, badge, className, onClick }: HomeDoorProps) {
  return (
    <button type="button" className={className ? `lb-home__door ${className}` : 'lb-home__door'} onClick={onClick}>
      <span className="lb-home__door-body">
        <span className="lb-home__door-title">
          <span className="lb-menucard__title">{title}</span>
          {badge && <span className="lb-home__badge">{badge}</span>}
        </span>
        <span className="lb-home__door-desc">{description}</span>
      </span>
      <svg className="lb-home__door-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
      </svg>
    </button>
  )
}

/**
 * ↑/↓ andam entre as portas (com volta no fim), como numa lista de menu.
 * Ouvido na tela inteira: ao abrir, o foco está no título, fora das portas.
 */
function moveFocusBetweenDoors(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const doors = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.lb-home__door'))
  const current = doors.indexOf(document.activeElement as HTMLButtonElement)
  const delta = event.key === 'ArrowDown' ? 1 : -1
  const next = current === -1 ? 0 : (current + delta + doors.length) % doors.length
  doors[next]?.focus()
  event.preventDefault()
}

/**
 * Raiz da navegação: a tela inicial. Título grande, as portas do app (Opções
 * só com `flags.optionsScreen`) e, quando houver, a oferta de recuperar o
 * trabalho não salvo. À direita, um labirinto que se desenha na abertura sob
 * um halo de lampião que segue o mouse.
 */
export function MainMenu({ onCreate, onLoad, onOptions, onRoleplay, flags = FEATURES, recovery }: MainMenuProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useLampGlow(stageRef, glowRef)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // Sem os outros tipos, "Criar Mapas" cria direto um Dungeon Map: a linha
  // de apoio diz o que ele é, em vez de prometer isométrico e mundo.
  const createDescription = flags.otherMapTypes ? 'Dungeon, isométrico ou mundo' : 'Planta em grade, paredes, portas e tokens'
  return (
    <div className="lb-home" ref={stageRef} onKeyDown={moveFocusBetweenDoors}>
      <div className="lb-home__grid" aria-hidden="true" />
      <div className="lb-home__glow" ref={glowRef} aria-hidden="true" />
      <div className="lb-home__vignette" aria-hidden="true" />

      <main className="lb-home__stage">
        <section className="lb-home__intro">
          <header className="lb-home__brand">
            <p className="lb-home__eyebrow">Mesa de mapas</p>
            <h1 className="lb-home__title" ref={headingRef} tabIndex={-1}>
              Labirinto
            </h1>
            <p className="lb-home__tagline">
              Desenhe a masmorra. Conduza a mesa.
              <br />
              Seus jogadores só veem o que a luz alcança.
            </p>
          </header>

          {recovery && (
            // Aviso na própria tela, não modal: o menu continua clicável e o
            // mestre decide quando quiser.
            <section className="lb-recovery lb-home__recovery" aria-labelledby="lb-recovery-title">
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

          <nav className="lb-home__doors" aria-label="Começar">
            <HomeDoor title="Criar Mapas" description={createDescription} className="lb-home__door--novo-mapa" onClick={onCreate} />
            <HomeDoor title="Carregar Mapa existente" description="Continuar de onde parou" onClick={onLoad} />
            <HomeDoor title="Roleplay" description="Mesa narrativa, sem mapa" badge="Em construção" onClick={onRoleplay} />
            {flags.optionsScreen && <HomeDoor title="Opções" description="Conexão, personagens, cenário" onClick={onOptions} />}
          </nav>
        </section>

        <div className="lb-home__art">
          <HomeMaze />
        </div>
      </main>

      <p className="lb-home__foot" aria-hidden="true">
        <kbd>↑</kbd>
        <kbd>↓</kbd> escolhe a porta · <kbd>Enter</kbd> entra
      </p>
    </div>
  )
}

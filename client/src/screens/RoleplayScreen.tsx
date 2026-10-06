import { MenuShell } from './MenuShell'
import './MainMenu.css'

interface RoleplayScreenProps {
  onBack: () => void
}

/** Página do Roleplay: ainda sem conteúdo, só o aviso de que está em construção. */
export function RoleplayScreen({ onBack }: RoleplayScreenProps) {
  return (
    <MenuShell title="Roleplay" subtitle="Mesa narrativa, sem mapa" onBack={onBack} crumbs={['Labirinto']}>
      <section className="lb-wip" aria-label="Em construção">
        <svg className="lb-wip__scaffold" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <path d="M20 100V30h80v70M20 30l40-14 40 14M20 55h80M20 80h80M45 30v70M75 30v70" />
          <path d="M8 100h104" />
        </svg>
        <span className="lb-home__badge">Em construção</span>
        <p className="lb-wip__text">Uma mesa só de narrativa, sem mapa. Ainda estamos levantando as paredes desta sala.</p>
      </section>
    </MenuShell>
  )
}

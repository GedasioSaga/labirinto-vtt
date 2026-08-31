import { useEffect, useRef, type ReactNode } from 'react'
import { LabyrinthMark, BackIcon } from '../components/icons'

interface MenuShellProps {
  title: string
  subtitle?: string
  /** Ausente só na raiz do menu — ali o cabeçalho mostra a marca completa. */
  onBack?: () => void
  /** Estágio mais largo, para telas com grade ou lista (`MapTypePicker`, `LoadMapScreen`). */
  wide?: boolean
  /**
   * Trilha de posição, do raiz até o pai desta tela (não repete `title` —
   * quem mostra a tela atual é o `<h1>`). `['Labirinto']` na raiz.
   * Renderizada numa barra fixa no topo do viewport, igual em toda tela, pra
   * amarrar as 5 telas como um produto contínuo em vez de telas soltas.
   */
  crumbs: string[]
  children: ReactNode
}

/**
 * Cromo compartilhado por toda tela de menu: barra fixa no topo (marca +
 * trilha de posição), fundo `.lb-start`, título em `<h1>` com foco
 * automático ao montar, e o botão Voltar (mais a tecla Escape, ouvida só
 * aqui — nunca vaza pro editor, que não é filho desta árvore).
 */
export function MenuShell({ title, subtitle, onBack, wide, crumbs, children }: MenuShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!onBack) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onBack])

  return (
    <div className="lb-start">
      <div className="lb-appbar">
        <span className="lb-appbar__mark" aria-hidden="true">
          <LabyrinthMark size={16} />
        </span>
        <nav className="lb-appbar__crumbs" aria-label="Posição na navegação">
          {crumbs.map((crumb) => (
            <span key={crumb} className="lb-appbar__crumb">
              {crumb}
            </span>
          ))}
          <span className="lb-appbar__crumb lb-appbar__crumb--current" aria-current="page">
            {title}
          </span>
        </nav>
      </div>
      <div className={wide ? 'lb-start__stage lb-start__stage--wide' : 'lb-start__stage'}>
        {onBack && (
          <button type="button" className="lb-btn lb-btn--ghost lb-menu__back" onClick={onBack}>
            <BackIcon />
            Voltar
          </button>
        )}
        <header className="lb-brand">
          {!onBack && (
            <span className="lb-brand__mark" aria-hidden="true">
              <LabyrinthMark size={30} />
            </span>
          )}
          <span>
            <h1 className="lb-brand__name" ref={headingRef} tabIndex={-1}>
              {title}
            </h1>
            {subtitle && <p className="lb-brand__tagline">{subtitle}</p>}
          </span>
        </header>
        {children}
      </div>
    </div>
  )
}

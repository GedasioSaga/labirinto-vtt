import type { ReactNode } from 'react'

interface MenuCardProps {
  icon: ReactNode
  title: string
  description: string
  /** `row` empilha em lista (menu raiz); `tile` vira grade (seletor de tipo). */
  layout: 'row' | 'tile'
  badge?: string
  disabled?: boolean
  onClick?: () => void
}

/**
 * Card reutilizável do menu — mesmo componente no menu raiz (`layout="row"`)
 * e no seletor de tipo de mapa (`layout="tile"`), em vez de duplicar markup.
 *
 * `<button disabled>` nativo para o estado indisponível: tira da ordem de Tab,
 * suprime clique e o leitor de tela anuncia sozinho — sem precisar de
 * `aria-disabled`. O selo entra no nome acessível por composição (fica dentro
 * do botão), então não leva `aria-label` próprio — isso apagaria o resto do
 * nome.
 */
export function MenuCard({ icon, title, description, layout, badge, disabled, onClick }: MenuCardProps) {
  const className = layout === 'tile' ? 'lb-menucard lb-menucard--tile' : 'lb-menucard'

  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      <span className="lb-menucard__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="lb-menucard__body">
        <span className="lb-menucard__title">
          {title}
          {badge && <span className="lb-badge">{badge}</span>}
        </span>
        <span className="lb-menucard__desc">{description}</span>
      </span>
    </button>
  )
}

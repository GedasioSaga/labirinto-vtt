import type { ReactNode } from 'react'
import type { PropertyGroupId } from '../lib/toolProperties'

export interface ToolPropertiesSectionProps {
  /** Grupo que os `children` representam — decide se aparecem, checando `groups`. */
  group: PropertyGroupId
  /** Saída de `relevantPropertyGroups` (lib/toolProperties.ts) para a
   *  ferramenta ativa e a seleção atuais. */
  groups: ReadonlySet<PropertyGroupId>
  children: ReactNode
}

/**
 * Gate de visibilidade por grupo de propriedade: substitui o padrão disperso
 * `{showX && <X/>}` de `PropertiesPanel.tsx` (hoje só parte das seções tem
 * esse gate — 6 renderizam sempre, ver docs/DOSSIE-FEEDBACK-F4.md) por uma
 * checagem centralizada, na MESMA fonte de verdade (`lib/toolProperties.ts`)
 * que os testes já cobrem — em vez de reimplementar a condição booleana
 * duas vezes (uma em `toolProperties.ts`, outra solta em JSX) e arriscar as
 * duas divergirem.
 *
 * Não introduz elemento novo no DOM: quando `group` não está em `groups`,
 * devolve `null` — igual ao `{cond && <X/>}` que substitui. Quando está,
 * devolve os `children` direto (sem `<div>`/`<section>` envolvendo) — cada
 * seção real (`LineCapControls`, `FillControls`, `GridControls`, ...)
 * já é o próprio `<section className="lb-section">`.
 */
export function ToolPropertiesSection({ group, groups, children }: ToolPropertiesSectionProps) {
  if (!groups.has(group)) return null
  return <>{children}</>
}

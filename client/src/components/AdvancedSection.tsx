import { Children, useId, type ReactNode } from 'react'
import { CollapsibleSection } from './CollapsibleSection'

/**
 * Seção "Avançado" do painel (plano de 15/09/2026, D13): sempre nasce
 * fechada, não lembra o estado no localStorage e usa h3, porque mora dentro de
 * um bloco que já tem h2. Sem filhos (todos os campos condicionais ausentes)
 * não renderiza nada, para não sobrar um cabeçalho vazio.
 *
 * Quem quer que ela volte a nascer fechada ao trocar de objeto passa `key`
 * com o id do objeto: o estado aberto é só do componente montado.
 */
export function AdvancedSection({ children }: { children?: ReactNode }) {
  if (Children.toArray(children).length === 0) return null
  return (
    <CollapsibleSection id="advanced" title="Avançado" defaultOpen={false} persist={false} headingLevel={3}>
      {children}
    </CollapsibleSection>
  )
}

/**
 * Um controle do Avançado com a frase que diz o que ele faz. O controle recebe
 * o id da frase para ligar `aria-describedby`, então o leitor de tela lê a
 * explicação junto do controle.
 */
export function AdvancedField({ hint, children }: { hint: string; children: (hintId: string) => ReactNode }) {
  const hintId = `${useId()}-hint`
  return (
    <div className="lb-advanced__item">
      {children(hintId)}
      <p className="lb-field__hint" id={hintId}>
        {hint}
      </p>
    </div>
  )
}

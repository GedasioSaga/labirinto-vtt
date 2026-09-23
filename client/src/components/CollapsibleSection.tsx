import { useId, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from './icons'

export interface CollapsibleSectionProps {
  /** Identificador estável: vira a chave `lb-section:<id>` no localStorage. */
  id: string
  title: string
  /** Usado enquanto o usuário nunca abriu/fechou esta seção. Pode mudar entre
   *  renders (ex.: abre com Selecionar e nada selecionado) — só o clique do
   *  usuário grava preferência, e a partir daí ela vence. */
  defaultOpen: boolean
  /** `false` ignora o localStorage: a seção sempre nasce em `defaultOpen` e o
   *  clique vale só enquanto ela estiver montada (Avançado, D13). Default `true`. */
  persist?: boolean
  /** Nível do título: 3 quando a seção mora dentro de um bloco que já tem h2. Default 2. */
  headingLevel?: 2 | 3
  children: ReactNode
}

const STORAGE_PREFIX = 'lb-section:'

/** localStorage pode não existir ou lançar (janela privada, dado bloqueado):
 *  sem preferência gravada a seção só segue `defaultOpen`. */
function readStoredOpen(id: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id)
    if (raw === '1') return true
    if (raw === '0') return false
    return null
  } catch {
    return null
  }
}

function writeStoredOpen(id: string, open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, open ? '1' : '0')
  } catch {
    // Sem armazenamento a escolha vale só nesta sessão (estado React abaixo).
  }
}

/**
 * Seção do painel que abre e fecha pelo cabeçalho. O cabeçalho é um `<button>`
 * de verdade (teclado e leitor de tela de graça) com `aria-expanded` e
 * `aria-controls` apontando para o corpo. O corpo fechado sai do DOM via
 * `hidden`, então controles recolhidos não entram na ordem de Tab.
 */
export function CollapsibleSection({
  id,
  title,
  defaultOpen,
  persist = true,
  headingLevel = 2,
  children,
}: CollapsibleSectionProps) {
  const [storedOpen, setStoredOpen] = useState<boolean | null>(() => (persist ? readStoredOpen(id) : null))
  const open = storedOpen ?? defaultOpen
  const bodyId = `${useId()}-body`
  const Heading = headingLevel === 3 ? 'h3' : 'h2'

  const toggle = () => {
    const next = !open
    setStoredOpen(next)
    if (persist) writeStoredOpen(id, next)
  }

  return (
    <section className="lb-section lb-collapsible">
      <Heading className="lb-collapsible__heading">
        <button
          type="button"
          className="lb-collapsible__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
        >
          <span className="lb-eyebrow">{title}</span>
          <span className="lb-collapsible__chevron">
            <ChevronDownIcon size={14} />
          </span>
        </button>
      </Heading>
      <div id={bodyId} className="lb-collapsible__body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}

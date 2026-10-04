import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from './icons'
import './CollapsibleSection.css'

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
  /** `true` só monta o conteúdo com a seção aberta: fechada, ele nem existe no
   *  DOM. Para listas longas (Objetos do mapa), que fechadas não custam nada e
   *  não repetem na página os nomes que o resto da tela já mostra. Default `false`. */
  lazy?: boolean
  /** Muda de valor para ABRIR a seção de fora — um atalho de teclado, no molde
   *  do contador de `resetZoomRequest`. O valor da montagem não abre nada, e
   *  fechar à mão continua valendo até o próximo pedido. */
  openRequest?: number
  /** Quantos itens a lista de dentro tem: o número discreto entre o nome e a
   *  seta ("Cenas 3 ›"). Só acima de zero — linha sem número é lista vazia.
   *  Ausente = a linha não conta (seção `lazy`, ou que não é lista). */
  contagem?: number
  /** Avisa quem monta a seção se ela está aberta, na montagem e a cada troca
   *  (a coluna da direita dá a altura toda às abas quando Cenas recolhe). */
  onOpenChange?: (open: boolean) => void
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
 *
 * O título é nome de LINHA, em minúscula (`.lb-collapsible__titulo`), e não
 * legenda em caixa alta: caixa alta fica para o título de grupo — AVENTURA,
 * ESTA CENA, PAREDE (pedido painel-acervo, fatia 3; CollapsibleSection.css).
 *
 * A contagem (fatia 5) fica FORA do nome do botão: as jornadas procuram
 * `getByRole('button', { name: 'Cenas', exact: true })`. Ela é a descrição
 * dele — `aria-describedby` lê o texto do alvo mesmo `aria-hidden` —, então o
 * leitor de tela ouve "Cenas", recolhido, "3": o mesmo que quem enxerga lê.
 */
export function CollapsibleSection({
  id,
  title,
  defaultOpen,
  persist = true,
  headingLevel = 2,
  lazy = false,
  openRequest,
  contagem,
  onOpenChange,
  children,
}: CollapsibleSectionProps) {
  const [storedOpen, setStoredOpen] = useState<boolean | null>(() => (persist ? readStoredOpen(id) : null))
  const open = storedOpen ?? defaultOpen
  const baseId = useId()
  const bodyId = `${baseId}-body`
  const contagemId = `${baseId}-contagem`
  // `> 0` também barra NaN: número que não é contagem não vira linha com "NaN".
  const mostraContagem = contagem !== undefined && contagem > 0
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  /** Último pedido de abrir já atendido; o da montagem conta como atendido. */
  const seenOpenRequest = useRef(openRequest)

  useEffect(() => {
    if (openRequest === seenOpenRequest.current) return
    seenOpenRequest.current = openRequest
    setStoredOpen(true)
    if (persist) writeStoredOpen(id, true)
  }, [openRequest, id, persist])

  // Ref, não dependência: um `onOpenChange` novo a cada render do pai não pode reavisar.
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange
  useEffect(() => {
    onOpenChangeRef.current?.(open)
  }, [open])

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
          aria-describedby={mostraContagem ? contagemId : undefined}
          onClick={toggle}
        >
          <span className="lb-collapsible__titulo">{title}</span>
          {mostraContagem && (
            <span id={contagemId} className="lb-collapsible__contagem" aria-hidden="true">
              {contagem}
            </span>
          )}
          <span className="lb-collapsible__chevron">
            <ChevronDownIcon size={14} />
          </span>
        </button>
      </Heading>
      <div id={bodyId} className="lb-collapsible__body" hidden={!open}>
        {lazy && !open ? null : children}
      </div>
    </section>
  )
}

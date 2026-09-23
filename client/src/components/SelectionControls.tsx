import { useRef, useState } from 'react'
import type { SelectionKind } from '../types/tools'
import { deleteSelectionLabel } from './labels'
import { TokenIcon } from './icons'

/**
 * Onda 4, item 24 — resumo do conjunto canônico (`lib/selectionModel.ts`),
 * não mais um único `Selection`. `kind` só importa quando `count === 1` (pra
 * escolher o rótulo singular "parede"/"token"/...); com `count > 1` o botão
 * mostra a contagem, sem tentar nomear um tipo dominante.
 *
 * Exceção deliberada de escopo do integrador da Onda 4: este arquivo não
 * está na lista de arquivos da tarefa, mas sem esta mudança o botão "Apagar"
 * ficaria PERMANENTEMENTE desabilitado sempre que 2+ itens estivessem
 * selecionados (`selection: Selection | null` não tem como representar
 * "vários") — quebraria justamente o deliverable pedido ("apagar passa a
 * valer para o conjunto inteiro"). Mudança mínima: só o tipo do prop e o
 * texto do botão para `count > 1`. O texto de `count === 1` mudou na
 * auditoria de 14/09: gênero por tipo ("Apagar parede selecionada",
 * "Apagar token selecionado"), ver `deleteSelectionLabel` em labels.ts.
 */
export interface SelectionSummary {
  kind: SelectionKind
  count: number
}

export interface SelectionControlsProps {
  selection: SelectionSummary | null
  /** Nome sugerido no campo ao adicionar token ("Token 1", "Token 2"…). */
  defaultTokenName: string
  /** Chamado com o nome confirmado (nunca vazio: vazio vira `defaultTokenName`). */
  onAddToken: (name: string) => void
  onRemoveSelected: () => void
}

/**
 * Ações sobre o que está selecionado no mapa.
 *
 * O texto do botão de apagar para 1 item selecionado é verificado byte a
 * byte pelos testes e2e (`toHaveText('Apagar parede selecionada')`),
 * então esse caso não pode ganhar ícone nem qualquer outro nó de texto.
 *
 * "Adicionar token" pede o nome antes de criar: sem isso todo token nascia
 * "Token" e a lista de atribuir jogador ficava com itens idênticos.
 */
export function SelectionControls({ selection, defaultTokenName, onAddToken, onRemoveSelected }: SelectionControlsProps) {
  const [tokenNameDraft, setTokenNameDraft] = useState<string | null>(null)
  /**
   * O campo abre com o nome sugerido JÁ SELECIONADO (`onFocus` + `select()`),
   * para quem quer outro nome só digitar por cima. Mas o clique do mouse
   * desmancha essa seleção antes da primeira tecla — o cursor ia parar no fim
   * do texto e o nome saía grudado: "Token 1Goblin" em vez de "Goblin".
   *
   * Esta marca segura a seleção no PRIMEIRO `mouseup` depois do foco. Do
   * segundo clique em diante o campo se comporta como qualquer outro (o clique
   * posiciona o cursor), que é o que se espera de quem foi corrigir uma letra.
   */
  const justSelectedOnFocus = useRef(false)
  const label =
    selection === null
      ? 'Nada selecionado'
      : selection.count === 1
        ? deleteSelectionLabel(selection.kind)
        : `Apagar ${selection.count} itens selecionados`

  const confirmToken = () => {
    if (tokenNameDraft === null) return
    const name = tokenNameDraft.trim()
    onAddToken(name === '' ? defaultTokenName : name)
    setTokenNameDraft(null)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Seleção</h2>
      {tokenNameDraft === null ? (
        <button type="button" className="lb-btn lb-btn--block" onClick={() => setTokenNameDraft(defaultTokenName)}>
          <TokenIcon size={16} />
          Adicionar token
        </button>
      ) : (
        <form
          className="lb-field"
          onSubmit={(event) => {
            event.preventDefault()
            confirmToken()
          }}
        >
          <label className="lb-label" htmlFor="lb-new-token-name">
            Nome do novo token
          </label>
          <input
            id="lb-new-token-name"
            className="lb-input"
            value={tokenNameDraft}
            autoFocus
            onFocus={(event) => {
              event.target.select()
              justSelectedOnFocus.current = true
            }}
            onMouseUp={(event) => {
              if (!justSelectedOnFocus.current) return
              justSelectedOnFocus.current = false
              // Impede a ação padrão do mouseup, que é colapsar a seleção no
              // ponto do clique — ver `justSelectedOnFocus` acima.
              event.preventDefault()
            }}
            onBlur={() => {
              justSelectedOnFocus.current = false
            }}
            onChange={(event) => setTokenNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setTokenNameDraft(null)
            }}
          />
          <button type="submit" className="lb-btn lb-btn--primary lb-btn--block">
            Adicionar
          </button>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={() => setTokenNameDraft(null)}>
            Cancelar
          </button>
        </form>
      )}
      <button
        type="button"
        className={`lb-btn lb-btn--block${selection ? ' lb-btn--danger' : ''}`}
        onClick={onRemoveSelected}
        disabled={!selection}
      >
        {label}
      </button>
    </section>
  )
}

import type { SelectionKind } from '../types/tools'
import { SELECTION_LABELS } from './labels'
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
 * texto do botão para `count > 1`; o texto de `count === 1` é BYTE A BYTE o
 * mesmo de antes (e2e `toHaveText('Apagar parede selecionada(o)')` continua
 * válido).
 */
export interface SelectionSummary {
  kind: SelectionKind
  count: number
}

export interface SelectionControlsProps {
  selection: SelectionSummary | null
  onAddToken: () => void
  onRemoveSelected: () => void
}

/**
 * Ações sobre o que está selecionado no mapa.
 *
 * O texto do botão de apagar para 1 item selecionado é verificado byte a
 * byte pelos testes e2e (`toHaveText('Apagar parede selecionada(o)')`),
 * então esse caso não pode ganhar ícone nem qualquer outro nó de texto.
 */
export function SelectionControls({ selection, onAddToken, onRemoveSelected }: SelectionControlsProps) {
  const label =
    selection === null
      ? 'Nada selecionado'
      : selection.count === 1
        ? `Apagar ${SELECTION_LABELS[selection.kind]} selecionada(o)`
        : `Apagar ${selection.count} itens selecionados`

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Seleção</h2>
      <button type="button" className="lb-btn lb-btn--block" onClick={onAddToken}>
        <TokenIcon size={16} />
        Adicionar token
      </button>
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

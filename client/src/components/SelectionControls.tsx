import { useEffect, useRef } from 'react'
import type { SelectionKind } from '../types/tools'
import type { SecretBatchState } from '../lib/batchSecret'

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

/**
 * "Oculto para jogadores" EM LOTE (`lib/batchSecret.ts`). `count` é quantos
 * itens da seleção aceitam o controle — parede e luz não entram na conta.
 */
export interface SelectionSecretProps {
  state: SecretBatchState
  count: number
  /** `true` esconde todos; `false` mostra todos. Misturado vira "esconder". */
  onChange: (secret: boolean) => void
}

/**
 * O objeto que o App monta para a seleção. O tipo continua o mesmo de antes da
 * fatia 2 do painel-acervo, para o App não mudar; quem lê cada campo agora:
 * `selection` e `onRemoveSelected` → faixa do topo (`SelectionHeader`, ou
 * `NadaSelecionado` sem seleção); `defaultTokenName` e `onAddToken` → o
 * "+ Token" (`NovoTokenForm`); `secret` → esta seção.
 */
export interface SelectionControlsProps {
  selection: SelectionSummary | null
  /** Ausente: um item só (ele tem o próprio toggle) ou nada que aceite. */
  secret?: SelectionSecretProps
  /** Nome sugerido no campo ao adicionar token ("Token 1", "Token 2"…). */
  defaultTokenName: string
  /** Chamado com o nome confirmado (nunca vazio: vazio vira `defaultTokenName`). */
  onAddToken: (name: string) => void
  /**
   * Apaga a seleção. O botão que a chama mora na faixa do topo
   * (`SelectionHeader`, montada pelo `PropertiesPanel` com este mesmo objeto):
   * uma instância só do "Apagar …", à vista em qualquer altura da coluna.
   */
  onRemoveSelected: () => void
}

/**
 * Interruptor de três estados. O terceiro (misturado) é o `indeterminate` do
 * checkbox nativo — só existe como propriedade do DOM, não como atributo, por
 * isso o efeito. O leitor de tela anuncia "misto" sozinho. Clicar num
 * misturado esconde todos: quem selecionou os 4 guardas quer um estado só.
 * O efeito roda a cada render, não só quando `state` muda: o clique nativo
 * zera o `indeterminate` antes de o React devolver o `checked`, e um clique
 * sem efeito no mapa deixaria a caixa mentindo "nenhum".
 */
function BatchSecretToggle({ state, count, onChange }: SelectionSecretProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (inputRef.current !== null) inputRef.current.indeterminate = state === 'mixed'
  })
  return (
    <label className="lb-switch">
      <span>{`Oculto para jogadores (${count})`}</span>
      <span className="lb-switch__track">
        <input
          ref={inputRef}
          className="lb-switch__input"
          type="checkbox"
          checked={state === 'all'}
          onChange={() => onChange(state !== 'all')}
        />
      </span>
    </label>
  )
}

/**
 * A seção "Seleção" — só com o "Oculto para jogadores" de vários itens de uma
 * vez. Sem ele não desenha nada: a seção fixa que aparecia com qualquer
 * ferramenta na mão era ruído (pedido painel-acervo, fatia 2). O que ela
 * guardava não sumiu:
 * - "Adicionar token" virou o "+ Token": na faixa do topo sem seleção
 *   (`NadaSelecionado`), no título do Acervo com seleção (`TokenLibraryPanel`),
 *   com o mesmo nome acessível e o mesmo campo "Nome do novo token"
 *   (`NovoTokenForm`);
 * - "Nada selecionado" virou a faixa do topo sem seleção (`NadaSelecionado`);
 * - o "Apagar" já morava na faixa da seleção (`SelectionHeader`).
 */
export function SelectionControls({ secret }: Pick<SelectionControlsProps, 'secret'>) {
  if (secret === undefined) return null
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Seleção</h2>
      <BatchSecretToggle {...secret} />
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { SelectionKind } from '../types/tools'
import type { SecretBatchState } from '../lib/batchSecret'
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
 * A seção "Seleção": o que vale sem nada selecionado ("Adicionar token") e o
 * "Oculto para jogadores" de vários itens de uma vez.
 *
 * Sem seleção fica o botão desabilitado "Nada selecionado", onde o "Apagar"
 * morava: os testes e2e o procuram (`getByRole('button', { name:
 * /Apagar|Nada selecionado/ })`) para saber que o clique no vazio desmarcou.
 * Com seleção o "Apagar" está na faixa do topo, e aqui não repete — duas
 * instâncias do mesmo nome quebrariam o modo estrito do Playwright.
 *
 * "Adicionar token" pede o nome antes de criar: sem isso todo token nascia
 * "Token" e a lista de atribuir jogador ficava com itens idênticos.
 */
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

export function SelectionControls({ selection, secret, defaultTokenName, onAddToken }: SelectionControlsProps) {
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
      {secret !== undefined && <BatchSecretToggle {...secret} />}
      {selection === null && (
        <button type="button" className="lb-btn lb-btn--block" disabled>
          Nada selecionado
        </button>
      )}
    </section>
  )
}

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import './NovoTokenForm.css'

/**
 * Nome acessível do "+ Token". As jornadas clicam
 * `getByRole('button', { name: 'Adicionar token' })`, várias SEM `exact`: na
 * página inteira só pode haver UM botão cujo nome contenha este trecho. Por
 * isso o "+ Token" mora num lugar de cada vez — na faixa do topo sem seleção
 * (`NadaSelecionado`), no título do Acervo com seleção (`TokenLibraryPanel`).
 */
export const ADICIONAR_TOKEN = 'Adicionar token'

/** Frase do balão nativo do "+ Token": onde a peça nasce, e que nasce sem foto (o acervo só guarda com foto). */
export const ADICIONAR_TOKEN_DICA = 'Põe um token novo, sem foto, no centro da vista'

/** O que o "+ Token" precisa de quem monta a tela — o mesmo par que `SelectionControlsProps` já traz do App. */
export interface NovoTokenProps {
  /** Nome sugerido no campo ("Token 1", "Token 2"…). */
  defaultTokenName: string
  /** Chamado com o nome confirmado (nunca vazio: vazio vira `defaultTokenName`). */
  onAddToken: (name: string) => void
}

interface NovoTokenFormProps {
  defaultTokenName: string
  /** O nome já aparado; campo em branco chega como `defaultTokenName`. */
  onConfirm: (nome: string) => void
  onCancel: () => void
  /** Classe a mais de quem monta (`lb-section` quando o campo desce solto no topo do corpo). */
  className?: string
}

/**
 * O formulário que o "+ Token" abre: "Nome do novo token", Cancelar e
 * Adicionar. Saiu da antiga seção "Seleção" sem mudar o gesto — pedir o nome
 * antes de criar evita a lista de atribuir jogador cheia de "Token" iguais.
 *
 * Os dois botões numa linha, à direita, como o campo de nova pasta do Acervo
 * (`.lb-acervo__form-acoes`): os dois formulários em linha do painel se
 * parecem. "Adicionar" é o envio, e o texto exato é o que as jornadas clicam.
 */
export function NovoTokenForm({ defaultTokenName, onConfirm, onCancel, className }: NovoTokenFormProps) {
  const [nome, setNome] = useState(defaultTokenName)
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

  // Aberto no pé da coluna (o "+ Token" do Acervo), o foco automático só traz
  // o CAMPO para a vista, e o Cancelar e o Adicionar ficavam cortados embaixo.
  // Uma vez, ao abrir, sem animação: quem abriu acabou de clicar ali.
  const formRef = useRef<HTMLFormElement>(null)
  useLayoutEffect(() => {
    formRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  // No formulário inteiro, e não só no campo: depois de um Tab o foco está no
  // Cancelar ou no Adicionar, e o Esc tem de desistir de onde o foco estiver.
  // Não chega ao mapa: lá o Esc é "cancelar" e largaria a seleção.
  const teclar = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onCancel()
  }

  return (
    <form
      ref={formRef}
      className={className === undefined ? 'lb-novotoken' : `${className} lb-novotoken`}
      onKeyDown={teclar}
      onSubmit={(event) => {
        event.preventDefault()
        const limpo = nome.trim()
        onConfirm(limpo === '' ? defaultTokenName : limpo)
      }}
    >
      <label className="lb-label" htmlFor="lb-new-token-name">
        Nome do novo token
      </label>
      <input
        id="lb-new-token-name"
        className="lb-input"
        value={nome}
        autoFocus
        onFocus={(event) => {
          event.target.select()
          justSelectedOnFocus.current = true
        }}
        onMouseUp={(event) => {
          if (!justSelectedOnFocus.current) return
          justSelectedOnFocus.current = false
          // Impede a ação padrão do mouseup, que é colapsar a seleção no ponto
          // do clique — ver `justSelectedOnFocus` acima.
          event.preventDefault()
        }}
        onBlur={() => {
          justSelectedOnFocus.current = false
        }}
        onChange={(event) => setNome(event.target.value)}
      />
      <div className="lb-novotoken__acoes">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn">
          Adicionar
        </button>
      </div>
    </form>
  )
}

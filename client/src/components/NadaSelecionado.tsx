import { useLayoutEffect, useRef, useState } from 'react'
import { BotaoMais } from './BotaoMais'
import { ADICIONAR_TOKEN, ADICIONAR_TOKEN_DICA, NovoTokenForm, type NovoTokenProps } from './NovoTokenForm'
import './NadaSelecionado.css'

/**
 * A faixa do topo do corpo quando nada está selecionado (pedido
 * painel-acervo, fatia 2). Mora no lugar da faixa da seleção
 * (`SelectionHeader`), com a mesma altura e grudada no topo como ela:
 * selecionar e largar só troca o que a faixa diz.
 *
 * Junta as duas peças da antiga seção "Seleção", que aparecia com qualquer
 * ferramenta na mão:
 * - "Nada selecionado". O texto exato, o papel de botão e o `disabled` são
 *   contrato das jornadas — é a prova de que o clique no vazio desmarcou
 *   (task4-select-delete, parede-grossa e portao-vista-movel, este com a
 *   Parede armada). Nenhum outro texto da página pode conter "nada
 *   selecionado": `getByText` não aceitaria dois.
 * - o "+ Token" (nome "Adicionar token"), à mão sem rolar a coluna. Com
 *   seleção ele mora no título do Acervo — um lugar de cada vez, ver
 *   `ADICIONAR_TOKEN`.
 *
 * O campo do nome desce logo abaixo da faixa, como seção: a faixa continua do
 * tamanho de sempre.
 */
export function NadaSelecionado({ novoToken }: { novoToken: NovoTokenProps }) {
  const [aberto, setAberto] = useState(false)
  const botaoRef = useRef<HTMLButtonElement>(null)
  /** Desistiu do campo: o foco volta ao "+ Token" assim que ele voltar à tela. */
  const devolverFocoRef = useRef(false)

  useLayoutEffect(() => {
    if (!devolverFocoRef.current) return
    devolverFocoRef.current = false
    botaoRef.current?.focus()
  })

  return (
    <>
      <div className="lb-semsel">
        <button type="button" className="lb-semsel__estado" disabled>
          Nada selecionado
        </button>
        {!aberto && (
          <BotaoMais ref={botaoRef} alto nome={ADICIONAR_TOKEN} texto="Token" dica={ADICIONAR_TOKEN_DICA} onClick={() => setAberto(true)} />
        )}
      </div>
      {aberto && (
        <NovoTokenForm
          className="lb-section"
          defaultTokenName={novoToken.defaultTokenName}
          onConfirm={(nome) => {
            setAberto(false)
            novoToken.onAddToken(nome)
          }}
          onCancel={() => {
            devolverFocoRef.current = true
            setAberto(false)
          }}
        />
      )}
    </>
  )
}

import './NadaSelecionado.css'

/**
 * A faixa do topo do corpo quando nada está selecionado (pedido
 * painel-acervo). Mora no lugar da faixa da seleção (`SelectionHeader`), com
 * a mesma altura e grudada no topo como ela: selecionar e largar só troca o
 * que a faixa diz, sem a coluna pular.
 *
 * Diz só "Nada selecionado" — estado, não ação. O texto exato, o papel de
 * botão e o `disabled` são contrato das jornadas: é a prova de que o clique no
 * vazio desmarcou (task4-select-delete, parede-grossa e portao-vista-movel,
 * este com a Parede armada). Nenhum outro texto da página pode conter "nada
 * selecionado": `getByText` não aceitaria dois.
 *
 * O "+ Token" que morou aqui foi para o cabeçalho do painel: com seleção esta
 * faixa dá lugar à da seleção, e o botão sumia junto — criar o segundo token
 * pedia rolar até o Acervo, no pé da coluna. No cabeçalho ele fica no mesmo
 * lugar nos dois casos (ver `ADICIONAR_TOKEN`).
 */
export function NadaSelecionado() {
  return (
    <div className="lb-semsel">
      <button type="button" className="lb-semsel__estado" disabled>
        Nada selecionado
      </button>
    </div>
  )
}

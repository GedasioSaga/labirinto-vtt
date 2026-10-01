import { useId } from 'react'
import { selectEndireitarMudaria, useMapStore } from '../stores/mapStore'
import './EndireitarControl.css'

/**
 * A frase do balão: o que o botão faz, o atalho e o desfazer. O atalho vai por
 * extenso aqui porque a tecla desenhada no botão é só para os olhos — o leitor
 * de tela lê esta frase como a descrição do botão.
 */
export const ENDIREITAR_DICA = 'Deixa a linha em pé ou deitada, sem mudar o tamanho. Atalho: tocar o Alt. Ctrl+Z desfaz.'

/**
 * ENDIREITAR — pedido 5 de 30/09/2026 (PEDIDOS.md), fatia 3: a porta de entrada
 * visível do Alt tocado (`lib/endireitarComAlt.ts`). Um clique faz o mesmo que
 * o toque — `endireitarSelecionados`, um passo só de Ctrl+Z, com o aviso quando
 * algo ficou como estava.
 *
 * Aparece sozinho, e só quando o clique mudaria alguma coisa
 * (`selectEndireitarMudaria`): com Linha, Parede solta ou Caminho tortos na
 * seleção. Depois do clique a linha está reta e ele some — botão na tela
 * sempre faz algo, e o painel não ganha mais um controle parado (pedido 2).
 * Lê a store direto, sem prop do App: o painel só o põe no lugar.
 *
 * Sem título de seção, de propósito: fica logo depois da faixa da seleção, e o
 * primeiro título da coluna tem de continuar sendo o do item. Sem animação de
 * entrada nem de saída: ele aparece com um clique no mapa (gesto de toda hora)
 * e some com o Alt (gesto de teclado), e nos dois casos movimento só atrasa.
 * O aperto é o do `.lb-btn` (afunda 3%, nada com "reduzir movimento").
 */
export function EndireitarControl() {
  const mudaria = useMapStore(selectEndireitarMudaria)
  const endireitarSelecionados = useMapStore((state) => state.endireitarSelecionados)
  const dicaId = useId()
  if (!mudaria) return null
  return (
    <section className="lb-section">
      <div className="lb-field">
        <button type="button" className="lb-btn lb-btn--block" aria-describedby={dicaId} onClick={() => endireitarSelecionados()}>
          Endireitar{' '}
          <kbd className="lb-endireitar__tecla" aria-hidden="true">
            Alt
          </kbd>
        </button>
        <p id={dicaId} className="lb-field__hint">
          {ENDIREITAR_DICA}
        </p>
      </div>
    </section>
  )
}

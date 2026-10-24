import { useId } from 'react'
import { cliqueParaAndarLigado } from '../../lib/cliqueParaAndar'
import { useMapStore } from '../../stores/mapStore'
import { Toggle } from '../Toggle'

/**
 * CLICAR PARA ANDAR (CAMINHOS F2): a chave do mestre na página Cena do livro,
 * só desta cena. Ligada (o padrão), o jogador clica no chão e a ficha dele anda
 * até lá pelo que ele conhece; desligada, ele só arrasta. O mestre não ganha a
 * ação: arrasta como sempre. Lê e grava a cena aberta direto na store (com
 * desfazer), sem passar pelo App.
 */
export function ChaveCliqueParaAndar() {
  const dicaId = useId()
  const ligado = useMapStore((state) => cliqueParaAndarLigado(state.map))
  const setCliqueParaAndar = useMapStore((state) => state.setCliqueParaAndar)
  return (
    <div className="lb-field gr-paginas__clique-para-andar">
      <Toggle label="Clicar para andar" checked={ligado} describedBy={dicaId} onChange={setCliqueParaAndar} />
      <p id={dicaId} className="lb-field__hint">
        {ligado
          ? 'O jogador clica no chão e a ficha anda até lá, pelo caminho que ele já conhece.'
          : 'Desligado: o jogador só arrasta a ficha. Quem clica no chão vê um aviso.'}
      </p>
    </div>
  )
}

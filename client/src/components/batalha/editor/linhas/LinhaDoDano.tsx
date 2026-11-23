import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../../lib/personagem'
import { BlocoDoDano } from '../../blocos/BlocoDoDano'

/** LINHA DANO (EDITOR.md §5): a fórmula com os botões de atributo e o "O app calcula sozinho" de hoje (`CampoDeDano`). */
export function LinhaDoDano({ mecanica, cartao, ficha, onChange }: { mecanica: MecanicaV1; cartao: CartaoDaFicha; ficha: FichaDaPrevia; onChange: (mecanica: MecanicaV1) => void }) {
  return <BlocoDoDano mecanica={mecanica} cartao={cartao} ficha={ficha} onChange={onChange} />
}

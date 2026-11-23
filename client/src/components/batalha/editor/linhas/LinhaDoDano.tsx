import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../../lib/personagem'
import { BlocoDoDano } from '../../blocos/BlocoDoDano'

/**
 * LINHA DANO (EDITOR.md §5): a fórmula com os botões de atributo e o "O app calcula sozinho" de hoje
 * (`CampoDeDano`). ED7: na arma, sem o "Dano da arma" (o dano da arma é o dela mesma).
 */
export function LinhaDoDano({ mecanica, cartao, ficha, naArma = false, onChange }: { mecanica: MecanicaV1; cartao: CartaoDaFicha; ficha: FichaDaPrevia; naArma?: boolean; onChange: (mecanica: MecanicaV1) => void }) {
  return <BlocoDoDano mecanica={mecanica} cartao={cartao} ficha={ficha} onChange={onChange} naArma={naArma} />
}

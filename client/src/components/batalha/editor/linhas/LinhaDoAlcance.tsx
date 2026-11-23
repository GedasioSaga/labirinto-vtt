import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import { BlocoDoAlvo } from '../../blocos/BlocoDoAlvo'

/**
 * LINHA ALCANCE (EDITOR.md §5): em quem pega, a forma (o seletor aprovado do
 * alcance, `EscolhaDaForma`) e o tamanho. O mapa 13x13 da coluna do papel
 * acompanha cada clique.
 */
export function LinhaDoAlcance({ mecanica, onChange }: { mecanica: MecanicaV1; onChange: (mecanica: MecanicaV1) => void }) {
  return <BlocoDoAlvo mecanica={mecanica} onChange={onChange} />
}

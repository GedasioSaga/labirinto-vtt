import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import { BlocoDoAlvo } from '../../blocos/BlocoDoAlvo'

/**
 * LINHA ALCANCE (EDITOR.md §5): em quem pega, a forma (o seletor aprovado do
 * alcance, `EscolhaDaForma`) e o tamanho. O mapa 13x13 da coluna do papel
 * acompanha cada clique. ED7: na arma montada, só as formas que o Atacar
 * executa (alvo até N ou anel), com a frase que diz por quê.
 */
export function LinhaDoAlcance({ mecanica, naArma = false, onChange }: { mecanica: MecanicaV1; naArma?: boolean; onChange: (mecanica: MecanicaV1) => void }) {
  return <BlocoDoAlvo mecanica={mecanica} onChange={onChange} naArma={naArma} />
}

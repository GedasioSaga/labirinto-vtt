import type { EfeitoDoItem } from '../../../../types/map'
import { Escolha, type Opcao } from '../../blocos/controles'

/** Quanto e onde o item gasta: o resto do efeito são as peças. */
export type GastoDoItem = Pick<EfeitoDoItem, 'gasta' | 'onde'>

const GASTOS: readonly Opcao<EfeitoDoItem['gasta']>[] = [
  { valor: 'um', rotulo: 'Gasta 1 por uso' },
  { valor: 'nada', rotulo: 'Não acaba (amuleto)' },
]

const ONDES: readonly Opcao<EfeitoDoItem['onde']>[] = [
  { valor: 'sempre', rotulo: 'Na batalha e fora' },
  { valor: 'soNaBatalha', rotulo: 'Só na batalha' },
  { valor: 'soFora', rotulo: 'Só fora da batalha' },
]

/**
 * LINHA GASTO (ED7, só no item; EDITOR.md §5 "Item: Alcance, Efeitos, Gasto, Requisitos"): quanto o
 * uso gasta da vaga e onde o item vale. Grava no efeito do item, fora das peças, como a janela de antes.
 */
export function LinhaDoGasto({ gasto, onChange }: { gasto: GastoDoItem; onChange: (gasto: GastoDoItem) => void }) {
  return (
    <>
      <Escolha legenda="Quanto gasta" opcoes={GASTOS} valor={gasto.gasta} onChange={(gasta) => onChange({ ...gasto, gasta })} />
      <Escolha legenda="Onde vale" opcoes={ONDES} valor={gasto.onde} onChange={(onde) => onChange({ ...gasto, onde })} />
    </>
  )
}

import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../../lib/batalha/mecanica/resumo'
import { BlocoDosEfeitos } from '../../blocos/BlocoDosEfeitos'

/**
 * LINHA EFEITOS (EDITOR.md §5): selo, cura, tirar selos, dreno, reviver e o
 * lembrete à mão, com as peças do selo de hoje (`PecasDoSelo`). O "+N no
 * acumulador" entra aqui na ED4/ED5, quando a peça existir no motor.
 */
export function LinhaDosEfeitos({ mecanica, ficha, onChange }: { mecanica: MecanicaV1; ficha: FichaDaPrevia; onChange: (mecanica: MecanicaV1) => void }) {
  return <BlocoDosEfeitos mecanica={mecanica} ficha={ficha} onChange={onChange} />
}

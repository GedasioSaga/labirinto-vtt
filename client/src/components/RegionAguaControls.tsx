import { useId } from 'react'
import { Toggle } from './Toggle'

export interface RegionAguaControlsProps {
  /** `Region.agua === true` (`types/map.ts`). */
  agua: boolean
  onAguaChange: (agua: boolean) => void
}

/**
 * Chave "É água" da região selecionada (pedido de 28/10/2026): o lago ou o rio
 * feito de região sai da terra do relevo (`regioesDaTerra`, `lib/relevo.ts`).
 * Só aparece fora do continente, onde ela muda alguma coisa. Mesmo molde das
 * chaves do Mapa vivo (`SceneMapTypeControls.tsx`): a chave e a dica ligada a ela.
 */
export function RegionAguaControls({ agua, onAguaChange }: RegionAguaControlsProps) {
  const dicaId = useId()
  return (
    <div className="lb-field">
      <Toggle label="É água" checked={agua} describedBy={dicaId} onChange={onAguaChange} />
      <p id={dicaId} className="lb-field__hint">
        Lago, rio ou mar: com o relevo ligado, fica plana, sem virar morro, e não segura penhasco.
      </p>
    </div>
  )
}

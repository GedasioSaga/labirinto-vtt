import { shallow } from 'zustand/shallow'
import { useMapStore } from './mapStore'

/**
 * Assina mudanças em map.props — evita redesenhar a camada de objetos em
 * mutações não relacionadas (addWall, setCamera, moveToken etc), mesmo
 * padrão de gridSubscription.ts/shapesSubscription.ts/tokensSubscription.ts.
 */
export function subscribeToPropsRedraw(onChange: () => void): () => void {
  return useMapStore.subscribe(
    (state) => state.map.props,
    onChange,
    { equalityFn: shallow },
  )
}

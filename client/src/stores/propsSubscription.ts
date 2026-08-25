import { shallow } from 'zustand/shallow'
import { useMapStore } from './mapStore'

/**
 * Assina mudanças em [map.props, selection] — evita redesenhar a camada de
 * objetos em mutações não relacionadas (addWall, setCamera, moveToken etc),
 * mesmo padrão de gridSubscription.ts/shapesSubscription.ts/tokensSubscription.ts.
 * `selection` entra porque o contorno de destaque da peça selecionada
 * (Task 3 de selecionar-apagar) é desenhado dentro de createPropsRenderer —
 * sem isso aqui, clicar pra selecionar uma peça não redesenha o contorno.
 */
export function subscribeToPropsRedraw(onChange: () => void): () => void {
  return useMapStore.subscribe(
    (state) => [state.map.props, state.selection] as const,
    onChange,
    { equalityFn: shallow },
  )
}

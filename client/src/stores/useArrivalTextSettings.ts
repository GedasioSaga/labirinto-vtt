import { useMapStore } from './mapStore'
import type { ArrivalTextControlsProps } from '../components/ArrivalTextControls'

/**
 * TEXTO DE CHEGADA ligado à cena aberta no editor: o que a janela
 * Configurações do mapa mostra e para onde vai o que o mestre escreve. Mora
 * fora do `App.tsx` para a ligação store → janela ter prova própria
 * (`components/ArrivalTextSettings.editor.test.tsx`).
 */
export function useArrivalTextSettings(): ArrivalTextControlsProps {
  const text = useMapStore((state) => state.map.textoChegada ?? '')
  const onChange = useMapStore((state) => state.setArrivalText)
  return { text, onChange }
}

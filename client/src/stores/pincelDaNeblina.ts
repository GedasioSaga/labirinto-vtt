import { create } from 'zustand'
import {
  FORCA_DA_NEBLINA_MAX,
  FORCA_DA_NEBLINA_MIN,
  FORCA_DA_NEBLINA_PADRAO,
  TAMANHO_DA_NEBLINA_PADRAO,
  type ModoDaNeblina,
} from '../lib/neblina'
import { TAMANHO_DO_PINCEL_MAX, TAMANHO_DO_PINCEL_MIN } from '../lib/texturas'

/**
 * O PINCEL DE NEBLINA do mestre (`lib/neblina.ts`): o que o PRÓXIMO gesto faz
 * (pincel ou borracha), o tamanho e a força. É preferência da mão, não do
 * mapa: não entra no desfazer nem no arquivo. Mora fora do `mapStore` para a
 * neblina não mexer no estado das outras ferramentas.
 */
interface PincelDaNeblina {
  modo: ModoDaNeblina
  tamanho: number
  forca: number
  setModo: (modo: ModoDaNeblina) => void
  setTamanho: (tamanho: number) => void
  setForca: (forca: number) => void
}

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

export const usePincelDaNeblina = create<PincelDaNeblina>((set) => ({
  modo: 'pincel',
  tamanho: TAMANHO_DA_NEBLINA_PADRAO,
  forca: FORCA_DA_NEBLINA_PADRAO,
  setModo: (modo) => set({ modo }),
  setTamanho: (tamanho) => {
    if (Number.isFinite(tamanho)) set({ tamanho: limitar(Math.round(tamanho), TAMANHO_DO_PINCEL_MIN, TAMANHO_DO_PINCEL_MAX) })
  },
  setForca: (forca) => {
    if (Number.isFinite(forca)) set({ forca: limitar(Math.round(forca * 100) / 100, FORCA_DA_NEBLINA_MIN, FORCA_DA_NEBLINA_MAX) })
  },
}))

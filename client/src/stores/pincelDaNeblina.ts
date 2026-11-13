import { create } from 'zustand'
import {
  DENSIDADE_DO_PINCEL_PADRAO,
  FORCA_DA_NEBLINA_MAX,
  FORCA_DA_NEBLINA_MIN,
  FORCA_DA_NEBLINA_PADRAO,
  TAMANHO_DA_NEBLINA_PADRAO,
  type ModoDaNeblina,
} from '../lib/neblina'
import { TAMANHO_DO_PINCEL_MAX, TAMANHO_DO_PINCEL_MIN } from '../lib/texturas'
import type { EfeitoDoPainel } from '../lib/ambiente'

/**
 * O PINCEL DE NEBLINA do mestre (`lib/neblina.ts`): o que o PRÓXIMO gesto faz
 * (pincel ou borracha), o tamanho, a força e a densidade. É preferência da
 * mão, não do mapa: não entra no desfazer nem no arquivo (a pincelada feita
 * leva os valores dela). Mora fora do `mapStore` para a neblina não mexer no
 * estado das outras ferramentas.
 */
interface PincelDaNeblina {
  /**
   * AMBIENTE (`lib/ambiente.ts`): o efeito que o painel e o pincel mexem agora.
   * A ferramenta Neblina virou Ambiente; a neblina é o primeiro dos seis.
   */
  efeito: EfeitoDoPainel
  setEfeito: (efeito: EfeitoDoPainel) => void
  modo: ModoDaNeblina
  tamanho: number
  forca: number
  /** 0 a 1: quanto da área a bruma pintada cobre (só o pincel; a borracha só tira). */
  densidade: number
  setModo: (modo: ModoDaNeblina) => void
  setTamanho: (tamanho: number) => void
  setForca: (forca: number) => void
  setDensidade: (densidade: number) => void
}

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

export const usePincelDaNeblina = create<PincelDaNeblina>((set) => ({
  efeito: 'neblina',
  setEfeito: (efeito) => set({ efeito }),
  modo: 'pincel',
  tamanho: TAMANHO_DA_NEBLINA_PADRAO,
  forca: FORCA_DA_NEBLINA_PADRAO,
  densidade: DENSIDADE_DO_PINCEL_PADRAO,
  setModo: (modo) => set({ modo }),
  setTamanho: (tamanho) => {
    if (Number.isFinite(tamanho)) set({ tamanho: limitar(Math.round(tamanho), TAMANHO_DO_PINCEL_MIN, TAMANHO_DO_PINCEL_MAX) })
  },
  setForca: (forca) => {
    if (Number.isFinite(forca)) set({ forca: limitar(Math.round(forca * 100) / 100, FORCA_DA_NEBLINA_MIN, FORCA_DA_NEBLINA_MAX) })
  },
  setDensidade: (densidade) => {
    if (Number.isFinite(densidade)) set({ densidade: limitar(Math.round(densidade * 100) / 100, 0, 1) })
  },
}))

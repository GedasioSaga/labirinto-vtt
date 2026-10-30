import { create } from 'zustand'
import type { ConsultaDaFicha } from './MiraDoGolpe'

/**
 * A MIRA DO MESTRE entre a aba Batalha (o painel da vez do NPC) e o mapa
 * (`App.tsx`, S4): o painel liga "Escolher no mapa"; com ela ligada, o App
 * passa `aoEscolherFicha` ao `PixiCanvas` (o clique esquerdo só mira e os
 * atalhos do editor ficam suspensos), e a ficha clicada volta ao painel.
 *
 * A consulta da posição na tela (S4, `onFichaNaTela`) mora fora do estado:
 * é uma função, e guardá-la com `set` a trataria como atualizador.
 */

let consultaAtual: ConsultaDaFicha | null = null

/** O App entrega aqui a consulta que o `PixiCanvas` registrou. */
export function guardarConsultaDoMestre(consulta: ConsultaDaFicha | null): void {
  consultaAtual = consulta
}

/** A consulta estável (a mesma função sempre), para os efeitos e as marcas da mira. */
export const consultaDoMestre: ConsultaDaFicha = (tokenId) => consultaAtual?.(tokenId) ?? null

interface MiraDoMestre {
  /** "Escolher no mapa" ligado no painel. */
  mirando: boolean
  /** A ficha clicada; `seq` sobe a cada clique (o mesmo token duas vezes desmarca). */
  alvo: { tokenId: string; seq: number } | null
  mirar: (mirando: boolean) => void
  escolher: (tokenId: string) => void
}

export const useMiraDoMestre = create<MiraDoMestre>()((set) => ({
  mirando: false,
  alvo: null,
  mirar: (mirando) => set({ mirando }),
  escolher: (tokenId) => set((state) => ({ alvo: { tokenId, seq: (state.alvo?.seq ?? 0) + 1 } })),
}))

/** O `aoEscolherFicha` do mapa do mestre (estável): a ficha clicada volta ao painel da vez. */
export function escolherFichaDoMestre(tokenId: string): void {
  useMiraDoMestre.getState().escolher(tokenId)
}

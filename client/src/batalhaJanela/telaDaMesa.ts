import { create } from 'zustand'
import type { TelaDoMenuDoMapa } from './tipos'

/**
 * O que a MESA DA BATALHA pede à tela da janela principal e não é da batalha
 * em si: o menu da vez sobre o mapa (o golpe de NPC que pede escolha a mais) e
 * a página Batalha do livro (dano, selos, extras, regras). Mora à parte para o
 * espelho e o App lerem sem importar um ao outro.
 */

export interface TelaDaMesa {
  /**
   * O menu da vez aberto sobre o mapa, para esta cena e esta vez; a vez andou, ele some sozinho. `tela` = a
   * tela em que ele abre (26/11/2026: Transformação, Passivas, Itens da mesa reduzida); `pedido` sobe a cada
   * pedido com tela, para o menu já aberto ir a ela de novo.
   */
  menuDoMapa: { sceneKey: string; vez: string; tela?: TelaDoMenuDoMapa; pedido: number } | null
  /** Sobe a cada pedido de abrir a página Batalha do livro (o App abre o livro e a página). */
  pedidosDoLivro: number
}

export const useTelaDaMesa = create<TelaDaMesa>(() => ({ menuDoMapa: null, pedidosDoLivro: 0 }))

export function abrirOLivroDaBatalha(): void {
  useTelaDaMesa.setState((antes) => ({ pedidosDoLivro: antes.pedidosDoLivro + 1 }))
}

export function ligarOMenuDoMapa(sceneKey: string, vez: string | null, tela?: TelaDoMenuDoMapa): void {
  useTelaDaMesa.setState((antes) => ({ menuDoMapa: vez === null ? null : { sceneKey, vez, ...(tela === undefined ? {} : { tela }), pedido: (antes.menuDoMapa?.pedido ?? 0) + 1 } }))
}

/** Fecha o menu da vez que a mesa abriu sobre o mapa (a troca do modo da batalha). */
export function fecharOMenuDoMapa(): void {
  if (useTelaDaMesa.getState().menuDoMapa !== null) useTelaDaMesa.setState({ menuDoMapa: null })
}

/** O menu da vez está aberto sobre o mapa nesta cena e nesta vez. */
export function menuDoMapaAberto(sceneKey: string, vez: string | null): boolean {
  const menu = useTelaDaMesa.getState().menuDoMapa
  return menu !== null && vez !== null && menu.sceneKey === sceneKey && menu.vez === vez
}

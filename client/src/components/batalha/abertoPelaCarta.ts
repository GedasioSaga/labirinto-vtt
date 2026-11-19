import { create } from 'zustand'
import type { CaixaDoMenuDBT } from '../dbt/batalha/OrdemDoMestreDBT'
import type { DialogoDoMestre } from './BatalhaDoMestre'

/**
 * O que o MENU DA CARTA do mestre abriu: o perfil, um diálogo do One Piece
 * (dano, ajustar, selo, extras, armas) ou a caixa do Dragon Ball (condição,
 * modificador). Mora fora da faixa porque três lugares pedem o mesmo menu (a
 * faixa do alto, a mesa da batalha encostada no mapa e a janela à parte, pelo
 * fio) e um só desenha: a faixa da cena, que fica montada (mesmo escondida
 * atrás da mesa) enquanto há batalha. As janelas do app vão para o `body`.
 */

export type AbertoPelaCarta =
  | { tipo: 'perfil'; personagemId: string }
  | { tipo: 'dialogo'; dialogo: DialogoDoMestre }
  | { tipo: 'caixaDBT'; caixa: CaixaDoMenuDBT }

interface EstadoDoAberto {
  /** A cena em que abriu: trocou de cena, a janela de lá não aparece na outra. */
  sceneKey: string | null
  aberto: AbertoPelaCarta | null
}

export const useAbertoPelaCarta = create<EstadoDoAberto>(() => ({ sceneKey: null, aberto: null }))

export function abrirPelaCarta(sceneKey: string, aberto: AbertoPelaCarta): void {
  useAbertoPelaCarta.setState({ sceneKey, aberto })
}

export function fecharOAbertoPelaCarta(): void {
  useAbertoPelaCarta.setState({ sceneKey: null, aberto: null })
}

/** O que está aberto nesta cena, deste tipo; `null` = nada. */
export function abertoNaCena<T extends AbertoPelaCarta['tipo']>(estado: EstadoDoAberto, sceneKey: string, tipo: T): Extract<AbertoPelaCarta, { tipo: T }> | null {
  const { aberto } = estado
  if (aberto === null || estado.sceneKey !== sceneKey || aberto.tipo !== tipo) return null
  return aberto as Extract<AbertoPelaCarta, { tipo: T }>
}

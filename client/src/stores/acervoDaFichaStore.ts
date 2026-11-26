import { create } from 'zustand'
import type { ItemDoCatalogo } from '../lib/acervoDeItens'

/**
 * O ACERVO DE ITENS QUE A FICHA CONSULTA (o tipo e o pente de cada arma na aba "Mochila e
 * equipamento", `EquipamentoDaFicha`). Puro, sem o disco: a ficha também abre no site do Lobby, que
 * roda fora do Tauri e não tem Acervo. Vazio por padrão; no app, `stores/acervoDeItensStore.ts` põe
 * aqui a lista a cada mudança. Vazio, a vaga vale pela cópia que ela leva (o tipo e a regra dela).
 */
interface AcervoDaFichaState {
  itens: readonly ItemDoCatalogo[]
}

export const useAcervoDaFichaStore = create<AcervoDaFichaState>()(() => ({ itens: [] }))

/** O app põe o Acervo de agora (a cada mudança dele). */
export function definirAcervoDaFicha(itens: readonly ItemDoCatalogo[]): void {
  useAcervoDaFichaStore.setState({ itens })
}

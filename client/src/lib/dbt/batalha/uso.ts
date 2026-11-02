import { consumirCondicao } from './condicoes'
import type { TecnicaLida } from './leitura'
import { combatente, fichaDe, mudarCombatente, type Trabalho } from './trabalho'
import type { IdDoCombatente, Rank } from './tipos'

/**
 * USO DE TÉCNICA PAGA (docs/planos/dbt-batalha.md, 6.2 e 8.5.1.2). Num lugar
 * só para a ação, a reação e o Choque contarem igual: antes cada caminho
 * contava (ou esquecia) por conta própria.
 */

/** A exaustão de técnica de rank máximo começa no rank C (8.5.1.2). */
const RANKS_COM_EXAUSTAO: readonly Rank[] = ['C', 'B', 'A', 'Z']

/**
 * Depois de pagar uma técnica: consome o Sobrecarregado quando o x2 dele
 * entrou no custo ("próxima técnica de tipo Ki") e conta +1 uso de técnica do
 * rank máximo da ficha (+5% de Ki bloqueado no fim).
 */
export function contarTecnicaPaga(t: Trabalho, id: IdDoCombatente, tecnica: TecnicaLida, sobrecargaCobrada: boolean): void {
  const c = combatente(t, id)
  const f = fichaDe(t, c)
  if (c === undefined) return
  if (sobrecargaCobrada) consumirCondicao(t, id, 'sobrecarregado')
  if (!RANKS_COM_EXAUSTAO.includes(tecnica.rank) || tecnica.rank !== f?.rankMaximo) return
  mudarCombatente(t, id, (atual) => ({ ...atual, usos: { ...atual.usos, tecnicaDeRankMaximo: atual.usos.tecnicaDeRankMaximo + 1 } }))
}

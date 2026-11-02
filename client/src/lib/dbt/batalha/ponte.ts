import type { JudgeNaCena } from '../../batalha/judge'
import type { Personagem } from '../../personagem'
import type { FichaLida } from './leitura'
import type { AutorDBT, ComandoDBT, EstadoDBT } from './tipos'

/**
 * CONTRATO HOST <-> STORE DA BATALHA DBT (docs/planos/dbt-batalha.md, seção
 * 16). O host (fatia 2) só fala com a batalha por aqui; a store é quem
 * implementa (`ponteDaBatalhaDBT` em `stores/batalhaDBTStore.ts`).
 */
export interface PonteDaBatalhaDBT {
  cena(sceneKey: string): (EstadoDBT & { judge?: JudgeNaCena }) | null
  /** `ok` = aceito; recusado, `motivo` diz por quê (o host o passa ao jogador, cortado no teto do fio). */
  comando(sceneKey: string, autor: AutorDBT, comando: ComandoDBT): { ok: boolean; motivo?: string }
  desfazer(sceneKey: string, linhaId: string, autor: AutorDBT): boolean
  registrarAjuste(personagemId: string, antes: Personagem, depois: Personagem, autor: AutorDBT): void
  /** As fichas lidas pela batalha (para o recorte do jogador). */
  fichasLidas(sceneKey: string): ReadonlyMap<string, FichaLida | null>
}

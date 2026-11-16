import type { IndiceDasPastas } from '../pastasDeMapas'
import type { Campanha } from './tipos'

/**
 * A CAMPANHA LIGADA A UM SISTEMA (E3, decisão do mestre de 16/11: "Na pasta de
 * mapas"). O sistema mora na pasta de mapas (`<appData>/pastas/<id>/rpg.json`,
 * `sistemaDeRpg`), que o Labirinto já lê; a campanha guarda o dela
 * (`Campanha.sistemaId`) só enquanto não tem pasta, ou enquanto a pasta
 * escolhida ainda não tem sistema. Uma fonte só: a pasta, quando tem, ganha.
 * Virar NPC e Pôr no mapa perguntam aqui qual é o sistema da campanha.
 */

/** De onde vem o sistema da campanha. */
export type OrigemDoSistema = 'pasta' | 'campanha'

export interface SistemaDaCampanha {
  /** Id na biblioteca de sistemas; `null` = falta escolher. */
  readonly sistemaId: string | null
  readonly de: OrigemDoSistema | null
}

/** `sistemaDaPasta`: o `sistemaDeRpg` do `rpg.json` da pasta (`undefined` = a pasta não tem, ou não foi lida). */
export function sistemaDaCampanha(campanha: Campanha, sistemaDaPasta: (pastaId: string) => string | undefined): SistemaDaCampanha {
  const daPasta = campanha.pastaId === undefined ? undefined : sistemaDaPasta(campanha.pastaId)
  if (daPasta !== undefined) return { sistemaId: daPasta, de: 'pasta' }
  if (campanha.sistemaId !== undefined) return { sistemaId: campanha.sistemaId, de: 'campanha' }
  return { sistemaId: null, de: null }
}

/**
 * A campanha com outra pasta de mapas (`null` = nenhuma). Pasta com sistema:
 * o da campanha sai (a pasta manda). Pasta sem sistema, ou nenhuma: o da
 * campanha fica, para não perder a escolha.
 */
export function campanhaComPasta(campanha: Campanha, pastaId: string | null, sistemaDaPasta: string | undefined): Campanha {
  const { pastaId: _pasta, sistemaId, ...resto } = campanha
  const comPasta: Campanha = pastaId === null ? resto : { ...resto, pastaId }
  return sistemaId === undefined || (pastaId !== null && sistemaDaPasta !== undefined) ? comPasta : { ...comPasta, sistemaId }
}

/** O sistema guardado na campanha (`null` = nenhum). */
export function campanhaComSistema(campanha: Campanha, sistemaId: string | null): Campanha {
  const { sistemaId: _antes, ...resto } = campanha
  return sistemaId === null ? resto : { ...resto, sistemaId }
}

/** Quantos mapas usam o sistema da pasta: os que estão nela e não preferem o próprio ("Configurar só neste mapa"). */
export function mapasQueUsamAPasta(indice: IndiceDasPastas, pastaId: string): number {
  return indice.mapas.filter((mapa) => mapa.pastaId === pastaId && mapa.proprio !== true).length
}

/** Quantos mapas estão na pasta (a linha "14 mapas" do cartão). */
export function mapasNaPasta(indice: IndiceDasPastas, pastaId: string): number {
  return indice.mapas.filter((mapa) => mapa.pastaId === pastaId).length
}

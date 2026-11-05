/**
 * MOCHILA NA FICHA — o marcador da migração (docs/planos/lobby-jogadores-2026-11-05.md §4.2).
 *
 * Mora no `rpg.json` da pasta ou no `adventure.json` da aventura que usa as
 * próprias fichas (aventura sem pasta, mapa em "Configurar só neste mapa"):
 * `mochilaMigrada: 1`. Presente, a migração não roda de novo — rodar de novo
 * copiaria do boneco para a ficha uma mochila já gasta.
 *
 * Sem import nenhum de propósito: `lib/adventure.ts` lê o marcador, e este
 * arquivo não pode puxar nada que volte para ela.
 */

/** A versão da migração que este app grava. */
export const VERSAO_DA_MIGRACAO_DA_MOCHILA = 1

/** O marcador como veio do disco: só versão inteira e positiva; torto conta como ausente (ainda não migrada). */
export function marcadorDaMochilaDoArquivo(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : undefined
}

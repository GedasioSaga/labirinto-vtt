import { lerFormula } from '../batalha/formula'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recuperacaoDaFicha, type RecursoDaRecuperacao } from './tipos'

/**
 * O "Recupera por turno" da ficha (`CaracteristicaRecuperacao`) como número:
 * o campo do mestre (a prévia "= 12 HP") e o começo da vez na batalha leem por
 * aqui, com a mesma gramática das fórmulas de dano (`lerFormula`, sem `eval`).
 *
 * Puro: sem store, sem rede, sem Tauri (o site do Lobby mostra a ficha).
 */

/** O número do quanto ("10", "Vigor / 2"), arredondado para baixo; `null` = vazio ou fora da gramática. */
export function numeroDaRecuperacao(quanto: string, personagem: Personagem, sistema: SistemaDeRpg): number | null {
  if (quanto.trim() === '') return null
  const lida = lerFormula(quanto, { personagem, sistema, arma: null, vidaDoAlvo: null })
  return lida.tipo === 'valor' ? lida.valor : null
}

/** O que a ficha recupera no começo da vez; `null` = nada (sem a característica, quanto vazio, ilegível ou 0). */
export function quantoDaRecuperacao(personagem: Personagem, sistema: SistemaDeRpg): { recurso: RecursoDaRecuperacao; quanto: number } | null {
  const recuperacao = recuperacaoDaFicha(personagem.caracteristicas)
  if (recuperacao === null) return null
  const quanto = numeroDaRecuperacao(recuperacao.quanto, personagem, sistema)
  return quanto === null || quanto <= 0 ? null : { recurso: recuperacao.recurso, quanto }
}

/** "HP" ou "SP", como o registro da batalha escreve. */
export function siglaDaRecuperacao(recurso: RecursoDaRecuperacao): string {
  return recurso === 'hp' ? 'HP' : 'SP'
}

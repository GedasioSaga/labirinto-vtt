import { lerFormula } from '../batalha/formula'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { linhasDaRecuperacao, recuperacaoDaFicha, type RecursoDaRecuperacao } from './tipos'

/**
 * O "Recupera por turno" da ficha (`CaracteristicaRecuperacao`) como número:
 * o campo do mestre (a prévia "= 12 de Vida agora") e o começo da vez na batalha
 * leem por aqui, com a mesma gramática das fórmulas de dano (`lerFormula`, sem
 * `eval`). Desde 27/11/2026 são duas linhas independentes (Vida e SP).
 *
 * Puro: sem store, sem rede, sem Tauri (o site do Lobby mostra a ficha).
 */

/** O nome de cada linha na tela e no registro da batalha ("Vida por turno", "+10 Vida"). */
export const ROTULO_DA_RECUPERACAO: Readonly<Record<RecursoDaRecuperacao, string>> = { hp: 'Vida', sp: 'SP' }

/** Uma linha que recupera de fato no começo da vez: o recurso e o número (acima de 0). */
export interface RecuperacaoDaVez {
  recurso: RecursoDaRecuperacao
  quanto: number
}

/** O número do quanto ("10", "Vigor / 2"), arredondado para baixo; `null` = vazio ou fora da gramática. */
export function numeroDaRecuperacao(quanto: string, personagem: Personagem, sistema: SistemaDeRpg): number | null {
  if (quanto.trim() === '') return null
  const lida = lerFormula(quanto, { personagem, sistema, arma: null, vidaDoAlvo: null })
  return lida.tipo === 'valor' ? lida.valor : null
}

/**
 * O que a ficha recupera no começo da vez, linha a linha (Vida antes do SP). Vazia = nada: sem a
 * característica, ou cada linha ligada com o quanto vazio, ilegível ou 0.
 */
export function quantosDaRecuperacao(personagem: Personagem, sistema: SistemaDeRpg): RecuperacaoDaVez[] {
  const recuperacao = recuperacaoDaFicha(personagem.caracteristicas)
  if (recuperacao === null) return []
  const lidas: RecuperacaoDaVez[] = []
  for (const { recurso, linha } of linhasDaRecuperacao(recuperacao)) {
    const quanto = numeroDaRecuperacao(linha.quanto, personagem, sistema)
    if (quanto !== null && quanto > 0) lidas.push({ recurso, quanto })
  }
  return lidas
}

/** O ganho de uma linha no começo da vez (o que a mesa gravou, já limitado ao máximo). */
export interface GanhoDaRecuperacao {
  recurso: RecursoDaRecuperacao
  ganho: number
}

/** A linha do registro da batalha: "Recupera: +10 Vida, +5 SP". Ganho 0 fica de fora; nenhum = '' (nada a escrever). */
export function textoDaRecuperacao(ganhos: readonly GanhoDaRecuperacao[]): string {
  const partes = ganhos.filter(({ ganho }) => ganho > 0).map(({ recurso, ganho }) => `+${ganho} ${ROTULO_DA_RECUPERACAO[recurso]}`)
  return partes.length === 0 ? '' : `Recupera: ${partes.join(', ')}`
}

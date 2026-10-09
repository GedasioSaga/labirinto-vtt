import type { CenarioDoPino } from './catalogo'

/**
 * "Só da primeira vez" da ANIMAÇÃO DO CENÁRIO: o navegador do jogador lembra
 * quais pinos ele já viu animados, por mapa e pino. Fica neste aparelho (outro
 * celular vê de novo). Sem armazenamento (aba anônima, bloqueado), cada
 * abertura conta como a primeira — melhor ver de novo do que nunca ver.
 */

const CHAVE = 'lb-cenario-visto'
/** Teto da lista: só cresce com pinos novos, e os mais antigos saem primeiro. */
const MAXIMO = 500

export type Armazem = Pick<Storage, 'getItem' | 'setItem'>

function armazemDoNavegador(): Armazem | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function lerVistos(armazem: Armazem | null): string[] {
  if (!armazem) return []
  try {
    const cru: unknown = JSON.parse(armazem.getItem(CHAVE) ?? '[]')
    return Array.isArray(cru) ? cru.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

const chaveDoPino = (mapaId: string, pinoId: string) => `${mapaId}|${pinoId}`

/** A animação (ou a revelação do pino sem imagem, que toca "só da primeira vez") deste pino toca agora? */
export function deveTocarCenario(cenario: Pick<CenarioDoPino, 'quando'>, mapaId: string, pinoId: string, armazem: Armazem | null = armazemDoNavegador()): boolean {
  if (cenario.quando === 'sempre') return true
  return !lerVistos(armazem).includes(chaveDoPino(mapaId, pinoId))
}

/** Anota que este jogador já viu a animação deste pino. */
export function marcarCenarioVisto(mapaId: string, pinoId: string, armazem: Armazem | null = armazemDoNavegador()): void {
  if (!armazem) return
  const chave = chaveDoPino(mapaId, pinoId)
  const vistos = lerVistos(armazem).filter((v) => v !== chave)
  vistos.push(chave)
  try {
    armazem.setItem(CHAVE, JSON.stringify(vistos.slice(-MAXIMO)))
  } catch {
    // Cheio ou bloqueado: na próxima abertura ele vê de novo.
  }
}

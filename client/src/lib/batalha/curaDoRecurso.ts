import type { Ajuste } from '../ajusteDaFicha'
import { numeroDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDoCusto, recursoDoEscudo } from './leituraDaFicha'
import { maximoDoRecurso } from './recursosDaBatalha'

/**
 * A CURA DE SP E DE ESCUDO (fase 5 de docs/design/habilidades/SISTEMA.md: o
 * Tônico recupera SP, a Barreira soma no Escudo). A cura de HP segue em
 * `ajustesDaCura` (reacao.ts); aqui só os outros dois recursos, pela mesma
 * porta da ficha (os ajustes que o Desfazer volta).
 *
 * - SP: até o máximo da ficha (sem máximo, soma inteiro).
 * - Escudo: soma por cima do que tem, sem teto (a Barreira é uma camada a
 *   mais, não "encher" o Escudo).
 *
 * Puro: sem store, sem rede.
 */

export type RecursoDaCura = 'sp' | 'escudo'

/** O id do recurso na ficha e o teto; `null` = o sistema não tem o recurso. */
function recursoNaFicha(personagem: Personagem, sistema: SistemaDeRpg, recurso: RecursoDaCura): { id: string; teto: number | null } | null {
  if (recurso === 'escudo') {
    const escudo = recursoDoEscudo(sistema)
    return escudo === null ? null : { id: escudo.id, teto: null }
  }
  const sp = recursoDoCusto(sistema, 'sp')
  return sp === null ? null : { id: sp.id, teto: maximoDoRecurso(personagem, sistema, 'sp') }
}

/**
 * Fase 7 (itens: a Poção Suprema, o Elixir): a cura pela parte (%) do máximo
 * do recurso DO ALVO, para baixo. Sem máximo na ficha = 0 (nada a curar pela
 * parte); 100% enche.
 */
export function curaPelaParteDoMaximo(personagem: Personagem, sistema: SistemaDeRpg, recurso: 'hp' | 'sp', porcento: number): number {
  const maximo = maximoDoRecurso(personagem, sistema, recurso)
  return maximo === null ? 0 : Math.max(0, Math.floor((maximo * porcento) / 100))
}

/** Quanto da cura entra de verdade (o que cabe até o teto; o Escudo não tem). */
export function quantoCabeNoRecurso(personagem: Personagem, sistema: SistemaDeRpg, recurso: RecursoDaCura, cura: number): number {
  const lido = cura > 0 ? recursoNaFicha(personagem, sistema, recurso) : null
  if (lido === null) return 0
  const atual = numeroDaFicha(personagem.recursos, lido.id)
  return lido.teto === null ? cura : Math.max(0, Math.min(cura, lido.teto - atual))
}

/** O ajuste que põe a cura de SP ou de Escudo na ficha; nada = vazio. */
export function ajustesDoRecursoDaCura(personagem: Personagem, sistema: SistemaDeRpg, recurso: RecursoDaCura, cura: number): Ajuste[] {
  const lido = recursoNaFicha(personagem, sistema, recurso)
  const entra = quantoCabeNoRecurso(personagem, sistema, recurso, cura)
  if (lido === null || entra <= 0) return []
  return [{ parte: 'recurso', chave: lido.id, valor: numeroDaFicha(personagem.recursos, lido.id) + entra }]
}

/** A nota da linha: "+50 de Escudo", "recuperou 30 SP", "SP já cheio". */
export function notaDoRecursoDaCura(recurso: RecursoDaCura, cura: number, coube: number): string {
  if (recurso === 'escudo') return `+${coube} de Escudo`
  if (coube <= 0) return 'SP já cheio, não recuperou'
  return coube >= cura ? `recuperou ${coube} SP` : `recuperou ${coube} SP (o SP encheu)`
}

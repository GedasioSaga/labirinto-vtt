import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { combateVazio, type CombateDoPersonagem, type LembreteDaPassiva, type ModDoSelo, type SeloPedido } from './combate'
import { normalizar } from './formula'
import { comLembrete, type FichasDaPassiva, type TurnosComLembretes } from './passivas'
import type { TurnosDaCena } from './turnos'

/**
 * PREPARAÇÃO PARA A BATALHA, conserto das fichas F1 (fatia S4; resposta do
 * Jimboy, regra para todos): no INÍCIO DO COMBATE, quem tem a vantagem
 * "Preparação para a Batalha" (em qualquer aba da ficha) recebe a pergunta
 * "vai fazer?"; se sim, escolhe QUAL atributo e ganha +20 nele até o fim do
 * combate (um selo sem turnos, que some com a batalha).
 *
 * Puro: sem store, sem rede.
 */

export const NOME_DA_PREPARACAO = 'Preparação para a Batalha'
/** O que o atributo escolhido ganha. */
export const BONUS_DA_PREPARACAO = 20

const SINAL_DA_PREPARACAO = 'preparacao para a batalha'

/** O cartão da Preparação na ficha (qualquer aba), pelo nome; `null` = não tem. */
export function cartaoDaPreparacao(personagem: Personagem): CartaoDaFicha | null {
  for (const cartoes of Object.values(personagem.abas)) {
    const achado = cartoes.find((cartao) => normalizar(cartao.nome).replace(/\s+/g, ' ').includes(SINAL_DA_PREPARACAO))
    if (achado !== undefined) return achado
  }
  return null
}

/** A chave do lembrete da Preparação. */
export function chaveDaPreparacao(cartaoId: string): string {
  return `${cartaoId}:preparacao`
}

/** O lembrete é o da Preparação (e não o de uma passiva). */
export function ehLembreteDaPreparacao(lembrete: Pick<LembreteDaPassiva, 'cartaoId' | 'chave'>): boolean {
  return lembrete.chave === chaveDaPreparacao(lembrete.cartaoId)
}

/**
 * No Iniciar: o lembrete "vai fazer a Preparação?" de cada personagem da
 * ordem que a tem (na primeira ficha dele), uma vez por batalha (a chave
 * entra em `lembradas`). Nada: os MESMOS turnos.
 */
export function comLembretesDaPreparacao(turnos: TurnosDaCena, mesa: FichasDaPassiva): TurnosComLembretes {
  const vistos = new Set<string>()
  const novos = new Map<string, CombateDoPersonagem>()
  for (const carta of turnos.cartas) {
    if (carta.personagemId === null || vistos.has(carta.personagemId)) continue
    vistos.add(carta.personagemId)
    const personagem = mesa.personagens.find((candidato) => candidato.id === carta.personagemId)
    const cartao = personagem === undefined ? null : cartaoDaPreparacao(personagem)
    if (cartao === null) continue
    const chave = chaveDaPreparacao(cartao.id)
    const combate = turnos.combate?.[carta.personagemId] ?? combateVazio()
    if ((combate.lembradas ?? []).includes(chave)) continue
    novos.set(carta.personagemId, comLembrete(combate, { cartaoId: cartao.id, tokenId: carta.tokenId, tipo: 'ativar', chave, rodada: turnos.rodada }))
  }
  if (novos.size === 0) return { turnos, mudaram: [] }
  const mudaram = [...novos.keys()].map((personagemId) => ({ personagemId, antes: turnos.combate?.[personagemId] ?? null }))
  return { turnos: { ...turnos, combate: { ...(turnos.combate ?? {}), ...Object.fromEntries(novos) } }, mudaram }
}

/** O selo da Preparação no atributo escolhido: +20 até o fim do combate. `null` = atributo fora do sistema. */
export function seloDaPreparacao(sistema: SistemaDeRpg, atributoId: string): SeloPedido | null {
  if (!sistema.atributos.some((atributo) => atributo.id === atributoId)) return null
  const mods: ModDoSelo[] = [{ alvo: atributoId, delta: BONUS_DA_PREPARACAO }]
  return { nome: NOME_DA_PREPARACAO, turnos: null, mods }
}

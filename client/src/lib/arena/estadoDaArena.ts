import type { Equipe } from '../batalha/equipes'
import type { BatalhaEmTurnos } from '../batalha/ponte'
import type { AutorDaAcao } from '../batalha/turnos'
import { vistaParaJogador, type ContextoDoJogador, type EstadoParaJogador } from '../batalha/vistaDoJogador'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { EQUIPE_DO_LADO, type LadoDaArena, type SessaoDaArena } from './tipos'

/**
 * A ARENA VISTA PELO MENU DO JOGADOR (seção 4.4 do plano, "Projeção para o
 * menu"): o mestre controla todos os lados, então a arena monta o recorte do
 * `BatalhaDoJogador` como se TUDO fosse dele — todos os tokens estão no
 * recorte e são "meus" (menos o do boneco), todas as cópias são "minhas", sem
 * aliados. Assim a vez de qualquer lado é "minha vez", toda reação pendente
 * aparece (a do boneco também, para o mestre resolver à mão se a automática
 * travar) e todo contra-ataque guardado também.
 *
 * As equipes são as duas virtuais, "Lado A" e "Lado B" (o boneco no B).
 *
 * Puro: sem store.
 */

/** O autor de tudo que a arena pede à batalha dela: o mestre. */
export const AUTOR_DA_ARENA: AutorDaAcao = { tipo: 'mestre' }

/** O `playerId` do recorte da arena (não há jogador: só o registro o lê). */
const JOGADOR_DA_ARENA = 'arena'

const LADOS: readonly LadoDaArena[] = ['a', 'b']

/** As duas equipes virtuais da sessão, com as cópias de cada lado como membros (o boneco no Lado B). */
export function equipesDaArena(sessao: SessaoDaArena): Equipe[] {
  const membros: Record<LadoDaArena, string[]> = { a: [], b: [] }
  for (const token of sessao.tokens) {
    const lado = sessao.ladoDe[token.id]
    if (token.characterId === null || lado === undefined) continue
    const daEquipe = membros[lado === 'boneco' ? 'b' : lado]
    if (!daEquipe.includes(token.characterId)) daEquipe.push(token.characterId)
  }
  return LADOS.map((lado) => ({ ...EQUIPE_DO_LADO[lado], membros: membros[lado] }))
}

/**
 * O recorte do menu com tudo "meu". O token do boneco fica fora de
 * `meusTokens` (a ficha dele continua em `meusPersonagens`): na vez dele não
 * abre menu (ele não age, a vez passa sozinha), mas a reação dele continua
 * aparecendo para o mestre.
 */
export function contextoDaArena(sessao: SessaoDaArena, sistema: SistemaDeRpg | null): ContextoDoJogador {
  return {
    playerId: JOGADOR_DA_ARENA,
    meusTokens: new Set(sessao.tokens.filter((token) => sessao.ladoDe[token.id] !== 'boneco').map((token) => token.id)),
    tokensNoRecorte: new Map(sessao.tokens.map((token) => [token.id, token.name])),
    meusPersonagens: new Set(sessao.copias.map((copia) => copia.id)),
    aliados: new Set(),
    equipes: equipesDaArena(sessao),
    personagens: sessao.copias,
    sistema,
  }
}

/** O `estado` do `BatalhaDoJogador` na arena. */
export function vistaDaArena(cena: BatalhaEmTurnos, sessao: SessaoDaArena, sistema: SistemaDeRpg | null): EstadoParaJogador {
  return vistaParaJogador(cena, contextoDaArena(sessao, sistema))
}

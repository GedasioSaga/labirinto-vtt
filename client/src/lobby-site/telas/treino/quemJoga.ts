import { cartaDaVez } from '../../../lib/batalha/turnos'
import type { Personagem } from '../../../lib/personagem'
import type { DueloNoFio } from '../../../lib/treino/duelo'
import type { LadoDoTreino } from '../../../lib/treino/mesaEmMemoria'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../../../lib/vidaDaFicha'

/**
 * QUEM JOGA AGORA numa luta do treino ou do duelo (o formato do fio,
 * `DueloNoFio`): de quem é a vez, se a cópia está de pé e o que a luta espera
 * de um lado. O robô do treino espera por aqui a jogada de quem treina; o HUD
 * da Arena (`ArenaDaLuta`) diz "o robô está jogando" ou "esperando o colega".
 */

/** A cópia de pé, pela Vida do sistema da campanha? Sem vida legível, de pé (a mesma leitura do fim da luta). */
export function dePe(doc: Personagem, sistema: SistemaDeRpg): boolean {
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(doc, recurso)
  return vida === null || vida.atual > 0
}

/** O nome de quem está na vez agora; `null` = ninguém (acabou ou não começou). */
export function nomeDaVez(duelo: DueloNoFio): { nome: string; lado: LadoDoTreino } | null {
  const carta = cartaDaVez(duelo.turnos)
  if (carta === null) return null
  const vaga = duelo.lutadores.vagas.find((candidata) => candidata.tokenId === carta.tokenId)
  if (vaga === undefined) return null
  const doc = duelo.lutadores.personagens.find((personagem) => personagem.id === vaga.personagemId)
  return { nome: doc?.nome ?? 'Alguém', lado: vaga.lado }
}

function tokensDoLado(duelo: DueloNoFio, lado: LadoDoTreino): Set<string> {
  return new Set(duelo.lutadores.vagas.filter((vaga) => vaga.lado === lado).map((vaga) => vaga.tokenId))
}

/** Algum golpe espera a reação de uma ficha deste conjunto? */
function reacaoPendente(duelo: DueloNoFio, tokens: ReadonlySet<string>, dosMeus: boolean): boolean {
  return (duelo.turnos.golpes ?? []).some((golpe) => golpe.alvos.some((alvo) => tokens.has(alvo.tokenId) === dosMeus && alvo.danoFinal === undefined && alvo.podeReagir))
}

/** O que a luta espera de um lado agora: reagir, agir, ou nada (`null`: a vez é do outro lado, ou acabou). */
export function oQueEsperaDeMim(duelo: DueloNoFio, meuLado: LadoDoTreino): 'reagir' | 'agir' | null {
  if (duelo.fim !== null) return null
  const meus = tokensDoLado(duelo, meuLado)
  if (reacaoPendente(duelo, meus, true)) return 'reagir'
  // Golpe esperando a reação do outro lado: a vez só anda depois dela.
  if (reacaoPendente(duelo, meus, false)) return null
  const carta = cartaDaVez(duelo.turnos)
  return carta !== null && meus.has(carta.tokenId) ? 'agir' : null
}

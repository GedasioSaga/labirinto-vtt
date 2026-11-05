import { textoDaFichaSeparada, type FichaSeparada } from '../lib/mochila/transicao'
import type { PlayerInfo } from './hostSession'

/**
 * MOCHILA NA FICHA na sala LAN (decisão do usuário de 05/11/2026): a ficha
 * que passa a ter vários bonecos na cena deixa vazio o boneco que a mostrava
 * (a ficha guarda tudo até sobrar um). O mestre lê o aviso no toast; o
 * jogador dono desse boneco recebe o mesmo texto pelo recado só para ele
 * (`playerNote`, o "Recado" do Grupo), que entra no caderno dele.
 */

/** Um recado por jogador dono de boneco que ficou vazio; duas fichas no mesmo acerto viram um recado só (o cartão dele mostra um por vez). */
export function recadosDosBonecosSeparados(
  separadas: readonly FichaSeparada[],
  jogadores: readonly Pick<PlayerInfo, 'playerId' | 'tokenIds'>[],
): { playerId: string; texto: string }[] {
  const porJogador = new Map<string, string[]>()
  for (const separada of separadas) {
    const doAcerto = new Set(separada.tokenIds)
    for (const jogador of jogadores) {
      if (!jogador.tokenIds.some((tokenId) => doAcerto.has(tokenId))) continue
      const textos = porJogador.get(jogador.playerId) ?? []
      textos.push(textoDaFichaSeparada(separada))
      porJogador.set(jogador.playerId, textos)
    }
  }
  return [...porJogador].map(([playerId, textos]) => ({ playerId, texto: textos.join(' ') }))
}

/** O que o aviso usa da ponte da sala: `HostBridge` serve. */
export interface PonteDosRecados {
  players(): readonly Pick<PlayerInfo, 'playerId' | 'tokenIds'>[]
  /** `HostBridge.playerNote`: o recado só para ele (a resposta, entregue ou guardado, não muda nada aqui). */
  playerNote(playerId: string, text: string): unknown
}

/** Manda os recados pela ponte da sala. Sala fechada: `players()` vem vazio e nada sai. */
export function avisarJogadoresDosBonecosSeparados(ponte: PonteDosRecados, separadas: readonly FichaSeparada[]): void {
  for (const recado of recadosDosBonecosSeparados(separadas, ponte.players())) ponte.playerNote(recado.playerId, recado.texto)
}

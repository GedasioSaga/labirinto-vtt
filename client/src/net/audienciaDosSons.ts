import type { AlvoDosSons } from '../lib/sons/biblioteca'
import type { PlayerInfo } from './hostSession'

/**
 * SONS AO VIVO, fatia F4 (`docs/planos/sons-ao-vivo-2026-10-23.md`, seção 2):
 * QUEM ESCUTA o som que o mestre manda tocar. Puro: não lê sessão nem rede.
 *
 *  - Todos: todo jogador conectado, e as telas da mesa.
 *  - Só a cena: o jogador conectado que está nela, e a tela da mesa quando
 *    mostra essa cena (decisão do usuário de 23/10: a TV também toca).
 *  - Escolhidos: os jogadores marcados que estão conectados; a TV nunca (o
 *    seletor lista jogadores).
 *
 * Desconectado não recebe: o assento continua na sessão, mas não há a quem
 * mandar; quem volta recebe o loop pela reconciliação da ponte do mestre.
 */

/** O pedaço de `PlayerInfo` que decide quem escuta. */
export type OuvinteDosSons = Pick<PlayerInfo, 'clientId' | 'playerId' | 'connected' | 'sceneId'>

export interface TelasDaMesa {
  /** As conexões das telas da mesa que estão na sala. */
  clientIds: readonly string[]
  /** A cena que as telas mostram (`tableSceneKey`); `null` = a tela espera. */
  cena: string | null
}

const SEM_TELAS: TelasDaMesa = { clientIds: [], cena: null }

export function destinatarios(alvo: AlvoDosSons, jogadores: readonly OuvinteDosSons[], telas: TelasDaMesa = SEM_TELAS): string[] {
  const saida = new Set<string>()
  const escuta = jogadorEscuta(alvo)
  for (const jogador of jogadores) {
    if (jogador.connected && jogador.clientId !== null && escuta(jogador)) saida.add(jogador.clientId)
  }
  if (telaEscuta(alvo, telas.cena)) for (const clientId of telas.clientIds) saida.add(clientId)
  return [...saida]
}

function jogadorEscuta(alvo: AlvoDosSons): (jogador: OuvinteDosSons) => boolean {
  switch (alvo.tipo) {
    case 'todos':
      return () => true
    case 'cena':
      return (jogador) => jogador.sceneId === alvo.sceneId
    case 'escolhidos': {
      const marcados = new Set(alvo.playerIds)
      return (jogador) => marcados.has(jogador.playerId)
    }
  }
}

function telaEscuta(alvo: AlvoDosSons, cenaDaTela: string | null): boolean {
  switch (alvo.tipo) {
    case 'todos':
      return true
    case 'cena':
      return cenaDaTela !== null && cenaDaTela === alvo.sceneId
    case 'escolhidos':
      return false
  }
}

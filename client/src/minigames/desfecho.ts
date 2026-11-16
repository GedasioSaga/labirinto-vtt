/**
 * CANAL DE DESFECHO DOS MINIGAMES (Fase B do pedido de 15/11/2026): o que um
 * minigame pode fazer no estado do jogo quando termina. O host aplica cada
 * desfecho pelo aplicador do tipo dele (`net/hostBridge.ts`).
 *
 * Hoje só a dança age por aqui: 'abrir porta' (a porta ligada abre quando
 * todos passam). O baú, a caixa e o barril (Fase C, 15/11/2026) declaram
 * 'dar itens', 'dano' e 'efeito' no registro (`REGISTRO_DE_JOGOS_DE_OBJETO`),
 * mas gravam os três numa vez só (`net/objetoNoHost.ts`, `applyObjetoAberto`):
 * a ficha de personagem é trocada inteira, e três aplicadores seguidos
 * perderiam as duas primeiras mudanças. O aplicador de cada um segue `null`
 * até um jogo precisar deles separados. Nada finge aplicar: sem aplicador, `aplicarDesfecho` devolve
 * `false` e quem chamou decide o aviso. A forma das três é provisória.
 */

export type TipoDeDesfecho = 'abrir porta' | 'dar itens' | 'dano' | 'efeito'

/** Abre e destranca uma parede-porta, desta cena (`sceneId` ausente) ou de outra. */
export interface DesfechoAbrirPorta {
  tipo: 'abrir porta'
  wallId: string
  sceneId?: string
}

/** Fase C: itens para a mochila de quem venceu. */
export interface DesfechoDarItens {
  tipo: 'dar itens'
  playerIds: readonly string[]
  itens: readonly { nome: string; itemId?: string }[]
}

/** Fase C: pontos de vida a menos (a armadilha). */
export interface DesfechoDano {
  tipo: 'dano'
  playerIds: readonly string[]
  pv: number
}

/** Fase C: uma condição com duração (Envenenado, Lento). */
export interface DesfechoEfeito {
  tipo: 'efeito'
  playerIds: readonly string[]
  efeito: string
  turnos?: number
}

export type Desfecho = DesfechoAbrirPorta | DesfechoDarItens | DesfechoDano | DesfechoEfeito

/** Aplica um desfecho no estado do jogo; `true` = mudou alguma coisa. */
export type AplicadorDeDesfecho<D extends Desfecho> = (desfecho: D) => boolean

/** Um aplicador por tipo. `null` = o tipo ainda não tem quem o aplique (Fase C). */
export type AplicadoresDeDesfecho = { [T in TipoDeDesfecho]: AplicadorDeDesfecho<Extract<Desfecho, { tipo: T }>> | null }

/**
 * Leva o desfecho ao aplicador do tipo dele. `false` = o tipo ainda não tem
 * aplicador, ou o aplicador não mudou nada.
 */
export function aplicarDesfecho(aplicadores: AplicadoresDeDesfecho, desfecho: Desfecho): boolean {
  switch (desfecho.tipo) {
    case 'abrir porta': {
      const aplicar = aplicadores['abrir porta']
      return aplicar === null ? false : aplicar(desfecho)
    }
    case 'dar itens': {
      const aplicar = aplicadores['dar itens']
      return aplicar === null ? false : aplicar(desfecho)
    }
    case 'dano': {
      const aplicar = aplicadores.dano
      return aplicar === null ? false : aplicar(desfecho)
    }
    case 'efeito': {
      const aplicar = aplicadores.efeito
      return aplicar === null ? false : aplicar(desfecho)
    }
  }
}

import { createContext } from 'react'

/**
 * O que a tela do jogador precisa saber quando roda DENTRO da janela de teste
 * (Visão de jogador). Fora dela, o contexto é `null` e nada muda.
 *
 * No teste há um jogador só: toda ficha alheia chega como "sem dono" (o
 * recorte não diz quem é NPC), e o cartão da ficha não sabe se faltou o
 * colega ou se é um NPC. A lista de fichas da barra do teste sabe: as que não
 * são NPC são de jogador, e lá o "Dar item" diz que no teste não há outro
 * jogador para receber, em vez de sumir como some para o NPC.
 */
export interface InfoDoTeste {
  /** Ids das fichas que NÃO são NPC na cena aberta do editor (a lista da barra do teste). */
  fichasDeJogador: ReadonlySet<string>
}

export const NoTeste = createContext<InfoDoTeste | null>(null)

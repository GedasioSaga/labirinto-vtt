import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'

/**
 * O DANO DA FICHA, F2 (seção 3.2 de docs/planos/batalha-one-piece-f2-plano.md):
 * a fórmula livre do cartão ("(Força + 20) + Dano da Arma") vira número com a
 * conta ao lado. Gramática pequena, descida recursiva, SEM `eval`. Na
 * dúvida, `naoEntende` (o campo vem vazio e a pessoa digita).
 *
 * FASE 0 (contrato): corpo provisório honesto (não entende nada); a fase 1
 * troca o corpo sem mudar a assinatura.
 *
 * Puro: sem store, sem rede.
 */

export interface ContextoDaFormula {
  personagem: Personagem
  sistema: SistemaDeRpg
  /** A arma escolhida para o golpe; `null` = nenhuma. */
  arma: CartaoDaFicha | null
  /** A vida do alvo, quando quem calcula pode vê-la; `null` = não sabe (o jogador nunca vê a do NPC). */
  vidaDoAlvo: { atual: number; maximo: number } | null
}

export type LeituraDoDano =
  /** "-": habilidade de suporte. */
  | { tipo: 'semDano' }
  /** "(160 Força + 20) + 8 Gram = 188". */
  | { tipo: 'valor'; valor: number; conta: string }
  /** Fala de "Dano da Arma" e não há arma escolhida. */
  | { tipo: 'precisaArma'; conta: string }
  /** "% da vida do alvo" sem a vida do alvo conhecida. */
  | { tipo: 'precisaAlvo' }
  /** Campo vazio ou fora da gramática: digita à mão. */
  | { tipo: 'naoEntende'; texto: string }

export function lerDano(texto: string, _ctx: ContextoDaFormula): LeituraDoDano {
  return { tipo: 'naoEntende', texto }
}

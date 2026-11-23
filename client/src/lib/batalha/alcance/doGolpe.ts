/**
 * ALCANCE: A FORMA DO GOLPE NA HORA (plano docs/design/habilidades/ALCANCE.md §3.2, §4 e §5). O
 * alcance do cartão (`alcanceDoCartao`, o único leitor; o Atacar desarmado é o alvo colado) com as
 * condições de quem usa (`alcanceComCondicoes`): a do selo montado e, sem ela, a da tabela de
 * condições pelo nome. O mesmo no host (`podeAgir`) e na mira.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

import { ALCANCE_DESARMADO, alcanceDoCartao, type CartaoComAlcance } from '../alcanceDoCartao'
import type { SeloDaBatalha } from '../combate'
import { alcanceDaCondicao } from '../condicoes'
import { alcanceComCondicoes, type GrupoDoAlcance, type MudancaDoAlcance, type SeloQueMudaOAlcance } from './condicoes'
import type { FormaDoAlcance } from './forma'

/**
 * A recusa do host quando o alvo, o centro ou um marcado está fora das casas acesas e o pedido não
 * trouxe a confirmação; a mira abre o "Fora do alcance, usar mesmo assim?" ao ler esta frase.
 */
export const MOTIVO_FORA_DO_ALCANCE = 'Fora do alcance: confirme para usar mesmo assim'

/** O que o selo da batalha faz no alcance: o da peça montada e, sem ele, o da condição pelo nome. */
export function mudancaDoSelo(selo: Pick<SeloDaBatalha, 'nome' | 'alcance'>): MudancaDoAlcance | null {
  return selo.alcance ?? alcanceDaCondicao(selo.nome)
}

/** Os selos ativos de `tokenId` que mexem no alcance, na ordem da carta (a ordem dos nomes no aviso). */
export function selosQueMudamOAlcance(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloQueMudaOAlcance[] {
  return (selos ?? []).flatMap((selo) => {
    const alcance = selo.tokenId === tokenId ? mudancaDoSelo(selo) : null
    return alcance === null ? [] : [{ nome: selo.nome, alcance }]
  })
}

export interface AlcanceDoGolpe {
  forma: FormaDoAlcance
  /** "Alcance 6 → 4 (Ofuscado)"; `null` = nenhuma condição vale. */
  aviso: string | null
}

/** A forma que vale agora; `cartao` `null` = o Atacar desarmado. `null` = sem alcance definido (nada acende, o host não confere). */
export function alcanceDoGolpe(cartao: CartaoComAlcance | null, grupo: GrupoDoAlcance, selos: readonly SeloQueMudaOAlcance[]): AlcanceDoGolpe | null {
  const base = cartao === null ? ALCANCE_DESARMADO : (alcanceDoCartao(cartao)?.forma ?? null)
  if (base === null) return null
  const { forma, aviso } = alcanceComCondicoes(base, grupo, selos)
  return { forma, aviso }
}

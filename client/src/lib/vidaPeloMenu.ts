import type { Token } from '../types/map'
import { NUMERO_DA_FICHA_MAX } from './ajusteDaFicha'
import type { Personagem } from './personagem'
import type { RecursoDoSistema } from './sistemaDeRpg'
import { vidaDoPersonagem } from './vidaDaFicha'

/**
 * VIDA NO BOTÃO DIREITO (pedido de 25/11/2026: "tirar dano e dar vida aos
 * NPCs sem entrar na ficha") — a parte pura: quais fichas a seleção mexe e o
 * número que o campo aceita. Quem aplica (pela batalha ou pela ficha, com o
 * Desfazer) é `stores/vidaPeloMenu.ts`.
 */

/** Uma ficha da seleção com vida: a mesma ficha em dois tokens conta uma vez só. */
export interface FichaComVida {
  personagemId: string
  /** O primeiro token da seleção com esta ficha. */
  tokenId: string
  nome: string
  atual: number
  maximo: number
}

/**
 * As fichas ligadas aos tokens `tokenIds`, na ordem da seleção, cada uma uma
 * vez (cópias do mesmo NPC têm cada uma a sua ficha; duas ligadas à MESMA não
 * levam o dano duas vezes). Token sem ficha, ficha fora da lista ou sem
 * máximo de vida ficam fora.
 */
export function fichasComVidaDosTokens(
  tokenIds: readonly string[],
  tokens: readonly Pick<Token, 'id' | 'characterId'>[],
  personagens: readonly Personagem[],
  recurso: RecursoDoSistema,
): FichaComVida[] {
  const porToken = new Map(tokens.map((token) => [token.id, token.characterId]))
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const vistas = new Set<string>()
  const achadas: FichaComVida[] = []
  for (const tokenId of tokenIds) {
    const characterId = porToken.get(tokenId)
    if (characterId === undefined || characterId === null || vistas.has(characterId)) continue
    const personagem = porId.get(characterId)
    if (personagem === undefined) continue
    const vida = vidaDoPersonagem(personagem, recurso)
    if (vida === null) continue
    vistas.add(characterId)
    achadas.push({ personagemId: personagem.id, tokenId, nome: personagem.nome.trim() || 'Personagem sem nome', atual: vida.atual, maximo: vida.maximo })
  }
  return achadas
}

/** O número do campo: inteiro de 1 ao teto da ficha. `null` = vazio, zero, negativo, quebrado ou texto. */
export function quantoDaVida(texto: string): number | null {
  const limpo = texto.trim()
  if (!/^\d+$/.test(limpo)) return null
  const valor = Number(limpo)
  return valor >= 1 && valor <= NUMERO_DA_FICHA_MAX ? valor : null
}

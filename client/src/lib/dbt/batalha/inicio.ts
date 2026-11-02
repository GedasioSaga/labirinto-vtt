import type { Equipe } from '../../batalha/equipes'
import type { Personagem } from '../../personagem'
import type { EntranteDBT } from './tipos'

/**
 * QUEM ENTRA NA BATALHA (docs/planos/dbt-batalha.md, seção 5): o mesmo filtro
 * do One Piece (`combatentesIniciais`: token escondido ou sem ficha fica fora;
 * NPC "só cenário" fica fora, salvo escolha do mestre), sem ordenar. O lado é a
 * equipe; sem equipe, jogador = 'pj' e o resto = 'npc'.
 */

/** O pedaço do token que importa aqui (o tipo do mapa não entra no motor). */
export interface TokenQueEntra {
  id: string
  characterId: string | null
  name: string
  hidden?: boolean
}

export const LADO_DOS_JOGADORES = 'pj'
export const LADO_DOS_NPCS = 'npc'

/** Mesma regra de `entraNaBatalha` (lib/livros/combate.ts), copiada para não puxar o resto daquele arquivo. */
function entraPorPadrao(personagem: Personagem): boolean {
  return personagem.tipo === 'jogador' || personagem.soCenario !== true
}

export function entrantesDaCena(
  tokens: readonly TokenQueEntra[],
  personagens: readonly Personagem[],
  equipes: readonly Equipe[],
  incluir?: ReadonlySet<string>,
): EntranteDBT[] {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const entrantes: EntranteDBT[] = []
  for (const token of tokens) {
    if (token.hidden === true || token.characterId === null) continue
    if (incluir !== undefined && !incluir.has(token.id)) continue
    const personagem = porId.get(token.characterId)
    if (personagem === undefined) continue
    if (incluir === undefined && !entraPorPadrao(personagem)) continue
    const npc = personagem.tipo !== 'jogador'
    const equipe = equipes.find((candidata) => candidata.membros.includes(personagem.id))
    entrantes.push({ tokenId: token.id, personagemId: personagem.id, nome: token.name, lado: equipe?.id ?? (npc ? LADO_DOS_NPCS : LADO_DOS_JOGADORES), npc })
  }
  return entrantes
}

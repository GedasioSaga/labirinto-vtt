import { semOcultas } from '../../lib/habilidadeOculta'
import { ehRefDeMidia, idDaRef } from '../../lib/midia'
import { idDaCopiaDeTreino, projetarParaTreino } from '../../lib/nuvem/projecao'
import type { RpgDaPasta } from '../../lib/pastasDeMapas'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'

/**
 * O QUE SOBE NO PUBLICAR (docs/planos/lobby-jogadores-2026-11-05.md §5.4, §8.2
 * T8), puro: a ficha como a nuvem a conhece e os INIMIGOS LIBERADOS para o
 * treino. Quem fala com a ponte é `components/nuvem/ponteDoLobby.ts`.
 *
 * Inimigo liberado: o mestre marca o NPC na ficha dele; o id entra na lista
 * `treino.inimigosLiberados` do `rpg.json` da pasta (não é campo do
 * personagem, então liberar não vira op). O que sobe é uma CÓPIA, com id
 * próprio (`treino_<id>`), já pela projeção do treino: sem nota do mestre,
 * dono, combate, mochila e bolsa. O servidor guarda a cópia com
 * `visivel:'treino'` e projeta de novo na saída.
 */

// ── A ficha como a nuvem a conhece ──────────────────────────────────────────

/** A foto embutida (data URL) não sobe (Si7); a ficha no app continua com ela. */
export function semImagemEmbutida(ficha: Personagem): { ficha: Personagem; tiradas: number } {
  let tiradas = 0
  const limpar = (imagem: string | null): string | null => {
    if (imagem === null || ehRefDeMidia(imagem)) return imagem
    tiradas += 1
    return null
  }
  const noCartao = (cartao: CartaoDaFicha): CartaoDaFicha => ({ ...cartao, imagem: limpar(cartao.imagem), subcartoes: cartao.subcartoes.map(noCartao) })
  const abas = Object.fromEntries(Object.entries(ficha.abas).map(([aba, cartoes]): [string, CartaoDaFicha[]] => [aba, cartoes.map(noCartao)]))
  return { ficha: { ...ficha, retrato: limpar(ficha.retrato), abas }, tiradas }
}

/** As imagens (`midia:`) da ficha: retrato, cartões em qualquer nível e itens da mochila. */
export function midiasDaFicha(ficha: Personagem): string[] {
  const ids: string[] = []
  const guardar = (ref: string | null | undefined): void => {
    const id = idDaRef(ref)
    if (id !== null) ids.push(id)
  }
  const noCartao = (cartao: CartaoDaFicha): void => {
    guardar(cartao.imagem)
    cartao.subcartoes.forEach(noCartao)
  }
  guardar(ficha.retrato)
  Object.values(ficha.abas).forEach((cartoes) => cartoes.forEach(noCartao))
  for (const item of ficha.mochila ?? []) guardar(item.imagem)
  return ids
}

// ── Inimigos liberados para o treino ────────────────────────────────────────

/** Os ids liberados nesta pasta; pasta sem a lista = nenhum. */
export function inimigosLiberadosDe(rpg: Pick<RpgDaPasta, 'treino'>): readonly string[] {
  return rpg.treino?.inimigosLiberados ?? []
}

export function estaLiberado(rpg: Pick<RpgDaPasta, 'treino'>, npcId: string): boolean {
  return inimigosLiberadosDe(rpg).includes(npcId)
}

/**
 * O RPG com o NPC liberado (no fim da lista) ou tirado dela. A lista vai
 * sempre presente, mesmo vazia: a cópia em memória da pasta aberta é
 * mesclada por cima da de antes, e uma lista ausente deixaria a velha lá.
 */
export function comInimigoLiberado(rpg: RpgDaPasta, npcId: string, liberado: boolean): RpgDaPasta {
  const atuais = inimigosLiberadosDe(rpg).filter((id) => id !== npcId)
  return { ...rpg, treino: { inimigosLiberados: liberado ? [...atuais, npcId] : atuais } }
}

/** A cópia de treino do NPC: id próprio, projeção do treino, sem foto embutida e sem o histórico de ajustes. */
export function copiaDeTreino(npc: Personagem): Personagem {
  // Fatia C7: a técnica oculta do NPC não sobe ao treino (o jogador veria o segredo lutando contra ele).
  const { ficha } = semImagemEmbutida(projetarParaTreino(semOcultas(npc)))
  return { ...ficha, id: idDaCopiaDeTreino(npc.id), historico: [] }
}

/**
 * As cópias que sobem, na ordem da lista: só de NPC que ainda está na pasta.
 * O id que sumiu (NPC apagado) ou que virou jogador fica de fora, e o
 * servidor tira a cópia dele do treino no próximo envio.
 */
export function copiasDeTreino(personagens: readonly Personagem[], liberados: readonly string[]): Personagem[] {
  const porId = new Map(personagens.map((personagem): [string, Personagem] => [personagem.id, personagem]))
  return liberados.flatMap((id) => {
    const npc = porId.get(id)
    return npc === undefined || npc.tipo !== 'npc' ? [] : [copiaDeTreino(npc)]
  })
}

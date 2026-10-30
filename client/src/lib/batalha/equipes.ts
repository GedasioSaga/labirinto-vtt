import type { Personagem } from '../personagem'

/**
 * EQUIPES (decisão 1 de docs/planos/batalha-one-piece-2026-10-30.md; Q2 e Q5
 * do plano da F1): grupos com nome e cor, gravados junto dos personagens — na
 * aventura (`Adventure.equipes`) ou na pasta (`RpgDaPasta.equipes`), quem for
 * o dono dos personagens.
 *
 * O membro é o PERSONAGEM (jogador ou NPC), não o jogador da sala: fica
 * estável entre sessões e aparelhos. Um personagem fica numa equipe só.
 *
 * Quem é aliado de quem (`aliadosDe`) decide o que o jogador vê dos colegas:
 * vida, SP, habilidades e o perfil. NPC nunca é aliado, de equipe nenhuma — o
 * mestre ajusta NPC no meio da luta e o número dele não sai.
 *
 * Puro: sem store, sem disco.
 */

export interface Equipe {
  id: string
  nome: string
  /** `#rrggbb`, minúsculo. */
  cor: string
  /** Ids de personagem (jogador ou NPC), sem repetir. */
  membros: readonly string[]
}

export const EQUIPES_MAX = 12
export const NOME_DA_EQUIPE_MAX = 40
/** Id da equipe: o do app é `equipe_<uuid>` (43); folga para o que vier editado à mão. */
export const ID_DA_EQUIPE_MAX = 80
export const NOME_DA_EQUIPE_PADRAO = 'Equipe'
/** Cor da equipe sem cor (ou com cor torta) no arquivo. */
export const COR_DA_EQUIPE_PADRAO = '#8a7f6e'

const COR_HEX = /^#[0-9a-f]{6}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function novoIdDeEquipe(): string {
  return `equipe_${crypto.randomUUID()}`
}

/** `#RRGGBB` vira minúsculo; qualquer outra coisa vira a cor padrão. */
export function corDaEquipe(value: unknown): string {
  return typeof value === 'string' && COR_HEX.test(value) ? value.toLowerCase() : COR_DA_EQUIPE_PADRAO
}

/**
 * Leitura do arquivo (aventura ou pasta), campo a campo. Ausente ou não lista
 * = `undefined` (arquivo de antes, que continua sem a chave). Equipe sem id,
 * com id repetido ou além de `EQUIPES_MAX` sai; nome vazio vira o padrão; cor
 * torta vira a padrão. Personagem que aparece em duas equipes fica na
 * primeira, e o membro que não é texto sai.
 */
export function equipesDoArquivo(value: unknown): Equipe[] | undefined {
  if (!Array.isArray(value)) return undefined
  const equipes: Equipe[] = []
  const ids = new Set<string>()
  const comEquipe = new Set<string>()
  for (const bruta of value) {
    if (equipes.length >= EQUIPES_MAX) break
    if (!isRecord(bruta)) continue
    const { id, nome, cor, membros } = bruta
    if (typeof id !== 'string' || id.length === 0 || id.length > ID_DA_EQUIPE_MAX || ids.has(id)) continue
    ids.add(id)
    const limpos: string[] = []
    for (const membro of Array.isArray(membros) ? membros : []) {
      if (typeof membro !== 'string' || membro.length === 0 || comEquipe.has(membro)) continue
      comEquipe.add(membro)
      limpos.push(membro)
    }
    const nomeLimpo = typeof nome === 'string' ? nome.trim().slice(0, NOME_DA_EQUIPE_MAX) : ''
    equipes.push({ id, nome: nomeLimpo.length > 0 ? nomeLimpo : NOME_DA_EQUIPE_PADRAO, cor: corDaEquipe(cor), membros: limpos })
  }
  return equipes
}

/** A equipe do personagem, ou `null` (sem equipe, ou nenhuma equipe cadastrada). */
export function equipeDe(personagemId: string, equipes: readonly Equipe[] | undefined): Equipe | null {
  if (equipes === undefined) return null
  return equipes.find((equipe) => equipe.membros.includes(personagemId)) ?? null
}

/**
 * Os aliados de quem tem os personagens `meusPersonagens` (ids de personagem):
 *  - nenhuma equipe cadastrada: todo personagem de tipo "jogador" é aliado (a
 *    equipe implícita: colega vê colega, como antes das equipes);
 *  - com equipes: os membros de tipo "jogador" das equipes dele. Sem equipe =
 *    sem aliados.
 * Nunca entra NPC, nem os próprios personagens.
 */
export function aliadosDe(meusPersonagens: ReadonlySet<string>, equipes: readonly Equipe[] | undefined, personagens: readonly Personagem[]): Set<string> {
  const jogadores = new Set(personagens.filter((personagem) => personagem.tipo === 'jogador').map((personagem) => personagem.id))
  const aliados = new Set<string>()
  if (equipes === undefined || equipes.length === 0) {
    for (const id of jogadores) if (!meusPersonagens.has(id)) aliados.add(id)
    return aliados
  }
  for (const equipe of equipes) {
    if (!equipe.membros.some((id) => meusPersonagens.has(id))) continue
    for (const id of equipe.membros) if (jogadores.has(id) && !meusPersonagens.has(id)) aliados.add(id)
  }
  return aliados
}

import { chaveDoNome } from '../contasDosJogadores'
import type { Personagem, TipoDePersonagem } from '../personagem'
import type { Verbete } from './tipos'

/**
 * A FICHA LIGADA A UM VERBETE DE PERSONAGEM (pedido 6 de 17/11/2026): o verbete
 * guarda só o id da ficha (`LigaFicha`), e a ficha pode ser de NPC ou de
 * jogador. Puro: quem lê as pastas (`preludio/enciclopedia/tiposDasFichas.ts`)
 * passa o tipo de cada ficha já lida.
 */

/** O tipo das fichas de cada pasta já lida: pastaId → (personagemId → tipo). */
export type TiposDasFichas = ReadonlyMap<string, ReadonlyMap<string, TipoDePersonagem>>

/**
 * O que o verbete é na mesa, pela ficha ligada: `jogador` se alguma ficha
 * ligada é de jogador; `npc` se tem ficha ligada e nenhuma é de jogador
 * (inclusive a que ainda não foi lida ou que sumiu da pasta); `null` = sem ficha.
 */
export function tipoDaFichaLigada(verbete: Pick<Verbete, 'liga'>, tipos: TiposDasFichas): TipoDePersonagem | null {
  const fichas = verbete.liga?.fichas ?? []
  if (fichas.length === 0) return null
  return fichas.some((ficha) => tipos.get(ficha.pastaId)?.get(ficha.personagemId) === 'jogador') ? 'jogador' : 'npc'
}

/** A ficha da pasta com o MESMO nome (a regra do nome repetido das fichas, `chaveDoNome`: sem caixa); a primeira, se houver duas. */
export function fichaDeMesmoNome<T extends Pick<Personagem, 'nome'>>(personagens: readonly T[], nome: string): T | null {
  const chave = chaveDoNome(nome)
  if (chave === '') return null
  return personagens.find((um) => chaveDoNome(um.nome) === chave) ?? null
}

import { valorDoRank } from '../ajusteDaFicha'
import type { Personagem } from '../personagem'
import { rankDoValor, type SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import { efeitosDasFormasLigadas } from './transformacao'

/**
 * O DANO RECEBIDO QUE CAI, conserto das fichas F1 (fatia S4): o que tira
 * uma parte de todo dano que chega na ficha, no golpe e no "Dar dano" / "Me
 * dar dano" (o jogador digita o dano CHEIO; o app desconta e avisa).
 *  - a forma ligada (R6, Resiliente: −20%);
 *  - a Determinação (regra do livro, aplicada pelo app para toda ficha,
 *    resposta da May): a partir do rank 4, com o HP ABAIXO da metade, −10%
 *    no rank 4 até −50% no rank 10.
 * Duas reduções vão uma depois da outra (−20% e −10% = −28%, como a
 * Armadura Humana com o Resiliente na resposta do Vagn).
 *
 * Puro: sem store, sem rede.
 */

/** O id do atributo Determinação no sistema One Piece. */
export const ATRIBUTO_DA_DETERMINACAO = 'determinacao'

/** Livro, Status > Determinação: o rank e quanto do dano sai (rank 10 e acima: 50%). */
const REDUCAO_POR_RANK: Readonly<Record<number, number>> = { 4: 10, 5: 15, 6: 20, 7: 25, 8: 30, 9: 40, 10: 50 }
const RANK_MINIMO_DA_DETERMINACAO = 4
const RANK_MAXIMO_DA_TABELA = 10
/** "Ao perder 50% da vida": vale com o HP abaixo desta porcentagem do máximo. */
const VIDA_DA_DETERMINACAO = 50

export interface ReducaoDoDano {
  /** "Resiliente", "Determinação". */
  nome: string
  /** Quanto sai, de 1 a 100. */
  porcento: number
}

/** A Determinação de agora: quanto tira do dano (0 = nada: rank abaixo de 4, HP na metade ou acima, ou sistema sem o atributo). */
export function reducaoDaDeterminacao(personagem: Personagem, sistema: SistemaDeRpg): number {
  const atributo = sistema.atributos.find((candidato) => candidato.id === ATRIBUTO_DA_DETERMINACAO)
  if (atributo === undefined) return 0
  const rank = rankDoValor(atributo.rank, valorDoRank(personagem, atributo.id))
  if (rank === null || rank < RANK_MINIMO_DA_DETERMINACAO) return 0
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  if (vida === null || vida.atual * 100 >= VIDA_DA_DETERMINACAO * vida.maximo) return 0
  return REDUCAO_POR_RANK[Math.min(rank, RANK_MAXIMO_DA_TABELA)] ?? 0
}

/** O que tira do dano que chega na ficha AGORA, na ordem forma, Determinação. Nenhum: lista vazia. */
export function reducoesDoDano(personagem: Personagem, sistema: SistemaDeRpg): ReducaoDoDano[] {
  const reducoes: ReducaoDoDano[] = []
  const { reducaoDoDano, formaDaReducao } = efeitosDasFormasLigadas(personagem, sistema)
  if (reducaoDoDano > 0) reducoes.push({ nome: formaDaReducao ?? 'forma', porcento: reducaoDoDano })
  const determinacao = reducaoDaDeterminacao(personagem, sistema)
  if (determinacao > 0) reducoes.push({ nome: 'Determinação', porcento: determinacao })
  return reducoes
}

/** O que sobra de 1 depois das reduções, uma depois da outra (−20% e −10% = 0,72). */
function fatorQueSobra(reducoes: readonly ReducaoDoDano[]): number {
  return reducoes.reduce((fator, reducao) => (fator * (100 - Math.min(100, Math.max(0, reducao.porcento)))) / 100, 1)
}

/** O dano que chega com as reduções, arredondado (como a forma sempre fez). Sem redução: o MESMO número. */
export function danoComAsReducoes(dano: number, reducoes: readonly ReducaoDoDano[]): number {
  return reducoes.length === 0 ? dano : Math.max(0, Math.round(dano * fatorQueSobra(reducoes)))
}

/** Quanto sai no total, em porcento (−20% e −10% = 28). */
export function porcentoDasReducoes(reducoes: readonly ReducaoDoDano[]): number {
  return Math.round((1 - fatorQueSobra(reducoes)) * 100)
}

/** "Resiliente", "Resiliente e Determinação": os nomes, para o registro. */
export function nomesDasReducoes(reducoes: readonly ReducaoDoDano[]): string {
  const nomes = reducoes.map((reducao) => reducao.nome)
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1] ?? ''}`
}

/** "Resiliente −20% e Determinação −10% (HP abaixo da metade)": o aviso da tela; sem redução, vazio. */
export function avisoDasReducoes(reducoes: readonly ReducaoDoDano[]): string {
  const partes = reducoes.map((reducao) => `${reducao.nome} −${reducao.porcento}%${reducao.nome === 'Determinação' ? ' (HP abaixo da metade)' : ''}`)
  return partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1] ?? ''}`
}

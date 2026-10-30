import { chaveDoNome, type ContaNaSala } from '../contasDosJogadores'
import { nomeDoJogadorLimpo, type Personagem } from '../personagem'
import type { JogadorVisto } from './jogadoresVistos'

/**
 * JOGADORES do mundo do livro de regras (M1,
 * docs/planos/livros-de-regras-plano.md §1 e decisão D1): a ficha se liga ao
 * jogador uma vez só, pela CONTA (`Personagem.dono`, nome + PIN) ou, para
 * quem entra sem conta, pelo NOME digitado na entrada
 * (`Personagem.nomeDoJogador`). As duas ligações são exclusivas: ligar uma
 * apaga a outra. Conta ganha de nome: com `dono`, o nome é ignorado.
 *
 * Nome é comparado pelo esqueleto (`chaveDoNome`), a mesma regra da sala
 * (`normalizeName` em net/hostSession.ts): "Beto" e "beto " são o mesmo.
 * Puro: sem store, sem disco, sem rede.
 */

export type LigacaoDoJogador = { tipo: 'conta'; contaId: string } | { tipo: 'nome'; nome: string } | { tipo: 'nenhuma' }

/** Como a ficha está ligada agora. Conta primeiro (D1): um `nomeDoJogador` que sobrou ao lado de um `dono` não vale. */
export function ligacaoDe(personagem: Personagem): LigacaoDoJogador {
  if (personagem.dono !== undefined) return { tipo: 'conta', contaId: personagem.dono }
  if (personagem.nomeDoJogador !== undefined) return { tipo: 'nome', nome: personagem.nomeDoJogador }
  return { tipo: 'nenhuma' }
}

/** Sem ligação nenhuma. As chaves saem do objeto (nada de `dono: undefined` gravado). */
export function desligarJogador(personagem: Personagem): Personagem {
  if (personagem.dono === undefined && personagem.nomeDoJogador === undefined) return personagem
  const { dono: _dono, nomeDoJogador: _nome, ...solto } = personagem // as duas ligações saem juntas
  return solto
}

/** Liga ao nome de entrada (limpo como o `join`); apaga a conta. Nome vazio depois da limpeza = desligar. */
export function ligarAoNome(personagem: Personagem, nome: string): Personagem {
  const limpo = nomeDoJogadorLimpo(nome)
  if (limpo.length === 0) return desligarJogador(personagem)
  if (personagem.dono === undefined && personagem.nomeDoJogador === limpo) return personagem
  return { ...desligarJogador(personagem), nomeDoJogador: limpo }
}

/** Liga à conta (D1: o jeito seguro, ninguém pega a ficha digitando o nome); apaga o nome. */
export function ligarAConta(personagem: Personagem, contaId: string): Personagem {
  if (personagem.dono === contaId && personagem.nomeDoJogador === undefined) return personagem
  return { ...desligarJogador(personagem), dono: contaId }
}

/**
 * As fichas que quem entra SEM conta com esse nome recebe: ligadas pelo nome
 * e sem conta. É a regra de `giveNamedTokens` (net/hostSession.ts) num lugar
 * só, para a página Jogadores e a sala lerem o mesmo.
 */
export function personagensDoNome(personagens: readonly Personagem[], nomeDigitado: string): Personagem[] {
  const chave = chaveDoNome(nomeDigitado)
  if (chave.length === 0) return []
  return personagens.filter((personagem) => personagem.dono === undefined && personagem.nomeDoJogador !== undefined && chaveDoNome(personagem.nomeDoJogador) === chave)
}

/**
 * O aviso de nome repetido na ligação: as OUTRAS fichas já ligadas ao mesmo
 * nome. Não impede (um jogador pode ter duas fichas); a tela só avisa.
 */
export function outrasFichasDoNome(personagens: readonly Personagem[], nome: string, personagemId: string): Personagem[] {
  return personagensDoNome(personagens, nome).filter((personagem) => personagem.id !== personagemId)
}

/**
 * "Entraram na mesa e não têm ficha": os nomes vistos sem ficha ligada. Nome
 * de conta conta como a conta (tem ficha se algum personagem tem `dono` com o
 * id dela); o resto, pelo nome de entrada. Na ordem de `vistos` (o mais
 * recente primeiro, `registrarVistos`).
 */
export function jogadoresSemFicha(vistos: readonly JogadorVisto[], personagens: readonly Personagem[], contas: readonly ContaNaSala[]): JogadorVisto[] {
  const contaPelaChave = new Map(contas.map((conta) => [chaveDoNome(conta.nome), conta.id]))
  const contasComFicha = new Set(personagens.flatMap((personagem) => (personagem.dono === undefined ? [] : [personagem.dono])))
  return vistos.filter((visto) => {
    const contaId = contaPelaChave.get(chaveDoNome(visto.nome))
    if (contaId !== undefined) return !contasComFicha.has(contaId)
    return personagensDoNome(personagens, visto.nome).length === 0
  })
}

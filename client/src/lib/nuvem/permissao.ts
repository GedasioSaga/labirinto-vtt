import { ABA_DAS_ARMAS } from '../batalha/leituraDaFicha'
import { quantidadeDe } from '../items'
import type { Personagem } from '../personagem'
import { alvoDoCaminho, quemEscreveAMudanca } from './caminho'
import { ehRegistro, proprio } from './json'
import type { FichaGuardada, Identidade, Membro, MotivoNegado, Mudanca, OpGravada, Papel } from './tipos'

/**
 * PERMISSÃO (docs/planos/lobby-jogadores-2026-11-05.md §6.4), conferida a
 * cada mensagem, não só na entrada: membro removido ou dono trocado passam a
 * ser negados já na mensagem seguinte.
 *
 * - Mestre: tudo.
 * - Jogador: escreve só nas fichas cujo `dono` (lido do doc COMPLETO no
 *   servidor) é a conta dele — uma conta pode ter várias fichas —, nunca em
 *   caminho do mestre, nunca cria nem apaga ficha. Ficha sem dono: só o mestre.
 *   Na vaga com efeito, só baixa a quantidade (`sobeItemComEfeito`).
 *   Na arma ligada ao livro, não muda o que ela faz (`mexeNaArmaDoLivro`).
 *   Na vaga ligada ao Acervo, não muda os dados da coisa (`mexeNaCoisaDoAcervo`).
 * - `autorDeclarado` (mesa LAN): só com a identidade do app e com um membro
 *   ativo; a permissão é a do app (o mestre), que já conferiu a edição na sala.
 */

export type Veredito = { ok: true } | { ok: false; motivo: MotivoNegado; detalhe: string }

const PERMITIDO: Veredito = { ok: true }

/** ARMAS-FONTE-UNICA §8: a frase da recusa na arma ligada ao livro (e na ligação dela). */
export const ARMA_DO_LIVRO = 'Arma do livro: só o mestre muda o que ela faz'

function negar(detalhe: string): Veredito {
  return { ok: false, motivo: 'sem-permissao', detalhe }
}

export function membroAtivo(membro: Membro | undefined): membro is Membro {
  return membro !== undefined && membro.estado === 'ativo'
}

/** O dono da ficha, do doc completo; `null` = sem dono (só o mestre edita). */
export function donoDaFicha(ficha: FichaGuardada): string | null {
  return ficha.doc.dono ?? null
}

/**
 * O jogador vê ficha da mesa e inimigo liberado para o treino (T8, pela
 * projeção do treino), se não foi apagada; o mestre vê tudo. Escrever, só na
 * da mesa (`podeEscreverNaFicha`).
 */
export function podeVer(papel: Papel, ficha: FichaGuardada): boolean {
  return papel === 'mestre' || ((ficha.visivel === 'mesa' || ficha.visivel === 'treino') && !ficha.apagada)
}

/**
 * Escreve na ficha, sem olhar o caminho. A ficha do jogador apagada continua
 * dele aqui: a op dele vira o conflito "o mestre apagou", não uma recusa seca.
 */
export function podeEscreverNaFicha(membro: Membro, ficha: FichaGuardada | undefined): boolean {
  if (membro.papel === 'mestre') return true
  if (ficha === undefined || ficha.visivel !== 'mesa') return false
  return donoDaFicha(ficha) === membro.contaId
}

/** A mudança no caminho, com o valor (cartão novo com imagem é só do mestre, 12.4), nesta ficha. */
export function permissaoDaMudanca(membro: Membro | undefined, ficha: FichaGuardada | undefined, mudanca: Pick<Mudanca, 'caminho' | 'acao' | 'valor' | 'delta'>): Veredito {
  if (!membroAtivo(membro)) return negar('Você não está nesta campanha')
  const quem = quemEscreveAMudanca(mudanca)
  if (quem === null) return { ok: false, motivo: 'fora-do-esquema', detalhe: 'Campo fora da tabela do Lobby' }
  // Fatia C7: esconder um cartão é só no app do mestre (o cartão oculto nunca sobe); no Lobby o segredo ficaria no servidor.
  if (alvoDoCaminho(mudanca.caminho)?.regra === 'ocultaDoCartao') return negar('Esconder um cartão dos jogadores é só pelo app do mestre')
  if (membro.papel === 'mestre') return PERMITIDO
  if (quem === 'mestre') return negar(mexeNaLigacaoDaArma(mudanca) ? ARMA_DO_LIVRO : 'Só o mestre muda este campo')
  if (!podeEscreverNaFicha(membro, ficha)) {
    if (ficha !== undefined && donoDaFicha(ficha) === null) return negar('Ficha sem dono: só o mestre edita')
    return negar('Esta ficha não é sua')
  }
  if (ficha !== undefined && sobeItemComEfeito(ficha.doc, mudanca)) return negar('Item com efeito: o jogador só gasta, quem dá mais é o mestre')
  if (ficha !== undefined && mexeNaArmaDoLivro(ficha.doc, mudanca)) return negar(ARMA_DO_LIVRO)
  if (ficha !== undefined && mexeNaCoisaDoAcervo(ficha.doc, mudanca)) return negar('Item do Acervo: só o mestre muda os dados dele')
  return PERMITIDO
}

/**
 * OS DADOS DA COISA NUMA FONTE SÓ (Nº 11 e 14 do levantamento de 25/11/2026,
 * `lib/mochila/efeitoNasCopias.ts`): a vaga ligada ao Acervo (`itemId`, no doc
 * do servidor) é cópia da coisa; o nome, a foto, a descrição, o preço, a luz e
 * as munições dela só o mestre muda. O dono acende e apaga (`acesa`), gasta e
 * tira. É a regra da mesa LAN, onde o jogador não tem como mudar uma vaga (só
 * acender, usar, dar e largar); no Lobby o dono podia, e a foto, a luz e as
 * munições voltavam ao Acervo na abertura seguinte da pasta no app do mestre.
 */
function mexeNaCoisaDoAcervo(doc: Personagem, mudanca: Pick<Mudanca, 'caminho'>): boolean {
  const alvo = alvoDoCaminho(mudanca.caminho)
  if (alvo?.regra !== 'campoDoItem' || alvo.campo === 'acesa') return false
  return (doc.mochila ?? []).some((vaga) => vaga.id === alvo.vagaId && vaga.itemId !== undefined)
}

/** O cartão (ou um subcartão dele) traz `itemId`: a ligação com o Acervo, que escolhe a regra do livro. */
function trazItemId(valor: unknown, profundidade = 0): boolean {
  if (!ehRegistro(valor) || profundidade > 2) return false
  if (proprio(valor, 'itemId') !== undefined) return true
  const subcartoes = proprio(valor, 'subcartoes')
  return Array.isArray(subcartoes) && Array.from(subcartoes).some((sub: unknown) => trazItemId(sub, profundidade + 1))
}

/** A mudança é na ligação do cartão com o Acervo (o `itemId`, ou o cartão novo que já nasce com ele). */
function mexeNaLigacaoDaArma(mudanca: Pick<Mudanca, 'caminho' | 'acao' | 'valor'>): boolean {
  const alvo = alvoDoCaminho(mudanca.caminho)
  if (alvo?.regra === 'campoDoCartao') return alvo.campo === 'itemId'
  return alvo?.regra === 'cartao' && mudanca.acao === 'criar' && trazItemId(mudanca.valor)
}

/**
 * ARMAS-FONTE-UNICA §8: o cartão de arma ligado (`itemId`, no doc do servidor)
 * é cópia da regra do livro; o que ela faz (os campos, a mecânica e as balas:
 * criar, apagar, renomear e reordenar) só o mestre muda. O nome, a arma padrão
 * e a proposta continuam do dono.
 */
function mexeNaArmaDoLivro(doc: Personagem, mudanca: Pick<Mudanca, 'caminho'>): boolean {
  const alvo = alvoDoCaminho(mudanca.caminho)
  if (alvo === null || !('aba' in alvo) || alvo.aba !== ABA_DAS_ARMAS) return false
  const [cartaoId, ...dentro] = alvo.trilha
  const cartao = (doc.abas[alvo.aba] ?? []).find((atual) => atual.id === cartaoId)
  if (cartao?.itemId === undefined) return false
  // Fase B do alcance: o alcance da arma ligada também é do livro (copiado pelo mesmo caminho da mecânica).
  if (alvo.regra === 'textoDoCartao' || alvo.regra === 'mecanicaDoCartao' || alvo.regra === 'alcanceDoCartao') return true
  if (alvo.regra === 'ordemDosCartoes') return alvo.trilha.length > 0
  return dentro.length > 0 && (alvo.regra === 'cartao' || alvo.regra === 'campoDoCartao')
}

/**
 * EFEITO DO ITEM (Fase 7, decisão C8: só o mestre dá item com efeito): na
 * vaga que tem efeito, o jogador baixa a quantidade (gastou), nunca sobe —
 * cada unidade a mais seria um uso de verdade, que o host executa pela cópia
 * dele. O doc do servidor não tem as peças: a vaga com efeito é a que tem a
 * frase (`efeitoResumo`, que só o mestre grava e que todo efeito dá).
 */
function sobeItemComEfeito(doc: Personagem, mudanca: Pick<Mudanca, 'caminho' | 'acao' | 'valor' | 'delta'>): boolean {
  const alvo = alvoDoCaminho(mudanca.caminho)
  if (alvo?.regra !== 'quantidade') return false
  const vaga = (doc.mochila ?? []).find((item) => item.id === alvo.vagaId)
  if (vaga === undefined || (vaga.efeitoResumo === undefined && vaga.efeito === undefined)) return false
  if (mudanca.acao === 'somar') return typeof mudanca.delta !== 'number' || mudanca.delta > 0
  // `definir` sem valor é o ausente, 1 (`quantidadeDe`), como em `lerMudanca`.
  const nova = mudanca.valor === undefined ? 1 : mudanca.valor
  return typeof nova !== 'number' || nova > quantidadeDe(vaga)
}

/** Quem fez a mudança de fato: quem mandou, ou o jogador da sala que o app declarou. */
export interface AutorEfetivo {
  membro: Membro
  atestadoPeloApp: boolean
}

/** Só a identidade do app (o Service Token, que é o mestre com origem `app`) declara quem mexeu na sala. Do site, nem o mestre. */
export function podeDeclararAutor(quem: Pick<Identidade, 'origem'>, remetente: Membro | undefined): boolean {
  return quem.origem === 'app' && remetente !== undefined && remetente.papel === 'mestre'
}

/**
 * O autor da op. `autorDeclarado` só vale com a identidade do app
 * (`podeDeclararAutor`) e com um membro ativo; fica marcado "atestado pelo
 * app" (§6.4).
 */
export function autorDaOp(
  quem: Pick<Identidade, 'origem'>,
  remetente: Membro,
  declarado: string | undefined,
  membroDeclarado: Membro | undefined,
): { ok: true; autor: AutorEfetivo } | { ok: false; motivo: MotivoNegado; detalhe: string } {
  if (declarado === undefined) return { ok: true, autor: { membro: remetente, atestadoPeloApp: false } }
  if (!podeDeclararAutor(quem, remetente)) return { ok: false, motivo: 'sem-permissao', detalhe: 'Só o app do mestre declara quem mexeu na sala' }
  if (!membroAtivo(membroDeclarado) || membroDeclarado.contaId !== declarado) return { ok: false, motivo: 'sem-permissao', detalhe: 'Quem mexeu na sala não está nesta campanha' }
  return { ok: true, autor: { membro: membroDeclarado, atestadoPeloApp: true } }
}

/**
 * Desfazer (§5.3): o mestre desfaz qualquer op; o jogador, só a que é dele
 * (autor efetivo), numa ficha que ele vê e em que ainda escreve hoje.
 */
export function podeDesfazer(membro: Membro | undefined, ficha: FichaGuardada | undefined, alvo: Pick<OpGravada, 'autorContaId'>): Veredito {
  if (!membroAtivo(membro)) return negar('Você não está nesta campanha')
  if (membro.papel === 'mestre') return PERMITIDO
  if (ficha === undefined || !podeVer(membro.papel, ficha)) return negar('Mudança não encontrada')
  if (alvo.autorContaId !== membro.contaId) return negar('Só o mestre desfaz a mudança de outra pessoa')
  if (!podeEscreverNaFicha(membro, ficha)) return negar('Esta ficha não é mais sua')
  return PERMITIDO
}

import { ErroDoPedido } from './http'
import { emailNormalizado } from './identidade'
import { CONTA_DO_MESTRE, ehJson, ehRegistro, proprio, segmentoValido, VERSAO_DO_FORMATO, type Json } from './nucleo'

/**
 * Os corpos das rotas do app (plano §5.4), lidos campo a campo. O app (fatias
 * R1/A5) manda exatamente isto:
 *
 * - `POST publicar`: `{ v, clienteId, nome, nomeDoMestre, sistema, membros, fichas, treino? }`
 * - `POST membros`:  `{ v, nomeDoMestre, membros }`
 * - `POST ops`:      `{ v, clienteId, lote }`
 *
 * `membros` = `[{ contaId, email, nome }]`, só os jogadores: o mestre é quem
 * publica (o e-mail vem da identidade do portão, `contaId` = 'mestre').
 */

export const KIB = 1024
export const MIB = 1024 * KIB
/** 12 fichas de 256 KiB (o teto do doc, §4.7) + o sistema, com folga. */
export const CORPO_MAX_PUBLICAR = 8 * MIB
/** Um lote de 50 ops comuns cabe com folga; lote com várias fichas inteiras vai partido pelo app. */
export const CORPO_MAX_OPS = 4 * MIB
export const CORPO_MAX_MEMBROS = 256 * KIB
/** O Access grátis tem 50 pessoas (§7): o mestre e até 49 jogadores. */
const MEMBROS_MAX = 49
const FICHAS_POR_PUBLICAR_MAX = 200
const NOME_MAX = 120

export interface MembroNovo {
  contaId: string
  email: string
  nome: string
}

export interface PedidoDeMembros {
  nomeDoMestre: string
  membros: MembroNovo[]
}

export interface PedidoDePublicar extends PedidoDeMembros {
  clienteId: string
  nome: string
  sistema: Json
  fichas: unknown[]
  /**
   * As cópias dos inimigos liberados para o treino (T8), a lista INTEIRA: a
   * cópia que não vem sai do treino. `null` = o pedido não trouxe a lista
   * (app de antes da T8, ou o `rpg.json` ilegível): as do servidor ficam.
   */
  treino: unknown[] | null
}

export interface PedidoDeOps {
  clienteId: string
  lote: unknown[]
}

/** O Worker aceita a versão do formato atual e a anterior (§5.6). */
export function versaoAceita(v: unknown): boolean {
  return v === VERSAO_DO_FORMATO || v === VERSAO_DO_FORMATO - 1
}

function foraDoFormato(detalhe: string): ErroDoPedido {
  return new ErroDoPedido(400, 'fora-do-formato', detalhe)
}

function registroDoCorpo(corpo: unknown): Record<string, unknown> {
  if (!ehRegistro(corpo)) throw foraDoFormato('Esperava um objeto')
  const v = proprio(corpo, 'v')
  if (!versaoAceita(v)) throw new ErroDoPedido(409, 'versao', `O servidor usa o formato ${VERSAO_DO_FORMATO}; atualize o app`)
  return corpo
}

function nomeDe(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || valor.trim().length === 0 || valor.trim().length > NOME_MAX) throw foraDoFormato(`${campo}: texto de 1 a ${NOME_MAX} caracteres`)
  return valor.trim()
}

function clienteIdDe(registro: Record<string, unknown>): string {
  const clienteId = proprio(registro, 'clienteId')
  if (!segmentoValido(clienteId)) throw foraDoFormato('clienteId fora do formato')
  return clienteId
}

function listaDe(registro: Record<string, unknown>, campo: string, maximo: number): unknown[] {
  const lista = proprio(registro, campo)
  if (!Array.isArray(lista)) throw foraDoFormato(`${campo}: esperava uma lista`)
  if (lista.length > maximo) throw foraDoFormato(`${campo}: no máximo ${maximo}`)
  return Array.from(lista)
}

function membroNovoDe(valor: unknown): MembroNovo {
  if (!ehRegistro(valor)) throw foraDoFormato('Membro fora do formato')
  const contaId = proprio(valor, 'contaId')
  const email = emailNormalizado(proprio(valor, 'email'))
  if (!segmentoValido(contaId) || contaId === CONTA_DO_MESTRE) throw foraDoFormato('contaId do membro fora do formato')
  if (email === null) throw foraDoFormato(`E-mail de ${contaId} fora do formato`)
  return { contaId, email, nome: nomeDe(proprio(valor, 'nome'), 'nome do membro') }
}

function membrosDe(registro: Record<string, unknown>): PedidoDeMembros {
  const membros = listaDe(registro, 'membros', MEMBROS_MAX).map(membroNovoDe)
  if (new Set(membros.map((membro) => membro.contaId)).size !== membros.length) throw foraDoFormato('contaId repetido')
  if (new Set(membros.map((membro) => membro.email)).size !== membros.length) throw foraDoFormato('E-mail repetido em duas contas')
  return { nomeDoMestre: nomeDe(proprio(registro, 'nomeDoMestre'), 'nomeDoMestre'), membros }
}

export function lerPedidoDeMembros(corpo: unknown): PedidoDeMembros {
  return membrosDe(registroDoCorpo(corpo))
}

export function lerPedidoDePublicar(corpo: unknown): PedidoDePublicar {
  const registro = registroDoCorpo(corpo)
  const sistema = proprio(registro, 'sistema')
  if (sistema === undefined || !ehJson(sistema)) throw foraDoFormato('sistema fora do formato')
  return {
    ...membrosDe(registro),
    clienteId: clienteIdDe(registro),
    nome: nomeDe(proprio(registro, 'nome'), 'nome da campanha'),
    sistema,
    fichas: listaDe(registro, 'fichas', FICHAS_POR_PUBLICAR_MAX),
    treino: proprio(registro, 'treino') === undefined ? null : listaDe(registro, 'treino', FICHAS_POR_PUBLICAR_MAX),
  }
}

/** O lote vai cru: o `processarLote` do núcleo lê cada op (e responde cada uma). */
export function lerPedidoDeOps(corpo: unknown): PedidoDeOps {
  const registro = registroDoCorpo(corpo)
  const lote = proprio(registro, 'lote')
  if (!Array.isArray(lote)) throw foraDoFormato('lote: esperava uma lista')
  return { clienteId: clienteIdDe(registro), lote: Array.from(lote) }
}

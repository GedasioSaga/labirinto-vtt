import type { AcaoDaTecnica, NumerosDoInvocado, PedidoDeInvocacao } from '../../lib/batalha/combate'
import { lerInvocacao, MOTIVO_DO_COMUM_COM_O_ULTRA, type OpcaoDaInvocacao } from '../../lib/batalha/invocacao'
import { tecnicaPorId } from '../../lib/batalha/leituraDaFicha'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { formatarNumero } from './dadosDoMenu'

/**
 * INVOCAÇÃO, F3 (docs/planos/batalha-invocacao-plano.md): o que as telas da
 * invocação desenham, montado dos dois lados (mestre e jogador). A regra mora
 * em `lib/batalha/invocacao.ts`; aqui só se junta o texto e a contagem.
 *
 * O mestre tem a cena inteira e usa `motivoDaInvocacao` (a mesma regra da
 * store). O jogador só tem o recorte: `motivoNoJogador` repete a parte que ele
 * consegue ver (máximo em campo, Ultra em campo, carga e o motivo da técnica); os tetos da
 * mesa inteira o host confere e a recusa volta como aviso.
 */

/** Uma opção na mira da invocação, com o que já está em campo e o porquê de estar apagada. */
export interface OpcaoDeInvocacaoNaTela extends OpcaoDaInvocacao {
  /** Quantos desta opção o dono já tem: colocados + esperando o mestre. */
  emCampo: number
  /** Presente = apagada, com a frase ("No máximo 3 em campo"). */
  motivo: string | null
}

export interface InvocacaoNaTela {
  cartaoId: string
  nome: string
  /** A imagem do cartão (`midia:` ou embutida); `null` = disco de iniciais. */
  imagem: string | null
  opcoes: OpcaoDeInvocacaoNaTela[]
}

/** A regra de cada lado: por que esta opção não vale com o custo e a ação da tela; `null` = pode. */
export type MotivoDaOpcao = (opcao: OpcaoDaInvocacao, custo: number | null, acao: AcaoDaTecnica | null) => string | null

/** A invocação da técnica `cartaoId` da ficha; `null` = não é técnica de Tipo Invocação. */
export function invocacaoDaFicha(personagem: Personagem | null, sistema: SistemaDeRpg | null, cartaoId: string): { cartaoId: string; nome: string; imagem: string | null; opcoes: OpcaoDaInvocacao[] } | null {
  if (personagem === null || sistema === null) return null
  const achada = tecnicaPorId(personagem, sistema, cartaoId)
  if (achada === null) return null
  return lerInvocacao(achada.cartao)
}

/** As opções com a contagem e o motivo de agora (o custo e a ação que a tela tem). */
export function opcoesNaTela(
  leitura: { opcoes: readonly OpcaoDaInvocacao[] },
  contar: (opcao: OpcaoDaInvocacao) => number,
  motivo: MotivoDaOpcao,
  custo: number | null,
  acao: AcaoDaTecnica | null,
): OpcaoDeInvocacaoNaTela[] {
  return leitura.opcoes.map((opcao) => ({ ...opcao, emCampo: contar(opcao), motivo: motivo(opcao, custo, acao) }))
}

/**
 * O motivo do lado do JOGADOR, na mesma ordem de `motivoDaInvocacao`:
 * máximo da opção (colocados + pendentes dele), o comum com o Ultra dele em
 * campo (`ultraEmCampo`: o Ultra da mesma técnica já posto), a carga que ela
 * exige e o motivo da técnica (recarga, usos, ação, SP), que o menu já calcula.
 */
export function motivoNoJogador(opcao: Pick<OpcaoDaInvocacao, 'maximo' | 'carga' | 'ultra'>, emCampo: number, ultraEmCampo: boolean, carga: number, motivoDaTecnica: string | null): string | null {
  if (opcao.maximo !== null && emCampo >= opcao.maximo) return `No máximo ${opcao.maximo} em campo`
  if (!opcao.ultra && ultraEmCampo) return MOTIVO_DO_COMUM_COM_O_ULTRA
  if (carga < opcao.carga) return `Precisa de concentração ${opcao.carga} (tem ${carga})`
  return motivoDaTecnica
}

/** "40 HP · 30 de dano · anda 3 blocos". */
export function textoDosNumeros(numeros: NumerosDoInvocado): string {
  const anda = numeros.blocos === 0 ? 'não anda' : `anda ${formatarNumero(numeros.blocos)} ${numeros.blocos === 1 ? 'bloco' : 'blocos'}`
  return `${formatarNumero(numeros.hp)} HP · ${formatarNumero(numeros.dano)} de dano · ${anda}`
}

/** "1 de 3 em campo"; sem máximo, "1 em campo"; nenhum e sem máximo, vazio. */
export function textoDoCampo(opcao: Pick<OpcaoDeInvocacaoNaTela, 'maximo' | 'emCampo'>): string {
  if (opcao.maximo === null) return opcao.emCampo === 0 ? '' : `${opcao.emCampo} em campo`
  return `${opcao.emCampo} de ${opcao.maximo} em campo`
}

/** O pedido que sai do Invocar. */
export function pedidoDeInvocacao(tokenId: string, cartaoId: string, opcao: string, custo: number | null, acao: AcaoDaTecnica | null): PedidoDeInvocacao {
  return { tipo: 'invocar', tokenId, cartaoId, opcao, custo, acao }
}

// ───────────────────────────────────────────────────────────────────────────
// A carta do bando
// ───────────────────────────────────────────────────────────────────────────

const VOGAIS = /[aeiouáéíóúâêôãõ]$/i

/** Plural simples de uma palavra, guardando a caixa ("LOBO" = "LOBOS", "Leão" = "Leões"). */
function pluralDaPalavra(palavra: string): string {
  const maiuscula = palavra.length > 1 && palavra === palavra.toLocaleUpperCase('pt-BR')
  const sufixo = (texto: string) => (maiuscula ? texto.toLocaleUpperCase('pt-BR') : texto)
  const minuscula = palavra.toLocaleLowerCase('pt-BR')
  if (minuscula.endsWith('ão')) return palavra.slice(0, -2) + sufixo('ões')
  if (minuscula.endsWith('s') || minuscula.endsWith('x')) return palavra
  if (minuscula.endsWith('m')) return palavra.slice(0, -1) + sufixo('ns')
  if (minuscula.endsWith('l')) return palavra.slice(0, -1) + sufixo('is')
  if (minuscula.endsWith('r') || minuscula.endsWith('z')) return palavra + sufixo('es')
  if (VOGAIS.test(minuscula)) return palavra + sufixo('s')
  return palavra
}

/** "Lobo" = "Lobos", "Ultra Lobo" = "Ultra Lobos": a última palavra vai ao plural. */
export function pluralDoNome(nome: string): string {
  const palavras = nome.trim().split(/\s+/)
  const ultima = palavras.pop()
  if (ultima === undefined || ultima === '') return nome
  return [...palavras, pluralDaPalavra(ultima)].join(' ')
}

/**
 * O nome da carta do bando: "Lobos de Ryoko" (todos com o mesmo nome),
 * "Lobo de Ryoko" (um só), "Bando de Ryoko" (nomes diferentes) ou o nome
 * que veio (`reserva`, o da store ou do recorte) quando não há dono à vista.
 */
export function nomeDoBando(membros: readonly { nome: string }[], dono: string | null, reserva: string): string {
  if (dono === null || dono.trim() === '') return reserva.trim() || 'Bando'
  const nomes = [...new Set(membros.map((membro) => membro.nome.trim()).filter((nome) => nome !== ''))]
  if (nomes.length !== 1) return `Bando de ${dono.trim()}`
  const [nome] = nomes as [string]
  return `${membros.length === 1 ? nome : pluralDoNome(nome)} de ${dono.trim()}`
}

/** "Simples 0/1 · Mov 2/3": a economia de um invocado na vez do bando. */
export function economiaDoInvocado(acoes: { simples: { usadas: number; total: number }; blocos: { andados: number; limite: number | null } }): string {
  const { andados, limite } = acoes.blocos
  return `Simples ${acoes.simples.usadas}/${acoes.simples.total} · Mov ${formatarNumero(andados)}${limite === null ? '' : `/${formatarNumero(limite)}`}`
}

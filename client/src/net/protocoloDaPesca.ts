import { PEIXES, type IdDoPeixe } from '../minigames/pesca/sim'
import {
  DIFICULDADES_PESCA,
  FALA_MAX_LENGTH,
  LAGO_MAX_LENGTH,
  LANCES_MAX,
  LANCES_MIN,
  NPC_MAX_LENGTH,
  PESCA_TEXTO_MAX_LENGTH,
  type DificuldadePesca,
  type MinigamePesca,
} from '../minigames/pesca/tipos'

/**
 * MINIGAME DE PESCA AO VIVO — as mensagens da pesca entre o mestre e os
 * jogadores. Aditivo como o resto do protocolo: jogador antigo cai no
 * `default` e ignora; mestre antigo responde `error invalid_message`.
 *
 *  - mestre → jogador: `pesca.convite` (o desafio congelado, só a quem entra),
 *    `pesca.estado`, `pesca.pausa`, `pesca.retoma` e `pesca.encerra`;
 *  - jogador → mestre: `pesca.pedir` (o pino de "Jogador toca no pino"),
 *    `pesca.pronto` (a dificuldade; cada um começa ao mandar), `pesca.vivo`
 *    (fase, lance k de N e medidor, no máximo 4 por segundo), `pesca.lance`
 *    (o resultado de um lance) e `pesca.fim` (o cesto).
 *
 * A rede nunca julga: cada aparelho joga a própria pesca e manda o que pegou.
 * Prêmio e consequência são só texto (decisão do usuário, 18/10/2026): vão no
 * convite, e a pesca não abre porta nem entrega item ou efeito.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */

/** Teto do id da sessão de pesca (o host gera um UUID, 36). */
export const PESCA_SESSAO_MAX = 64
/** Mais participantes que isso nem cabem na sala (`MAX_PLAYERS` do Rust é 16). */
export const PESCA_PARTICIPANTES_MAX = 16
/** Teto do nome que viaja na pesca (o nome efetivo na sala, com "(2)" e tudo). */
export const PESCA_NOME_MAX = 64
/** O jogador manda `pesca.vivo` no máximo a cada 250 ms (4 por segundo; o servidor aceita 30 mensagens/s). */
export const PESCA_VIVO_INTERVALO_MS = 250
/** O maior peixe do jogo tem 210 cm; o teto só barra lixo. */
export const PESCA_CM_MAX = 1000
/** Estrelas de um lance: 1 a 3 pela distância, mais 1 pelo perfeito. */
export const PESCA_ESTRELAS_MAX = 4

export type PescaStatus = 'convidado' | 'pescando' | 'terminou' | 'saiu'
export const PESCA_STATUS: readonly PescaStatus[] = ['convidado', 'pescando', 'terminou', 'saiu']
/** A fase da sessão que o jogador lê. `encerrada` não viaja: chega como `pesca.encerra`. */
export type PescaFaseNoFio = 'aberta' | 'pausa'
const FASES_NO_FIO: readonly PescaFaseNoFio[] = ['aberta', 'pausa']
/** `mestre`: o mestre encerrou; `saiu`: a conexão caiu (ou abriu aba nova) no meio da pesca. */
export type PescaMotivoDoFim = 'mestre' | 'saiu'
const MOTIVOS_DO_FIM: readonly PescaMotivoDoFim[] = ['mestre', 'saiu']
/**
 * A fase do lance na tela do jogador, como o placar do mestre lê: a mesma
 * `FaseDaPesca` de `minigames/pesca/arte.ts`, sem o `convite` (o `pesca.vivo`
 * só sai depois do Pronto).
 */
export type PescaFaseDoLance = 'lance' | 'voo' | 'espera' | 'cedo' | 'fisgada' | 'puxada' | 'final' | 'resultado'
export const PESCA_FASES_DO_LANCE: readonly PescaFaseDoLance[] = ['lance', 'voo', 'espera', 'cedo', 'fisgada', 'puxada', 'final', 'resultado']
/** "Fugiu" e "Escapou" são o mesmo desfecho com nomes diferentes (protótipo aprovado). */
export type PescaResultado = 'pegou' | 'escapou' | 'fugiu'
const PERMITIDAS: readonly MinigamePesca['permitida'][] = ['escolha', ...DIFICULDADES_PESCA]
const IDS_DOS_PEIXES: readonly IdDoPeixe[] = PEIXES.map((peixe) => peixe.id)

export interface PescaParticipante {
  playerId: string
  nome: string
}

/** Um peixe no cesto. O baú só vem junto com o peixe. */
export interface PeixeNoCesto {
  peixe: IdDoPeixe
  cm: number
  estrelas: number
  perfeito: boolean
  bau: boolean
}

/** O que a tela do jogador mostra AGORA, para o placar do mestre. */
export interface PescaVivo {
  fase: PescaFaseDoLance
  /** O lance de agora (1..N). */
  lance: number
  /** Os lances da chamada (N, os do convite). */
  de: number
  /** O medidor de captura, 0..1 (0 fora da puxada). */
  medidor: number
}

/** O desfecho de um lance: `pegou` sempre traz o peixe; o resto nunca traz. */
export type PescaDesfechoDoLance = { resultado: 'pegou'; peixe: PeixeNoCesto } | { resultado: 'escapou' | 'fugiu' }

export interface PescaConviteMessage {
  type: 'pesca.convite'
  sessao: string
  pinId: string
  npc: string
  fala: string
  lago: string
  lances: number
  permitida: MinigamePesca['permitida']
  premio: MinigamePesca['premio']
  consequencia: MinigamePesca['consequencia']
  participantes: PescaParticipante[]
}

export interface PescaEstadoMessage {
  type: 'pesca.estado'
  sessao: string
  fase: PescaFaseNoFio
  participantes: (PescaParticipante & { status: PescaStatus })[]
}

export interface PescaPausaMessage {
  type: 'pesca.pausa' | 'pesca.retoma'
  sessao: string
}

export interface PescaEncerraMessage {
  type: 'pesca.encerra'
  sessao: string
  motivo: PescaMotivoDoFim
}

export type PescaHostMessage = PescaConviteMessage | PescaEstadoMessage | PescaPausaMessage | PescaEncerraMessage

export interface PescaPedirMessage {
  type: 'pesca.pedir'
  pinId: string
}

export interface PescaProntoMessage {
  type: 'pesca.pronto'
  sessao: string
  dificuldade: DificuldadePesca
}

export interface PescaVivoMessage extends PescaVivo {
  type: 'pesca.vivo'
  sessao: string
}

export type PescaLanceMessage = { type: 'pesca.lance'; sessao: string; lance: number } & PescaDesfechoDoLance

export interface PescaFimMessage {
  type: 'pesca.fim'
  sessao: string
  cesto: PeixeNoCesto[]
}

export type PescaPlayerMessage = PescaPedirMessage | PescaProntoMessage | PescaVivoMessage | PescaLanceMessage | PescaFimMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoEntre(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function numeroEntre(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function inteiroEntre(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && numeroEntre(value, min, max)
}

function umDaLista<T>(lista: readonly T[], value: unknown): T | undefined {
  return lista.find((item) => item === value)
}

/** Lista com teto: `null` para o que não é lista, passa do teto ou tem um item torto. */
function listaDe<T>(value: unknown, max: number, ler: (item: unknown) => T | null, min = 0): T[] | null {
  if (!Array.isArray(value) || value.length < min || value.length > max) return null
  const itens: unknown[] = value
  const lidos: T[] = []
  for (const item of itens) {
    const lido = ler(item)
    if (lido === null) return null
    lidos.push(lido)
  }
  return lidos
}

const sessaoValida = (value: unknown): value is string => textoEntre(value, 1, PESCA_SESSAO_MAX)
const idValido = (value: unknown): value is string => textoEntre(value, 1, PESCA_SESSAO_MAX)
const lanceValido = (value: unknown): value is number => inteiroEntre(value, LANCES_MIN, LANCES_MAX)

export function lerPeixeNoCesto(value: unknown): PeixeNoCesto | null {
  if (!isRecord(value)) return null
  const peixe = umDaLista(IDS_DOS_PEIXES, value.peixe)
  const { cm, estrelas, perfeito, bau } = value
  if (peixe === undefined || !numeroEntre(cm, 0, PESCA_CM_MAX) || !inteiroEntre(estrelas, 1, PESCA_ESTRELAS_MAX)) return null
  if (typeof perfeito !== 'boolean' || typeof bau !== 'boolean') return null
  return { peixe, cm, estrelas, perfeito, bau }
}

/** Do jogador, no host. Qualquer campo torto recusa a mensagem inteira. */
export function parsePescaPlayerMessage(value: unknown): PescaPlayerMessage | null {
  if (!isRecord(value)) return null
  if (value.type === 'pesca.pedir') return idValido(value.pinId) ? { type: 'pesca.pedir', pinId: value.pinId } : null
  const { sessao } = value
  if (!sessaoValida(sessao)) return null
  switch (value.type) {
    case 'pesca.pronto': {
      const dificuldade = umDaLista(DIFICULDADES_PESCA, value.dificuldade)
      return dificuldade === undefined ? null : { type: 'pesca.pronto', sessao, dificuldade }
    }
    case 'pesca.vivo': {
      const fase = umDaLista(PESCA_FASES_DO_LANCE, value.fase)
      const { lance, de, medidor } = value
      if (fase === undefined || !lanceValido(lance) || !lanceValido(de) || lance > de || !numeroEntre(medidor, 0, 1)) return null
      return { type: 'pesca.vivo', sessao, fase, lance, de, medidor }
    }
    case 'pesca.lance': {
      const { lance } = value
      if (!lanceValido(lance)) return null
      if (value.resultado === 'escapou' || value.resultado === 'fugiu') {
        return value.peixe === undefined ? { type: 'pesca.lance', sessao, lance, resultado: value.resultado } : null
      }
      const peixe = value.resultado === 'pegou' ? lerPeixeNoCesto(value.peixe) : null
      return peixe === null ? null : { type: 'pesca.lance', sessao, lance, resultado: 'pegou', peixe }
    }
    case 'pesca.fim': {
      const cesto = listaDe(value.cesto, LANCES_MAX, lerPeixeNoCesto)
      return cesto === null ? null : { type: 'pesca.fim', sessao, cesto }
    }
    default:
      return null
  }
}

function lerParticipante(value: unknown): PescaParticipante | null {
  if (!isRecord(value) || !idValido(value.playerId) || !textoEntre(value.nome, 1, PESCA_NOME_MAX)) return null
  return { playerId: value.playerId, nome: value.nome }
}

function lerTexto(value: unknown, max: number): { texto: string } | null {
  return isRecord(value) && textoEntre(value.texto, 0, max) ? { texto: value.texto } : null
}

/** Do mestre, no jogador. O host é de confiança, mas a mensagem torta cai inteira em vez de virar meia tela. */
export function parsePescaHostMessage(value: unknown): PescaHostMessage | null {
  if (!isRecord(value) || !sessaoValida(value.sessao)) return null
  const sessao = value.sessao
  switch (value.type) {
    case 'pesca.convite': {
      const { pinId, npc, fala, lago, lances } = value
      const permitida = umDaLista(PERMITIDAS, value.permitida)
      const premio = lerTexto(value.premio, PESCA_TEXTO_MAX_LENGTH)
      const consequencia = lerTexto(value.consequencia, PESCA_TEXTO_MAX_LENGTH)
      const participantes = listaDe(value.participantes, PESCA_PARTICIPANTES_MAX, lerParticipante, 1)
      if (!idValido(pinId) || !textoEntre(npc, 0, NPC_MAX_LENGTH) || !textoEntre(fala, 0, FALA_MAX_LENGTH) || !textoEntre(lago, 0, LAGO_MAX_LENGTH)) return null
      if (!lanceValido(lances) || permitida === undefined || premio === null || consequencia === null || participantes === null) return null
      return { type: 'pesca.convite', sessao, pinId, npc, fala, lago, lances, permitida, premio, consequencia, participantes }
    }
    case 'pesca.estado': {
      const fase = umDaLista(FASES_NO_FIO, value.fase)
      const participantes = listaDe(value.participantes, PESCA_PARTICIPANTES_MAX, (item) => {
        const base = lerParticipante(item)
        const status = isRecord(item) ? umDaLista(PESCA_STATUS, item.status) : undefined
        return base === null || status === undefined ? null : { ...base, status }
      })
      return fase === undefined || participantes === null ? null : { type: 'pesca.estado', sessao, fase, participantes }
    }
    case 'pesca.pausa':
    case 'pesca.retoma':
      return { type: value.type, sessao }
    case 'pesca.encerra': {
      const motivo = umDaLista(MOTIVOS_DO_FIM, value.motivo)
      return motivo === undefined ? null : { type: 'pesca.encerra', sessao, motivo }
    }
    default:
      return null
  }
}

import { BALAS, DIF } from '../minigames/tiro/sim'
import {
  BARRACA_MAX_LENGTH,
  DIFICULDADES_TIRO,
  FALA_MAX_LENGTH,
  MEDALHAS_TIRO,
  NPC_MAX_LENGTH,
  TENTATIVAS_MAX,
  TENTATIVAS_MIN,
  TIRO_TEXTO_MAX_LENGTH,
  type DificuldadeTiro,
  type MinigameTiro,
} from '../minigames/tiro/tipos'

/**
 * MINIGAME DE TIRO AO VIVO — as mensagens da barraca de tiro entre o mestre e
 * os jogadores, pelo caminho da pesca. Aditivo como o resto do protocolo:
 * jogador antigo cai no `default` e ignora; mestre antigo responde
 * `error invalid_message`.
 *
 *  - mestre → jogador: `tiro.convite` (o desafio congelado e as tentativas que
 *    ele já usou), `tiro.estado`, `tiro.inicio` (a rodada que o host liberou,
 *    com a semente), `tiro.pausa`, `tiro.retoma`, `tiro.encerra` e
 *    `tiro.recusado`;
 *  - jogador → mestre: `tiro.pedir` (o pino de "Jogador toca no pino"),
 *    `tiro.pronto` (a dificuldade: pede uma rodada), `tiro.vivo` (pontos,
 *    tiros, balas, no máximo 4 por segundo) e `tiro.fim` (o resultado).
 *
 * As tentativas são contadas no HOST: só o `tiro.inicio` abre uma rodada. Cada
 * aparelho joga a própria rodada; o host confere os números contra o teto do
 * tempo e da dificuldade e julga a medalha. Prêmio e consequência são só texto.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */

/** Teto do id da sessão (o host gera um UUID, 36). */
export const TIRO_SESSAO_MAX = 64
/** Mais participantes que isso nem cabem na sala (`MAX_PLAYERS` do Rust é 16). */
export const TIRO_PARTICIPANTES_MAX = 16
/** Teto do nome que viaja (o nome efetivo na sala, com "(2)" e tudo). */
export const TIRO_NOME_MAX = 64
/** Teto da semente que o host manda no início. */
export const TIRO_SEMENTE_MAX = 160
/** O jogador manda `tiro.vivo` no máximo a cada 250 ms (4 por segundo). */
export const TIRO_VIVO_INTERVALO_MS = 250
/** Teto de pontos que um número da rodada aceita (o teto de verdade é o do tempo, no host). */
const PONTOS_NO_FIO_MAX = 100_000
const CONTAGEM_NO_FIO_MAX = 10_000
const TEMPO_MAX = Math.max(DIF.normal.tempo, DIF.extremo.tempo)

/** convidado = na barraca, sem rodada; atirando = numa rodada; terminou = sem tentativa; saiu = caiu ou foi expulso. */
export type TiroStatus = 'convidado' | 'atirando' | 'terminou' | 'saiu'
export const TIRO_STATUS: readonly TiroStatus[] = ['convidado', 'atirando', 'terminou', 'saiu']
/** A fase da sessão que o jogador lê. `encerrada` não viaja: chega como `tiro.encerra`. */
export type TiroFaseNoFio = 'aberta' | 'pausa'
const FASES_NO_FIO: readonly TiroFaseNoFio[] = ['aberta', 'pausa']
/** `mestre`: o mestre encerrou; `saiu`: a conexão abriu de novo no meio da rodada. */
export type TiroMotivoDoFim = 'mestre' | 'saiu'
const MOTIVOS_DO_FIM: readonly TiroMotivoDoFim[] = ['mestre', 'saiu']
/** longe = nenhuma ficha encostada; ocupado = já está noutra barraca; indisponivel = o resto. */
export type TiroMotivoDaRecusa = 'longe' | 'ocupado' | 'indisponivel'
export const TIRO_MOTIVOS_DA_RECUSA: readonly TiroMotivoDaRecusa[] = ['longe', 'ocupado', 'indisponivel']
/** `fim`: o sino tocou; `desistiu`: saiu pela pausa (sem medalha). */
export type TiroDesfecho = 'fim' | 'desistiu'
const DESFECHOS: readonly TiroDesfecho[] = ['fim', 'desistiu']
const PERMITIDAS: readonly MinigameTiro['permitida'][] = ['escolha', ...DIFICULDADES_TIRO]

export interface TiroParticipante {
  playerId: string
  nome: string
}

/** O que a tela do jogador mostra AGORA, para o placar do mestre. */
export interface TiroVivo {
  /** A rodada de agora (a tentativa, 1..N). */
  rodada: number
  /** Segundos de rodada já jogados. */
  t: number
  pontos: number
  tiros: number
  acertos: number
  balas: number
  recarregando: boolean
}

/** Os números de uma rodada que acabou, como o jogador manda. */
export interface TiroNumeros {
  t: number
  pontos: number
  tiros: number
  acertos: number
  comboMax: number
  proibidos: number
  secos: number
  recargas: number
  derrubados: number
}

export interface TiroConviteMessage {
  type: 'tiro.convite'
  sessao: string
  pinId: string
  npc: string
  fala: string
  barraca: string
  tentativas: number
  /** As tentativas que ESTE jogador já usou nesta sessão (0 ao entrar). */
  usadas: number
  permitida: MinigameTiro['permitida']
  meta: MinigameTiro['meta']
  premio: MinigameTiro['premio']
  consequencia: MinigameTiro['consequencia']
  participantes: TiroParticipante[]
}

export interface TiroEstadoMessage {
  type: 'tiro.estado'
  sessao: string
  fase: TiroFaseNoFio
  participantes: (TiroParticipante & { status: TiroStatus })[]
}

/** O host liberou a rodada `rodada` (= tentativas usadas, contando esta). */
export interface TiroInicioMessage {
  type: 'tiro.inicio'
  sessao: string
  rodada: number
  dificuldade: DificuldadeTiro
  semente: string
}

export interface TiroPausaMessage {
  type: 'tiro.pausa' | 'tiro.retoma'
  sessao: string
}

export interface TiroEncerraMessage {
  type: 'tiro.encerra'
  sessao: string
  motivo: TiroMotivoDoFim
}

export interface TiroRecusadoMessage {
  type: 'tiro.recusado'
  pinId: string
  motivo: TiroMotivoDaRecusa
}

export type TiroHostMessage = TiroConviteMessage | TiroEstadoMessage | TiroInicioMessage | TiroPausaMessage | TiroEncerraMessage | TiroRecusadoMessage

export interface TiroPedirMessage {
  type: 'tiro.pedir'
  pinId: string
}

export interface TiroProntoMessage {
  type: 'tiro.pronto'
  sessao: string
  dificuldade: DificuldadeTiro
}

export interface TiroVivoMessage extends TiroVivo {
  type: 'tiro.vivo'
  sessao: string
}

export interface TiroFimMessage extends TiroNumeros {
  type: 'tiro.fim'
  sessao: string
  rodada: number
  desfecho: TiroDesfecho
}

export type TiroPlayerMessage = TiroPedirMessage | TiroProntoMessage | TiroVivoMessage | TiroFimMessage

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

const idValido = (value: unknown): value is string => textoEntre(value, 1, TIRO_SESSAO_MAX)
const rodadaValida = (value: unknown): value is number => inteiroEntre(value, TENTATIVAS_MIN, TENTATIVAS_MAX)
const contagem = (value: unknown): value is number => inteiroEntre(value, 0, CONTAGEM_NO_FIO_MAX)

/** Os números de uma rodada: tipo e faixa de cada um. O teto pelo tempo e a coerência entre eles são do host. */
function lerNumeros(v: Record<string, unknown>): TiroNumeros | null {
  const { t, pontos, tiros, acertos, comboMax, proibidos, secos, recargas, derrubados } = v
  if (!numeroEntre(t, 0, TEMPO_MAX) || !inteiroEntre(pontos, 0, PONTOS_NO_FIO_MAX)) return null
  if (!contagem(tiros) || !contagem(acertos) || !contagem(comboMax) || !contagem(proibidos) || !contagem(secos) || !contagem(recargas) || !contagem(derrubados)) return null
  return { t, pontos, tiros, acertos, comboMax, proibidos, secos, recargas, derrubados }
}

/** Do jogador, no host. Qualquer campo torto recusa a mensagem inteira. */
export function parseTiroPlayerMessage(value: unknown): TiroPlayerMessage | null {
  if (!isRecord(value)) return null
  if (value.type === 'tiro.pedir') return idValido(value.pinId) ? { type: 'tiro.pedir', pinId: value.pinId } : null
  const { sessao } = value
  if (!idValido(sessao)) return null
  switch (value.type) {
    case 'tiro.pronto': {
      const dificuldade = umDaLista(DIFICULDADES_TIRO, value.dificuldade)
      return dificuldade === undefined ? null : { type: 'tiro.pronto', sessao, dificuldade }
    }
    case 'tiro.vivo': {
      const { rodada, t, pontos, tiros, acertos, balas, recarregando } = value
      if (!rodadaValida(rodada) || !numeroEntre(t, 0, TEMPO_MAX) || !inteiroEntre(pontos, 0, PONTOS_NO_FIO_MAX)) return null
      if (!contagem(tiros) || !contagem(acertos) || !inteiroEntre(balas, 0, BALAS) || typeof recarregando !== 'boolean') return null
      return { type: 'tiro.vivo', sessao, rodada, t, pontos, tiros, acertos, balas, recarregando }
    }
    case 'tiro.fim': {
      const desfecho = umDaLista(DESFECHOS, value.desfecho)
      const numeros = lerNumeros(value)
      if (!rodadaValida(value.rodada) || desfecho === undefined || numeros === null) return null
      return { type: 'tiro.fim', sessao, rodada: value.rodada, desfecho, ...numeros }
    }
    default:
      return null
  }
}

function lerParticipante(value: unknown): TiroParticipante | null {
  if (!isRecord(value) || !idValido(value.playerId) || !textoEntre(value.nome, 1, TIRO_NOME_MAX)) return null
  return { playerId: value.playerId, nome: value.nome }
}

function lerTexto(value: unknown): { texto: string } | null {
  return isRecord(value) && textoEntre(value.texto, 0, TIRO_TEXTO_MAX_LENGTH) ? { texto: value.texto } : null
}

/** Do mestre, no jogador. O host é de confiança, mas a mensagem torta cai inteira em vez de virar meia tela. */
export function parseTiroHostMessage(value: unknown): TiroHostMessage | null {
  if (!isRecord(value)) return null
  // A recusa vem antes de haver sessão: é a única sem `sessao`.
  if (value.type === 'tiro.recusado') {
    const motivo = umDaLista(TIRO_MOTIVOS_DA_RECUSA, value.motivo)
    return idValido(value.pinId) && motivo !== undefined ? { type: 'tiro.recusado', pinId: value.pinId, motivo } : null
  }
  if (!idValido(value.sessao)) return null
  const sessao = value.sessao
  switch (value.type) {
    case 'tiro.convite': {
      const { pinId, npc, fala, barraca, tentativas, usadas } = value
      const permitida = umDaLista(PERMITIDAS, value.permitida)
      const meta = umDaLista(MEDALHAS_TIRO, value.meta)
      const premio = lerTexto(value.premio)
      const consequencia = lerTexto(value.consequencia)
      const participantes = listaDe(value.participantes, TIRO_PARTICIPANTES_MAX, lerParticipante, 1)
      if (!idValido(pinId) || !textoEntre(npc, 0, NPC_MAX_LENGTH) || !textoEntre(fala, 0, FALA_MAX_LENGTH) || !textoEntre(barraca, 0, BARRACA_MAX_LENGTH)) return null
      if (!rodadaValida(tentativas) || !inteiroEntre(usadas, 0, tentativas) || permitida === undefined || meta === undefined) return null
      if (premio === null || consequencia === null || participantes === null) return null
      return { type: 'tiro.convite', sessao, pinId, npc, fala, barraca, tentativas, usadas, permitida, meta, premio, consequencia, participantes }
    }
    case 'tiro.estado': {
      const fase = umDaLista(FASES_NO_FIO, value.fase)
      const participantes = listaDe(value.participantes, TIRO_PARTICIPANTES_MAX, (item) => {
        const base = lerParticipante(item)
        const status = isRecord(item) ? umDaLista(TIRO_STATUS, item.status) : undefined
        return base === null || status === undefined ? null : { ...base, status }
      })
      return fase === undefined || participantes === null ? null : { type: 'tiro.estado', sessao, fase, participantes }
    }
    case 'tiro.inicio': {
      const dificuldade = umDaLista(DIFICULDADES_TIRO, value.dificuldade)
      const { rodada, semente } = value
      if (!rodadaValida(rodada) || dificuldade === undefined || !textoEntre(semente, 1, TIRO_SEMENTE_MAX)) return null
      return { type: 'tiro.inicio', sessao, rodada, dificuldade, semente }
    }
    case 'tiro.pausa':
    case 'tiro.retoma':
      return { type: value.type, sessao }
    case 'tiro.encerra': {
      const motivo = umDaLista(MOTIVOS_DO_FIM, value.motivo)
      return motivo === undefined ? null : { type: 'tiro.encerra', sessao, motivo }
    }
    default:
      return null
  }
}

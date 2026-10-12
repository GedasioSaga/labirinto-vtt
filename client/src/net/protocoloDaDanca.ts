import { ehRefDeAudio } from '../lib/midia'
import type { Julgamento } from '../minigames/danca/regras'
import {
  DIFICULDADES_DANCA,
  LETRAS_DANCA,
  type DificuldadeDanca,
  type LetraDanca,
  type MinigameDoPino,
  type MusicaDaDanca,
  type NotaDaDanca,
  type TrilhaDanca,
} from '../minigames/danca/tipos'

/**
 * MINIGAME DE DANÇA AO VIVO — as mensagens da dança entre o mestre e os
 * jogadores chamados. Aditivo como o resto do protocolo: jogador antigo cai no
 * `default` e ignora; mestre antigo responde `error invalid_message`.
 *
 *  - mestre → jogador: `danca.convite` (o desafio congelado, só aos escolhidos),
 *    `danca.estado`, `danca.comecar`, `danca.pausa`, `danca.retoma`,
 *    `danca.encerra`, `danca.colegas` (os toques de um colega, nunca os do
 *    próprio) e `danca.desfecho`;
 *  - jogador → mestre: `danca.pronto`, `danca.toques` (lote de ~250 ms) e
 *    `danca.fim`.
 *
 * A rede nunca julga: cada aparelho julga os toques no próprio relógio de
 * áudio e manda o placar. A consequência e a porta ligada nunca viajam; o
 * prêmio vai no convite (é o que o jogador disputa).
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */

/** Teto do id da sessão de dança (o host gera um UUID, 36). */
export const DANCA_SESSAO_MAX = 64
/** Mais participantes que isso nem cabem na sala (`MAX_PLAYERS` do Rust é 16). */
export const DANCA_PARTICIPANTES_MAX = 16
/** Toques por lote: 250 ms de Expert apertado dão uns 4; o teto só barra lixo. */
export const DANCA_EVENTOS_MAX = 64
/** De quanto em quanto tempo a tela do jogador manda o lote (o servidor aceita 30 mensagens/s). */
export const DANCA_TOQUES_INTERVALO_MS = 250
/** Cada aparelho começa a música este tanto depois de receber `danca.comecar`: dá tempo do 3-2-1. */
export const DANCA_COMECAR_EM_MS = 3000
/** Setas por coreografia: 20 min de Expert a 3,7 setas/s ainda cabe. */
export const DANCA_NOTAS_MAX = 5000
/** Música mais longa que isso não é desafio de mesa. */
export const DANCA_DURACAO_MAX_S = 1200
/** Teto de qualquer contagem do placar (combo, Perfeito…): bem acima de qualquer música real. */
export const DANCA_CONTAGEM_MAX = 100_000
/** Teto do nome que viaja na dança (o nome efetivo na sala, com "(2)" e tudo). */
export const DANCA_NOME_MAX = 64
const MUSICA_NOME_MAX = 80
const TEXTO_CURTO_MAX = 220
const BPM_MAX = 1000

export type DancaStatus = 'convidado' | 'pronto' | 'dancando' | 'terminou' | 'saiu' | 'fora'
export const DANCA_STATUS: readonly DancaStatus[] = ['convidado', 'pronto', 'dancando', 'terminou', 'saiu', 'fora']
/** A fase que o jogador lê. `fim` e `encerrada` não viajam: chegam como `danca.desfecho` e `danca.encerra`. */
export type DancaFaseNoFio = 'convite' | 'musica' | 'pausa'
const FASES_NO_FIO: readonly DancaFaseNoFio[] = ['convite', 'musica', 'pausa']
/** `fora`: não estava pronto no "Começar"; `mestre`: o mestre encerrou; `saiu`: caiu no meio da música. */
export type DancaMotivoDoFim = 'fora' | 'mestre' | 'saiu'
const MOTIVOS_DO_FIM: readonly DancaMotivoDoFim[] = ['fora', 'mestre', 'saiu']
const JULGAMENTOS: readonly Julgamento[] = ['perfeito', 'bom', 'ok', 'errou']
const TRILHAS: readonly TrilhaDanca[] = [0, 1, 2, 3]
const SUBDIVISOES: readonly NotaDaDanca['sub'][] = [4, 8, 16]
const PREMIOS: readonly MinigameDoPino['premio']['tipo'][] = ['item', 'pista', 'bonus', 'nada']
const CONSEQUENCIAS: readonly MinigameDoPino['consequencia']['tipo'][] = ['teste', 'barulho', 'espera', 'nada']
const PERMITIDAS: readonly MinigameDoPino['permitida'][] = ['escolha', ...DIFICULDADES_DANCA]

export interface DancaParticipante {
  playerId: string
  nome: string
}

/** Um toque julgado no aparelho de quem dançou: trilha, julgamento e posição na música (s). */
export interface DancaEvento {
  lane: TrilhaDanca
  j: Julgamento
  t: number
}

/** O placar ao vivo, como o mestre e os colegas leem. */
export interface DancaPlacarAoVivo {
  precisao: number
  combo: number
  vida: number
  julgadas: number
}

/** O placar de quem terminou. `falhou`: a vida zerou no Expert. */
export interface DancaPlacarFinal {
  precisao: number
  letra: LetraDanca
  falhou: boolean
  perfeito: number
  bom: number
  ok: number
  errou: number
  comboMax: number
  segOk: number
  segTotal: number
}

export interface DancaConviteMessage {
  type: 'danca.convite'
  sessao: string
  pinId: string
  npc: string
  fala: string
  permitida: MinigameDoPino['permitida']
  notaMin: LetraDanca
  premio: MinigameDoPino['premio']
  musica: MusicaDaDanca
  participantes: DancaParticipante[]
}

export interface DancaEstadoMessage {
  type: 'danca.estado'
  sessao: string
  fase: DancaFaseNoFio
  participantes: { playerId: string; status: DancaStatus }[]
}

export interface DancaComecarMessage {
  type: 'danca.comecar'
  sessao: string
  emMs: number
  participantes: (DancaParticipante & { dificuldade: DificuldadeDanca })[]
}

export interface DancaPausaMessage {
  type: 'danca.pausa' | 'danca.retoma'
  sessao: string
}

export interface DancaEncerraMessage {
  type: 'danca.encerra'
  sessao: string
  motivo: DancaMotivoDoFim
}

export interface DancaColegasMessage {
  type: 'danca.colegas'
  sessao: string
  playerId: string
  eventos: DancaEvento[]
  placar: DancaPlacarAoVivo
}

/** Uma linha da mesa no resultado: a nota, ou "Falhou" (vida zerou) ou "Saiu" (caiu no meio). */
export interface DancaLinhaDaMesa {
  playerId: string
  nome: string
  letra: LetraDanca | 'Falhou' | 'Saiu'
  precisao: number
}

export interface DancaDesfechoMessage {
  type: 'danca.desfecho'
  sessao: string
  todosPassaram: boolean
  portaAberta: boolean
  mesa: DancaLinhaDaMesa[]
  /** O que é DESTE jogador: o prêmio só com todos passando; a consequência só para quem não passou. */
  seu: { passou: boolean; premio?: MinigameDoPino['premio']; consequencia?: MinigameDoPino['consequencia'] }
}

export type DancaHostMessage =
  | DancaConviteMessage
  | DancaEstadoMessage
  | DancaComecarMessage
  | DancaPausaMessage
  | DancaEncerraMessage
  | DancaColegasMessage
  | DancaDesfechoMessage

export interface DancaProntoMessage {
  type: 'danca.pronto'
  sessao: string
  dificuldade: DificuldadeDanca
}

export interface DancaToquesMessage {
  type: 'danca.toques'
  sessao: string
  eventos: DancaEvento[]
  placar: DancaPlacarAoVivo
}

export interface DancaFimMessage {
  type: 'danca.fim'
  sessao: string
  placar: DancaPlacarFinal
}

export type DancaPlayerMessage = DancaProntoMessage | DancaToquesMessage | DancaFimMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoEntre(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function numeroEntre(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function contagem(value: unknown): value is number {
  return Number.isSafeInteger(value) && numeroEntre(value, 0, DANCA_CONTAGEM_MAX)
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

const sessaoValida = (value: unknown): value is string => textoEntre(value, 1, DANCA_SESSAO_MAX)

function lerEvento(value: unknown): DancaEvento | null {
  if (!isRecord(value)) return null
  const lane = umDaLista(TRILHAS, value.lane)
  const j = umDaLista(JULGAMENTOS, value.j)
  if (lane === undefined || j === undefined || !numeroEntre(value.t, 0, DANCA_DURACAO_MAX_S)) return null
  return { lane, j, t: value.t }
}

function lerPlacarAoVivo(value: unknown): DancaPlacarAoVivo | null {
  if (!isRecord(value)) return null
  const { precisao, combo, vida, julgadas } = value
  if (!numeroEntre(precisao, 0, 1) || !contagem(combo) || !numeroEntre(vida, 0, 100) || !contagem(julgadas)) return null
  return { precisao, combo, vida, julgadas }
}

function lerPlacarFinal(value: unknown): DancaPlacarFinal | null {
  if (!isRecord(value)) return null
  const { precisao, falhou, perfeito, bom, ok, errou, comboMax, segOk, segTotal } = value
  const letra = umDaLista(LETRAS_DANCA, value.letra)
  if (!numeroEntre(precisao, 0, 1) || letra === undefined || typeof falhou !== 'boolean') return null
  if (!contagem(perfeito) || !contagem(bom) || !contagem(ok) || !contagem(errou) || !contagem(comboMax)) return null
  if (!contagem(segOk) || !contagem(segTotal) || segOk > segTotal) return null
  return { precisao, letra, falhou, perfeito, bom, ok, errou, comboMax, segOk, segTotal }
}

/** Do jogador, no host. Qualquer campo torto recusa a mensagem inteira. */
export function parseDancaPlayerMessage(value: unknown): DancaPlayerMessage | null {
  if (!isRecord(value)) return null
  const { sessao } = value
  if (!sessaoValida(sessao)) return null
  switch (value.type) {
    case 'danca.pronto': {
      const dificuldade = umDaLista(DIFICULDADES_DANCA, value.dificuldade)
      return dificuldade === undefined ? null : { type: 'danca.pronto', sessao, dificuldade }
    }
    case 'danca.toques': {
      const eventos = listaDe(value.eventos, DANCA_EVENTOS_MAX, lerEvento)
      const placar = lerPlacarAoVivo(value.placar)
      return eventos === null || placar === null ? null : { type: 'danca.toques', sessao, eventos, placar }
    }
    case 'danca.fim': {
      const placar = lerPlacarFinal(value.placar)
      return placar === null ? null : { type: 'danca.fim', sessao, placar }
    }
    default:
      return null
  }
}

function lerParticipante(value: unknown): DancaParticipante | null {
  if (!isRecord(value) || !textoEntre(value.playerId, 1, DANCA_SESSAO_MAX) || !textoEntre(value.nome, 1, DANCA_NOME_MAX)) return null
  return { playerId: value.playerId, nome: value.nome }
}

function lerNota(value: unknown): NotaDaDanca | null {
  if (!isRecord(value)) return null
  const lane = umDaLista(TRILHAS, value.lane)
  const sub = umDaLista(SUBDIVISOES, value.sub)
  if (lane === undefined || sub === undefined || !numeroEntre(value.t, 0, DANCA_DURACAO_MAX_S) || !numeroEntre(value.len, 0, DANCA_DURACAO_MAX_S)) return null
  return { t: value.t, lane, len: value.len, sub }
}

function lerMusica(value: unknown): MusicaDaDanca | null {
  if (!isRecord(value)) return null
  if (value.tipo === 'demo') return { tipo: 'demo' }
  if (value.tipo !== 'arquivo' || !ehRefDeAudio(value.midia) || !textoEntre(value.nome, 0, MUSICA_NOME_MAX)) return null
  const { bpm, primeiraBatida, duracaoS, coreografias } = value
  const fase4 = umDaLista(TRILHAS, value.fase4)
  if (!numeroEntre(bpm, Number.MIN_VALUE, BPM_MAX) || !numeroEntre(primeiraBatida, 0, DANCA_DURACAO_MAX_S) || fase4 === undefined) return null
  if (!numeroEntre(duracaoS, Number.MIN_VALUE, DANCA_DURACAO_MAX_S) || !isRecord(coreografias)) return null
  const diversao = listaDe(coreografias.diversao, DANCA_NOTAS_MAX, lerNota)
  const expert = listaDe(coreografias.expert, DANCA_NOTAS_MAX, lerNota)
  if (diversao === null || expert === null) return null
  return { tipo: 'arquivo', midia: value.midia, nome: value.nome, bpm, primeiraBatida, fase4, duracaoS, coreografias: { diversao, expert } }
}

function lerPremio(value: unknown): MinigameDoPino['premio'] | null {
  const tipo = isRecord(value) ? umDaLista(PREMIOS, value.tipo) : undefined
  return tipo === undefined || !isRecord(value) || !textoEntre(value.texto, 0, TEXTO_CURTO_MAX) ? null : { tipo, texto: value.texto }
}

function lerConsequencia(value: unknown): MinigameDoPino['consequencia'] | null {
  const tipo = isRecord(value) ? umDaLista(CONSEQUENCIAS, value.tipo) : undefined
  return tipo === undefined || !isRecord(value) || !textoEntre(value.texto, 0, TEXTO_CURTO_MAX) ? null : { tipo, texto: value.texto }
}

function lerLinhaDaMesa(value: unknown): DancaLinhaDaMesa | null {
  const base = lerParticipante(value)
  if (base === null || !isRecord(value) || !numeroEntre(value.precisao, 0, 1)) return null
  const letra = value.letra === 'Falhou' || value.letra === 'Saiu' ? value.letra : umDaLista(LETRAS_DANCA, value.letra)
  return letra === undefined ? null : { ...base, letra, precisao: value.precisao }
}

/** Do mestre, no jogador. O host é de confiança, mas a mensagem torta cai inteira em vez de virar meia tela. */
export function parseDancaHostMessage(value: unknown): DancaHostMessage | null {
  if (!isRecord(value) || !sessaoValida(value.sessao)) return null
  const sessao = value.sessao
  switch (value.type) {
    case 'danca.convite': {
      const { pinId, npc, fala } = value
      const permitida = umDaLista(PERMITIDAS, value.permitida)
      const notaMin = umDaLista(LETRAS_DANCA, value.notaMin)
      const premio = lerPremio(value.premio)
      const musica = lerMusica(value.musica)
      const participantes = listaDe(value.participantes, DANCA_PARTICIPANTES_MAX, lerParticipante, 1)
      if (!textoEntre(pinId, 1, DANCA_SESSAO_MAX) || !textoEntre(npc, 0, TEXTO_CURTO_MAX) || !textoEntre(fala, 0, TEXTO_CURTO_MAX)) return null
      if (permitida === undefined || notaMin === undefined || premio === null || musica === null || participantes === null) return null
      return { type: 'danca.convite', sessao, pinId, npc, fala, permitida, notaMin, premio, musica, participantes }
    }
    case 'danca.estado': {
      const fase = umDaLista(FASES_NO_FIO, value.fase)
      const participantes = listaDe(value.participantes, DANCA_PARTICIPANTES_MAX, (item) => {
        const status = isRecord(item) ? umDaLista(DANCA_STATUS, item.status) : undefined
        return status === undefined || !isRecord(item) || !textoEntre(item.playerId, 1, DANCA_SESSAO_MAX) ? null : { playerId: item.playerId, status }
      })
      return fase === undefined || participantes === null ? null : { type: 'danca.estado', sessao, fase, participantes }
    }
    case 'danca.comecar': {
      const participantes = listaDe(
        value.participantes,
        DANCA_PARTICIPANTES_MAX,
        (item) => {
          const base = lerParticipante(item)
          const dificuldade = isRecord(item) ? umDaLista(DIFICULDADES_DANCA, item.dificuldade) : undefined
          return base === null || dificuldade === undefined ? null : { ...base, dificuldade }
        },
        1,
      )
      if (!numeroEntre(value.emMs, 0, 60_000) || participantes === null) return null
      return { type: 'danca.comecar', sessao, emMs: value.emMs, participantes }
    }
    case 'danca.pausa':
    case 'danca.retoma':
      return { type: value.type, sessao }
    case 'danca.encerra': {
      const motivo = umDaLista(MOTIVOS_DO_FIM, value.motivo)
      return motivo === undefined ? null : { type: 'danca.encerra', sessao, motivo }
    }
    case 'danca.colegas': {
      const eventos = listaDe(value.eventos, DANCA_EVENTOS_MAX, lerEvento)
      const placar = lerPlacarAoVivo(value.placar)
      if (!textoEntre(value.playerId, 1, DANCA_SESSAO_MAX) || eventos === null || placar === null) return null
      return { type: 'danca.colegas', sessao, playerId: value.playerId, eventos, placar }
    }
    case 'danca.desfecho': {
      const { todosPassaram, portaAberta, seu } = value
      const mesa = listaDe(value.mesa, DANCA_PARTICIPANTES_MAX, lerLinhaDaMesa)
      if (typeof todosPassaram !== 'boolean' || typeof portaAberta !== 'boolean' || mesa === null || !isRecord(seu) || typeof seu.passou !== 'boolean') return null
      const lido: DancaDesfechoMessage['seu'] = { passou: seu.passou }
      if (seu.premio !== undefined) {
        const premio = lerPremio(seu.premio)
        if (premio === null) return null
        lido.premio = premio
      }
      if (seu.consequencia !== undefined) {
        const consequencia = lerConsequencia(seu.consequencia)
        if (consequencia === null) return null
        lido.consequencia = consequencia
      }
      return { type: 'danca.desfecho', sessao, todosPassaram, portaAberta, mesa, seu: lido }
    }
    default:
      return null
  }
}

import { ALAVANCA_JOGADORES_MAX, ALAVANCA_TEMPO_MAX_S, ALAVANCA_TEMPO_MIN_S, DIFICULDADES_ALAVANCA, type DificuldadeAlavanca } from '../minigames/alavanca/tipos'

/**
 * MINIGAME ALAVANCA DA PONTE AO VIVO — as mensagens entre o mestre e quem
 * gira. Aditivo como o resto do protocolo: jogador antigo cai no `default` e
 * ignora; mestre antigo responde `error invalid_message`.
 *
 *  - mestre → jogador: `alavanca.convite`, `alavanca.estado` (fase, quem
 *    está pronto, pausa), `alavanca.comecar` (a rodada: quem gira, em que
 *    ordem, a dificuldade e o tempo), `alavanca.vivo` (a ponte, a corrente e
 *    os giros, a cada `ALAVANCA_REPASSE_MS`), `alavanca.fim`,
 *    `alavanca.encerra` e `alavanca.recusado` (o "Girar a alavanca" do selo
 *    não abriu);
 *  - jogador → mestre: `alavanca.pedir` (começar sozinho no selo, se o mestre
 *    deixou), `alavanca.pronto`, `alavanca.giro` (um aperto), `alavanca.pausa`,
 *    `alavanca.continuar` e `alavanca.desistir`.
 *
 * O HOST É A AUTORIDADE: só ele roda a partida (`minigames/alavanca/sim.ts`),
 * com os apertos na hora em que chegam. O jogador só desenha o que recebe.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */

/** O relógio do repasse: o host avança a partida e manda a ponte a cada 50 ms (20 por segundo). */
export const ALAVANCA_REPASSE_MS = 50
/** Teto do id da sessão (o host gera um UUID, 36). */
export const ALAVANCA_SESSAO_MAX = 64
export const ALAVANCA_NOME_MAX = 64
/** Quantos o mestre chama de uma vez (a rodada leva no máximo `ALAVANCA_JOGADORES_MAX`). */
export const ALAVANCA_PARTICIPANTES_MAX = 16
const TEXTO_MAX = 240
const GIROS_MAX = 100_000

export type AlavancaStatus = 'convidado' | 'pronto' | 'girando' | 'saiu' | 'fora'
export const ALAVANCA_STATUS: readonly AlavancaStatus[] = ['convidado', 'pronto', 'girando', 'saiu', 'fora']

export type AlavancaFaseNoFio = 'convite' | 'contagem' | 'rodada' | 'pausa' | 'fim'
const FASES_NO_FIO: readonly AlavancaFaseNoFio[] = ['convite', 'contagem', 'rodada', 'pausa', 'fim']

/** Como a rodada acabou: a ponte desceu, o tempo acabou (a corrente puxou de volta), ou o mestre encerrou. */
export type AlavancaTipoDoFim = 'baixou' | 'subiu' | 'encerrado'
const TIPOS_DO_FIM: readonly AlavancaTipoDoFim[] = ['baixou', 'subiu', 'encerrado']

/** Por que a alavanca fechou para este jogador sem rodada: o mestre encerrou, ou ele ficou de fora. */
export type AlavancaMotivoDoFim = 'mestre' | 'fora'
const MOTIVOS_DO_FIM: readonly AlavancaMotivoDoFim[] = ['mestre', 'fora']

export type AlavancaMotivoDaRecusa = 'longe' | 'ocupado' | 'indisponivel'
export const ALAVANCA_MOTIVOS_DA_RECUSA: readonly AlavancaMotivoDaRecusa[] = ['longe', 'ocupado', 'indisponivel']

export interface AlavancaParticipante {
  playerId: string
  nome: string
}

export interface AlavancaConviteMessage {
  type: 'alavanca.convite'
  sessao: string
  pinId: string
  lugar: string
  fala: string
  dificuldade: DificuldadeAlavanca
  /** O tempo limite já resolvido (o padrão da dificuldade, ou o do mestre). */
  tempo: number
  participantes: AlavancaParticipante[]
  /** Começou sozinho no selo: o Começar já gira, e "Tentar de novo" pede outra rodada. */
  sozinho: boolean
  /** A vitória abre uma porta do mapa (qual, o jogador não sabe). */
  abrePorta: boolean
}

export interface AlavancaEstadoMessage {
  type: 'alavanca.estado'
  sessao: string
  fase: AlavancaFaseNoFio
  participantes: { playerId: string; status: AlavancaStatus }[]
  /** Na pausa: quem pausou ("mestre" ou o playerId). Só o mestre continua a pausa dele. */
  pausaPor?: string
}

export interface AlavancaComecarMessage {
  type: 'alavanca.comecar'
  sessao: string
  dificuldade: DificuldadeAlavanca
  tempo: number
  /** Quem gira, na ordem da rodada: o índice é a cor e a marca de cada um. */
  ordem: AlavancaParticipante[]
}

export interface AlavancaVivoMessage {
  type: 'alavanca.vivo'
  sessao: string
  /** O tempo da rodada, em s. */
  t: number
  /** A ponte, de 0 (erguida) a 1 (assentada). */
  p: number
  /** A velocidade da ponte (fração por s): o rangido e a corrente correndo. */
  vel: number
  /** A força da corrente, de 0 a 1 da força máxima. */
  tensao: number
  /** A catraca soltando, de 0 a 1. */
  solta: number
  /** Os giros de cada um, na ordem da rodada. */
  giros: number[]
}

export interface AlavancaFimMessage {
  type: 'alavanca.fim'
  sessao: string
  tipo: AlavancaTipoDoFim
  /** Quando acabou (s da rodada). */
  tFim: number
  /** A ponte no fim e o mais baixo que ela chegou. */
  p: number
  pMax: number
  giros: number[]
  soltou: number
  maiorPausa: number
  /** A porta do mapa abriu (só com a ponte baixada e uma porta ligada). */
  portaAberta: boolean
}

export interface AlavancaEncerraMessage {
  type: 'alavanca.encerra'
  sessao: string
  motivo: AlavancaMotivoDoFim
}

export interface AlavancaRecusadoMessage {
  type: 'alavanca.recusado'
  pinId: string
  motivo: AlavancaMotivoDaRecusa
}

export type AlavancaHostMessage =
  | AlavancaConviteMessage
  | AlavancaEstadoMessage
  | AlavancaComecarMessage
  | AlavancaVivoMessage
  | AlavancaFimMessage
  | AlavancaEncerraMessage
  | AlavancaRecusadoMessage

export type AlavancaDaSessaoMessage = Exclude<AlavancaHostMessage, AlavancaRecusadoMessage>

export interface AlavancaPedirMessage {
  type: 'alavanca.pedir'
  pinId: string
}

export interface AlavancaProntoMessage {
  type: 'alavanca.pronto'
  sessao: string
}

/** Um aperto: a hora é a da chegada no host (o relógio é dele). */
export interface AlavancaGiroMessage {
  type: 'alavanca.giro'
  sessao: string
}

export interface AlavancaPausaMessage {
  type: 'alavanca.pausa' | 'alavanca.continuar'
  sessao: string
}

export interface AlavancaDesistirMessage {
  type: 'alavanca.desistir'
  sessao: string
}

export type AlavancaPlayerMessage = AlavancaPedirMessage | AlavancaProntoMessage | AlavancaGiroMessage | AlavancaPausaMessage | AlavancaDesistirMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoEntre(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function inteiroEntre(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

function numeroEntre(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
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

const sessaoValida = (value: unknown): value is string => textoEntre(value, 1, ALAVANCA_SESSAO_MAX)
const idValido = (value: unknown): value is string => textoEntre(value, 1, ALAVANCA_SESSAO_MAX)
const tempoValido = (value: unknown): value is number => inteiroEntre(value, ALAVANCA_TEMPO_MIN_S, ALAVANCA_TEMPO_MAX_S)
const segundos = (value: unknown): value is number => numeroEntre(value, 0, ALAVANCA_TEMPO_MAX_S + 1)
const fracao = (value: unknown): value is number => numeroEntre(value, 0, 1)
const contagem = (value: unknown): number | null => (inteiroEntre(value, 0, GIROS_MAX) ? value : null)

function lerParticipante(value: unknown): AlavancaParticipante | null {
  if (!isRecord(value) || !idValido(value.playerId) || !textoEntre(value.nome, 1, ALAVANCA_NOME_MAX)) return null
  return { playerId: value.playerId, nome: value.nome }
}

/** Do jogador, no host. Qualquer campo torto recusa a mensagem inteira. */
export function parseAlavancaPlayerMessage(value: unknown): AlavancaPlayerMessage | null {
  if (!isRecord(value)) return null
  // O pedido vem antes de haver sessão.
  if (value.type === 'alavanca.pedir') return idValido(value.pinId) ? { type: 'alavanca.pedir', pinId: value.pinId } : null
  const { sessao } = value
  if (!sessaoValida(sessao)) return null
  switch (value.type) {
    case 'alavanca.pronto':
    case 'alavanca.giro':
    case 'alavanca.pausa':
    case 'alavanca.continuar':
    case 'alavanca.desistir':
      return { type: value.type, sessao }
    default:
      return null
  }
}

/** Do mestre, no jogador. O host é de confiança, mas a mensagem torta cai inteira em vez de virar meia tela. */
export function parseAlavancaHostMessage(value: unknown): AlavancaHostMessage | null {
  if (!isRecord(value)) return null
  // A recusa do pedido vem antes de haver sessão.
  if (value.type === 'alavanca.recusado') {
    const motivo = umDaLista(ALAVANCA_MOTIVOS_DA_RECUSA, value.motivo)
    return idValido(value.pinId) && motivo !== undefined ? { type: 'alavanca.recusado', pinId: value.pinId, motivo } : null
  }
  if (!sessaoValida(value.sessao)) return null
  const sessao = value.sessao
  switch (value.type) {
    case 'alavanca.convite': {
      const { pinId, lugar, fala, tempo, sozinho, abrePorta } = value
      const dificuldade = umDaLista(DIFICULDADES_ALAVANCA, value.dificuldade)
      const participantes = listaDe(value.participantes, ALAVANCA_PARTICIPANTES_MAX, lerParticipante, 1)
      if (!idValido(pinId) || !textoEntre(lugar, 0, TEXTO_MAX) || !textoEntre(fala, 0, TEXTO_MAX) || !tempoValido(tempo)) return null
      if (dificuldade === undefined || participantes === null || typeof sozinho !== 'boolean' || typeof abrePorta !== 'boolean') return null
      return { type: 'alavanca.convite', sessao, pinId, lugar, fala, dificuldade, tempo, participantes, sozinho, abrePorta }
    }
    case 'alavanca.estado': {
      const fase = umDaLista(FASES_NO_FIO, value.fase)
      const participantes = listaDe(value.participantes, ALAVANCA_PARTICIPANTES_MAX, (item) => {
        const status = isRecord(item) ? umDaLista(ALAVANCA_STATUS, item.status) : undefined
        return status === undefined || !isRecord(item) || !idValido(item.playerId) ? null : { playerId: item.playerId, status }
      })
      if (fase === undefined || participantes === null) return null
      if (value.pausaPor === undefined) return { type: 'alavanca.estado', sessao, fase, participantes }
      return idValido(value.pausaPor) ? { type: 'alavanca.estado', sessao, fase, participantes, pausaPor: value.pausaPor } : null
    }
    case 'alavanca.comecar': {
      const dificuldade = umDaLista(DIFICULDADES_ALAVANCA, value.dificuldade)
      const ordem = listaDe(value.ordem, ALAVANCA_JOGADORES_MAX, lerParticipante, 1)
      if (dificuldade === undefined || ordem === null || !tempoValido(value.tempo)) return null
      return { type: 'alavanca.comecar', sessao, dificuldade, tempo: value.tempo, ordem }
    }
    case 'alavanca.vivo': {
      const { t, p, vel, tensao, solta } = value
      const giros = listaDe(value.giros, ALAVANCA_JOGADORES_MAX, contagem, 1)
      if (!segundos(t) || !fracao(p) || !numeroEntre(vel, -10, 10) || !fracao(tensao) || !fracao(solta) || giros === null) return null
      return { type: 'alavanca.vivo', sessao, t, p, vel, tensao, solta, giros }
    }
    case 'alavanca.fim': {
      const tipo = umDaLista(TIPOS_DO_FIM, value.tipo)
      const giros = listaDe(value.giros, ALAVANCA_JOGADORES_MAX, contagem, 1)
      const { tFim, p, pMax, soltou, maiorPausa, portaAberta } = value
      if (tipo === undefined || giros === null || !segundos(tFim) || !fracao(p) || !fracao(pMax) || contagem(soltou) === null) return null
      if (!segundos(maiorPausa) || typeof portaAberta !== 'boolean' || typeof soltou !== 'number') return null
      return { type: 'alavanca.fim', sessao, tipo, tFim, p, pMax, giros, soltou, maiorPausa, portaAberta }
    }
    case 'alavanca.encerra': {
      const motivo = umDaLista(MOTIVOS_DO_FIM, value.motivo)
      return motivo === undefined ? null : { type: 'alavanca.encerra', sessao, motivo }
    }
    default:
      return null
  }
}

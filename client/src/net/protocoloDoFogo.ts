import {
  DIFICULDADES_FOGO,
  FUNCOES_FOGO,
  MODOS_FOGO,
  type DificuldadeFogo,
  type FuncaoFogo,
  type ModoFogo,
} from '../minigames/fogo/tipos'

/**
 * MINIGAME FOGO NA FLORESTA AO VIVO — as mensagens do fogo entre o mestre e
 * os jogadores chamados. Aditivo como o resto do protocolo: jogador antigo cai
 * no `default` e ignora; mestre antigo responde `error invalid_message`.
 *
 *  - mestre → jogador: `fogo.convite`, `fogo.estado`, `fogo.comecar`,
 *    `fogo.entradas` (as dos colegas, em lotes, a cada `FOGO_REPASSE_MS`),
 *    `fogo.sair`, `fogo.pausa`, `fogo.retoma`, `fogo.encerra` e `fogo.desfecho`;
 *  - jogador → mestre: `fogo.pronto`, `fogo.entradas` (as minhas, de `de` em
 *    diante), `fogo.hash` (a cada 5 s de jogo), `fogo.fim` (o placar) e
 *    `fogo.desistir` ("Agora não", ou o jogo não carregou neste aparelho).
 *
 * Lockstep (o jogo é um export web do Godot, `minigames/fogo/tela/ponteDoJogo.ts`):
 * todo aparelho roda a MESMA partida com a mesma semente e as mesmas entradas
 * por tique. A rede nunca simula nada: o mestre só repassa entradas e
 * compara os hashes. Contrato do jogo: `docs/ponte-app-labirinto.md` do
 * projeto do jogo.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */

/** Teto do id da sessão (o host gera um UUID, 36). */
export const FOGO_SESSAO_MAX = 64
/** Mais participantes que isso nem cabem na sala (`MAX_PLAYERS` do Rust é 16). */
export const FOGO_PARTICIPANTES_MAX = 16
/** A simulação aceita de 1 a 6 no mesmo incêndio (`JOGADORES_MAX` do jogo). */
export const FOGO_EQUIPE_MAX = 6
/** Teto do nome que viaja (o nome efetivo na sala, com "(2)" e tudo; o jogo corta em 64). */
export const FOGO_NOME_MAX = 64
/** Entradas num lote e lotes numa mensagem: os tetos do jogo (`LOTE_MAX`, `LOTES_MAX`). */
export const FOGO_LOTE_MAX = 100
export const FOGO_LOTES_MAX = 24
/** Tique mais alto que o jogo aceita (`TIQUE_MAX`): 180 s de partida são 1800. */
export const FOGO_TIQUE_MAX = 100_000
/** Uma entrada no fio: `[mx, my, ax, ay, acao, pegar, funcao]`, só inteiros. */
export const FOGO_ENTRADA_TAMANHO = 7
/** O jogo saneia cada número; o teto aqui só barra lixo (a mira vai em centésimos de célula). */
const FOGO_ENTRADA_VALOR_MAX = 1_000_000
/** De quanto em quanto tempo o mestre repassa as entradas, e o jogador manda as suas. */
export const FOGO_REPASSE_MS = 100
/** Atraso do lockstep em tiques (0,1 s cada): cobre rede + repasse numa rede boa. */
export const FOGO_ATRASO_PADRAO = 4
export const FOGO_ATRASO_MIN = 1
export const FOGO_ATRASO_MAX = 20
export const FOGO_SEMENTE_MAX = 2_147_483_647
/** Teto de qualquer contagem do placar: bem acima de qualquer partida real. */
const FOGO_CONTAGEM_MAX = 1_000_000_000
const TEXTO_CURTO_MAX = 220
const MOTIVO_MAX = 20

export type FogoStatus = 'convidado' | 'pronto' | 'jogando' | 'terminou' | 'saiu' | 'fora'
export const FOGO_STATUS: readonly FogoStatus[] = ['convidado', 'pronto', 'jogando', 'terminou', 'saiu', 'fora']
/** A fase que o jogador lê. `fim` e `encerrada` não viajam: chegam como `fogo.desfecho` e `fogo.encerra`. */
export type FogoFaseNoFio = 'convite' | 'jogo' | 'pausa'
const FASES_NO_FIO: readonly FogoFaseNoFio[] = ['convite', 'jogo', 'pausa']
/** `fora`: não estava pronto no "Começar"; `mestre`: o mestre encerrou; `saiu`: caiu no meio; `divergiu`: hash diferente. */
export type FogoMotivoDoFim = 'fora' | 'mestre' | 'saiu' | 'divergiu'
const MOTIVOS_DO_FIM: readonly FogoMotivoDoFim[] = ['fora', 'mestre', 'saiu', 'divergiu']
export type FogoResultado = 'venceu' | 'perdeu' | 'saiu'
const RESULTADOS: readonly FogoResultado[] = ['venceu', 'perdeu', 'saiu']

/** Uma entrada de um tique, como o jogo manda e recebe. */
export type FogoEntrada = number[]

export interface FogoParticipante {
  playerId: string
  nome: string
  funcao: FuncaoFogo
}

/** As entradas do jogador `id` para os tiques `de`, `de + 1`, ... */
export interface FogoLote {
  id: string
  de: number
  lista: FogoEntrada[]
}

/** O jogador na partida: `id` é o `playerId` (a ordem da lista é o número dele na simulação). */
export interface FogoJogadorDaPartida {
  id: string
  nome: string
  funcao: FuncaoFogo
}

/** O placar do fim que o jogo manda (convertido para o app: só o que a mesa lê). */
export interface FogoPlacar {
  vitoria: boolean
  motivo: string
  pontos: number
  estrelas: number
  florestaViva: number
  casas: number
  tempoS: number
  porJogador: { id: string; funcao: FuncaoFogo; pontos: number }[]
}

export interface FogoConviteMessage {
  type: 'fogo.convite'
  sessao: string
  pinId: string
  npc: string
  fala: string
  floresta: string
  modo: ModoFogo
  premio: { texto: string }
  consequencia: { texto: string }
  participantes: FogoParticipante[]
}

export interface FogoEstadoMessage {
  type: 'fogo.estado'
  sessao: string
  fase: FogoFaseNoFio
  participantes: { playerId: string; status: FogoStatus; funcao: FuncaoFogo }[]
}

export interface FogoComecarMessage {
  type: 'fogo.comecar'
  sessao: string
  semente: number
  dificuldade: DificuldadeFogo
  atraso: number
  jogadores: FogoJogadorDaPartida[]
}

export interface FogoLotesMessage {
  type: 'fogo.entradas'
  sessao: string
  lotes: FogoLote[]
}

export interface FogoSairMessage {
  type: 'fogo.sair'
  sessao: string
  id: string
  depoisDe: number
}

export interface FogoPausaMessage {
  type: 'fogo.pausa' | 'fogo.retoma'
  sessao: string
}

export interface FogoEncerraMessage {
  type: 'fogo.encerra'
  sessao: string
  motivo: FogoMotivoDoFim
}

/** Uma linha da mesa no resultado. */
export interface FogoLinhaDaMesa {
  playerId: string
  nome: string
  funcao: FuncaoFogo
  pontos: number
  resultado: FogoResultado
}

export interface FogoDesfechoMessage {
  type: 'fogo.desfecho'
  sessao: string
  modo: ModoFogo
  /** O placar da equipe (no solo, o do próprio jogador); ausente = ninguém terminou. */
  placar?: Omit<FogoPlacar, 'porJogador'>
  mesa: FogoLinhaDaMesa[]
  /** O que é DESTE jogador: o prêmio de quem venceu, a consequência de quem não venceu. */
  seu: { passou: boolean; premio?: { texto: string }; consequencia?: { texto: string } }
}

export type FogoHostMessage =
  | FogoConviteMessage
  | FogoEstadoMessage
  | FogoComecarMessage
  | FogoLotesMessage
  | FogoSairMessage
  | FogoPausaMessage
  | FogoEncerraMessage
  | FogoDesfechoMessage

export interface FogoProntoMessage {
  type: 'fogo.pronto'
  sessao: string
  funcao: FuncaoFogo
}

export interface FogoEntradasMessage {
  type: 'fogo.entradas'
  sessao: string
  de: number
  lista: FogoEntrada[]
}

export interface FogoHashMessage {
  type: 'fogo.hash'
  sessao: string
  tique: number
  hash: number
}

export interface FogoFimMessage {
  type: 'fogo.fim'
  sessao: string
  tique: number
  hash: number
  placar: FogoPlacar
}

/** `recusou`: o jogador tocou em "Agora não" (ou fechou a tela); `erro`: o jogo não carregou ou travou neste aparelho. */
export type FogoMotivoDaDesistencia = 'recusou' | 'erro'
const MOTIVOS_DA_DESISTENCIA: readonly FogoMotivoDaDesistencia[] = ['recusou', 'erro']

/** O jogador sai do fogo antes do fim: o mestre tira do convite ou da partida, e a equipe não fica esperando por ele. */
export interface FogoDesistirMessage {
  type: 'fogo.desistir'
  sessao: string
  motivo: FogoMotivoDaDesistencia
}

export type FogoPlayerMessage = FogoProntoMessage | FogoEntradasMessage | FogoHashMessage | FogoFimMessage | FogoDesistirMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoEntre(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function inteiroEntre(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

/** O hash do estado é um inteiro do Godot (64 bits): basta ser inteiro finito, igual em todo aparelho. */
function ehHash(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
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

const sessaoValida = (value: unknown): value is string => textoEntre(value, 1, FOGO_SESSAO_MAX)
const idValido = (value: unknown): value is string => textoEntre(value, 1, FOGO_SESSAO_MAX)

/** Uma entrada: 7 inteiros pequenos. Aqui só a forma; o valor de cada um o jogo saneia. */
export function lerEntradaDoFogo(value: unknown): FogoEntrada | null {
  if (!Array.isArray(value) || value.length !== FOGO_ENTRADA_TAMANHO) return null
  const itens: unknown[] = value
  const lidos: number[] = []
  for (const item of itens) {
    if (!inteiroEntre(item, -FOGO_ENTRADA_VALOR_MAX, FOGO_ENTRADA_VALOR_MAX)) return null
    lidos.push(item)
  }
  return lidos
}

const contagem = (value: unknown): value is number => inteiroEntre(value, 0, FOGO_CONTAGEM_MAX)

type ResumoDoPlacar = Omit<FogoPlacar, 'porJogador'>

/** O placar do time, sem as linhas de cada jogador (o desfecho leva as linhas na mesa). */
function lerResumoDoPlacar(value: unknown): ResumoDoPlacar | null {
  if (!isRecord(value)) return null
  const { vitoria, motivo, pontos, estrelas, florestaViva, casas, tempoS } = value
  if (typeof vitoria !== 'boolean' || !textoEntre(motivo, 0, MOTIVO_MAX) || !contagem(pontos) || !inteiroEntre(estrelas, 0, 10)) return null
  if (!inteiroEntre(florestaViva, 0, 100) || !contagem(casas) || !inteiroEntre(tempoS, 0, FOGO_TIQUE_MAX)) return null
  return { vitoria, motivo, pontos, estrelas, florestaViva, casas, tempoS }
}

/** O placar no formato do APP (camelCase). O do jogo (snake_case) é convertido por `placarDoJogo`. */
function lerPlacar(value: unknown): FogoPlacar | null {
  const resumo = lerResumoDoPlacar(value)
  if (resumo === null || !isRecord(value)) return null
  const porJogador = listaDe(
    value.porJogador,
    FOGO_EQUIPE_MAX,
    (item) => {
      const funcao = isRecord(item) ? umDaLista(FUNCOES_FOGO, item.funcao) : undefined
      if (!isRecord(item) || funcao === undefined || !idValido(item.id) || !contagem(item.pontos)) return null
      return { id: item.id, funcao, pontos: item.pontos }
    },
    1,
  )
  return porJogador === null ? null : { ...resumo, porJogador }
}

/**
 * O placar como o JOGO manda (`fim.placar`, snake_case, seção 6 do GDD),
 * convertido para o do app. `null` = torto. Campos que a mesa não lê ficam.
 */
export function placarDoJogo(value: unknown): FogoPlacar | null {
  if (!isRecord(value)) return null
  const porJogador = Array.isArray(value.por_jogador)
    ? value.por_jogador.map((item: unknown) => (isRecord(item) ? { id: item.id, funcao: item.funcao_inicial ?? item.funcao, pontos: item.pontos } : null))
    : null
  return lerPlacar({
    vitoria: value.vitoria,
    motivo: value.motivo,
    pontos: value.pontos,
    estrelas: value.estrelas,
    florestaViva: value.floresta_viva,
    casas: value.casas,
    tempoS: value.tempo_s,
    porJogador,
  })
}

/** Do jogador, no host. Qualquer campo torto recusa a mensagem inteira. */
export function parseFogoPlayerMessage(value: unknown): FogoPlayerMessage | null {
  if (!isRecord(value)) return null
  const { sessao } = value
  if (!sessaoValida(sessao)) return null
  switch (value.type) {
    case 'fogo.pronto': {
      const funcao = umDaLista(FUNCOES_FOGO, value.funcao)
      return funcao === undefined ? null : { type: 'fogo.pronto', sessao, funcao }
    }
    case 'fogo.entradas': {
      const lista = listaDe(value.lista, FOGO_LOTE_MAX, lerEntradaDoFogo, 1)
      if (!inteiroEntre(value.de, 1, FOGO_TIQUE_MAX) || lista === null) return null
      return { type: 'fogo.entradas', sessao, de: value.de, lista }
    }
    case 'fogo.hash': {
      const { tique, hash } = value
      return inteiroEntre(tique, 0, FOGO_TIQUE_MAX) && ehHash(hash) ? { type: 'fogo.hash', sessao, tique, hash } : null
    }
    case 'fogo.fim': {
      const { tique, hash } = value
      const placar = lerPlacar(value.placar)
      if (!inteiroEntre(tique, 0, FOGO_TIQUE_MAX) || !ehHash(hash) || placar === null) return null
      return { type: 'fogo.fim', sessao, tique, hash, placar }
    }
    case 'fogo.desistir': {
      const motivo = umDaLista(MOTIVOS_DA_DESISTENCIA, value.motivo)
      return motivo === undefined ? null : { type: 'fogo.desistir', sessao, motivo }
    }
    default:
      return null
  }
}

function lerParticipante(value: unknown): FogoParticipante | null {
  if (!isRecord(value)) return null
  const funcao = umDaLista(FUNCOES_FOGO, value.funcao)
  if (!idValido(value.playerId) || !textoEntre(value.nome, 1, FOGO_NOME_MAX) || funcao === undefined) return null
  return { playerId: value.playerId, nome: value.nome, funcao }
}

function lerJogadorDaPartida(value: unknown): FogoJogadorDaPartida | null {
  if (!isRecord(value)) return null
  const funcao = umDaLista(FUNCOES_FOGO, value.funcao)
  if (!idValido(value.id) || !textoEntre(value.nome, 0, FOGO_NOME_MAX) || funcao === undefined) return null
  return { id: value.id, nome: value.nome, funcao }
}

function lerTexto(value: unknown): { texto: string } | null {
  return isRecord(value) && textoEntre(value.texto, 0, TEXTO_CURTO_MAX) ? { texto: value.texto } : null
}

function lerLote(value: unknown): FogoLote | null {
  if (!isRecord(value) || !idValido(value.id) || !inteiroEntre(value.de, 1, FOGO_TIQUE_MAX)) return null
  const lista = listaDe(value.lista, FOGO_LOTE_MAX, lerEntradaDoFogo, 1)
  return lista === null ? null : { id: value.id, de: value.de, lista }
}

function lerLinhaDaMesa(value: unknown): FogoLinhaDaMesa | null {
  const base = lerParticipante(value)
  const resultado = isRecord(value) ? umDaLista(RESULTADOS, value.resultado) : undefined
  if (base === null || !isRecord(value) || !contagem(value.pontos) || resultado === undefined) return null
  return { ...base, pontos: value.pontos, resultado }
}

function lerDesfecho(value: Record<string, unknown>, sessao: string): FogoDesfechoMessage | null {
  const modo = umDaLista(MODOS_FOGO, value.modo)
  const mesa = listaDe(value.mesa, FOGO_PARTICIPANTES_MAX, lerLinhaDaMesa)
  const { seu } = value
  if (modo === undefined || mesa === null || !isRecord(seu) || typeof seu.passou !== 'boolean') return null
  const lido: FogoDesfechoMessage = { type: 'fogo.desfecho', sessao, modo, mesa, seu: { passou: seu.passou } }
  if (value.placar !== undefined) {
    const placar = lerResumoDoPlacar(value.placar)
    if (placar === null) return null
    lido.placar = placar
  }
  for (const campo of ['premio', 'consequencia'] as const) {
    if (seu[campo] === undefined) continue
    const texto = lerTexto(seu[campo])
    if (texto === null) return null
    lido.seu[campo] = texto
  }
  return lido
}

/** Do mestre, no jogador. O host é de confiança, mas a mensagem torta cai inteira em vez de virar meia tela. */
export function parseFogoHostMessage(value: unknown): FogoHostMessage | null {
  if (!isRecord(value) || !sessaoValida(value.sessao)) return null
  const sessao = value.sessao
  switch (value.type) {
    case 'fogo.convite': {
      const { pinId, npc, fala, floresta } = value
      const modo = umDaLista(MODOS_FOGO, value.modo)
      const premio = lerTexto(value.premio)
      const consequencia = lerTexto(value.consequencia)
      const participantes = listaDe(value.participantes, FOGO_PARTICIPANTES_MAX, lerParticipante, 1)
      if (!idValido(pinId) || !textoEntre(npc, 0, TEXTO_CURTO_MAX) || !textoEntre(fala, 0, TEXTO_CURTO_MAX) || !textoEntre(floresta, 0, TEXTO_CURTO_MAX)) return null
      if (modo === undefined || premio === null || consequencia === null || participantes === null) return null
      return { type: 'fogo.convite', sessao, pinId, npc, fala, floresta, modo, premio, consequencia, participantes }
    }
    case 'fogo.estado': {
      const fase = umDaLista(FASES_NO_FIO, value.fase)
      const participantes = listaDe(value.participantes, FOGO_PARTICIPANTES_MAX, (item) => {
        const status = isRecord(item) ? umDaLista(FOGO_STATUS, item.status) : undefined
        const funcao = isRecord(item) ? umDaLista(FUNCOES_FOGO, item.funcao) : undefined
        return status === undefined || funcao === undefined || !isRecord(item) || !idValido(item.playerId) ? null : { playerId: item.playerId, status, funcao }
      })
      return fase === undefined || participantes === null ? null : { type: 'fogo.estado', sessao, fase, participantes }
    }
    case 'fogo.comecar': {
      const dificuldade = umDaLista(DIFICULDADES_FOGO, value.dificuldade)
      const jogadores = listaDe(value.jogadores, FOGO_EQUIPE_MAX, lerJogadorDaPartida, 1)
      const { semente, atraso } = value
      if (dificuldade === undefined || jogadores === null || !inteiroEntre(semente, 0, FOGO_SEMENTE_MAX) || !inteiroEntre(atraso, FOGO_ATRASO_MIN, FOGO_ATRASO_MAX)) return null
      return { type: 'fogo.comecar', sessao, semente, dificuldade, atraso, jogadores }
    }
    case 'fogo.entradas': {
      const lotes = listaDe(value.lotes, FOGO_LOTES_MAX, lerLote, 1)
      return lotes === null ? null : { type: 'fogo.entradas', sessao, lotes }
    }
    case 'fogo.sair':
      return idValido(value.id) && inteiroEntre(value.depoisDe, 0, FOGO_TIQUE_MAX) ? { type: 'fogo.sair', sessao, id: value.id, depoisDe: value.depoisDe } : null
    case 'fogo.pausa':
    case 'fogo.retoma':
      return { type: value.type, sessao }
    case 'fogo.encerra': {
      const motivo = umDaLista(MOTIVOS_DO_FIM, value.motivo)
      return motivo === undefined ? null : { type: 'fogo.encerra', sessao, motivo }
    }
    case 'fogo.desfecho':
      return lerDesfecho(value, sessao)
    default:
      return null
  }
}

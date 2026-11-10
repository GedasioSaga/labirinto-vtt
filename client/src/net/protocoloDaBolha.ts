import { CENARIOS_BOLHA, DIFICULDADES_BOLHA, MODOS_BOLHA, type CenarioBolha, type DificuldadeBolha, type ModoBolha } from '../minigames/bolha/tipos'

/**
 * MINIGAME BOLHA D'ÁGUA AO VIVO — as mensagens da bolha entre o mestre e os
 * jogadores chamados. Aditivo como o resto do protocolo: jogador antigo cai
 * no `default` e ignora; mestre antigo responde `error invalid_message`.
 *
 *  - mestre → jogador: `bolha.convite`, `bolha.estado`, `bolha.comecar`,
 *    `bolha.pausa`, `bolha.retoma`, `bolha.encerra`, `bolha.desfecho` e
 *    `bolha.recusado` (o "Apagar o fogo" do pino não abriu);
 *  - jogador → mestre: `bolha.pedir` (começar sozinho no cartão do pino, se o
 *    mestre deixou), `bolha.pronto`, `bolha.fim` (o placar) e `bolha.desistir`
 *    ("Agora não", ou o jogo não carregou neste aparelho).
 *
 * SEM LOCKSTEP (a diferença para o fogo): cada um joga a própria cópia do
 * export web do Godot (`minigames/bolha/tela/ponteDaBolha.ts`). Em equipe o
 * mestre manda a todos o MESMO `bolha.comecar` (semente, cenário e
 * dificuldade): a partida começa igual para todos, e o mestre junta os
 * placares. Contrato do jogo: `docs/ponte-app-labirinto.md` do projeto do jogo.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */

/** Teto do id da sessão (o host gera um UUID, 36). */
export const BOLHA_SESSAO_MAX = 64
/** Mais participantes que isso nem cabem na sala (`MAX_PLAYERS` do Rust é 16). */
export const BOLHA_PARTICIPANTES_MAX = 16
/** O jogo aceita de 1 a 6 jogadores na lista do `iniciar`. */
export const BOLHA_EQUIPE_MAX = 6
/** Teto do nome que viaja (o nome efetivo na sala); o jogo recusa acima de 40, a ponte corta. */
export const BOLHA_NOME_MAX = 64
/** O nome que o JOGO aceita (`_validar_iniciar`). */
export const BOLHA_NOME_NO_JOGO_MAX = 40
export const BOLHA_SEMENTE_MAX = 2_147_483_647
/** Teto de qualquer contagem do placar: bem acima de qualquer partida real. */
const BOLHA_CONTAGEM_MAX = 1_000_000_000
/** Segundos de partida: o jogo para em 90 s; o teto só barra lixo. */
const BOLHA_TEMPO_MAX_S = 100_000
const TEXTO_CURTO_MAX = 220
const MOTIVO_MAX = 20

export type BolhaStatus = 'convidado' | 'pronto' | 'jogando' | 'terminou' | 'saiu' | 'fora'
export const BOLHA_STATUS: readonly BolhaStatus[] = ['convidado', 'pronto', 'jogando', 'terminou', 'saiu', 'fora']
/** A fase que o jogador lê. `fim` e `encerrada` não viajam: chegam como `bolha.desfecho` e `bolha.encerra`. */
export type BolhaFaseNoFio = 'convite' | 'jogo' | 'pausa'
const FASES_NO_FIO: readonly BolhaFaseNoFio[] = ['convite', 'jogo', 'pausa']
/** `fora`: não estava pronto no "Começar"; `mestre`: o mestre encerrou; `saiu`: caiu no meio. */
export type BolhaMotivoDoFim = 'fora' | 'mestre' | 'saiu'
const MOTIVOS_DO_FIM: readonly BolhaMotivoDoFim[] = ['fora', 'mestre', 'saiu']
export type BolhaResultado = 'venceu' | 'perdeu' | 'saiu'
const RESULTADOS: readonly BolhaResultado[] = ['venceu', 'perdeu', 'saiu']

export interface BolhaParticipante {
  playerId: string
  nome: string
}

/** O jogador na partida, como o `iniciar` do jogo pede: `id` é o `playerId`. */
export interface BolhaJogadorDaPartida {
  id: string
  nome: string
}

/**
 * O placar do fim que o jogo manda (`fim.placar`), no formato do app. O id e
 * o nome do jogador, a semente e o modo que o jogo devolve não viajam: o
 * mestre já sabe de quem é a mensagem e qual partida mandou.
 */
export interface BolhaPlacar {
  vitoria: boolean
  /** `apagou`, `tempo` ou `tomou` hoje; texto livre para não recusar um motivo novo do jogo. */
  motivo: string
  cenario: CenarioBolha
  dificuldade: DificuldadeBolha
  /** Segundos de partida (o jogo manda com duas casas). */
  tempoS: number
  bolhas: number
  acertos: number
  /** Acertos sobre bolhas, em %. */
  precisao: number
  focosApagados: number
  focosQuePegaram: number
  /** Quanto fogo sobrou no fim, em %. */
  fogoNoFim: number
  pontos: number
  /** 0 a 3. */
  estrelas: number
}

export interface BolhaConviteMessage {
  type: 'bolha.convite'
  sessao: string
  pinId: string
  npc: string
  fala: string
  cenario: CenarioBolha
  modo: ModoBolha
  premio: { texto: string }
  consequencia: { texto: string }
  participantes: BolhaParticipante[]
  /**
   * SOZINHO NO PINO: a volta do `bolha.pedir` deste jogador. Ninguém espera o
   * mestre: o Pronto já leva a dificuldade e começa. Diz a dificuldade que o
   * mestre deixou (`escolha` = o jogador escolhe). Ausente = convite do mestre.
   */
  sozinho?: { permitida: 'escolha' | DificuldadeBolha }
}

/** Por que o começar sozinho não abriu: ficha longe, outra bolha acesa nesta sala, ou o pino não vale. */
export type BolhaMotivoDaRecusa = 'longe' | 'ocupado' | 'indisponivel'
export const BOLHA_MOTIVOS_DA_RECUSA: readonly BolhaMotivoDaRecusa[] = ['longe', 'ocupado', 'indisponivel']

export interface BolhaRecusadoMessage {
  type: 'bolha.recusado'
  pinId: string
  motivo: BolhaMotivoDaRecusa
}

/** O jogador tocou em "Apagar o fogo" no cartão do pino: pede uma partida só dele. */
export interface BolhaPedirMessage {
  type: 'bolha.pedir'
  pinId: string
}

export interface BolhaEstadoMessage {
  type: 'bolha.estado'
  sessao: string
  fase: BolhaFaseNoFio
  participantes: { playerId: string; status: BolhaStatus }[]
}

export interface BolhaComecarMessage {
  type: 'bolha.comecar'
  sessao: string
  semente: number
  dificuldade: DificuldadeBolha
  cenario: CenarioBolha
  modo: ModoBolha
  /** Equipe: todos os que jogam, na ordem do mestre; solo: só o próprio. */
  jogadores: BolhaJogadorDaPartida[]
}

export interface BolhaPausaMessage {
  type: 'bolha.pausa' | 'bolha.retoma'
  sessao: string
}

export interface BolhaEncerraMessage {
  type: 'bolha.encerra'
  sessao: string
  motivo: BolhaMotivoDoFim
}

/** Uma linha da mesa no resultado: cada um com os SEUS pontos (cada um jogou a sua cópia). */
export interface BolhaLinhaDaMesa {
  playerId: string
  nome: string
  pontos: number
  estrelas: number
  resultado: BolhaResultado
}

export interface BolhaDesfechoMessage {
  type: 'bolha.desfecho'
  sessao: string
  modo: ModoBolha
  /** O placar DESTE jogador; ausente = ele não terminou (saiu no meio). */
  placar?: BolhaPlacar
  mesa: BolhaLinhaDaMesa[]
  /** O que é DESTE jogador: o prêmio se apagou, a consequência se não. */
  seu: { passou: boolean; premio?: { texto: string }; consequencia?: { texto: string } }
}

export type BolhaHostMessage =
  | BolhaConviteMessage
  | BolhaEstadoMessage
  | BolhaComecarMessage
  | BolhaPausaMessage
  | BolhaEncerraMessage
  | BolhaDesfechoMessage
  | BolhaRecusadoMessage

/** O que o host manda DENTRO de uma sessão (a recusa vem antes de haver uma). */
export type BolhaDaSessaoMessage = Exclude<BolhaHostMessage, BolhaRecusadoMessage>

export interface BolhaProntoMessage {
  type: 'bolha.pronto'
  sessao: string
  /** Só no convite `sozinho`: a dificuldade escolhida (o host confere com a que o mestre deixou). */
  dificuldade?: DificuldadeBolha
}

export interface BolhaFimMessage {
  type: 'bolha.fim'
  sessao: string
  placar: BolhaPlacar
}

/** `recusou`: o jogador tocou em "Agora não" (ou fechou a tela); `erro`: o jogo não carregou ou travou neste aparelho. */
export type BolhaMotivoDaDesistencia = 'recusou' | 'erro'
const MOTIVOS_DA_DESISTENCIA: readonly BolhaMotivoDaDesistencia[] = ['recusou', 'erro']

export interface BolhaDesistirMessage {
  type: 'bolha.desistir'
  sessao: string
  motivo: BolhaMotivoDaDesistencia
}

export type BolhaPlayerMessage = BolhaPedirMessage | BolhaProntoMessage | BolhaFimMessage | BolhaDesistirMessage

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

const sessaoValida = (value: unknown): value is string => textoEntre(value, 1, BOLHA_SESSAO_MAX)
const idValido = (value: unknown): value is string => textoEntre(value, 1, BOLHA_SESSAO_MAX)
const contagem = (value: unknown): value is number => inteiroEntre(value, 0, BOLHA_CONTAGEM_MAX)
const porcento = (value: unknown): value is number => inteiroEntre(value, 0, 100)

/** A dificuldade como o jogo devolve: aceita o `extremo` do fogo como `dificil` (o contrato do jogo faz o mesmo). */
function lerDificuldade(value: unknown): DificuldadeBolha | undefined {
  return value === 'extremo' ? 'dificil' : umDaLista(DIFICULDADES_BOLHA, value)
}

/** O placar no formato do APP (camelCase): o que viaja do jogador ao mestre. */
export function lerPlacarDaBolha(value: unknown): BolhaPlacar | null {
  if (!isRecord(value)) return null
  const { vitoria, motivo, tempoS, bolhas, acertos, precisao, focosApagados, focosQuePegaram, fogoNoFim, pontos, estrelas } = value
  const cenario = umDaLista(CENARIOS_BOLHA, value.cenario)
  const dificuldade = umDaLista(DIFICULDADES_BOLHA, value.dificuldade)
  if (typeof vitoria !== 'boolean' || !textoEntre(motivo, 0, MOTIVO_MAX) || cenario === undefined || dificuldade === undefined) return null
  if (!numeroEntre(tempoS, 0, BOLHA_TEMPO_MAX_S) || !contagem(bolhas) || !contagem(acertos) || !porcento(precisao)) return null
  if (!contagem(focosApagados) || !contagem(focosQuePegaram) || !porcento(fogoNoFim) || !contagem(pontos) || !inteiroEntre(estrelas, 0, 3)) return null
  return { vitoria, motivo, cenario, dificuldade, tempoS, bolhas, acertos, precisao, focosApagados, focosQuePegaram, fogoNoFim, pontos, estrelas }
}

/**
 * O placar como o JOGO manda (`fim.placar`, snake_case), convertido para o
 * do app. `null` = torto. `semente`, `modo` e `jogador` ficam: o app já sabe.
 */
export function placarDoJogoDaBolha(value: unknown): BolhaPlacar | null {
  if (!isRecord(value)) return null
  return lerPlacarDaBolha({
    vitoria: value.vitoria,
    motivo: value.motivo,
    cenario: value.cenario,
    dificuldade: lerDificuldade(value.dificuldade),
    tempoS: value.tempo_s,
    bolhas: value.bolhas,
    acertos: value.acertos,
    precisao: value.precisao,
    focosApagados: value.focos_apagados,
    focosQuePegaram: value.focos_que_pegaram,
    fogoNoFim: value.fogo_no_fim,
    pontos: value.pontos,
    estrelas: value.estrelas,
  })
}

/** Do jogador, no host. Qualquer campo torto recusa a mensagem inteira. */
export function parseBolhaPlayerMessage(value: unknown): BolhaPlayerMessage | null {
  if (!isRecord(value)) return null
  // O pedido vem antes de haver sessão.
  if (value.type === 'bolha.pedir') return idValido(value.pinId) ? { type: 'bolha.pedir', pinId: value.pinId } : null
  const { sessao } = value
  if (!sessaoValida(sessao)) return null
  switch (value.type) {
    case 'bolha.pronto': {
      if (value.dificuldade === undefined) return { type: 'bolha.pronto', sessao }
      const dificuldade = umDaLista(DIFICULDADES_BOLHA, value.dificuldade)
      return dificuldade === undefined ? null : { type: 'bolha.pronto', sessao, dificuldade }
    }
    case 'bolha.fim': {
      const placar = lerPlacarDaBolha(value.placar)
      return placar === null ? null : { type: 'bolha.fim', sessao, placar }
    }
    case 'bolha.desistir': {
      const motivo = umDaLista(MOTIVOS_DA_DESISTENCIA, value.motivo)
      return motivo === undefined ? null : { type: 'bolha.desistir', sessao, motivo }
    }
    default:
      return null
  }
}

function lerParticipante(value: unknown): BolhaParticipante | null {
  if (!isRecord(value) || !idValido(value.playerId) || !textoEntre(value.nome, 1, BOLHA_NOME_MAX)) return null
  return { playerId: value.playerId, nome: value.nome }
}

function lerJogadorDaPartida(value: unknown): BolhaJogadorDaPartida | null {
  if (!isRecord(value) || !idValido(value.id) || !textoEntre(value.nome, 0, BOLHA_NOME_MAX)) return null
  return { id: value.id, nome: value.nome }
}

function lerTexto(value: unknown): { texto: string } | null {
  return isRecord(value) && textoEntre(value.texto, 0, TEXTO_CURTO_MAX) ? { texto: value.texto } : null
}

function lerLinhaDaMesa(value: unknown): BolhaLinhaDaMesa | null {
  const base = lerParticipante(value)
  if (base === null || !isRecord(value)) return null
  const resultado = umDaLista(RESULTADOS, value.resultado)
  if (!contagem(value.pontos) || !inteiroEntre(value.estrelas, 0, 3) || resultado === undefined) return null
  return { ...base, pontos: value.pontos, estrelas: value.estrelas, resultado }
}

function lerDesfecho(value: Record<string, unknown>, sessao: string): BolhaDesfechoMessage | null {
  const modo = umDaLista(MODOS_BOLHA, value.modo)
  const mesa = listaDe(value.mesa, BOLHA_PARTICIPANTES_MAX, lerLinhaDaMesa)
  const { seu } = value
  if (modo === undefined || mesa === null || !isRecord(seu) || typeof seu.passou !== 'boolean') return null
  const lido: BolhaDesfechoMessage = { type: 'bolha.desfecho', sessao, modo, mesa, seu: { passou: seu.passou } }
  if (value.placar !== undefined) {
    const placar = lerPlacarDaBolha(value.placar)
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
export function parseBolhaHostMessage(value: unknown): BolhaHostMessage | null {
  if (!isRecord(value)) return null
  // A recusa do pedido vem antes de haver sessão.
  if (value.type === 'bolha.recusado') {
    const motivo = umDaLista(BOLHA_MOTIVOS_DA_RECUSA, value.motivo)
    return idValido(value.pinId) && motivo !== undefined ? { type: 'bolha.recusado', pinId: value.pinId, motivo } : null
  }
  if (!sessaoValida(value.sessao)) return null
  const sessao = value.sessao
  switch (value.type) {
    case 'bolha.convite': {
      const { pinId, npc, fala } = value
      const cenario = umDaLista(CENARIOS_BOLHA, value.cenario)
      const modo = umDaLista(MODOS_BOLHA, value.modo)
      const premio = lerTexto(value.premio)
      const consequencia = lerTexto(value.consequencia)
      const participantes = listaDe(value.participantes, BOLHA_PARTICIPANTES_MAX, lerParticipante, 1)
      if (!idValido(pinId) || !textoEntre(npc, 0, TEXTO_CURTO_MAX) || !textoEntre(fala, 0, TEXTO_CURTO_MAX)) return null
      if (cenario === undefined || modo === undefined || premio === null || consequencia === null || participantes === null) return null
      const convite: BolhaConviteMessage = { type: 'bolha.convite', sessao, pinId, npc, fala, cenario, modo, premio, consequencia, participantes }
      if (value.sozinho !== undefined) {
        const permitida = isRecord(value.sozinho) ? (value.sozinho.permitida === 'escolha' ? 'escolha' : umDaLista(DIFICULDADES_BOLHA, value.sozinho.permitida)) : undefined
        if (permitida === undefined) return null
        convite.sozinho = { permitida }
      }
      return convite
    }
    case 'bolha.estado': {
      const fase = umDaLista(FASES_NO_FIO, value.fase)
      const participantes = listaDe(value.participantes, BOLHA_PARTICIPANTES_MAX, (item) => {
        const status = isRecord(item) ? umDaLista(BOLHA_STATUS, item.status) : undefined
        return status === undefined || !isRecord(item) || !idValido(item.playerId) ? null : { playerId: item.playerId, status }
      })
      return fase === undefined || participantes === null ? null : { type: 'bolha.estado', sessao, fase, participantes }
    }
    case 'bolha.comecar': {
      const dificuldade = umDaLista(DIFICULDADES_BOLHA, value.dificuldade)
      const cenario = umDaLista(CENARIOS_BOLHA, value.cenario)
      const modo = umDaLista(MODOS_BOLHA, value.modo)
      const jogadores = listaDe(value.jogadores, BOLHA_EQUIPE_MAX, lerJogadorDaPartida, 1)
      const { semente } = value
      if (dificuldade === undefined || cenario === undefined || modo === undefined || jogadores === null || !inteiroEntre(semente, 0, BOLHA_SEMENTE_MAX)) return null
      return { type: 'bolha.comecar', sessao, semente, dificuldade, cenario, modo, jogadores }
    }
    case 'bolha.pausa':
    case 'bolha.retoma':
      return { type: value.type, sessao }
    case 'bolha.encerra': {
      const motivo = umDaLista(MOTIVOS_DO_FIM, value.motivo)
      return motivo === undefined ? null : { type: 'bolha.encerra', sessao, motivo }
    }
    case 'bolha.desfecho':
      return lerDesfecho(value, sessao)
    default:
      return null
  }
}

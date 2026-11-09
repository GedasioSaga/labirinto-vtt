import {
  ALTURAS_FOGO,
  DIFICULDADES_FOGO,
  FERRAMENTAS_FOGO,
  MODOS_FOGO,
  type AlturaFogo,
  type DificuldadeFogo,
  type FerramentaFogo,
  type ModoFogo,
} from '../minigames/fogo/tipos'

/**
 * MINIGAME FOGO NA FLORESTA AO VIVO — as mensagens do fogo entre o mestre e
 * os jogadores chamados. Aditivo como o resto do protocolo: jogador antigo cai
 * no `default` e ignora; mestre antigo responde `error invalid_message`.
 *
 *  - mestre → jogador: `fogo.convite`, `fogo.estado`, `fogo.comecar`,
 *    `fogo.entradas` (as dos colegas, em lotes, a cada `FOGO_REPASSE_MS`),
 *    `fogo.sair`, `fogo.pausa`, `fogo.retoma`, `fogo.encerra`, `fogo.desfecho`
 *    e `fogo.recusado` (o "Apagar o fogo" do pino não abriu);
 *  - jogador → mestre: `fogo.pedir` ("Apagar o fogo" no cartão do pino: um
 *    incêndio só dele), `fogo.pronto`, `fogo.entradas` (as minhas, de `de` em
 *    diante), `fogo.hash` (a cada 5 s de jogo), `fogo.fim` (o placar) e
 *    `fogo.desistir` ("Agora não", ou o jogo não carregou neste aparelho).
 *
 * Lockstep (o jogo é um export web do Godot, `minigames/fogo/tela/ponteDoJogo.ts`):
 * todo aparelho roda a MESMA partida com a mesma semente e as mesmas entradas
 * por tique. A rede nunca simula nada: o mestre só repassa entradas e
 * compara os hashes. Contrato do jogo (versão 2, primeira pessoa):
 * `docs/ponte-app-labirinto.md` do projeto do jogo. Cada jogador sai com uma
 * FERRAMENTA (`bolha`, `mangueira` ou `areia`), que o mestre sugere e o
 * jogador confirma no Pronto.
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
/** Uma entrada no fio: `[frente, lado, olhar, mx, my, acao, ferramenta]`, só inteiros (opaca: o app só repassa). */
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
  ferramenta: FerramentaFogo
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
  ferramenta: FerramentaFogo
}

/** Uma altura do fogo no fim: `viva` em %, o resto em células daquela altura. */
export interface FogoAlturaNoPlacar {
  viva: number
  inicial: number
  vivasNoFim: number
  queimadas: number
}

/** A linha de um jogador no placar do jogo: a ferramenta com que saiu, os pontos e o fogo que tirou das alturas que contam. */
export interface FogoPlacarDoJogador {
  id: string
  ferramenta: FerramentaFogo
  pontos: number
  /** 1000 = uma altura acesa inteira numa célula (GDD seção 3, "Pontos por jogador"). */
  fogoCerto: number
}

/** O placar do fim que o jogo manda (convertido para o app: só o que a mesa lê). */
export interface FogoPlacar {
  vitoria: boolean
  /** `apagado`, `tempo` ou `vila` hoje; texto livre para não recusar um motivo novo do jogo. */
  motivo: string
  /** Do JOGO: `solo` quando a partida teve 1 jogador (só a altura da ferramenta dele contou). */
  modo: ModoFogo
  /** As alturas que contaram: as 3 na equipe, só a da ferramenta principal no solo. */
  contam: AlturaFogo[]
  pontos: number
  estrelas: number
  florestaViva: number
  alturas: Record<AlturaFogo, FogoAlturaNoPlacar>
  casas: number
  tempoS: number
  porJogador: FogoPlacarDoJogador[]
}

/** O placar do time, sem as linhas de cada jogador (o desfecho leva as linhas na mesa). */
export type FogoResumoDoPlacar = Omit<FogoPlacar, 'porJogador'>

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
  /**
   * SOZINHO NO PINO: a volta do "Apagar o fogo" deste jogador (`fogo.pedir`).
   * Ninguém espera o mestre: o Pronto já leva a dificuldade e começa. Diz a
   * dificuldade que o mestre deixou (`escolha` = o jogador escolhe). Ausente =
   * convite do mestre, como sempre.
   */
  sozinho?: { permitida: 'escolha' | DificuldadeFogo }
}

/** Por que o "Apagar o fogo" não abriu: ficha longe, outro incêndio aceso nesta sala, ou o pino não vale. */
export type FogoMotivoDaRecusa = 'longe' | 'ocupado' | 'indisponivel'
export const FOGO_MOTIVOS_DA_RECUSA: readonly FogoMotivoDaRecusa[] = ['longe', 'ocupado', 'indisponivel']

/** A recusa do `fogo.pedir`: sem sessão (nenhuma começou), só o pino e o motivo curto. */
export interface FogoRecusadoMessage {
  type: 'fogo.recusado'
  pinId: string
  motivo: FogoMotivoDaRecusa
}

/** O jogador tocou em "Apagar o fogo" no cartão do pino: pede um incêndio só dele. */
export interface FogoPedirMessage {
  type: 'fogo.pedir'
  pinId: string
}

export interface FogoEstadoMessage {
  type: 'fogo.estado'
  sessao: string
  fase: FogoFaseNoFio
  participantes: { playerId: string; status: FogoStatus; ferramenta: FerramentaFogo }[]
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
  ferramenta: FerramentaFogo
  pontos: number
  /** O `fogoCerto` do placar dele (0 para quem saiu antes do fim). */
  fogoCerto: number
  resultado: FogoResultado
}

export interface FogoDesfechoMessage {
  type: 'fogo.desfecho'
  sessao: string
  modo: ModoFogo
  /** O placar da equipe (no solo, o do próprio jogador); ausente = ninguém terminou. */
  placar?: FogoResumoDoPlacar
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
  | FogoRecusadoMessage

/** O que o host manda DENTRO de uma sessão (a recusa vem antes de haver uma). */
export type FogoDaSessaoMessage = Exclude<FogoHostMessage, FogoRecusadoMessage>

export interface FogoProntoMessage {
  type: 'fogo.pronto'
  sessao: string
  ferramenta: FerramentaFogo
  /** Só no convite `sozinho`: a dificuldade escolhida (o host confere com a que o mestre deixou). */
  dificuldade?: DificuldadeFogo
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

export type FogoPlayerMessage = FogoPedirMessage | FogoProntoMessage | FogoEntradasMessage | FogoHashMessage | FogoFimMessage | FogoDesistirMessage

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

function lerAltura(value: unknown): FogoAlturaNoPlacar | null {
  if (!isRecord(value)) return null
  const { viva, inicial, vivasNoFim, queimadas } = value
  if (!inteiroEntre(viva, 0, 100) || !contagem(inicial) || !contagem(vivasNoFim) || !contagem(queimadas)) return null
  return { viva, inicial, vivasNoFim, queimadas }
}

/** As 3 alturas, sempre todas (o jogo manda as 3 mesmo no solo, em que só uma conta). */
function lerAlturas(value: unknown): Record<AlturaFogo, FogoAlturaNoPlacar> | null {
  if (!isRecord(value)) return null
  const rasteiro = lerAltura(value.rasteiro)
  const tronco = lerAltura(value.tronco)
  const copa = lerAltura(value.copa)
  return rasteiro === null || tronco === null || copa === null ? null : { rasteiro, tronco, copa }
}

const lerAlturaQueConta = (item: unknown): AlturaFogo | null => umDaLista(ALTURAS_FOGO, item) ?? null

function lerResumoDoPlacar(value: unknown): FogoResumoDoPlacar | null {
  if (!isRecord(value)) return null
  const { vitoria, motivo, pontos, estrelas, florestaViva, casas, tempoS } = value
  const modo = umDaLista(MODOS_FOGO, value.modo)
  const contam = listaDe(value.contam, ALTURAS_FOGO.length, lerAlturaQueConta, 1)
  const alturas = lerAlturas(value.alturas)
  if (typeof vitoria !== 'boolean' || !textoEntre(motivo, 0, MOTIVO_MAX) || !contagem(pontos) || !inteiroEntre(estrelas, 0, 10)) return null
  if (!inteiroEntre(florestaViva, 0, 100) || !contagem(casas) || !inteiroEntre(tempoS, 0, FOGO_TIQUE_MAX)) return null
  if (modo === undefined || contam === null || alturas === null) return null
  return { vitoria, motivo, modo, contam, pontos, estrelas, florestaViva, alturas, casas, tempoS }
}

function lerPlacarDoJogador(item: unknown): FogoPlacarDoJogador | null {
  if (!isRecord(item)) return null
  const ferramenta = umDaLista(FERRAMENTAS_FOGO, item.ferramenta)
  if (ferramenta === undefined || !idValido(item.id) || !contagem(item.pontos) || !contagem(item.fogoCerto)) return null
  return { id: item.id, ferramenta, pontos: item.pontos, fogoCerto: item.fogoCerto }
}

/** O placar no formato do APP (camelCase). O do jogo (snake_case) é convertido por `placarDoJogo`. */
function lerPlacar(value: unknown): FogoPlacar | null {
  const resumo = lerResumoDoPlacar(value)
  if (resumo === null || !isRecord(value)) return null
  const porJogador = listaDe(value.porJogador, FOGO_EQUIPE_MAX, lerPlacarDoJogador, 1)
  return porJogador === null ? null : { ...resumo, porJogador }
}

/** Uma altura como o jogo manda (`vivas_no_fim`), no formato do app. */
const alturaDoJogo = (value: unknown): unknown =>
  isRecord(value) ? { viva: value.viva, inicial: value.inicial, vivasNoFim: value.vivas_no_fim, queimadas: value.queimadas } : null

/**
 * O placar como o JOGO manda (`fim.placar`, snake_case, seção 6 do GDD,
 * versão 2), convertido para o do app. `null` = torto. Os campos que a mesa
 * não lê (`apagou`, `agua_usada`, `bolhas_usadas`, `areia_usada`, `desmaios`)
 * ficam. A ferramenta da linha é a INICIAL (a que a mesa escolheu): a final
 * é só onde ele estava quando acabou.
 */
export function placarDoJogo(value: unknown): FogoPlacar | null {
  if (!isRecord(value)) return null
  const porJogador = Array.isArray(value.por_jogador)
    ? value.por_jogador.map((item: unknown) =>
        isRecord(item) ? { id: item.id, ferramenta: item.ferramenta_inicial ?? item.ferramenta, pontos: item.pontos, fogoCerto: item.fogo_certo } : null,
      )
    : null
  const alturas = isRecord(value.alturas)
    ? { rasteiro: alturaDoJogo(value.alturas.rasteiro), tronco: alturaDoJogo(value.alturas.tronco), copa: alturaDoJogo(value.alturas.copa) }
    : null
  return lerPlacar({
    vitoria: value.vitoria,
    motivo: value.motivo,
    modo: value.modo,
    contam: value.contam,
    pontos: value.pontos,
    estrelas: value.estrelas,
    florestaViva: value.floresta_viva,
    alturas,
    casas: value.casas,
    tempoS: value.tempo_s,
    porJogador,
  })
}

/** Do jogador, no host. Qualquer campo torto recusa a mensagem inteira. */
export function parseFogoPlayerMessage(value: unknown): FogoPlayerMessage | null {
  if (!isRecord(value)) return null
  // O pedido vem antes de haver sessão.
  if (value.type === 'fogo.pedir') return idValido(value.pinId) ? { type: 'fogo.pedir', pinId: value.pinId } : null
  const { sessao } = value
  if (!sessaoValida(sessao)) return null
  switch (value.type) {
    case 'fogo.pronto': {
      const ferramenta = umDaLista(FERRAMENTAS_FOGO, value.ferramenta)
      if (ferramenta === undefined) return null
      if (value.dificuldade === undefined) return { type: 'fogo.pronto', sessao, ferramenta }
      const dificuldade = umDaLista(DIFICULDADES_FOGO, value.dificuldade)
      return dificuldade === undefined ? null : { type: 'fogo.pronto', sessao, ferramenta, dificuldade }
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
  const ferramenta = umDaLista(FERRAMENTAS_FOGO, value.ferramenta)
  if (!idValido(value.playerId) || !textoEntre(value.nome, 1, FOGO_NOME_MAX) || ferramenta === undefined) return null
  return { playerId: value.playerId, nome: value.nome, ferramenta }
}

function lerJogadorDaPartida(value: unknown): FogoJogadorDaPartida | null {
  if (!isRecord(value)) return null
  const ferramenta = umDaLista(FERRAMENTAS_FOGO, value.ferramenta)
  if (!idValido(value.id) || !textoEntre(value.nome, 0, FOGO_NOME_MAX) || ferramenta === undefined) return null
  return { id: value.id, nome: value.nome, ferramenta }
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
  if (base === null || !isRecord(value) || !contagem(value.pontos) || !contagem(value.fogoCerto) || resultado === undefined) return null
  return { ...base, pontos: value.pontos, fogoCerto: value.fogoCerto, resultado }
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
  if (!isRecord(value)) return null
  // A recusa do pedido vem antes de haver sessão.
  if (value.type === 'fogo.recusado') {
    const motivo = umDaLista(FOGO_MOTIVOS_DA_RECUSA, value.motivo)
    return idValido(value.pinId) && motivo !== undefined ? { type: 'fogo.recusado', pinId: value.pinId, motivo } : null
  }
  if (!sessaoValida(value.sessao)) return null
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
      const convite: FogoConviteMessage = { type: 'fogo.convite', sessao, pinId, npc, fala, floresta, modo, premio, consequencia, participantes }
      if (value.sozinho !== undefined) {
        const permitida = isRecord(value.sozinho) ? (value.sozinho.permitida === 'escolha' ? 'escolha' : umDaLista(DIFICULDADES_FOGO, value.sozinho.permitida)) : undefined
        if (permitida === undefined) return null
        convite.sozinho = { permitida }
      }
      return convite
    }
    case 'fogo.estado': {
      const fase = umDaLista(FASES_NO_FIO, value.fase)
      const participantes = listaDe(value.participantes, FOGO_PARTICIPANTES_MAX, (item) => {
        const status = isRecord(item) ? umDaLista(FOGO_STATUS, item.status) : undefined
        const ferramenta = isRecord(item) ? umDaLista(FERRAMENTAS_FOGO, item.ferramenta) : undefined
        return status === undefined || ferramenta === undefined || !isRecord(item) || !idValido(item.playerId) ? null : { playerId: item.playerId, status, ferramenta }
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

import { ID_DA_BATALHA_MAX, parseBatalhaAjustar, RODADA_MAX } from '../../net/protocoloDaBatalha'
import type { VezEsperada } from '../batalha/ponte'
import type { LinhaParaJogador } from '../batalha/registro'
import { lerRegrasDaBatalha } from '../batalha/regrasDoCampo'
import { segmentoValido } from '../nuvem/caminho'
import { ehRegistro, proprio } from '../nuvem/json'
import type { PedidoDoArbitro } from './arbitroDaLuta'
import { dueloParaOFio, jogadaDoValor, type DueloGravado, type FimDoDuelo, type JogadaDoDuelo } from './duelo'
import { CONTAS_POR_LUTA_MAX, type EstadoDaLuta, type FimDaLutaV4, type ModoDaLuta, type MotivoDaRecusaNaLuta, type PapelNaLuta } from './luta'
import { LADOS_DA_LUTA, VAGAS_POR_LADO_MAX, type LadoDaLuta, type LutadoresDaLuta } from './mesaEmMemoria'
import { lutaParaOFio, type LutaDaConta } from './vistaDaLuta'

/**
 * A LUTA DO LOBBY (Arena multijogador, fatia F4 de
 * docs/planos/arena-multijogador-2026-11-07.md §2 e §6): o protocolo `luta.*`
 * que o DO Campanha fala com o site pela MESMA conexão WebSocket das fichas.
 * A regra é a do motor v4 (`luta.ts`, `arbitroDaLuta.ts`); o SQLite, a sala
 * de espera, os prazos, o histórico e a difusão ficam no DO
 * (`lobby/nuvem/src/luta.ts`). O site (F5) usa os mesmos tipos.
 *
 * Fica fora de `lib/nuvem` pelo mesmo motivo do `dueloDoLobby.ts`: a regra da
 * luta puxa a store da batalha, e a guarda de pureza do núcleo não deixa.
 *
 * O fluxo: quem cria (`luta.criar`) diz o modo, os lados e cada conta com o
 * papel e o lado dela (ele mesmo também, com as fichas dele); cada convidado
 * aceita com as fichas dele (`luta.aceitar`) ou recusa; com 2 lados ou mais
 * com ficha, quem criou começa (`luta.comecar`). A sala de espera vale
 * `ESPERA_DA_LUTA_MS`. Depois: `luta.jogar`, `luta.arbitrar` (só o árbitro),
 * `luta.sair`; qualquer membro assiste (`luta.assistir`/`luta.parar`) e lê o
 * histórico (`luta.historico`). Cada conta recebe o `luta.estado` do papel
 * dela (`lutaParaTodos`). O site velho, que não conhece `luta.*`, nunca recebe
 * nada daqui: só o socket que já mandou algum `luta.*` (o site novo manda
 * `luta.lista` depois do `ola`) entra na difusão.
 */

/** A sala de espera que ninguém começou some depois disto. */
export const ESPERA_DA_LUTA_MS = 5 * 60_000

/** A luta acabada fica para quem lutou ver o fim ao voltar; o resumo fica no histórico. */
export const LUTA_ACABADA_FICA_MS = 60 * 60_000

/** O histórico guarda as últimas lutas da campanha (as mais velhas saem). */
export const HISTORICO_DE_LUTAS_MAX = 100

/** Uma página do `luta.historico`, no máximo. */
export const PAGINA_DO_HISTORICO_MAX = 20

const PAPEIS: readonly PapelNaLuta[] = ['jogador', 'juiz', 'arbitro', 'espectador']

/** Uma conta como os outros a veem na luta: nunca o e-mail (§6.4). */
export interface ContaNaLuta {
  contaId: string
  nome: string
}

/** O convite de uma conta: o papel e o lado (`null` para quem arbitra ou assiste). */
export interface ConvidadoDaLuta {
  contaId: string
  papel: PapelNaLuta
  lado: LadoDaLuta | null
}

export type PedidoDaLuta =
  /**
   * `convidados` = todas as contas, inclusive quem cria. `fichas` (e
   * `ajustes`, só do mestre como Judge) = o aceite de quem cria, que já
   * entra aceito.
   */
  | { t: 'luta.criar'; modo: ModoDaLuta; lados: LadoDaLuta[]; convidados: ConvidadoDaLuta[]; fichas: string[]; ajustes?: Record<string, unknown> }
  /** `lado` null = fica o do convite (no time, a conta pode trocar de time; em todos contra todos, não). */
  | { t: 'luta.aceitar'; id: string; lado: LadoDaLuta | null; fichas: string[]; ajustes?: Record<string, unknown> }
  /** O convidado recusa; quem criou desiste da sala inteira. */
  | { t: 'luta.recusar'; id: string }
  | { t: 'luta.comecar'; id: string }
  /** A jogada do motor (a do duelo), com o `seq` do último estado; dano e custo do pedido já chegam `null` (`jogadaDoValor`). */
  | { t: 'luta.jogar'; id: string; jogada: JogadaDoDuelo }
  | { t: 'luta.arbitrar'; id: string; pedido: PedidoDoArbitro }
  /** Quem está na luta sai: as fichas dele saem da ordem e a luta segue. */
  | { t: 'luta.sair'; id: string }
  | { t: 'luta.assistir'; id: string }
  | { t: 'luta.parar'; id: string }
  /** As salas de espera da conta e as lutas acontecendo agora; depois, o `luta.estado` das lutas dela. */
  | { t: 'luta.lista' }
  /** Uma página do histórico, das mais novas para as mais velhas (`antesDe` = o `fim` da última que o site tem); com `id`, só ela, com o registro. */
  | { t: 'luta.historico'; antesDe: number | null; limite: number; id?: string }

export type TipoDoPedidoDaLuta = PedidoDaLuta['t']

/**
 * `formato` = pedido torto (violação, §6.5); `nao-existe` = luta que não
 * existe (ou não é desta conta), ou convidado que não é membro ativo;
 * `ocupado` = alguém já está noutra luta; `fichas` = ficha que não é da conta
 * (ou do treino, no Judge), não está na mesa ou passa do teto; `sistema` = a
 * campanha não é do motor do One Piece; `papel` = papel ou lado que não
 * combina (Judge e árbitro são só do mestre, e um dos dois por luta); `lados`
 * = menos de 2 lados com ficha, lado repetido ou fora da lista; `cheia` =
 * mais de `CONTAS_POR_LUTA_MAX` contas; `so-criador` = só quem criou começa;
 * `ritmo`/`cota` = espere `tentarDepoisDe`. O resto vem do motor.
 */
export type MotivoDaLutaRecusada = 'formato' | 'nao-existe' | 'ocupado' | 'fichas' | 'sistema' | 'papel' | 'lados' | 'cheia' | 'so-criador' | 'ritmo' | 'cota' | MotivoDaRecusaNaLuta

/**
 * Como a sala de espera acabou para quem recebe: `desistiu` = quem criou
 * desistiu; `expirou` = ninguém começou a tempo; `recusou` = você recusou ou
 * saiu; `semVoce` = a luta começou sem o seu aceite (ou com as suas fichas
 * que já não servem).
 */
export type FimDaEspera = 'desistiu' | 'expirou' | 'recusou' | 'semVoce'

/** Uma conta na sala de espera, como todos da sala a veem. */
export interface VagaNaEspera extends ContaNaLuta {
  papel: PapelNaLuta
  lado: LadoDaLuta | null
  aceitou: boolean
  /** As fichas que ela escolheu (ids; o site acha o nome no `estado`). Vazia até aceitar. */
  fichas: string[]
}

export interface EsperaDaLuta {
  id: string
  criador: ContaNaLuta
  modo: ModoDaLuta
  lados: LadoDaLuta[]
  contas: VagaNaEspera[]
  criadoEm: number
  venceEm: number
}

/** Um lado e as contas dele. */
export interface LadoComContas {
  lado: LadoDaLuta
  contas: ContaNaLuta[]
}

/** Uma luta acontecendo agora, para a lista "Lutas acontecendo agora" (§6): sem estado, só o bastante para escolher qual assistir. */
export interface LutaAcontecendo {
  id: string
  modo: ModoDaLuta
  lados: LadoComContas[]
  rodada: number
  /** Quantas contas assistem. */
  assistindo: number
  /** Quantas contas ainda cabem (`CONTAS_POR_LUTA_MAX` menos as de agora). */
  vagas: number
  pausada: boolean
}

/** Um lado no histórico: as contas e os nomes das fichas que lutaram. */
export interface LadoNoHistorico extends LadoComContas {
  fichas: string[]
}

/**
 * Uma luta acabada (§6): a vista pública, sem combate nem segredo. `modo`
 * `duelo` = o duelo 1x1. `motivo` = o tipo do fim (vitória, todos caídos,
 * tempo, árbitro; no duelo também ausência e desistência). `registro` = o
 * final como o espectador o vê, só no pedido com `id`.
 */
export interface LutaNoHistorico {
  id: string
  fim: number
  modo: ModoDaLuta | 'duelo'
  lados: LadoNoHistorico[]
  vencedor: LadoDaLuta | null
  motivo: FimDaLutaV4['tipo'] | FimDoDuelo['tipo']
  rodadas: number
  registro?: readonly LinhaParaJogador[]
}

export type MensagemDaLutaDoServidor =
  /** A todas as contas da sala de espera: a sala nova ou mudada (alguém aceitou, recusou ou trocou de time). */
  | { t: 'luta.espera'; espera: EsperaDaLuta }
  /** A quem a sala de espera acabou. */
  | { t: 'luta.fechada'; id: string; motivo: FimDaEspera }
  /** A cada conta da luta, a do papel dela (`lutaParaTodos`): começou, alguém jogou, saiu, voltou, o árbitro mexeu ou acabou. */
  | { t: 'luta.estado'; luta: LutaDaConta }
  /** Ao `luta.lista`, e a todos quando uma luta começa, acaba ou muda quem assiste: as salas de espera da conta e as lutas acontecendo. */
  | { t: 'luta.lista'; convites: EsperaDaLuta[]; acontecendo: LutaAcontecendo[] }
  | { t: 'luta.historico'; lista: LutaNoHistorico[]; temMais: boolean }
  | { t: 'luta.recusado'; pedido: TipoDoPedidoDaLuta | 'luta'; motivo: MotivoDaLutaRecusada; id?: string; tentarDepoisDe?: number }

/** O pedido lido; fora do formato, o tipo (se conhecido) e o `id` (se legível) para a resposta. */
export type LeituraDoPedidoDaLuta = { ok: true; pedido: PedidoDaLuta } | { ok: false; pedido: TipoDoPedidoDaLuta | 'luta'; id?: string }

const TIPOS_DO_PEDIDO: readonly TipoDoPedidoDaLuta[] = [
  'luta.criar',
  'luta.aceitar',
  'luta.recusar',
  'luta.comecar',
  'luta.jogar',
  'luta.arbitrar',
  'luta.sair',
  'luta.assistir',
  'luta.parar',
  'luta.lista',
  'luta.historico',
]

function tipoDoPedido(valor: unknown): TipoDoPedidoDaLuta | null {
  return TIPOS_DO_PEDIDO.find((tipo) => tipo === valor) ?? null
}

export function ehLadoDaLuta(valor: unknown): valor is LadoDaLuta {
  return LADOS_DA_LUTA.some((lado) => lado === valor)
}

function ehPapel(valor: unknown): valor is PapelNaLuta {
  return PAPEIS.some((papel) => papel === valor)
}

function ehModo(valor: unknown): valor is ModoDaLuta {
  return valor === 'times' || valor === 'todos'
}

/** Inteiro de 0 em diante (`seq`, a hora do histórico). */
function contagem(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

/** De 0 a `VAGAS_POR_LADO_MAX` ids válidos (quem arbitra ou assiste manda a lista vazia); senão `null`. */
function lerFichas(valor: unknown): string[] | null {
  if (!Array.isArray(valor) || valor.length > VAGAS_POR_LADO_MAX) return null
  const fichas: string[] = []
  for (const id of valor) {
    if (!segmentoValido(id)) return null
    fichas.push(id)
  }
  return fichas
}

/** Os ajustes do Judge: ausente fica ausente; presente, um registro (o DO os lê com o sistema, `validarAjustesDoJuiz`). */
function lerAjustes(valor: unknown): { ok: true; ajustes?: Record<string, unknown> } | { ok: false } {
  if (valor === undefined) return { ok: true }
  return ehRegistro(valor) ? { ok: true, ajustes: valor } : { ok: false }
}

/** De 2 a 12 lados distintos. */
function lerLados(valor: unknown): LadoDaLuta[] | null {
  if (!Array.isArray(valor) || valor.length < 2 || valor.length > LADOS_DA_LUTA.length) return null
  const lados: LadoDaLuta[] = []
  for (const lado of valor) {
    if (!ehLadoDaLuta(lado) || lados.includes(lado)) return null
    lados.push(lado)
  }
  return lados
}

function lerConvidado(valor: unknown): ConvidadoDaLuta | null {
  if (!ehRegistro(valor)) return null
  const contaId = proprio(valor, 'contaId')
  const papel = proprio(valor, 'papel')
  const lado = proprio(valor, 'lado')
  if (!segmentoValido(contaId) || !ehPapel(papel) || (lado !== null && !ehLadoDaLuta(lado))) return null
  return { contaId, papel, lado }
}

/** De 1 a `CONTAS_POR_LUTA_MAX` + 1 convidados: a 13ª conta passa na leitura para a recusa dizer `cheia`, não `formato`. */
function lerConvidados(valor: unknown): ConvidadoDaLuta[] | null {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > CONTAS_POR_LUTA_MAX + 1) return null
  const convidados: ConvidadoDaLuta[] = []
  for (const bruto of valor) {
    const convidado = lerConvidado(bruto)
    if (convidado === null) return null
    convidados.push(convidado)
  }
  return convidados
}

function lerVez(valor: unknown): VezEsperada | null {
  if (!ehRegistro(valor)) return null
  const cartaId = proprio(valor, 'cartaId')
  const rodada = proprio(valor, 'rodada')
  if (typeof cartaId !== 'string' || cartaId.length === 0 || cartaId.length > ID_DA_BATALHA_MAX) return null
  if (typeof rodada !== 'number' || !Number.isSafeInteger(rodada) || rodada < 1 || rodada > RODADA_MAX) return null
  return { cartaId, rodada }
}

/** O pedido do árbitro (`arbitroDaLuta.ts`); `null` = torto. O "Ajustar..." passa pelo mesmo leitor da batalha da mesa. */
export function lerPedidoDoArbitro(valor: unknown): PedidoDoArbitro | null {
  if (!ehRegistro(valor)) return null
  const seq = proprio(valor, 'seq')
  if (!contagem(seq)) return null
  switch (proprio(valor, 'tipo')) {
    case 'desfazer':
      return { tipo: 'desfazer', seq }
    case 'pausar':
      return { tipo: 'pausar', seq }
    case 'retomar':
      return { tipo: 'retomar', seq }
    case 'encerrar': {
      const vencedor = proprio(valor, 'vencedor')
      return vencedor === null || ehLadoDaLuta(vencedor) ? { tipo: 'encerrar', seq, vencedor } : null
    }
    case 'passarVez': {
      const vez = lerVez(proprio(valor, 'vez'))
      return vez === null ? null : { tipo: 'passarVez', seq, vez }
    }
    case 'regras': {
      const bruto = proprio(valor, 'regras')
      if (bruto === null) return { tipo: 'regras', seq, regras: null }
      const regras = lerRegrasDaBatalha(bruto)
      return regras === null ? null : { tipo: 'regras', seq, regras }
    }
    case 'ajustar': {
      // O envelope é só para o leitor da mesa: o `reqId` não vai a lugar nenhum.
      const lido = parseBatalhaAjustar({ type: 'batalha.ajustar', reqId: 'arbitro', pedido: proprio(valor, 'pedido') })
      return lido === null ? null : { tipo: 'ajustar', seq, pedido: lido.pedido }
    }
    default:
      return null
  }
}

/** O `antesDe` do histórico: ausente ou `null` = do começo; senão a hora (ms). `undefined` = torto. */
function lerAntesDe(valor: unknown): number | null | undefined {
  if (valor === undefined || valor === null) return null
  return contagem(valor) ? valor : undefined
}

/** O `limite` do histórico: ausente = a página cheia; acima do teto, o teto. `null` = torto. */
function lerLimite(valor: unknown): number | null {
  if (valor === undefined) return PAGINA_DO_HISTORICO_MAX
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 1 ? Math.min(valor, PAGINA_DO_HISTORICO_MAX) : null
}

function lerHistorico(registro: Record<string, unknown>): PedidoDaLuta | null {
  const antesDe = lerAntesDe(proprio(registro, 'antesDe'))
  const limite = lerLimite(proprio(registro, 'limite'))
  const id = proprio(registro, 'id')
  if (antesDe === undefined || limite === null) return null
  if (id === undefined) return { t: 'luta.historico', antesDe, limite }
  return segmentoValido(id) ? { t: 'luta.historico', antesDe, limite, id } : null
}

function lerCriar(registro: Record<string, unknown>): PedidoDaLuta | null {
  const modo = proprio(registro, 'modo')
  const lados = lerLados(proprio(registro, 'lados'))
  const convidados = lerConvidados(proprio(registro, 'convidados'))
  const fichas = lerFichas(proprio(registro, 'fichas'))
  const ajustes = lerAjustes(proprio(registro, 'ajustes'))
  if (!ehModo(modo) || lados === null || convidados === null || fichas === null || !ajustes.ok) return null
  return { t: 'luta.criar', modo, lados, convidados, fichas, ...(ajustes.ajustes === undefined ? {} : { ajustes: ajustes.ajustes }) }
}

function pedidoComId(tipo: Exclude<TipoDoPedidoDaLuta, 'luta.criar' | 'luta.lista' | 'luta.historico'>, id: string, registro: Record<string, unknown>): PedidoDaLuta | null {
  switch (tipo) {
    case 'luta.aceitar': {
      const bruto = proprio(registro, 'lado')
      const lado = bruto === undefined || bruto === null ? null : ehLadoDaLuta(bruto) ? bruto : undefined
      const fichas = lerFichas(proprio(registro, 'fichas'))
      const ajustes = lerAjustes(proprio(registro, 'ajustes'))
      if (lado === undefined || fichas === null || !ajustes.ok) return null
      return { t: tipo, id, lado, fichas, ...(ajustes.ajustes === undefined ? {} : { ajustes: ajustes.ajustes }) }
    }
    case 'luta.jogar': {
      const jogada = jogadaDoValor(proprio(registro, 'jogada'))
      return jogada === null ? null : { t: tipo, id, jogada }
    }
    case 'luta.arbitrar': {
      const pedido = lerPedidoDoArbitro(proprio(registro, 'pedido'))
      return pedido === null ? null : { t: tipo, id, pedido }
    }
    case 'luta.recusar':
    case 'luta.comecar':
    case 'luta.sair':
    case 'luta.assistir':
    case 'luta.parar':
      return { t: tipo, id }
  }
}

function pedidoDoRegistro(tipo: TipoDoPedidoDaLuta, registro: Record<string, unknown>): PedidoDaLuta | null {
  if (tipo === 'luta.criar') return lerCriar(registro)
  if (tipo === 'luta.lista') return { t: tipo }
  if (tipo === 'luta.historico') return lerHistorico(registro)
  const id = proprio(registro, 'id')
  return segmentoValido(id) ? pedidoComId(tipo, id, registro) : null
}

/** Um frame `luta.*` do site. Fora do formato não lança: devolve o que dá para responder. */
export function lerPedidoDaLuta(registro: Record<string, unknown>): LeituraDoPedidoDaLuta {
  const tipo = tipoDoPedido(proprio(registro, 't'))
  if (tipo === null) return { ok: false, pedido: 'luta' }
  const pedido = pedidoDoRegistro(tipo, registro)
  if (pedido !== null) return { ok: true, pedido }
  const id = proprio(registro, 'id')
  return segmentoValido(id) ? { ok: false, pedido: tipo, id } : { ok: false, pedido: tipo }
}

// ── O resumo do histórico (§6), puro ─────────────────────────────────────────

/** Os lados na ordem das letras, com as contas e os nomes das fichas de cada um. */
function ladosNoHistorico(lutadores: LutadoresDaLuta, contasDoLado: (lado: LadoDaLuta) => ContaNaLuta[]): LadoNoHistorico[] {
  const nomes = new Map(lutadores.personagens.map((personagem) => [personagem.id, personagem.nome]))
  return LADOS_DA_LUTA.flatMap((lado) => {
    const vagas = lutadores.vagas.filter((vaga) => vaga.lado === lado)
    if (vagas.length === 0) return []
    return [{ lado, contas: contasDoLado(lado), fichas: vagas.map((vaga) => nomes.get(vaga.personagemId) ?? vaga.personagemId) }]
  })
}

function vencedorDoFim(fim: FimDaLutaV4 | FimDoDuelo): LadoDaLuta | null {
  switch (fim.tipo) {
    case 'vitoria':
    case 'desistencia':
    case 'arbitro':
    case 'ausencia':
      return fim.vencedor
    case 'todosCaidos':
    case 'tempo':
      return null
  }
}

/**
 * O resumo da luta acabada para o histórico; `null` = ainda não acabou. As
 * contas de cada lado são as que jogaram por ele (o mestre como Judge também);
 * o registro é o final como o espectador o vê (`lutaParaOFio`: as cópias
 * projetadas, a cauda do registro, sem a reversão).
 */
export function resumoDaLuta(luta: EstadoDaLuta, quando: number): LutaNoHistorico | null {
  if (luta.fim === null) return null
  const contasDoLado = (lado: LadoDaLuta): ContaNaLuta[] => luta.participantes.filter((participante) => participante.lado === lado).map(({ contaId, nome }) => ({ contaId, nome }))
  return {
    id: luta.id,
    fim: quando,
    modo: luta.modo,
    lados: ladosNoHistorico(luta.lutadores, contasDoLado),
    vencedor: vencedorDoFim(luta.fim),
    motivo: luta.fim.tipo,
    rodadas: luta.cena.turnos.rodada,
    registro: lutaParaOFio(luta).registro,
  }
}

/** O resumo do duelo 1x1 acabado, na mesma forma (modo `duelo`); `null` = ainda não acabou. */
export function resumoDoDuelo(duelo: DueloGravado, quando: number): LutaNoHistorico | null {
  if (duelo.fim === null) return null
  const { jogadores } = duelo
  const contasDoLado = (lado: LadoDaLuta): ContaNaLuta[] => {
    if (lado !== 'a' && lado !== 'b') return []
    const { contaId, nome } = jogadores[lado]
    return [{ contaId, nome }]
  }
  return {
    id: duelo.id,
    fim: quando,
    modo: 'duelo',
    lados: ladosNoHistorico(duelo.lutadores, contasDoLado),
    vencedor: vencedorDoFim(duelo.fim),
    motivo: duelo.fim.tipo,
    rodadas: duelo.cena.turnos.rodada,
    registro: dueloParaOFio(duelo).registro,
  }
}

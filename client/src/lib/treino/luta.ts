import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from '../../stores/batalhaFabrica'
import { GRADES_DA_ARENA, type GradeDaArena, type TamanhoDaGrade } from '../arena/grade'
import { reacaoDoBoneco } from '../arena/reacaoDoBoneco'
import { chaveDaVez } from '../batalha/combate'
import type { MesaDaBatalha } from '../batalha/mesa'
import { bonusDaBatalha, bonusDaReacao } from '../batalha/selos'
import { cartaDaVez, combatentesIniciais, type AutorDaAcao } from '../batalha/turnos'
import { projetarParaTreino } from '../nuvem/projecao'
import type { Personagem } from '../personagem'
import { fimDaMesaDaJogada, jogarNaMesa, VOLTA_DO_AUSENTE_MS, type JogadaDoDuelo, type MotivoDaRecusa, type MotorDoDuelo, type QuemJoga, type RegraDoAndar } from './duelo'
import type { FimDaLuta } from './fimDaLuta'
import { fichaDoJuiz, juizNaoReage, type AjustesDoJuiz } from './juiz'
import { AUTOR_DO_ROBO, type GolpesDaVez } from './lutaAutomatica'
import {
  casasIniciais,
  criarMesaEmMemoria,
  fichaSemHpNaEscolha,
  LADOS_DA_LUTA,
  montarLutadoresDaLuta,
  soOsDoisLados,
  tamanhoDaLuta,
  type CasaDoTreino,
  type EscolhaDaVaga,
  type LadoDaLuta,
  type LutadoresDaLuta,
  type MesaDaLuta,
  type VagaDaLuta,
} from './mesaEmMemoria'
import { golpesDoRobo, marcaDoRobo } from './robo'

/**
 * A LUTA DE N LADOS, motor v4 (Arena multijogador, fatia F2 de
 * docs/planos/arena-multijogador-2026-11-07.md §2): várias contas, cada uma
 * com as fichas DELA, em TIMES (cada time é um lado) ou TODOS CONTRA TODOS
 * (cada conta é o próprio lado), sobre a MESMA regra da batalha One Piece do
 * app e a mesa em memória com as cópias. O duelo 1x1 de hoje (`duelo.ts`, v3)
 * é o atalho de 2 lados: a jogada passa pelo mesmo núcleo (`jogarNaMesa`),
 * com o dano, o custo e a ação refeitos pelo servidor, a recusa da Surpresa e
 * do dano à mão, o `seq` e a leitura de 64 KiB (`lerJogadaDoDuelo`).
 *
 * O que muda do duelo:
 *  - a vaga leva a conta (`VagaDaLuta.contaId`): no time, cada conta só joga a
 *    própria ficha (`naoEDaConta` na do colega);
 *  - quem não joga (o árbitro e o espectador) entra na luta sem lado e sem
 *    ficha: toda jogada dele é `naoJoga`;
 *  - a ausência não acaba a luta: a conta fora 3 min (`tirarAusentes`) ou que
 *    sai (`sairDaLuta`) tira as fichas dela da ordem (`tirarCombatente`) e a
 *    luta segue; o lado que fica sem ninguém cai no fim de sempre (`fimDaLuta`:
 *    vence o único lado com alguém de pé);
 *  - a grade: a média com mais de 2 lados ou mais de 6 fichas, as largadas
 *    pelo perímetro (`tamanhoDaLuta`, `casasIniciais`); na montagem cada um
 *    larga na zona do lado dele (a metade, com 2 lados).
 *
 * F3 (o mesmo dono, em sequência; plano §2 e §3). O mestre escolhe UM papel
 * por luta, Judge OU árbitro (a luta aceita no máximo um dos dois):
 *  - MESTRE COMO JUDGE (`papel: 'juiz'`): o lado dele leva o Judge, montado
 *    aqui pela função pura (`fichaDoJuiz`, com os ajustes que ele mandou no
 *    aceite), e os inimigos liberados para o treino; ele joga como quem joga.
 *    Fora 3 min, o robô assume as fichas dele (`ParticipanteDaLuta.robo`) e
 *    joga até a vez de gente; o mestre que volta retoma o Judge;
 *  - O ÁRBITRO: desfazer, ajustar, regras, passar a vez, pausar e encerrar
 *    moram em `arbitroDaLuta.ts`. Aqui só a pausa vale: jogada na pausa =
 *    `pausada`, e o relógio dos ausentes para. A pausa não fica presa: o
 *    árbitro que sai, ou que fica fora 3 min, a retoma (ninguém mais o faria).
 * A rede, a sala de espera e o relógio são do DO (F4).
 *
 * Sem Tauri, sem DOM.
 */

/** A versão do motor (coluna `versaoDoMotor` da tabela `lutas`): estado de outra versão não continua. */
export const VERSAO_DO_MOTOR_DA_LUTA = 4

/** Contas numa luta, somando quem joga, arbitra e assiste (plano §2). */
export const CONTAS_POR_LUTA_MAX = 12

/** A chave da cena nas lojas da luta (a loja é de uma chamada só; a chave não vai ao estado). */
export const CENA_DA_LUTA = 'luta'

/** Quem tira a reação de quem saiu da luta: o golpe que esperava por ele entra cheio. */
const AUTOR_DA_SAIDA: AutorDaAcao = { tipo: 'mestre' }

/** Passos do robô numa chamada, no máximo: a vez dele com as reações fica bem abaixo, e o teto de passos da luta segue valendo. */
const PASSOS_DO_ROBO_MAX = 64

export type ModoDaLuta = 'times' | 'todos'

export type PapelNaLuta = 'jogador' | 'juiz' | 'arbitro' | 'espectador'

/** O Judge do mestre como o servidor o monta no `luta.comecar` (plano §2: os ajustes chegam no aceite). */
export interface JudgeDoMestre {
  /** Os ajustes que o mestre mandou, já lidos (`validarAjustesDoJuiz`). */
  ajustes: AjustesDoJuiz
  /** O doc que `ajustes.baseFichaId` aponta, como a mesa o tem agora; `null` = o boneco (ou a base sumiu da mesa). */
  base: Personagem | null
}

/** Uma conta na luta como o servidor a monta no `luta.comecar`: as fichas são o DOC COMPLETO guardado (com o `dono`). */
export interface InscricaoNaLuta {
  contaId: string
  nome: string
  papel: PapelNaLuta
  /** O lado de quem joga (e do `juiz`); `null` para quem arbitra ou assiste. */
  lado: LadoDaLuta | null
  /**
   * Vazia para quem não joga. Do `juiz`: os inimigos que o mestre liberou para
   * o treino (o DO confere `visivel: 'treino'`), que podem faltar; entram pela
   * projeção do treino, sem os campos do mestre.
   */
  fichas: readonly Personagem[]
  /** Só do `juiz`: o Judge, que vai primeiro no lado dele. */
  juiz?: JudgeDoMestre
}

export interface AberturaDaLuta {
  id: string
  modo: ModoDaLuta
  inscricoes: readonly InscricaoNaLuta[]
}

/** Uma conta na luta. `ausenteDesde` = quando ficou sem nenhum socket (ms); `null` = está aqui. */
export interface ParticipanteDaLuta {
  contaId: string
  nome: string
  papel: PapelNaLuta
  lado: LadoDaLuta | null
  ausenteDesde: number | null
  /** F3: o robô joga as fichas desta conta (o mestre-Judge fora 3 min). Ausente = quem joga é a conta. */
  robo?: true
}

/** Como a luta acabou: o fim da regra (vitória, todos caídos, tempo) ou o árbitro que encerrou (`vencedor` null = empate). */
export type FimDaLutaV4 = FimDaLuta<LadoDaLuta> | { tipo: 'arbitro'; vencedor: LadoDaLuta | null }

/** Um marco do árbitro (plano §3): o `seq` do estado que ele abriu e quando (ms do servidor). */
export interface MarcoDaLuta {
  seq: number
  tipo: 'pausar' | 'retomar' | 'encerrar'
  quando: number
}

/** A luta guardada no servidor (coluna `estadoJson`), só dados: vai a JSON e volta igual. */
export interface EstadoDaLuta {
  versao: typeof VERSAO_DO_MOTOR_DA_LUTA
  id: string
  modo: ModoDaLuta
  participantes: readonly ParticipanteDaLuta[]
  lutadores: LutadoresDaLuta
  /** A grade da luta (`GRADES_DA_ARENA`): decidida na criação, não muda. */
  tamanho: TamanhoDaGrade
  /** Onde cada ficha está na grade, pelo id do token. */
  posicoes: Readonly<Record<string, CasaDoTreino>>
  /** `true` até a primeira jogada aceita que não é `montar`. */
  montagem: boolean
  cena: BatalhaDaCena
  /** Quantas mudanças foram aceitas (jogadas, saídas, a vez do robô e o que o árbitro fez). A jogada leva o `seq` do estado que viu. */
  seq: number
  /** Os passos do relógio da luta: uma jogada de agir, reagir ou passar, um passo (também a do robô). */
  passos: number
  fim: FimDaLutaV4 | null
  /** F3: o árbitro pausou: toda jogada volta `pausada`. Ausente = a luta corre. */
  pausada?: true
  /** F3: os marcos do árbitro, do mais velho ao mais novo. Ausente = nenhum. */
  marcos?: readonly MarcoDaLuta[]
  /** F3: os golpes que o robô já deu na vez de agora (o teto `GOLPES_POR_VEZ_MAX` entre uma chamada e outra). Ausente = nenhum. */
  golpesDoRobo?: GolpesDaVez
}

/** Por que a luta não começa. */
export type CriacaoDaLuta =
  | { ok: true; luta: EstadoDaLuta }
  /**
   * `cheia` = mais de `CONTAS_POR_LUTA_MAX` contas; `contaRepetida` = a mesma
   * conta duas vezes; `papel` = papel com lado, ficha ou Judge que não combina
   * (ou mais de um entre `juiz` e `arbitro`: o mestre é um só); `semFicha` =
   * quem joga sem ficha, ou com uma ficha de HP máximo 0 (F2, fatia A:
   * `fichaSemHpNaEscolha`); `ladoRepetido` = duas contas no mesmo lado em todos
   * contra todos.
   */
  | { ok: false; motivo: 'cheia' | 'contaRepetida' | 'papel' | 'semFicha' | 'ladoRepetido' }
  /** Alguma ficha da conta não é dela (o `dono` do doc completo). */
  | { ok: false; motivo: 'naoEDono'; contaId: string }
  /** Como em `montarLutadoresDaLuta`. */
  | { ok: false; motivo: 'poucosLados' | 'demais' }
  | { ok: false; motivo: 'vazio' | 'cheio'; lado: LadoDaLuta }

/** Por que a luta recusa: os motivos do duelo, a jogada na pausa (`pausada`) e o pedido de árbitro de quem não arbitra (`naoArbitra`). */
export type MotivoDaRecusaNaLuta = MotivoDaRecusa | 'pausada' | 'naoArbitra'

/** A recusa leva o `texto` da regra da batalha quando ela falou (`RecusaDaJogada` do duelo); ausente = a frase do código. */
export type ResultadoNaLuta = { ok: true; luta: EstadoDaLuta } | { ok: false; motivo: MotivoDaRecusaNaLuta; texto?: string }

type CriacaoRecusada = Exclude<CriacaoDaLuta, { ok: true }>

export function recusaNaLuta(motivo: MotivoDaRecusaNaLuta): { ok: false; motivo: MotivoDaRecusaNaLuta } {
  return { ok: false, motivo }
}

/** Marcos guardados por luta: passou, os mais velhos saem (pausar e retomar sem fim não incham o estado). */
export const MARCOS_MAX = 50

/** O marco do árbitro, com o `seq` novo (o estado que ele abre). */
export function comMarco(luta: EstadoDaLuta, tipo: MarcoDaLuta['tipo'], quando: number): EstadoDaLuta {
  const seq = luta.seq + 1
  return { ...luta, seq, marcos: [...(luta.marcos ?? []), { seq, tipo, quando }].slice(-MARCOS_MAX) }
}

/** A luta sem a pausa. `ausentesDeNovo`: quem segue fora conta os 3 min a partir de `agora` (na pausa o relógio dele parou). */
export function semPausa(luta: EstadoDaLuta, agora: number, ausentesDeNovo: boolean): EstadoDaLuta {
  const { pausada: _pausada, ...correndo } = luta
  if (!ausentesDeNovo) return correndo
  return { ...correndo, participantes: luta.participantes.map((participante) => (participante.ausenteDesde === null ? participante : { ...participante, ausenteDesde: agora })) }
}

function lojaDaLuta(mesa: MesaDaBatalha, motor: MotorDoDuelo): LojaDaBatalha {
  return criarBatalhaStore(mesa, { rolarD20: motor.rolarD20, outraBatalhaLigada: () => false })
}

function cenaDaLoja(loja: LojaDaBatalha): BatalhaDaCena {
  const cena = loja.getState().cenas[CENA_DA_LUTA]
  if (cena === undefined) throw new RangeError('a batalha da luta não está ligada')
  return cena
}

/** A luta numa loja nova, sobre CÓPIAS dos lutadores e da cena: o que a loja muda (ou recusa no meio) não toca a luta recebida. */
export interface LutaNaLoja {
  loja: LojaDaBatalha
  mesa: MesaDaLuta
  cena(): BatalhaDaCena
}

export function abrirNaLoja(luta: Pick<EstadoDaLuta, 'lutadores' | 'cena' | 'tamanho'>, motor: MotorDoDuelo): LutaNaLoja {
  const copia = structuredClone({ lutadores: luta.lutadores, cena: luta.cena })
  const mesa = criarMesaEmMemoria(motor.sistema, copia.lutadores, GRADES_DA_ARENA[luta.tamanho])
  const loja = lojaDaLuta(mesa, motor)
  // A cena volta inteira pela store (o `setState` do zustand), como em `jogarNaMesa`.
  loja.setState({ cenas: { [CENA_DA_LUTA]: copia.cena } })
  return { loja, mesa, cena: () => cenaDaLoja(loja) }
}

/** A conta na luta; `null` = ela não está nesta luta. */
export function participanteDaConta(luta: Pick<EstadoDaLuta, 'participantes'>, contaId: string): ParticipanteDaLuta | null {
  return luta.participantes.find((participante) => participante.contaId === contaId) ?? null
}

/** Quem tem lado e ficha na luta: quem joga e o mestre como Judge. */
function temLado(participante: ParticipanteDaLuta): boolean {
  return (participante.papel === 'jogador' || participante.papel === 'juiz') && participante.lado !== null
}

// ───────────────────────────────────────────────────────────────────────────
// Começar
// ───────────────────────────────────────────────────────────────────────────

const PAPEL_TORTO: CriacaoRecusada = { ok: false, motivo: 'papel' }

/** A inscrição torta, sem olhar as outras: o papel, o lado, o Judge e as fichas (de quem joga, todas da conta). */
function inscricaoTorta(inscricao: InscricaoNaLuta): CriacaoRecusada | null {
  const { papel, lado, fichas, contaId, juiz } = inscricao
  if ((papel === 'juiz') !== (juiz !== undefined)) return PAPEL_TORTO
  if (papel === 'arbitro' || papel === 'espectador') return lado === null && fichas.length === 0 ? null : PAPEL_TORTO
  if (lado === null || !LADOS_DA_LUTA.includes(lado)) return PAPEL_TORTO
  // O Judge é de ninguém e os inimigos são os liberados pelo mestre (o DO confere): sem a conferência do dono.
  if (juiz !== undefined) return juiz.base === null || juiz.base.id === juiz.ajustes.baseFichaId ? null : PAPEL_TORTO
  if (fichas.length === 0) return { ok: false, motivo: 'semFicha' }
  if (fichas.some((ficha) => ficha.dono !== contaId)) return { ok: false, motivo: 'naoEDono', contaId }
  return null
}

/** As fichas que a inscrição põe no lado: as dela, ou o Judge primeiro e os inimigos pela projeção do treino. */
function fichasDaInscricao(inscricao: InscricaoNaLuta, motor: MotorDoDuelo): readonly Personagem[] {
  const { juiz, fichas } = inscricao
  if (juiz === undefined) return fichas
  return [fichaDoJuiz(motor.sistema, juiz.ajustes, juiz.base), ...fichas.map(projetarParaTreino)]
}

/** A vaga do Judge que "fica parado" leva `reage: 'parado'`: o robô não rola o d20 por ela (como no treino). */
function comOsParados(lutadores: LutadoresDaLuta, inscricoes: readonly InscricaoNaLuta[]): LutadoresDaLuta {
  const parados = new Set(inscricoes.flatMap((inscricao) => (inscricao.juiz === undefined ? [] : juizNaoReage(inscricao.juiz.ajustes))))
  if (parados.size === 0) return lutadores
  return { ...lutadores, vagas: lutadores.vagas.map((vaga): VagaDaLuta => (parados.has(vaga.origem) ? { ...vaga, reage: 'parado' } : vaga)) }
}

/**
 * A luta nova (o `luta.comecar` do DO, com quem aceitou): confere as contas
 * (até 12, sem repetir), o papel de cada uma e que cada ficha é da conta dela;
 * em todos contra todos, cada conta num lado só dela. O mestre como Judge
 * leva o Judge montado aqui e os inimigos liberados. Monta as vagas e as
 * cópias (cada lado na ordem das letras, a conta em cada vaga), escolhe a
 * grade e liga a batalha como o duelo (a ordem pela Agilidade, o desempate no
 * d20 do motor, a vez na primeira carta). As fichas recebidas não mudam.
 */
export function criarLuta(abertura: AberturaDaLuta, motor: MotorDoDuelo): CriacaoDaLuta {
  const { inscricoes } = abertura
  if (inscricoes.length > CONTAS_POR_LUTA_MAX) return { ok: false, motivo: 'cheia' }
  const contas = new Set<string>()
  const ladosDeQuemJoga = new Set<LadoDaLuta>()
  const escolhas: EscolhaDaVaga<LadoDaLuta>[] = []
  let papelDoMestre = false
  for (const inscricao of inscricoes) {
    if (contas.has(inscricao.contaId)) return { ok: false, motivo: 'contaRepetida' }
    contas.add(inscricao.contaId)
    const torta = inscricaoTorta(inscricao)
    if (torta !== null) return torta
    if (inscricao.papel === 'juiz' || inscricao.papel === 'arbitro') {
      if (papelDoMestre) return PAPEL_TORTO
      papelDoMestre = true
    }
    const { lado, contaId } = inscricao
    if (lado === null) continue
    if (abertura.modo === 'todos' && ladosDeQuemJoga.has(lado)) return { ok: false, motivo: 'ladoRepetido' }
    ladosDeQuemJoga.add(lado)
    escolhas.push(...fichasDaInscricao(inscricao, motor).map((ficha) => ({ ficha, lado, contaId })))
  }
  // F2 (fatia A): ficha com HP máximo 0 fica de fora, com recusa, em vez de entrar na grade sem carta.
  // `semFicha` e não um motivo novo: o servidor do Lobby (lobby/nuvem/src/luta.ts) troca cada motivo num switch fechado.
  if (fichaSemHpNaEscolha(escolhas, motor.sistema) !== null) return { ok: false, motivo: 'semFicha' }
  const montagem = montarLutadoresDaLuta(escolhas)
  if (!montagem.ok) return montagem
  const tamanho = tamanhoDaLuta(montagem.lutadores.vagas)
  const mesa = criarMesaEmMemoria(motor.sistema, comOsParados(montagem.lutadores, inscricoes), GRADES_DA_ARENA[tamanho])
  const loja = lojaDaLuta(mesa, motor)
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA_DA_LUTA, {}, { combatentes, regras: null, desempate: 'd20' })
  const luta: EstadoDaLuta = {
    versao: VERSAO_DO_MOTOR_DA_LUTA,
    id: abertura.id,
    modo: abertura.modo,
    participantes: inscricoes.map(({ contaId, nome, papel, lado }) => ({ contaId, nome, papel, lado, ausenteDesde: null })),
    lutadores: mesa.lutadores(),
    tamanho,
    posicoes: Object.fromEntries(tokens.map((token) => [token.id, { col: token.col, row: token.row }])),
    montagem: true,
    cena: cenaDaLoja(loja),
    seq: 0,
    passos: 0,
    fim: null,
  }
  return { ok: true, luta: { ...luta, fim: fimDaMesaDaJogada(motor.sistema, luta) } }
}

// ───────────────────────────────────────────────────────────────────────────
// Jogar
// ───────────────────────────────────────────────────────────────────────────

/** A distância em casas (Chebyshev: a diagonal conta 1, como o passo da grade). */
function distancia(de: CasaDoTreino, para: CasaDoTreino): number {
  return Math.max(Math.abs(de.col - para.col), Math.abs(de.row - para.row))
}

/**
 * De que lado é a casa na montagem: com só os lados `a` e `b`, a metade dele
 * (como o duelo); com mais lados, o lado da largada mais perto (pelas casas de
 * `casasIniciais`, que não mudam na montagem). Empate entre lados = de ninguém.
 */
export function ladoDaZona(vagas: readonly VagaDaLuta[], grade: GradeDaArena, casa: CasaDoTreino): LadoDaLuta | null {
  if (soOsDoisLados(vagas)) return casa.col < Math.floor(grade.colunas / 2) ? 'a' : 'b'
  const largadas = casasIniciais(vagas, grade)
  const maisPerto = new Map<LadoDaLuta, number>()
  for (const vaga of vagas) {
    const largada = largadas.get(vaga.tokenId)
    if (largada === undefined) continue
    maisPerto.set(vaga.lado, Math.min(maisPerto.get(vaga.lado) ?? Number.POSITIVE_INFINITY, distancia(largada, casa)))
  }
  const menor = Math.min(...maisPerto.values())
  const [unico, ...outros] = [...maisPerto].filter(([, d]) => d === menor).map(([lado]) => lado)
  return unico !== undefined && outros.length === 0 ? unico : null
}

/**
 * Uma jogada da conta `contaId`. Confere, nesta ordem: a versão do motor, o
 * fim, a conta (só quem tem lado: o árbitro e o espectador = `naoJoga`), a
 * pausa do árbitro (`pausada`), o `seq`; o resto é o núcleo do duelo
 * (`jogarNaMesa`) com a ficha da PRÓPRIA conta (a do colega de time =
 * `naoEDaConta`; a que saiu da luta também) e a largada na zona do lado.
 * Aceita: o estado novo com `seq` + 1 e o fim conferido; se a vez que vem é
 * do robô (o mestre-Judge fora 3 min), ele joga em seguida, como outra
 * mudança (`seq` + 1 de novo). Recusada: o motivo, e a luta recebida fica
 * como estava.
 */
export function aplicarJogadaNaLuta(luta: EstadoDaLuta, motor: MotorDoDuelo, contaId: string, jogada: JogadaDoDuelo, regraDoAndar: RegraDoAndar = 'naVez'): ResultadoNaLuta {
  if (luta.versao !== VERSAO_DO_MOTOR_DA_LUTA) return recusaNaLuta('versao')
  if (luta.fim !== null) return recusaNaLuta('acabou')
  const eu = participanteDaConta(luta, contaId)
  if (eu === null || !temLado(eu) || eu.lado === null) return recusaNaLuta('naoJoga')
  if (luta.pausada === true) return recusaNaLuta('pausada')
  if (jogada.seq !== luta.seq) return recusaNaLuta('seqVelho')
  const meuLado = eu.lado
  const grade = GRADES_DA_ARENA[luta.tamanho]
  const quem: QuemJoga = {
    autor: { tipo: 'jogador', playerId: contaId, nome: eu.nome },
    podeJogar: (vaga) => vaga.contaId === contaId && vaga.fora !== true,
    podeMontarEm: (casa) => ladoDaZona(luta.lutadores.vagas, grade, casa) === meuLado,
  }
  const feito = jogarNaMesa(luta, motor, quem, jogada, grade, regraDoAndar)
  if (!feito.ok) return feito
  const fim = feito.mexeuNaLuta ? fimDaMesaDaJogada(motor.sistema, feito.mesa) : luta.fim
  return { ok: true, luta: jogarPeloRobo({ ...luta, ...feito.mesa, seq: luta.seq + 1, fim }, motor) }
}

// ───────────────────────────────────────────────────────────────────────────
// O robô no lugar do mestre-Judge (plano §2: "Mestre fora 3 min: o robô assume o Judge")
// ───────────────────────────────────────────────────────────────────────────

type PassoDoRobo = { jogou: true; golpesDaVez: GolpesDaVez | null } | { jogou: false }

const ROBO_PAROU: PassoDoRobo = { jogou: false }

/**
 * Um passo do robô pelas vagas `doRobo`, como a luta automática: a reação
 * esperando por uma delas; o lembrete da marca de uma delas; senão, se algum golpe ainda espera a reação de
 * gente, para; senão, na vez de uma delas, o golpe mais forte que a batalha
 * aceitar (até `GOLPES_POR_VEZ_MAX` na vez), ou passa a vez. A vez de gente
 * (ou a batalha que recusa) = para.
 */
function passoDoRobo(aberta: LutaNaLoja, doRobo: (vaga: VagaDaLuta) => boolean, golpesDaVez: GolpesDaVez | null): PassoDoRobo {
  const { turnos, regras } = aberta.cena()
  const batalha = aberta.loja.getState()
  for (const vaga of aberta.mesa.vagas()) {
    if (!doRobo(vaga)) continue
    const pedido = reacaoDoBoneco(turnos.golpes, vaga.tokenId, vaga.reage ?? 'd20', bonusDaReacao(bonusDaBatalha(turnos.selos, vaga.tokenId)), turnos.selos)
    if (pedido !== null) return batalha.reagir(CENA_DA_LUTA, AUTOR_DO_ROBO, pedido) ? { jogou: true, golpesDaVez } : ROBO_PAROU
  }
  // O lembrete da marca de uma ficha dele (o teste, o SP ou "Agora não", que sempre passa).
  const marca = marcaDoRobo(turnos, (tokenId) => aberta.mesa.vagas().some((vaga) => vaga.tokenId === tokenId && doRobo(vaga)))
  for (const pedido of marca?.pedidos ?? []) {
    if (batalha.marcar(CENA_DA_LUTA, AUTOR_DO_ROBO, pedido)) return { jogou: true, golpesDaVez }
  }
  if ((turnos.golpes ?? []).some((golpe) => golpe.alvos.some((alvo) => alvo.danoFinal === undefined))) return ROBO_PAROU
  const carta = cartaDaVez(turnos)
  const vagaDaVez = carta === null ? undefined : aberta.mesa.vagas().find((vaga) => vaga.tokenId === carta.tokenId)
  if (carta === null || vagaDaVez === undefined || !doRobo(vagaDaVez)) return ROBO_PAROU
  const esperado = { cartaId: carta.id, rodada: turnos.rodada }
  const chave = chaveDaVez(turnos.rodada, carta.id)
  const jaDeu = golpesDaVez !== null && golpesDaVez.chave === chave ? golpesDaVez.golpes : 0
  const golpes = golpesDoRobo({ turnos, regras, vagas: aberta.mesa.vagas(), personagens: aberta.mesa.personagens(), sistema: aberta.mesa.sistema(), golpesNaVez: jaDeu }, carta)
  for (const pedido of golpes) {
    if (batalha.agir(CENA_DA_LUTA, AUTOR_DO_ROBO, esperado, pedido)) return { jogou: true, golpesDaVez: { chave, golpes: jaDeu + 1 } }
  }
  return batalha.passarVez(CENA_DA_LUTA, AUTOR_DO_ROBO, esperado) ? { jogou: true, golpesDaVez } : ROBO_PAROU
}

/**
 * O robô joga pelas contas marcadas `robo` enquanto a vez é dele (a reação,
 * os golpes e o passar), até a vez de gente, o fim ou `PASSOS_DO_ROBO_MAX`.
 * Cada passo conta no relógio da luta. Jogou: `seq` + 1 (uma mudança só) e o
 * fim conferido. Nenhuma conta do robô, luta acabada ou pausada, ou a vez não
 * é dele: a mesma luta.
 */
function jogarPeloRobo(luta: EstadoDaLuta, motor: MotorDoDuelo): EstadoDaLuta {
  const contasDoRobo = new Set(luta.participantes.filter((participante) => participante.robo === true).map((participante) => participante.contaId))
  if (luta.fim !== null || luta.pausada === true || contasDoRobo.size === 0) return luta
  const doRobo = (vaga: VagaDaLuta): boolean => vaga.contaId !== undefined && contasDoRobo.has(vaga.contaId) && vaga.fora !== true
  const aberta = abrirNaLoja(luta, motor)
  let golpesDaVez = luta.golpesDoRobo ?? null
  let agora = luta
  for (let deu = 0; deu < PASSOS_DO_ROBO_MAX; deu += 1) {
    const passo = passoDoRobo(aberta, doRobo, golpesDaVez)
    if (!passo.jogou) break
    golpesDaVez = passo.golpesDaVez
    // O robô só joga depois que a conta sumiu no meio da luta: a montagem já não vale.
    agora = { ...luta, lutadores: aberta.mesa.lutadores(), cena: aberta.cena(), passos: agora.passos + 1, montagem: false }
    if (fimDaMesaDaJogada(motor.sistema, agora) !== null) break
  }
  if (agora === luta) return luta
  const depois: EstadoDaLuta = { ...agora, seq: luta.seq + 1, ...(golpesDaVez === null ? {} : { golpesDoRobo: golpesDaVez }) }
  return { ...depois, fim: fimDaMesaDaJogada(motor.sistema, depois) }
}

// ───────────────────────────────────────────────────────────────────────────
// Quem sai: a conta fora 3 min ou que sai sai da ordem, e a luta segue
// ───────────────────────────────────────────────────────────────────────────

/** A vaga ainda luta (está na ordem)? */
function aindaLuta(vaga: VagaDaLuta): boolean {
  return vaga.fora !== true
}

/** A conta ainda tem ficha na luta? */
function contaAindaLuta(luta: Pick<EstadoDaLuta, 'lutadores'>, contaId: string): boolean {
  return luta.lutadores.vagas.some((vaga) => vaga.contaId === contaId && aindaLuta(vaga))
}

/** O golpe que espera a reação de quem sai entra cheio (Não reagir), um a um; para no primeiro que a batalha recusar. */
function golpesSemResposta(loja: LojaDaBatalha, tokenId: string): void {
  const pendentes = cenaDaLoja(loja).turnos.golpes?.length ?? 0
  for (let i = 0; i < pendentes; i += 1) {
    const pedido = reacaoDoBoneco(cenaDaLoja(loja).turnos.golpes, tokenId, 'parado', 0, undefined)
    if (pedido === null || !loja.getState().reagir(CENA_DA_LUTA, AUTOR_DA_SAIDA, pedido)) return
  }
}

/**
 * As fichas das contas `saem` saem da luta: o golpe que esperava por elas
 * entra cheio, as cartas saem da ordem (`tirarCombatente`, a vez anda) e a
 * vaga fica `fora` (não conta de pé). `seq` + 1 e o fim conferido; nenhuma
 * ficha a tirar = a mesma luta.
 */
function tirarContas(luta: EstadoDaLuta, motor: MotorDoDuelo, saem: ReadonlySet<string>): EstadoDaLuta {
  const vaiSair = (vaga: VagaDaLuta): boolean => vaga.contaId !== undefined && saem.has(vaga.contaId) && aindaLuta(vaga)
  const tokens = luta.lutadores.vagas.filter(vaiSair).map((vaga) => vaga.tokenId)
  if (tokens.length === 0) return luta
  const lutadores: LutadoresDaLuta = {
    vagas: luta.lutadores.vagas.map((vaga): VagaDaLuta => (vaiSair(vaga) ? { ...vaga, fora: true } : vaga)),
    personagens: luta.lutadores.personagens,
  }
  const aberta = abrirNaLoja({ ...luta, lutadores }, motor)
  for (const tokenId of tokens) {
    golpesSemResposta(aberta.loja, tokenId)
    aberta.loja.getState().tirarCombatente(CENA_DA_LUTA, tokenId)
  }
  const depois: EstadoDaLuta = { ...luta, lutadores: aberta.mesa.lutadores(), cena: aberta.cena(), seq: luta.seq + 1 }
  return { ...depois, fim: fimDaMesaDaJogada(motor.sistema, depois) }
}

/**
 * A pausa sem o árbitro (ele saiu, ou passou 3 min fora): a luta volta a
 * correr como no retomar (o marco `retomar`, `seq` + 1, quem segue fora com
 * 3 min de novo) e o robô joga se a vez é dele.
 */
function retomarSemOArbitro(luta: EstadoDaLuta, motor: MotorDoDuelo, agora: number): EstadoDaLuta {
  return jogarPeloRobo(comMarco(semPausa(luta, agora, true), 'retomar', agora), motor)
}

/** Na pausa, quando o árbitro ausente passa dos 3 min (ms). `null` = a luta corre, ou o árbitro está aqui. */
function prazoDoArbitroNaPausa(luta: EstadoDaLuta): number | null {
  if (luta.pausada !== true) return null
  const arbitro = luta.participantes.find((participante) => participante.papel === 'arbitro')
  return arbitro === undefined || arbitro.ausenteDesde === null ? null : arbitro.ausenteDesde + VOLTA_DO_AUSENTE_MS
}

/**
 * A conta `contaId` sai (`luta.sair`) em `agora`: quem tem lado (quem joga, e
 * o mestre como Judge) tira as fichas dele da luta (a luta segue, e o robô
 * joga se a vez cair nele); quem arbitra ou assiste só deixa a lista, e o
 * árbitro que sai da luta pausada a retoma (senão ninguém mais a retomaria).
 * Recusada (versão, acabada, conta de fora): a luta recebida fica como estava.
 */
export function sairDaLuta(luta: EstadoDaLuta, motor: MotorDoDuelo, contaId: string, agora: number): ResultadoNaLuta {
  if (luta.versao !== VERSAO_DO_MOTOR_DA_LUTA) return recusaNaLuta('versao')
  if (luta.fim !== null) return recusaNaLuta('acabou')
  const eu = participanteDaConta(luta, contaId)
  if (eu === null) return recusaNaLuta('naoJoga')
  if (!temLado(eu)) {
    const semEle: EstadoDaLuta = { ...luta, participantes: luta.participantes.filter((participante) => participante.contaId !== contaId) }
    return { ok: true, luta: eu.papel === 'arbitro' && luta.pausada === true ? retomarSemOArbitro(semEle, motor, agora) : semEle }
  }
  return { ok: true, luta: jogarPeloRobo(tirarContas(luta, motor, new Set([contaId])), motor) }
}

/** A conta ficou sem nenhum socket em `agora`. Já ausente: fica o primeiro instante. Luta acabada ou conta de fora: a mesma luta. */
export function marcarAusenteNaLuta(luta: EstadoDaLuta, contaId: string, agora: number): EstadoDaLuta {
  const eu = participanteDaConta(luta, contaId)
  if (luta.fim !== null || eu === null || eu.ausenteDesde !== null) return luta
  return { ...luta, participantes: luta.participantes.map((participante) => (participante.contaId === contaId ? { ...participante, ausenteDesde: agora } : participante)) }
}

/** A conta voltou (abriu um socket); o mestre que volta retoma o Judge do robô. Já presente, ou conta de fora: a mesma luta. */
export function marcarPresenteNaLuta(luta: EstadoDaLuta, contaId: string): EstadoDaLuta {
  const eu = participanteDaConta(luta, contaId)
  if (eu === null || eu.ausenteDesde === null) return luta
  const { robo: _robo, ...presente } = eu
  return { ...luta, participantes: luta.participantes.map((participante) => (participante.contaId === contaId ? { ...presente, ausenteDesde: null } : participante)) }
}

/** Quando a conta passa do prazo dos 3 min (ms): ausente, sem o robô no lugar e ainda com ficha na luta. `null` = ela não espera prazo. */
function prazoDaConta(luta: Pick<EstadoDaLuta, 'lutadores'>, participante: ParticipanteDaLuta): number | null {
  if (participante.ausenteDesde === null || participante.robo === true || !contaAindaLuta(luta, participante.contaId)) return null
  return participante.ausenteDesde + VOLTA_DO_AUSENTE_MS
}

/**
 * O menor prazo (ms), a coluna `prazo` e o `alarm()` do DO: correndo, o de
 * quem joga, está ausente e ainda tem ficha na luta; pausada (o relógio de
 * quem joga para), o do árbitro ausente, que ao passar retoma a luta.
 * `null` = ninguém, ou já acabou.
 */
export function prazoDaLuta(luta: EstadoDaLuta): number | null {
  if (luta.fim !== null) return null
  if (luta.pausada === true) return prazoDoArbitroNaPausa(luta)
  const prazos = luta.participantes.flatMap((participante) => {
    const prazo = prazoDaConta(luta, participante)
    return prazo === null ? [] : [prazo]
  })
  return prazos.length === 0 ? null : Math.min(...prazos)
}

/**
 * Em `agora`, quem passou do prazo sai da luta (as fichas saem da ordem) e a
 * luta segue; o mestre como Judge não sai: o robô assume as fichas dele e
 * joga se a vez é dele (`seq` + 1). Na pausa ninguém sai; só vale o prazo do
 * árbitro fora: passou, a luta volta a correr (`retomarSemOArbitro`). Ninguém
 * passou, ou já acabou: a mesma luta.
 */
export function tirarAusentes(luta: EstadoDaLuta, motor: MotorDoDuelo, agora: number): EstadoDaLuta {
  if (luta.fim !== null) return luta
  if (luta.pausada === true) {
    const prazo = prazoDoArbitroNaPausa(luta)
    return prazo !== null && agora >= prazo ? retomarSemOArbitro(luta, motor, agora) : luta
  }
  const passaram = luta.participantes.filter((participante) => {
    const prazo = prazoDaConta(luta, participante)
    return prazo !== null && agora >= prazo
  })
  if (passaram.length === 0) return luta
  const assume = new Set(passaram.filter((participante) => participante.papel === 'juiz').map((participante) => participante.contaId))
  const semQuemSaiu = tirarContas(luta, motor, new Set(passaram.filter((participante) => participante.papel !== 'juiz').map((participante) => participante.contaId)))
  if (assume.size === 0) return jogarPeloRobo(semQuemSaiu, motor)
  const comORobo: EstadoDaLuta = {
    ...semQuemSaiu,
    participantes: semQuemSaiu.participantes.map((participante): ParticipanteDaLuta => (assume.has(participante.contaId) ? { ...participante, robo: true } : participante)),
    seq: semQuemSaiu.seq + 1,
  }
  return jogarPeloRobo(comORobo, motor)
}

import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from '../../stores/batalhaFabrica'
import { GRADES_DA_ARENA, type GradeDaArena, type TamanhoDaGrade } from '../arena/grade'
import { reacaoDoBoneco } from '../arena/reacaoDoBoneco'
import type { MesaDaBatalha } from '../batalha/mesa'
import { combatentesIniciais, type AutorDaAcao } from '../batalha/turnos'
import type { Personagem } from '../personagem'
import { fimDaMesaDaJogada, jogarNaMesa, VOLTA_DO_AUSENTE_MS, type JogadaDoDuelo, type MotivoDaRecusa, type MotorDoDuelo, type QuemJoga, type RegraDoAndar } from './duelo'
import type { FimDaLuta } from './fimDaLuta'
import {
  casasIniciais,
  criarMesaEmMemoria,
  LADOS_DA_LUTA,
  montarLutadoresDaLuta,
  soOsDoisLados,
  tamanhoDaLuta,
  type CasaDoTreino,
  type EscolhaDaVaga,
  type LadoDaLuta,
  type LutadoresDaLuta,
  type VagaDaLuta,
} from './mesaEmMemoria'

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
 * Fica para a F3 (o mesmo dono, em sequência): o árbitro (desfazer, ajustar,
 * pausar, encerrar) e o mestre como Judge. Aqui o papel `juiz` é recusado na
 * criação. A rede, a sala de espera e o relógio são do DO (F4).
 *
 * Sem Tauri, sem DOM.
 */

/** A versão do motor (coluna `versaoDoMotor` da tabela `lutas`): estado de outra versão não continua. */
export const VERSAO_DO_MOTOR_DA_LUTA = 4

/** Contas numa luta, somando quem joga, arbitra e assiste (plano §2). */
export const CONTAS_POR_LUTA_MAX = 12

/** A chave da cena nas lojas deste arquivo (a loja é de uma chamada só; a chave não vai ao estado). */
const CENA_DA_LUTA = 'luta'

/** Quem tira a reação de quem saiu da luta: o golpe que esperava por ele entra cheio. */
const AUTOR_DA_SAIDA: AutorDaAcao = { tipo: 'mestre' }

export type ModoDaLuta = 'times' | 'todos'

export type PapelNaLuta = 'jogador' | 'juiz' | 'arbitro' | 'espectador'

/** Uma conta na luta como o servidor a monta no `luta.comecar`: as fichas são o DOC COMPLETO guardado (com o `dono`). */
export interface InscricaoNaLuta {
  contaId: string
  nome: string
  papel: PapelNaLuta
  /** O lado de quem joga; `null` para quem arbitra ou assiste. */
  lado: LadoDaLuta | null
  /** Vazia para quem não joga. */
  fichas: readonly Personagem[]
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
}

/** Como a luta acabou (a F3 soma o fim pelo árbitro). */
export type FimDaLutaV4 = FimDaLuta<LadoDaLuta>

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
  /** Quantas mudanças foram aceitas (jogadas e saídas). A jogada leva o `seq` do estado que viu. */
  seq: number
  /** Os passos do relógio da luta: uma jogada de agir, reagir ou passar, um passo. */
  passos: number
  fim: FimDaLutaV4 | null
}

/** Por que a luta não começa. */
export type CriacaoDaLuta =
  | { ok: true; luta: EstadoDaLuta }
  /** `cheia` = mais de `CONTAS_POR_LUTA_MAX` contas; `contaRepetida` = a mesma conta duas vezes; `papel` = papel com lado ou ficha que não combina (ou o `juiz`, que chega na F3); `semFicha` = quem joga sem ficha; `ladoRepetido` = duas contas no mesmo lado em todos contra todos. */
  | { ok: false; motivo: 'cheia' | 'contaRepetida' | 'papel' | 'semFicha' | 'ladoRepetido' }
  /** Alguma ficha da conta não é dela (o `dono` do doc completo). */
  | { ok: false; motivo: 'naoEDono'; contaId: string }
  /** Como em `montarLutadoresDaLuta`. */
  | { ok: false; motivo: 'poucosLados' | 'demais' }
  | { ok: false; motivo: 'vazio' | 'cheio'; lado: LadoDaLuta }

export type ResultadoNaLuta = { ok: true; luta: EstadoDaLuta } | { ok: false; motivo: MotivoDaRecusa }

type CriacaoRecusada = Exclude<CriacaoDaLuta, { ok: true }>

function recusa(motivo: MotivoDaRecusa): { ok: false; motivo: MotivoDaRecusa } {
  return { ok: false, motivo }
}

function lojaDaLuta(mesa: MesaDaBatalha, motor: MotorDoDuelo): LojaDaBatalha {
  return criarBatalhaStore(mesa, { rolarD20: motor.rolarD20, outraBatalhaLigada: () => false })
}

function cenaDaLoja(loja: LojaDaBatalha): BatalhaDaCena {
  const cena = loja.getState().cenas[CENA_DA_LUTA]
  if (cena === undefined) throw new RangeError('a batalha da luta não está ligada')
  return cena
}

/** A conta na luta; `null` = ela não está nesta luta. */
export function participanteDaConta(luta: Pick<EstadoDaLuta, 'participantes'>, contaId: string): ParticipanteDaLuta | null {
  return luta.participantes.find((participante) => participante.contaId === contaId) ?? null
}

// ───────────────────────────────────────────────────────────────────────────
// Começar
// ───────────────────────────────────────────────────────────────────────────

/** A inscrição torta, sem olhar as outras: o papel, o lado e as fichas (de quem joga, todas da conta). */
function inscricaoTorta(inscricao: InscricaoNaLuta): CriacaoRecusada | null {
  const { papel, lado, fichas, contaId } = inscricao
  // O mestre como Judge (o lado dele com o Judge e os inimigos liberados) é a fatia F3.
  if (papel === 'juiz') return { ok: false, motivo: 'papel' }
  if (papel !== 'jogador') return lado === null && fichas.length === 0 ? null : { ok: false, motivo: 'papel' }
  if (lado === null || !LADOS_DA_LUTA.includes(lado)) return { ok: false, motivo: 'papel' }
  if (fichas.length === 0) return { ok: false, motivo: 'semFicha' }
  if (fichas.some((ficha) => ficha.dono !== contaId)) return { ok: false, motivo: 'naoEDono', contaId }
  return null
}

/**
 * A luta nova (o `luta.comecar` do DO, com quem aceitou): confere as contas
 * (até 12, sem repetir), o papel de cada uma e que cada ficha é da conta dela;
 * em todos contra todos, cada conta num lado só dela. Monta as vagas e as
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
  for (const inscricao of inscricoes) {
    if (contas.has(inscricao.contaId)) return { ok: false, motivo: 'contaRepetida' }
    contas.add(inscricao.contaId)
    const torta = inscricaoTorta(inscricao)
    if (torta !== null) return torta
    const { lado, contaId, fichas } = inscricao
    if (lado === null) continue
    if (abertura.modo === 'todos' && ladosDeQuemJoga.has(lado)) return { ok: false, motivo: 'ladoRepetido' }
    ladosDeQuemJoga.add(lado)
    escolhas.push(...fichas.map((ficha) => ({ ficha, lado, contaId })))
  }
  const montagem = montarLutadoresDaLuta(escolhas)
  if (!montagem.ok) return montagem
  const tamanho = tamanhoDaLuta(montagem.lutadores.vagas)
  const mesa = criarMesaEmMemoria(motor.sistema, montagem.lutadores, GRADES_DA_ARENA[tamanho])
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
 * fim, a conta (só quem joga: o árbitro e o espectador = `naoJoga`), o `seq`;
 * o resto é o núcleo do duelo (`jogarNaMesa`) com a ficha da PRÓPRIA conta
 * (a do colega de time = `naoEDaConta`; a que saiu da luta também) e a
 * largada na zona do lado. Aceita: o estado novo com `seq` + 1 e o fim
 * conferido. Recusada: o motivo, e a luta recebida fica como estava.
 */
export function aplicarJogadaNaLuta(luta: EstadoDaLuta, motor: MotorDoDuelo, contaId: string, jogada: JogadaDoDuelo, regraDoAndar: RegraDoAndar = 'naVez'): ResultadoNaLuta {
  if (luta.versao !== VERSAO_DO_MOTOR_DA_LUTA) return recusa('versao')
  if (luta.fim !== null) return recusa('acabou')
  const eu = participanteDaConta(luta, contaId)
  if (eu === null || eu.papel !== 'jogador' || eu.lado === null) return recusa('naoJoga')
  if (jogada.seq !== luta.seq) return recusa('seqVelho')
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
  return { ok: true, luta: { ...luta, ...feito.mesa, seq: luta.seq + 1, fim } }
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
    const pedido = reacaoDoBoneco(cenaDaLoja(loja).turnos.golpes, tokenId, 'parado', 0)
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
  const copia = structuredClone({ lutadores: luta.lutadores, cena: luta.cena })
  const lutadores: LutadoresDaLuta = {
    vagas: copia.lutadores.vagas.map((vaga): VagaDaLuta => (vaiSair(vaga) ? { ...vaga, fora: true } : vaga)),
    personagens: copia.lutadores.personagens,
  }
  const mesa = criarMesaEmMemoria(motor.sistema, lutadores, GRADES_DA_ARENA[luta.tamanho])
  const loja = lojaDaLuta(mesa, motor)
  loja.setState({ cenas: { [CENA_DA_LUTA]: copia.cena } })
  for (const tokenId of tokens) {
    golpesSemResposta(loja, tokenId)
    loja.getState().tirarCombatente(CENA_DA_LUTA, tokenId)
  }
  const depois: EstadoDaLuta = { ...luta, lutadores: mesa.lutadores(), cena: cenaDaLoja(loja), seq: luta.seq + 1 }
  return { ...depois, fim: fimDaMesaDaJogada(motor.sistema, depois) }
}

/**
 * A conta `contaId` sai (`luta.sair`): quem joga tira as fichas dele da luta
 * (a luta segue); quem arbitra ou assiste só deixa a lista. Recusada (versão,
 * acabada, conta de fora): a luta recebida fica como estava.
 */
export function sairDaLuta(luta: EstadoDaLuta, motor: MotorDoDuelo, contaId: string): ResultadoNaLuta {
  if (luta.versao !== VERSAO_DO_MOTOR_DA_LUTA) return recusa('versao')
  if (luta.fim !== null) return recusa('acabou')
  const eu = participanteDaConta(luta, contaId)
  if (eu === null) return recusa('naoJoga')
  if (eu.papel !== 'jogador') return { ok: true, luta: { ...luta, participantes: luta.participantes.filter((participante) => participante.contaId !== contaId) } }
  return { ok: true, luta: tirarContas(luta, motor, new Set([contaId])) }
}

/** A conta ficou sem nenhum socket em `agora`. Já ausente: fica o primeiro instante. Luta acabada ou conta de fora: a mesma luta. */
export function marcarAusenteNaLuta(luta: EstadoDaLuta, contaId: string, agora: number): EstadoDaLuta {
  const eu = participanteDaConta(luta, contaId)
  if (luta.fim !== null || eu === null || eu.ausenteDesde !== null) return luta
  return { ...luta, participantes: luta.participantes.map((participante) => (participante.contaId === contaId ? { ...participante, ausenteDesde: agora } : participante)) }
}

/** A conta voltou (abriu um socket). Já presente, ou conta de fora: a mesma luta. */
export function marcarPresenteNaLuta(luta: EstadoDaLuta, contaId: string): EstadoDaLuta {
  const eu = participanteDaConta(luta, contaId)
  if (eu === null || eu.ausenteDesde === null) return luta
  return { ...luta, participantes: luta.participantes.map((participante) => (participante.contaId === contaId ? { ...participante, ausenteDesde: null } : participante)) }
}

/** O menor prazo (ms) de quem joga, está ausente e ainda tem ficha na luta: a coluna `prazo` e o `alarm()` do DO. `null` = ninguém, ou já acabou. */
export function prazoDaLuta(luta: EstadoDaLuta): number | null {
  if (luta.fim !== null) return null
  const prazos = luta.participantes.flatMap((participante) =>
    participante.ausenteDesde !== null && contaAindaLuta(luta, participante.contaId) ? [participante.ausenteDesde + VOLTA_DO_AUSENTE_MS] : [],
  )
  return prazos.length === 0 ? null : Math.min(...prazos)
}

/** Em `agora`, quem passou do prazo sai da luta (as fichas saem da ordem); a luta segue. Ninguém passou (ou já acabou): a mesma luta. */
export function tirarAusentes(luta: EstadoDaLuta, motor: MotorDoDuelo, agora: number): EstadoDaLuta {
  if (luta.fim !== null) return luta
  const saem = new Set(luta.participantes.filter((participante) => participante.ausenteDesde !== null && agora >= participante.ausenteDesde + VOLTA_DO_AUSENTE_MS).map((participante) => participante.contaId))
  return saem.size === 0 ? luta : tirarContas(luta, motor, saem)
}

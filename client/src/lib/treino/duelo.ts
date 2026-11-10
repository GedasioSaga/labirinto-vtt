import { ID_DA_BATALHA_MAX, lerPedidoDeAcao, lerPedidoDeEvolucao, lerPedidoDePassiva, lerPedidoDeReacao, motivoNoFio, parseBatalhaArmas, RODADA_MAX } from '../../net/protocoloDaBatalha'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from '../../stores/batalhaFabrica'
import { CASA_DA_ARENA, centroDaCasaNaArena, type GradeDaArena } from '../arena/grade'
import { tecnicasNoMenu } from '../batalha/acoes'
import type { ParedeDoPasso } from '../batalha/blocos'
import type { AcaoDaTecnica, EfeitoDaBatalha, PedidoDeAcao, PedidoDeAlvo, PedidoDeEvolucao, PedidoDeMarca, PedidoDePassiva, PedidoDeReacao } from '../batalha/combate'
import { ehLembreteDoSangramento } from '../batalha/condicoes'
import { preenchimentoDaVariante, varianteDoPedido } from '../batalha/escolhaEEvolucao'
import { acoesDaCarta, danoSugeridoDoAtaque } from '../batalha/golpe'
import { armaSoDeEfeito } from '../batalha/formula'
import { armasDe, balaDaArma, ehPerfurante, perfuracaoDe, tecnicaPorId, type ArmaDaFicha, type BalaDaArma } from '../batalha/leituraDaFicha'
import { danoDaTecnica } from '../batalha/leituraDaTecnica'
import { cartaoMontado } from '../batalha/mecanica/leitura'
import { COMO_MARCA } from '../batalha/marca'
import { chavesDoDono, motivoDasRespostasDoGolpe, reacaoAMaoDe } from '../batalha/mecanicasAMao'
import { motivoDaReacaoComTecnica, saidasDaTecnica } from '../batalha/reacaoComTecnica'
import { passoEmBatalha } from '../batalha/movimentoEmBatalha'
import { motivoDaPassiva } from '../batalha/passivas'
import type { VezEsperada } from '../batalha/ponte'
import type { RegrasDaBatalha } from '../batalha/regrasDoCampo'
import { registroParaJogador, type LinhaParaJogador } from '../batalha/registro'
import { bonusDaBatalha, bonusDaReacao, seloPedidoValido } from '../batalha/selos'
import { modoDaReacao, seloDaReacao } from '../batalha/tiposDaHabilidade'
import { acaoDaForma, formaDaFicha } from '../batalha/transformacao'
import { cartaDaVez, combatentesIniciais, type AutorDaAcao, type CartaDaOrdem, type TurnosDaCena } from '../batalha/turnos'
import { bytesDoTexto, ehRegistro, lerJsonSeguro } from '../nuvem/json'
import { LIMITES } from '../nuvem/limites'
import { projetarParaJogador } from '../nuvem/projecao'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { MesaDaBatalha } from '../batalha/mesa'
import { fimDaLuta, mesaDosLutadores, type FimDaLuta } from './fimDaLuta'
import { TETOS_DO_TREINO } from './lutaAutomatica'
import {
  criarMesaEmMemoria,
  fichaSemHpNaEscolha,
  GRADE_DO_TREINO,
  LADOS_DO_TREINO,
  montarLutadores,
  type CasaDoTreino,
  type EscolhaDaVaga,
  type LadoDaLuta,
  type LadoDoTreino,
  type LutadoresDaLuta,
  type LutadoresDoTreino,
  type MesaDaLuta,
  type MesaEmMemoria,
  type VagaDaLuta,
} from './mesaEmMemoria'
import { danoNoTeto, seloDaMira } from './robo'

/**
 * A REGRA PURA DO DUELO (LOBBY v2, fatia T5 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): dois jogadores, cada um
 * com as fichas DELE, lutam turno a turno sobre a MESMA regra da batalha One
 * Piece do app (`criarBatalhaStore`) e a mesa em memória com as cópias (a
 * ficha de verdade nunca é tocada). O servidor (o DO da campanha, fatia T6)
 * guarda o `DueloGravado` e chama estas funções; aqui não há rede, relógio
 * nem sorteio: o d20 entra por `MotorDoDuelo.rolarD20` (no DO, o do crypto).
 *
 * O servidor não confia no cliente (achados Tr2, Tr3, Tr5 e Tr7, §11), mas
 * também NÃO refaz a regra (R3 da unificação do combate, 10/11/2026): quem
 * valida e executa é a mesma `agir`/`reagir` da batalha do app, o caminho do
 * jogador por LAN (`net/batalhaNoHost.ts`), e a recusa volta com o motivo
 * dela. Aqui fica só a conferência de dono, de vez (`seq`) e de formato:
 *  - o pedido não traz NÚMERO do cliente. Na mesa a mira do jogador manda o
 *    dano, o custo e o bônus e o mestre vê; no site ninguém vê, então o
 *    servidor faz o papel da mira com as leituras do motor: o dano que a
 *    ficha dá (o mesmo de `robo.ts`), o custo e a ação da ficha (a ação que
 *    a ficha não diz = Simples, `ACAO_SEM_A_FICHA`; a de Ativar a forma = a
 *    do campo Ação, `acaoDaForma`), Perfurante só se a ficha diz, o selo só
 *    o sugerido, o bônus da reação só o dos selos. O dano "% da vida do
 *    alvo" (Explosão) vai vazio: o motor o calcula alvo a alvo
 *    (`comDanoPelaVida` em `lib/batalha/golpe.ts`);
 *  - arma, bala, técnica, opção, resposta e forma que a cópia não tem não
 *    são recusadas aqui: o pedido segue sem número e a batalha recusa com o
 *    motivo que ela dá ao jogador na mesa;
 *  - DIFERENÇAS DE PROPÓSITO (o site não tem mestre): o golpe marcado "à
 *    mão" ou de dano que a ficha não lê é recusado (ninguém digita dano); a
 *    Surpresa, a reação livre, rerolar com Ponto Saga e passar sem dano são
 *    recusados (decisões do mestre); a Vantagem pedida no d20 da reação não
 *    vale (`rolarSemVantagemPedida`); o Evoluir (custo digitado, condição em
 *    texto livre) só vale no treino local; a saída da técnica de reação é a da
 *    ficha (a escolha livre da mesa só vale nas saídas próprias da tabela).
 *    O contra-ataque gasto em se mover não é `agir`: é a jogada `andar` com
 *    o `contraDe`, que gasta e anda de uma vez só;
 *  - ANDAR (fatia M1, a grade 12 x 8 da Arena): só a ficha do lado de quem
 *    pede, na vez dela (ou pelo contra-ataque que ela ganhou), para uma casa
 *    dentro da grade e livre, pelo mesmo passo da batalha do app
 *    (`passoEmBatalha`, sem paredes, como a Arena). Os blocos somam no MOV
 *    da vez (`somarCaminho`), que fica vermelho acima do limite e não trava.
 *    A regra não usa distância (nem dano, nem alcance): andar não muda o
 *    robô, as 100 lutas nem a semente;
 *  - MONTAR (a montagem por arrasto do site): a casa de largada que cada um
 *    escolheu. Só na montagem (`DueloGravado.montagem`: nenhum dos dois agiu
 *    ainda; a primeira jogada que não é `montar` a fecha), só a ficha do lado
 *    de quem pede, só para uma casa da metade dele, dentro da grade e livre.
 *    Não passa pela batalha: não gasta MOV, nem passo, nem a vez;
 *  - exige o `seq` do último estado em agir, reagir e passar: a jogada
 *    reenviada (ou feita sobre um estado velho) é recusada, nunca aplicada 2×;
 *  - o dono das fichas é lido do DOC COMPLETO (o `paraOFio` e a projeção do
 *    jogador tiram o `dono`): `criarDuelo` recebe o doc guardado no servidor;
 *  - o teto de 64 KiB vale só do cliente para o DO (`lerJogadaDoDuelo`); o
 *    estado que vai aos dois (`dueloParaOFio`) leva só a cauda do registro e
 *    as fichas projetadas, sem teto.
 *
 * Resposta 12.15 do usuário: sem tempo limite por turno; quem caiu tem 3
 * minutos para voltar. A contagem é do servidor (T6, coluna `prazo` e o
 * `alarm()`); aqui só o estado (`marcarAusente`, `marcarPresente`,
 * `prazoDoDuelo`, `vencerAusencia`). Sem tempo por turno, quem não quer
 * esperar o outro jogar sai desistindo (`desistirDoDuelo`): o outro vence.
 *
 * Sem Tauri, sem DOM.
 */

/**
 * A versão do motor (coluna `versaoDoMotor` da tabela `duelos`): estado de
 * outra versão não continua. 2 = as posições na grade e a jogada `andar` (M1);
 * 3 = a fase de montagem (`montagem`) e a jogada `montar`.
 */
export const VERSAO_DO_MOTOR_DO_DUELO = 3

/** A chave da cena da batalha do duelo (a store do duelo só tem esta). */
export const CENA_DO_DUELO = 'duelo'

/** Resposta 12.15: quanto tempo quem caiu tem para voltar antes de perder o duelo. */
export const VOLTA_DO_AUSENTE_MS = 3 * 60_000

/**
 * A ação que a técnica gasta quando a ficha não diz. Na mesa a tela pergunta;
 * no duelo o cliente não escolhe (a "Livre" não gasta nada e daria golpes sem
 * fim na vez): vale a Simples, o padrão do Atacar (`dadosDoMenu`).
 */
const ACAO_SEM_A_FICHA: AcaoDaTecnica = 'simples'

/** O que o motor recebe de fora: o sistema do livro (One Piece) e o d20 (no DO, o do crypto; no teste, o da semente). */
export interface MotorDoDuelo {
  sistema: SistemaDeRpg
  rolarD20: () => number
}

/** Um lado como o servidor o monta: a conta e as fichas dela, cada uma o DOC COMPLETO guardado (com o `dono`). */
export interface LadoDoDuelo {
  contaId: string
  nome: string
  fichas: readonly Personagem[]
}

export interface PedidoDeDuelo {
  id: string
  a: LadoDoDuelo
  b: LadoDoDuelo
}

/** Um jogador no duelo. `ausenteDesde` = quando a conta ficou sem nenhum socket (ms); `null` = está aqui. */
export interface JogadorDoDuelo {
  contaId: string
  nome: string
  ausenteDesde: number | null
}

/**
 * Como o duelo acabou: o fim da luta; a ausência (`vencedor` null = os dois
 * passaram do prazo); ou a desistência (o `vencedor` é o lado de quem NÃO desistiu).
 */
export type FimDoDuelo = FimDaLuta | { tipo: 'ausencia'; vencedor: LadoDoTreino | null } | { tipo: 'desistencia'; vencedor: LadoDoTreino }

/** O duelo guardado no servidor (coluna `estadoJson`), só dados: vai a JSON e volta igual. */
export interface DueloGravado {
  versao: typeof VERSAO_DO_MOTOR_DO_DUELO
  id: string
  jogadores: Readonly<Record<LadoDoTreino, JogadorDoDuelo>>
  lutadores: LutadoresDoTreino
  /** Onde cada ficha está na grade (`GRADE_DO_TREINO`), pelo id do token; nasce nas casas de `TokenDaVaga`. */
  posicoes: Readonly<Record<string, CasaDoTreino>>
  /** A fase de montagem: `true` até a primeira jogada aceita que não é `montar` (enquanto ninguém agiu, cada um escolhe a casa de largada). */
  montagem: boolean
  cena: BatalhaDaCena
  /** Quantas jogadas foram aceitas. A jogada leva o `seq` do estado que viu. */
  seq: number
  /** Os passos do relógio da luta (`fimDaLuta`): uma jogada aceita, um passo; andar e montar não contam (não são golpe nem vez). */
  passos: number
  fim: FimDoDuelo | null
}

export type JogadaDoDuelo =
  /** `vez` null só com o contra-ataque (`contraDe`), como na batalha da mesa. */
  | { tipo: 'agir'; seq: number; vez: VezEsperada | null; pedido: PedidoDeAcao }
  | { tipo: 'reagir'; seq: number; pedido: PedidoDeReacao }
  | { tipo: 'passar'; seq: number; vez: VezEsperada }
  /**
   * A ficha `tokenId` anda para a casa `col`/`row` da grade. Como o `agir`:
   * `vez` null só com o contra-ataque (`contraDe`, gasto em se mover).
   */
  | { tipo: 'andar'; seq: number; vez: VezEsperada | null; tokenId: string; col: number; row: number; contraDe?: string }
  /** Na montagem, a ficha `tokenId` (do lado de quem pede) vai para a casa `col`/`row` da metade dele: a casa de largada escolhida. */
  | { tipo: 'montar'; seq: number; tokenId: string; col: number; row: number }
  /**
   * A resposta ao lembrete "Marcar o alvo?" (a passiva de marca, o Olhar
   * Artístico do Vincent) de uma ficha de quem pede: pagar o SP, o teste (o
   * servidor rola o d20 com o modificador da ficha) ou "Agora não". O "rolei
   * fora" (`passou`/`falhou`) é só da mesa (`foraDoDuelo`). Não conta passo:
   * não é golpe nem vez.
   */
  | { tipo: 'marcar'; seq: number; pedido: PedidoDeMarca }
  /**
   * R4 (unificação do combate, 10/11/2026): Ativar ou Desligar a passiva de
   * uma ficha de quem pede, ou a resposta ao lembrete dela (a manutenção da
   * forma, a Preparação). O custo e o selo são os da ficha. Não conta passo.
   */
  | { tipo: 'passiva'; seq: number; pedido: PedidoDePassiva }
  /** R4: Evoluir a técnica nesta batalha, na vez da ficha (a batalha confere). Só no treino local; entre contas é recusado (`foraDoDuelo`). Não conta passo. */
  | { tipo: 'evoluir'; seq: number; pedido: PedidoDeEvolucao }
  /** R4: as armas da batalha da cópia `personagemId` de quem pede, até o limite da ficha (a batalha confere). Não conta passo. */
  | { tipo: 'armas'; seq: number; personagemId: string; armas: readonly string[] }

/**
 * Quem anda e quando. `naVez` (o duelo: o servidor decide): só a ficha da vez,
 * ou a do contra-ataque que ela ganhou. `livre` (o treino local, como a Arena
 * do app): qualquer ficha do lado de quem joga, a qualquer hora. Nas duas, a
 * casa tem de estar dentro da grade e livre. `naVez` também diz que a luta é
 * entre contas: o Evoluir (custo digitado, condição em texto) é recusado nela.
 */
export type RegraDoAndar = 'naVez' | 'livre'

export type MotivoDaRecusa =
  /** O estado é de outra versão do motor. */
  | 'versao'
  | 'acabou'
  /** A conta não é de nenhum dos dois lados. */
  | 'naoJoga'
  /** A jogada não traz o `seq` do último estado (reenvio, ou feita sobre um estado velho). */
  | 'seqVelho'
  /** A ficha que age ou reage é do outro lado. */
  | 'naoEDaConta'
  | 'surpresa'
  /** Dano que a ficha não calcula (À mão, "1d6", "Dano da arma" sem arma): no duelo ninguém digita dano. O "% da vida do alvo" passa: a batalha calcula (R3). */
  | 'danoAMao'
  /** Fora do duelo: o `agir` de mover pelo contra-ataque (vai pelo `andar`), reação livre, rerolar, passar sem dano e o "rolei fora" da marca (decisões do mestre na mesa). */
  | 'foraDoDuelo'
  /** A batalha recusou: não é a vez, ação gasta, técnica em recarga, alvo que não reage, casa ocupada ou fora da grade, montar fora da montagem ou na metade do outro... */
  | 'regra'

/**
 * A recusa de uma jogada: o código (o site de antes só lê este) e, quando a
 * regra falou, o `texto` dela em português simples: o mesmo motivo que o app
 * mostra ao jogador na mesa (`motivoDoAgir` da store), no teto do fio (`motivoNoFio`).
 * Ausente = fica a frase do código (`textoDaRecusa` do site).
 */
export type RecusaDaJogada = { ok: false; motivo: MotivoDaRecusa; texto?: string }

export type ResultadoDaJogada = { ok: true; duelo: DueloGravado } | RecusaDaJogada

export type CriacaoDoDuelo =
  | { ok: true; duelo: DueloGravado }
  | { ok: false; motivo: 'mesmaConta' }
  /** `naoEDono` = alguma ficha do lado não é da conta dele; `vazio`/`cheio` como em `montarLutadores`. */
  | { ok: false; motivo: 'naoEDono' | 'vazio' | 'cheio'; lado: LadoDoTreino }
  /** F2 (fatia A): a ficha `nome` do lado tem HP máximo 0 (`fichaSemHpNaEscolha`): fica de fora, e a tela diz "ficha sem HP". */
  | { ok: false; motivo: 'semHp'; lado: LadoDoTreino; nome: string }

export type LeituraDaJogada = { ok: true; jogada: JogadaDoDuelo } | { ok: false; motivo: 'grandeDemais' | 'formato' }

/** O duelo como os dois o recebem: as fichas projetadas e só a cauda do registro (`REGISTRO_PARA_JOGADOR_MAX`). */
export interface DueloNoFio {
  versao: number
  id: string
  seq: number
  fim: FimDoDuelo | null
  jogadores: Readonly<Record<LadoDoTreino, JogadorDoDuelo>>
  lutadores: LutadoresDoTreino
  /** Onde cada ficha está na grade, pelo id do token (`DueloGravado.posicoes`). */
  posicoes: Readonly<Record<string, CasaDoTreino>>
  /** Ainda dá para montar (`DueloGravado.montagem`): a tela manda as casas escolhidas só enquanto é `true`. */
  montagem: boolean
  turnos: TurnosDaCena
  regras: RegrasDaBatalha | null
  efeitos: readonly EfeitoDaBatalha[]
  registro: readonly LinhaParaJogador[]
}

function lojaDoDuelo(mesa: MesaDaBatalha, motor: MotorDoDuelo): LojaDaBatalha {
  return criarBatalhaStore(mesa, { rolarD20: motor.rolarD20, outraBatalhaLigada: () => false })
}

function cenaDaLoja(loja: LojaDaBatalha): BatalhaDaCena {
  const cena = loja.getState().cenas[CENA_DO_DUELO]
  if (cena === undefined) throw new RangeError('a batalha do duelo não está ligada')
  return cena
}

/** O fim pela regra da luta de treino (vitória, todos caídos, tempo pelos tetos de sempre). */
function fimNaMesa(mesa: MesaEmMemoria, cena: BatalhaDaCena, passos: number): FimDoDuelo | null {
  return fimDaLuta(mesa, { rodada: cena.turnos.rodada, passos }, TETOS_DO_TREINO)
}

// ───────────────────────────────────────────────────────────────────────────
// Começar
// ───────────────────────────────────────────────────────────────────────────

/**
 * O duelo novo: confere que cada ficha é da conta do lado dela (o `dono` do
 * doc completo), monta as vagas e as cópias (Lado A = quem convidou) e liga a
 * batalha como a luta de treino (a ordem pela Agilidade, o desempate no d20
 * do motor, a vez na primeira carta). As fichas recebidas não mudam.
 */
export function criarDuelo(pedido: PedidoDeDuelo, motor: MotorDoDuelo): CriacaoDoDuelo {
  if (pedido.a.contaId === pedido.b.contaId) return { ok: false, motivo: 'mesmaConta' }
  const escolhas: EscolhaDaVaga[] = []
  for (const lado of LADOS_DO_TREINO) {
    const { contaId, fichas } = pedido[lado]
    if (fichas.some((ficha) => ficha.dono !== contaId)) return { ok: false, motivo: 'naoEDono', lado }
    escolhas.push(...fichas.map((ficha) => ({ ficha, lado })))
  }
  const semHp = fichaSemHpNaEscolha(escolhas, motor.sistema)
  if (semHp !== null) return { ok: false, motivo: 'semHp', ...semHp }
  const montagem = montarLutadores(escolhas)
  if (!montagem.ok) return montagem
  const mesa = criarMesaEmMemoria(motor.sistema, montagem.lutadores)
  const loja = lojaDoDuelo(mesa, motor)
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA_DO_DUELO, {}, { combatentes, regras: null, desempate: 'd20' })
  const cena = cenaDaLoja(loja)
  const jogador = (lado: LadoDoTreino): JogadorDoDuelo => ({ contaId: pedido[lado].contaId, nome: pedido[lado].nome, ausenteDesde: null })
  return {
    ok: true,
    duelo: {
      versao: VERSAO_DO_MOTOR_DO_DUELO,
      id: pedido.id,
      jogadores: { a: jogador('a'), b: jogador('b') },
      lutadores: mesa.lutadores(),
      posicoes: Object.fromEntries(tokens.map((token) => [token.id, { col: token.col, row: token.row }])),
      montagem: true,
      cena,
      seq: 0,
      passos: 0,
      fim: fimNaMesa(mesa, cena, 0),
    },
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O servidor preenche os números (a regra é a da batalha)
// ───────────────────────────────────────────────────────────────────────────

type Recalculo<T> = { ok: true; pedido: T } | RecusaDaJogada

/** A recusa com o texto da regra no teto do fio (`motivoNoFio`: o mesmo corte do host da mesa, no fim de uma palavra). */
function recusa(motivo: MotivoDaRecusa, texto?: string | null): RecusaDaJogada {
  const dito = texto?.trim() ?? ''
  return dito === '' ? { ok: false, motivo } : { ok: false, motivo, texto: motivoNoFio(dito) }
}

/** As frases do host da mesa para a vez que andou e o golpe já fechado (`net/batalhaNoHost.ts`): a mesma palavra no app e no site. */
const TEXTO_DA_VEZ_QUE_PASSOU = 'A vez já passou'
const TEXTO_DO_GOLPE_RESOLVIDO = 'Esse golpe já foi resolvido'
const TEXTO_DO_ALVO_DE_FORA = 'Esse alvo não está na luta'
const TEXTO_DO_EVOLUIR_ENTRE_CONTAS = 'Evoluir é só no treino: o custo e a condição da evolução estão no texto da ficha, e na luta entre contas ninguém confere'

/** As recusas da grade do site (andar e montar não passam pela regra da batalha: o texto é daqui). */
const TEXTO_DA_CASA = 'Essa casa está ocupada ou fica fora da grade'
const TEXTO_DO_ANDAR_FORA_DA_VEZ = 'Só dá para andar na vez desta ficha'
const TEXTO_DA_MONTAGEM_FECHADA = 'A luta já começou: a casa de largada não muda mais'
const TEXTO_DA_METADE = 'Na montagem, cada um larga na própria área da grade'

/** Quem age: a carta (da vez, ou a do contra-ataque) e a cópia dela. */
interface QuemAge {
  carta: CartaDaOrdem
  personagem: Personagem
}

/** Os alvos do pedido com o dano do servidor (o mesmo em todos, como a mira preenche). */
function comODano(alvos: readonly PedidoDeAlvo[], dano: number | null): PedidoDeAlvo[] {
  return alvos.map((alvo) => ({ tokenId: alvo.tokenId, dano }))
}

/** F2 (fatia C): os ids dos cartões da cópia (todas as abas), e (fatia E) as chaves da raça e da ficha, para as perguntas de todo golpe do dono (o Electro da Aira). */
function idsDosCartoes(personagem: Personagem): string[] {
  return chavesDoDono(personagem)
}

/**
 * O Atacar com os números da ficha: o dano da arma (e da bala) pela cópia, o
 * que a mira do app sugere; Perfurante só se a arma diz; o Atacar não leva
 * selo (a mira só o sugere na técnica). Arma, bala e respostas (F2, fatia C:
 * o Electro da Aira) que a cópia não tem NÃO são recusadas aqui: seguem para
 * a regra da batalha, que recusa com o motivo dela (R3).
 */
function ataqueRecalculado(pedido: Extract<PedidoDeAcao, { tipo: 'atacar' }>, personagem: Personagem, sistema: SistemaDeRpg): Recalculo<PedidoDeAcao> {
  // De propósito: no site não há mestre para conceder a Surpresa.
  if (pedido.surpresa) return recusa('surpresa')
  const { respostas } = pedido
  const arma = pedido.armaId === null ? null : (armasDe(personagem).find((candidata) => candidata.id === pedido.armaId) ?? null)
  // De propósito: no site ninguém digita dano (arma marcada "à mão", ou dano que a ficha não lê).
  if (arma !== null && arma.aMao === true) return recusa('danoAMao')
  const bala = arma === null || pedido.balaId === undefined ? null : balaDaArma(arma, pedido.balaId)
  const valor = danoDoAtacarNoDuelo(personagem, sistema, arma, bala)
  if (valor === undefined) return recusa('danoAMao')
  const perfurante = pedido.perfurante && arma !== null && ehPerfurante(arma)
  const perfuracao = perfurante && arma !== null ? perfuracaoDe(arma) : null
  const novo: PedidoDeAcao = { tipo: 'atacar', armaId: pedido.armaId, alvos: comODano(pedido.alvos, valor === null ? null : danoNoTeto(valor)), surpresa: false, perfurante }
  if (perfuracao !== null) novo.perfuracao = perfuracao
  if (pedido.contraDe !== undefined) novo.contraDe = pedido.contraDe
  if (pedido.balaId !== undefined) novo.balaId = pedido.balaId
  if (respostas !== undefined) novo.respostas = respostas
  // Construtor C8: a arma de texto só de efeito leva o selo do Efeito dela (o mesmo que a mira sugere); é o golpe inteiro.
  // A montada não precisa: o host tira o selo das peças.
  if (pedido.selo !== undefined && arma !== null && !cartaoMontado(arma) && armaSoDeEfeito(arma)) {
    const sugerido = seloDaMira(arma, sistema)
    if (sugerido !== null) novo.selo = sugerido
  }
  return { ok: true, pedido: novo }
}

/**
 * Construtor C8: o dano do Atacar pela cópia. A arma montada pelas peças (o
 * host recalcula igual); a só de efeito ("Nada" no Soma no ataque) e a montada
 * sem dano dão `null` (golpe sem número); `undefined` = a conta não lê.
 */
function danoDoAtacarNoDuelo(personagem: Personagem, sistema: SistemaDeRpg, arma: ArmaDaFicha | null, bala: BalaDaArma | null): number | null | undefined {
  if (arma !== null && cartaoMontado(arma)) {
    const lido = danoDaTecnica(arma, { personagem, sistema, arma })
    return lido.tipo === 'valor' ? lido.valor : lido.tipo === 'semDano' ? null : undefined
  }
  if (arma !== null && armaSoDeEfeito(arma)) return null
  return danoSugeridoDoAtaque(personagem, sistema, arma, bala) ?? undefined
}

/**
 * A Habilidade com os números da ficha: o dano lido da técnica (ou da opção
 * escolhida) pela cópia, com o bônus dos selos de quem age, como a mira e o
 * robô; o custo da ficha (`custo: null`); a ação da ficha (`ACAO_SEM_A_FICHA`
 * quando ela não diz); Perfurante só se a técnica diz; o selo só o sugerido.
 * O dano "% da vida do alvo" (`precisaAlvo`, a Explosão) vai vazio: a batalha
 * o calcula alvo a alvo. Técnica, arma, opção e resposta que a cópia não tem
 * NÃO são recusadas aqui: o pedido segue sem número (`semNumero`) e a regra
 * da batalha recusa com o motivo dela (R3).
 */
function tecnicaRecalculada(pedido: Extract<PedidoDeAcao, { tipo: 'habilidade' }>, quem: QuemAge, cena: BatalhaDaCena, sistema: SistemaDeRpg): Recalculo<PedidoDeAcao> {
  // De propósito: no site não há mestre para conceder a Surpresa.
  if (pedido.surpresa) return recusa('surpresa')
  const { carta, personagem } = quem
  const { turnos } = cena
  const { respostas } = pedido
  // Nada do que o cliente digitaria: sem dano, o custo e a ação da ficha, sem Perfurante nem selo.
  const semNumero: PedidoDeAcao = { tipo: 'habilidade', cartaoId: pedido.cartaoId, armaId: pedido.armaId, alvos: comODano(pedido.alvos, null), surpresa: false, perfurante: false, custo: null, acao: ACAO_SEM_A_FICHA }
  if (pedido.contraDe !== undefined) semNumero.contraDe = pedido.contraDe
  if (pedido.variante !== undefined) semNumero.variante = pedido.variante
  if (respostas !== undefined) semNumero.respostas = respostas
  const arma = pedido.armaId === null ? null : (armasDe(personagem).find((candidata) => candidata.id === pedido.armaId) ?? null)
  const bonus = bonusDaBatalha(turnos.selos, carta.tokenId)
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: cena.regras })
  const tecnica = tecnicasNoMenu(personagem, sistema, turnos.combate?.[personagem.id], acoes, arma, bonus).find((candidata) => candidata.cartao.id === pedido.cartaoId)
  if (tecnica === undefined) return { ok: true, pedido: semNumero }
  // De propósito: no site ninguém digita dano (técnica marcada "à mão").
  if (tecnica.cartao.aMao === true) return recusa('danoAMao')
  const variante = pedido.variante === undefined ? null : varianteDoPedido(tecnica.cartao, pedido.variante)
  if (pedido.variante !== undefined && variante === null) return { ok: true, pedido: semNumero }
  // A opção que não é a principal pode trazer o dano e o selo dela (`preenchimentoDaVariante`, como a mira).
  const daOpcao = variante === null || variante.principal ? null : preenchimentoDaVariante(tecnica.cartao, variante, { personagem, sistema, arma, vidaDoAlvo: null, bonusDaBatalha: bonus })
  // F2 (fatias B e C): as respostas da mira (ponto vital, quadrados empurrados, o Electro da Aira) mudam o dano; a resposta torta não entra na conta e a batalha a recusa.
  if (respostas !== undefined && motivoDasRespostasDoGolpe(pedido.cartaoId, idsDosCartoes(personagem), respostas) !== null) return { ok: true, pedido: semNumero }
  const leitura = daOpcao?.dano ?? (respostas === undefined ? tecnica.dano : danoDaTecnica(tecnica.cartao, { personagem, sistema, arma, bonusDaBatalha: bonus }, respostas))
  // De propósito: no site ninguém digita dano (o que a ficha não lê). O `precisaAlvo` passa: a batalha fecha a conta pela vida de cada alvo.
  if (leitura.tipo !== 'valor' && leitura.tipo !== 'semDano' && leitura.tipo !== 'precisaAlvo') return recusa('danoAMao')
  const perfurante = pedido.perfurante && tecnica.perfurante
  const novo: PedidoDeAcao = {
    ...semNumero,
    alvos: comODano(pedido.alvos, leitura.tipo === 'valor' ? danoNoTeto(leitura.valor) : null),
    perfurante,
    // A ação do pedido é ignorada: `null` = a da ficha (a store lê); a ficha que não diz gasta a Simples.
    acao: tecnica.acao === null ? ACAO_SEM_A_FICHA : null,
  }
  if (perfurante && tecnica.perfuracao !== undefined) novo.perfuracao = tecnica.perfuracao
  if (pedido.selo !== undefined) {
    const sugerido = daOpcao === null ? seloDaMira(tecnica.cartao, sistema) : daOpcao.selo === null ? null : seloPedidoValido(daOpcao.selo, sistema)
    if (sugerido !== null) novo.selo = sugerido
  }
  return { ok: true, pedido: novo }
}

/**
 * Ativar a forma refeito: a ação é a do campo Ação da cópia (`acaoDaForma`:
 * vazio ou ilegível = Completa; a forma Livre não gasta, a store confere); a
 * do pedido é ignorada. Senão a forma de Ação Completa ligaria pedida como
 * Simples ou Bônus e sobraria ação na vez. A forma que não é da cópia segue
 * para a regra da batalha, que recusa com o motivo dela (R3).
 */
function formaRecalculada(pedido: Extract<PedidoDeAcao, { tipo: 'transformar' }>, personagem: Personagem, sistema: SistemaDeRpg): Recalculo<PedidoDeAcao> {
  const cartao = formaDaFicha(personagem, sistema, pedido.cartaoId)
  return { ok: true, pedido: { tipo: 'transformar', cartaoId: pedido.cartaoId, acao: cartao === null ? ACAO_SEM_A_FICHA : acaoDaForma(cartao), trocarImagem: pedido.trocarImagem } }
}

function acaoRecalculada(pedido: PedidoDeAcao, quem: QuemAge, cena: BatalhaDaCena, sistema: SistemaDeRpg): Recalculo<PedidoDeAcao> {
  switch (pedido.tipo) {
    // Sem dano, custo nem ação vindos do cliente: a regra da batalha confere o resto.
    case 'concentrar':
    case 'destransformar':
      return { ok: true, pedido }
    case 'transformar':
      return formaRecalculada(pedido, quem.personagem, sistema)
    case 'mover':
      return recusa('foraDoDuelo')
    case 'atacar':
      return ataqueRecalculado(pedido, quem.personagem, sistema)
    case 'habilidade':
      return tecnicaRecalculada(pedido, quem, cena, sistema)
  }
}

/** O bônus de reação dos selos da ficha (o mesmo do robô, `reacaoDoBoneco`): o modificador do pedido é ignorado. */
function modificadorDaReacao(turnos: TurnosDaCena, tokenId: string): number {
  return bonusDaReacao(bonusDaBatalha(turnos.selos, tokenId))
}

/**
 * O d20 da reação como o servidor o pede. A Vantagem que o cliente marca não
 * vale: na mesa é o mestre quem a concede e ele vê o pedido; aqui ninguém vê,
 * e o pedido com "vantagem" rolaria 2 dados em toda reação. A Desvantagem
 * pedida fica (só piora o dado de quem pede); a que a regra impõe (selo, golpe)
 * a batalha aplica sozinha (`vantagemDaReacao`).
 */
function rolarSemVantagemPedida(pedido: Extract<PedidoDeReacao, { tipo: 'rolar' }>, modificador: number): PedidoDeReacao {
  const limpo: PedidoDeReacao = { tipo: 'rolar', golpeId: pedido.golpeId, tokenId: pedido.tokenId, modificador }
  if (pedido.vantagem === 'desvantagem') limpo.vantagem = 'desvantagem'
  return limpo
}

/**
 * A reação com os números da ficha: o modificador é o dos selos; a técnica
 * leva o custo da ficha e o selo sugerido. Quem valida e resolve é a `reagir`
 * da batalha (a mesma do jogador por LAN): a técnica que a cópia não tem, em
 * recarga ou sem SP é recusada por ela, com o motivo dela (R3).
 */
function reacaoRecalculada(pedido: PedidoDeReacao, turnos: TurnosDaCena, personagem: Personagem | null, sistema: SistemaDeRpg): Recalculo<PedidoDeReacao> {
  switch (pedido.tipo) {
    case 'rolar':
      // De propósito: a reação livre (sem golpe) é o teste que o mestre pede na mesa; no site contaria passo do relógio da luta.
      if (pedido.golpeId === null) return recusa('foraDoDuelo')
      return { ok: true, pedido: rolarSemVantagemPedida(pedido, modificadorDaReacao(turnos, pedido.tokenId)) }
    // De propósito: rerolar com Ponto Saga e passar sem dano são decisões do mestre.
    case 'rerolar':
    case 'semDano':
      return recusa('foraDoDuelo')
    case 'escolher':
    case 'naoReagir':
    case 'passar':
      return { ok: true, pedido }
    case 'tecnica': {
      const achada = personagem === null ? null : tecnicaPorId(personagem, sistema, pedido.cartaoId)
      // A técnica que a cópia não tem segue sem escolha nem número: a batalha recusa com o motivo dela.
      if (achada === null) return { ok: true, pedido: { tipo: 'tecnica', golpeId: pedido.golpeId, tokenId: pedido.tokenId, cartaoId: pedido.cartaoId, saida: 'rolar', custo: null, modificador: modificadorDaReacao(turnos, pedido.tokenId) } }
      // De propósito: o texto que não diz a saída (modo "escolher") rola o d20; sem mestre, ninguém escolhe a esquiva.
      // F2 (fatia D): a técnica da tabela com saídas próprias (Armadura Humana: Defender ou Atacar) aceita a escolha de quem reage.
      const daTecnica = saidasDaTecnica(achada.cartao.id, modoDaReacao(achada.cartao))
      const saida = reacaoAMaoDe(achada.cartao.id)?.saidas !== undefined && daTecnica.saidas.includes(pedido.saida) ? pedido.saida : (daTecnica.sugerida ?? 'rolar')
      const novo: PedidoDeReacao = { tipo: 'tecnica', golpeId: pedido.golpeId, tokenId: pedido.tokenId, cartaoId: pedido.cartaoId, saida, custo: null }
      if (saida === 'rolar') novo.modificador = modificadorDaReacao(turnos, pedido.tokenId)
      const selo = pedido.seloNoAtacante === undefined ? null : seloDaReacao(achada.cartao)
      if (selo !== null) novo.seloNoAtacante = selo
      return { ok: true, pedido: novo }
    }
  }
}

/**
 * A resposta à marca refeita: o "rolei fora" é da mesa; o teste rola com o
 * modificador da ficha (o rank do atributo com os selos, `modificadorDoTeste`
 * na store), nunca o digitado, como o bônus da reação.
 */
function marcaRecalculada(pedido: PedidoDeMarca): Recalculo<PedidoDeMarca> {
  if (pedido.como === 'passou' || pedido.como === 'falhou') return recusa('foraDoDuelo')
  return { ok: true, pedido: { tipo: 'marcar', lembreteId: pedido.lembreteId, como: pedido.como } }
}

// ───────────────────────────────────────────────────────────────────────────
// Jogar
// ───────────────────────────────────────────────────────────────────────────

function ladoDaConta(duelo: DueloGravado, contaId: string): LadoDoTreino | null {
  return LADOS_DO_TREINO.find((lado) => duelo.jogadores[lado].contaId === contaId) ?? null
}

function vagaDoToken<L extends LadoDaLuta>(lutadores: LutadoresDaLuta<L>, tokenId: string | undefined): VagaDaLuta<L> | null {
  return lutadores.vagas.find((vaga) => vaga.tokenId === tokenId) ?? null
}

/**
 * Quem joga e onde (o que muda entre o duelo e a luta v4 de `luta.ts`): no
 * duelo, a ficha é do lado da conta e a largada é na metade dele; na luta v4,
 * a ficha é da própria conta (no time cada um joga a sua) e a largada é na
 * zona do lado.
 */
export interface QuemJoga {
  autor: AutorDaAcao
  /** A ficha desta vaga é de quem joga? Não = `naoEDaConta`. */
  podeJogar(vaga: VagaDaLuta): boolean
  /** Na montagem, quem joga pode largar nesta casa (já dentro da grade)? */
  podeMontarEm(casa: CasaDoTreino): boolean
}

/** O que uma jogada muda (o duelo e a luta v4 guardam estes campos iguais; o `seq` e o fim são de quem chama). */
export interface MesaDaJogada<L extends LadoDaLuta = LadoDoTreino> {
  lutadores: LutadoresDaLuta<L>
  posicoes: Readonly<Record<string, CasaDoTreino>>
  montagem: boolean
  cena: BatalhaDaCena
  passos: number
}

/** A jogada aceita (`mexeuNaLuta` falso = só a casa de largada mudou: o fim não muda) ou o motivo da recusa. */
export type JogadaNaMesa<L extends LadoDaLuta = LadoDoTreino> = { ok: true; mesa: MesaDaJogada<L>; mexeuNaLuta: boolean } | RecusaDaJogada

/**
 * Por que a batalha recusou a reação, no texto do app: o golpe que já fechou
 * (a frase do host da mesa) ou a regra da técnica de reação
 * (`motivoDaReacaoComTecnica`, a mesma conferência da store). `null` = a regra
 * não diz (fica a frase do código).
 */
function textoDaReacaoRecusada(turnos: TurnosDaCena, pedido: PedidoDeReacao, personagem: Personagem | null, sistema: SistemaDeRpg): string | null {
  const golpe = (turnos.golpes ?? []).find((candidato) => candidato.id === pedido.golpeId)
  const alvo = golpe?.alvos.find((candidato) => candidato.tokenId === pedido.tokenId)
  if (golpe === undefined || alvo === undefined || alvo.danoFinal !== undefined) return TEXTO_DO_GOLPE_RESOLVIDO
  if (pedido.tipo !== 'tecnica') return null
  const combate = personagem === null ? undefined : turnos.combate?.[personagem.id]
  return motivoDaReacaoComTecnica({ personagem, sistema, combate, quemPede: 'jogador' }, alvo, pedido, golpe.overload, golpe.surpresa)
}

/** A carta que age: a do contra-ataque (`contraDe`, fora da vez) ou a da vez. */
function cartaQueAge(turnos: TurnosDaCena, pedido: PedidoDeAcao): CartaDaOrdem | null {
  const contraDe = contraDoPedido(pedido)
  if (contraDe === undefined) return cartaDaVez(turnos)
  const contra = (turnos.contras ?? []).find((candidato) => candidato.golpeId === contraDe)
  return contra === undefined ? null : (turnos.cartas.find((carta) => carta.tokenId === contra.tokenId) ?? null)
}

/**
 * A jogada na store, com o pedido já refeito: `null` = aceita; senão, a recusa
 * (antes da store, ou dela). Quando é a regra da batalha que recusa, o texto é
 * o motivo que ela dá (R1 do plano de unificação do combate, 10/11/2026).
 */
function jogarNaLoja(
  loja: LojaDaBatalha,
  mesa: MesaDaLuta,
  cena: BatalhaDaCena,
  quem: QuemJoga,
  jogada: Exclude<JogadaDoDuelo, { tipo: 'andar' | 'montar' }>,
  sistema: SistemaDeRpg,
  entreContas: boolean,
): RecusaDaJogada | null {
  const { turnos } = cena
  const { autor } = quem
  const lutadores = mesa.lutadores()
  const ehDoLado = (tokenId: string | undefined): boolean => {
    const vaga = vagaDoToken(lutadores, tokenId)
    return vaga !== null && quem.podeJogar(vaga)
  }
  const copiaDe = (personagemId: string | null): Personagem | null => mesa.personagens().find((personagem) => personagem.id === personagemId) ?? null
  switch (jogada.tipo) {
    case 'passar': {
      if (!ehDoLado(cartaDaVez(turnos)?.tokenId)) return recusa('naoEDaConta')
      return loja.getState().passarVez(CENA_DO_DUELO, autor, jogada.vez) ? null : recusa('regra', TEXTO_DA_VEZ_QUE_PASSOU)
    }
    case 'agir': {
      const carta = cartaQueAge(turnos, jogada.pedido)
      if (carta === null) return recusa('regra', loja.getState().motivoDoAgir(CENA_DO_DUELO, autor, jogada.vez, jogada.pedido))
      if (!ehDoLado(carta.tokenId)) return recusa('naoEDaConta')
      const personagem = copiaDe(carta.personagemId)
      if (personagem === null || carta.bando !== undefined) return recusa('regra', loja.getState().motivoDoAgir(CENA_DO_DUELO, autor, jogada.vez, jogada.pedido))
      const refeito = acaoRecalculada(jogada.pedido, { carta, personagem }, cena, sistema)
      if (!refeito.ok) return refeito
      if (loja.getState().agir(CENA_DO_DUELO, autor, jogada.vez, refeito.pedido)) return null
      // A store recusou sem mudar nada: o motivo é o que a regra diz deste mesmo pedido, agora.
      return recusa('regra', loja.getState().motivoDoAgir(CENA_DO_DUELO, autor, jogada.vez, refeito.pedido))
    }
    case 'reagir': {
      const vaga = vagaDoToken(lutadores, jogada.pedido.tokenId)
      if (vaga === null) return recusa('regra', TEXTO_DO_GOLPE_RESOLVIDO)
      if (!quem.podeJogar(vaga)) return recusa('naoEDaConta')
      const personagem = copiaDe(vaga.personagemId)
      const refeito = reacaoRecalculada(jogada.pedido, turnos, personagem, sistema)
      if (!refeito.ok) return refeito
      if (loja.getState().reagir(CENA_DO_DUELO, autor, refeito.pedido)) return null
      return recusa('regra', textoDaReacaoRecusada(turnos, refeito.pedido, personagem, sistema))
    }
    case 'marcar': {
      // O lembrete é da ficha que atirou: só quem a joga responde (a store confere a passiva, o SP e o alvo).
      const lembrete = (turnos.lembretesDaMarca ?? []).find((candidato) => candidato.id === jogada.pedido.lembreteId)
      if (lembrete === undefined) return recusa('regra', 'Esse lembrete da marca não espera mais resposta')
      if (!ehDoLado(lembrete.tokenId)) return recusa('naoEDaConta')
      const refeito = marcaRecalculada(jogada.pedido)
      if (!refeito.ok) return refeito
      return loja.getState().marcar(CENA_DO_DUELO, autor, refeito.pedido) ? null : recusa('regra')
    }
    case 'passiva': {
      const { pedido } = jogada
      if (!ehDoLado(pedido.tokenId)) return recusa('naoEDaConta')
      // O alvo da passiva tem de estar na luta (o host da mesa confere que está na tela de quem pede).
      if (pedido.tipo === 'passiva' && pedido.alvoTokenId !== undefined && vagaDoToken(lutadores, pedido.alvoTokenId) === null) return recusa('regra', TEXTO_DO_ALVO_DE_FORA)
      const limpo = passivaSemNumero(pedido)
      if (loja.getState().passiva(CENA_DO_DUELO, autor, limpo)) return null
      // A store recusou sem mudar nada: o motivo é o que a regra das passivas diz deste mesmo pedido, agora.
      const vaga = vagaDoToken(lutadores, pedido.tokenId)
      const personagem = vaga === null ? null : copiaDe(vaga.personagemId)
      return recusa('regra', motivoDaPassiva({ personagem, sistema, turnos, aplicarSoComLembrete: autor.tipo === 'jogador' }, limpo))
    }
    case 'evoluir': {
      if (!ehDoLado(jogada.pedido.tokenId)) return recusa('naoEDaConta')
      // De propósito: o custo do Evoluir é o digitado e a condição é texto livre da ficha (a batalha não lê nenhum dos
      // dois: na mesa o mestre vê). Entre contas ninguém vê, e o pedido com custo 0 evoluiria de graça.
      if (entreContas) return recusa('foraDoDuelo', TEXTO_DO_EVOLUIR_ENTRE_CONTAS)
      if (loja.getState().evoluir(CENA_DO_DUELO, autor, jogada.pedido)) return null
      return recusa('regra', loja.getState().motivoDoEvoluir(CENA_DO_DUELO, autor, jogada.pedido))
    }
    case 'armas': {
      const vaga = lutadores.vagas.find((candidata) => candidata.personagemId === jogada.personagemId)
      if (vaga === undefined || !quem.podeJogar(vaga)) return recusa('naoEDaConta')
      return loja.getState().escolherArmas(CENA_DO_DUELO, autor, jogada.personagemId, jogada.armas) ? null : recusa('regra')
    }
  }
}

/**
 * R4: a passiva sem número do cliente. O custo é o da ficha (`custo: null`)
 * e o selo é o que a batalha lê da ficha (sem `selo` no pedido), como o dano
 * e o custo do golpe. A opção (`variante`), o alvo e o atributo da Preparação
 * são escolhas de quem joga: a batalha confere.
 */
function passivaSemNumero(pedido: PedidoDePassiva): PedidoDePassiva {
  if (pedido.tipo === 'lembrete') return pedido
  const limpo: PedidoDePassiva = { tipo: 'passiva', tokenId: pedido.tokenId, cartaoId: pedido.cartaoId, ligar: pedido.ligar, custo: null }
  if (pedido.alvoTokenId !== undefined) limpo.alvoTokenId = pedido.alvoTokenId
  if (pedido.variante !== undefined) limpo.variante = pedido.variante
  return limpo
}

/** Quem aplica o que na mesa só o mestre aplica: no site, a própria regra. */
const AUTOR_DA_REGRA: AutorDaAcao = { tipo: 'mestre' }

/**
 * R4 (o dano de selo por vez): na mesa, o lembrete do Sangramento na vez de
 * quem sangra só o mestre aplica (a batalha recusa o do jogador). O site não
 * tem mestre, e o Sangrando tirava 0: depois de cada jogada aceita, a regra
 * aplica os lembretes de Sangramento que esperam, pelo caminho da batalha.
 * `chave` = a cena da store (a luta v4 chama depois de cada passo do robô,
 * com a cena dela). Cena desligada: nada.
 */
export function aplicarSangramentos(loja: LojaDaBatalha, chave: string = CENA_DO_DUELO): void {
  const cena = loja.getState().cenas[chave]
  if (cena === undefined) return
  const esperando = Object.values(cena.turnos.combate ?? {}).flatMap((combate) => (combate.lembretes ?? []).filter(ehLembreteDoSangramento))
  for (const lembrete of esperando) {
    loja.getState().passiva(chave, AUTOR_DA_REGRA, { tipo: 'lembrete', tokenId: lembrete.tokenId, cartaoId: lembrete.cartaoId, aplicar: true })
  }
}

/** A grade não tem paredes (como a Arena do app). */
const SEM_PAREDES: readonly ParedeDoPasso[] = []

function casaNaGrade(col: number, row: number, grade: GradeDaArena): boolean {
  return Number.isSafeInteger(col) && Number.isSafeInteger(row) && col >= 0 && row >= 0 && col < grade.colunas && row < grade.linhas
}

/** A coluna (ou linha) do ponto em px da grade. */
function casaDoValor(valor: number): number {
  return Math.floor(valor / CASA_DA_ARENA)
}

type Andanca = { ok: true; posicoes: Record<string, CasaDoTreino> } | RecusaDaJogada

/**
 * O `andar` na loja: o lado da ficha; a vez dela (`naVez`) ou o contra-ataque
 * dela; a casa dentro da grade; o passo da batalha do app sem paredes, com a
 * casa de outra ficha recusando (como `moverFicha` da Arena). Aceito: gasta o
 * contra-ataque (a linha "usou o contra-ataque para se mover"), soma os
 * blocos no caminho e no MOV da vez (`somarCaminho`) e devolve as posições novas.
 */
function andarNaLoja(
  loja: LojaDaBatalha,
  duelo: Pick<MesaDaJogada<LadoDaLuta>, 'cena' | 'lutadores' | 'posicoes'>,
  quem: QuemJoga,
  jogada: Extract<JogadaDoDuelo, { tipo: 'andar' }>,
  regra: RegraDoAndar,
  grade: GradeDaArena,
): Andanca {
  const { turnos } = duelo.cena
  const { tokenId } = jogada
  const vaga = vagaDoToken(duelo.lutadores, tokenId)
  if (vaga === null) return recusa('regra', TEXTO_DA_CASA)
  if (!quem.podeJogar(vaga)) return recusa('naoEDaConta')
  const contra = jogada.contraDe === undefined ? null : ((turnos.contras ?? []).find((candidato) => candidato.golpeId === jogada.contraDe && candidato.tokenId === tokenId) ?? null)
  if (jogada.contraDe !== undefined && contra === null) return recusa('regra', 'Esse contra-ataque não existe mais')
  if (regra === 'naVez' && contra === null) {
    const { vez } = jogada
    if (vez === null || turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada || cartaDaVez(turnos)?.tokenId !== tokenId) return recusa('regra', TEXTO_DO_ANDAR_FORA_DA_VEZ)
  }
  const de = duelo.posicoes[tokenId]
  if (de === undefined || !casaNaGrade(jogada.col, jogada.row, grade)) return recusa('regra', TEXTO_DA_CASA)
  const passo = passoEmBatalha({
    grid: CASA_DA_ARENA,
    colunas: grade.colunas,
    linhas: grade.linhas,
    de: centroDaCasaNaArena(de),
    para: centroDaCasaNaArena({ col: jogada.col, row: jogada.row }),
    tamanho: 1,
    passoMaximo: null,
    paredesDoHost: SEM_PAREDES,
    paredesDoJogador: SEM_PAREDES,
    noChao: () => true,
    ocupada: (ponto) => Object.entries(duelo.posicoes).some(([outro, casa]) => outro !== tokenId && casa.col === casaDoValor(ponto.x) && casa.row === casaDoValor(ponto.y)),
  })
  // Casa ocupada, ou a mesma casa (não é passo).
  if (!passo.ok || passo.blocos === 0) return recusa('regra', TEXTO_DA_CASA)
  if (contra !== null && !loja.getState().agir(CENA_DO_DUELO, quem.autor, null, { tipo: 'mover', contraDe: contra.golpeId })) return recusa('regra', loja.getState().motivoDoAgir(CENA_DO_DUELO, quem.autor, null, { tipo: 'mover', contraDe: contra.golpeId }))
  loja.getState().somarCaminho(CENA_DO_DUELO, tokenId, passo.blocos, passo.caminho)
  return { ok: true, posicoes: { ...duelo.posicoes, [tokenId]: { col: casaDoValor(passo.x), row: casaDoValor(passo.y) } } }
}

/** A metade da grade de cada lado, como a Arena monta: as colunas da esquerda são do Lado A, as da direita do B. */
function ladoDaMetade(col: number): LadoDoTreino {
  return col < Math.floor(GRADE_DO_TREINO.colunas / 2) ? 'a' : 'b'
}

/**
 * O `montar`: só na montagem (ninguém agiu ainda), só a ficha do lado de quem
 * pede, para uma casa da metade dele, dentro da grade e livre (a casa de outra
 * ficha, ou a própria, recusa). Não passa pela loja: sem MOV, sem vez, sem
 * registro; só a posição muda.
 */
function montarNaGrade(
  duelo: Pick<MesaDaJogada<LadoDaLuta>, 'montagem' | 'lutadores' | 'posicoes'>,
  quem: QuemJoga,
  jogada: Extract<JogadaDoDuelo, { tipo: 'montar' }>,
  grade: GradeDaArena,
): Andanca {
  if (!duelo.montagem) return recusa('regra', TEXTO_DA_MONTAGEM_FECHADA)
  const vaga = vagaDoToken(duelo.lutadores, jogada.tokenId)
  if (vaga === null) return recusa('regra', TEXTO_DA_CASA)
  if (!quem.podeJogar(vaga)) return recusa('naoEDaConta')
  const { col, row } = jogada
  if (!casaNaGrade(col, row, grade)) return recusa('regra', TEXTO_DA_CASA)
  if (!quem.podeMontarEm({ col, row })) return recusa('regra', TEXTO_DA_METADE)
  if (Object.values(duelo.posicoes).some((casa) => casa.col === col && casa.row === row)) return recusa('regra', TEXTO_DA_CASA)
  return { ok: true, posicoes: { ...duelo.posicoes, [jogada.tokenId]: { col, row } } }
}

/**
 * O núcleo de uma jogada, sem a conta, o `seq` nem o fim (o duelo e a luta v4
 * conferem os deles antes e somam depois): o `montar` muda só a casa de
 * largada; o resto passa pela loja numa cópia (a recusa no meio não deixa o
 * estado recebido pela metade), com o pedido refeito pelo servidor. Aceita:
 * os campos novos, `passos` + 1 só no agir, reagir e passar.
 */
export function jogarNaMesa<L extends LadoDaLuta>(
  antes: MesaDaJogada<L>,
  motor: MotorDoDuelo,
  quem: QuemJoga,
  jogada: JogadaDoDuelo,
  grade: GradeDaArena,
  regraDoAndar: RegraDoAndar,
): JogadaNaMesa<L> {
  if (jogada.tipo === 'montar') {
    const montou = montarNaGrade(antes, quem, jogada, grade)
    if (!montou.ok) return montou
    return { ok: true, mexeuNaLuta: false, mesa: { lutadores: antes.lutadores, posicoes: montou.posicoes, montagem: antes.montagem, cena: antes.cena, passos: antes.passos } }
  }
  const copia = structuredClone({ lutadores: antes.lutadores, posicoes: antes.posicoes, cena: antes.cena, passos: antes.passos })
  const mesa = criarMesaEmMemoria(motor.sistema, copia.lutadores, grade)
  const loja = lojaDoDuelo(mesa, motor)
  // A cena volta inteira pela store (o `setState` do zustand), como em `retomarLuta`.
  loja.setState({ cenas: { [CENA_DO_DUELO]: copia.cena } })
  if (jogada.tipo === 'andar') {
    const andou = andarNaLoja(loja, copia, quem, jogada, regraDoAndar, grade)
    if (!andou.ok) return andou
    return { ok: true, mexeuNaLuta: true, mesa: { lutadores: mesa.lutadores(), posicoes: andou.posicoes, montagem: false, cena: cenaDaLoja(loja), passos: copia.passos } }
  }
  // Só o treino local joga com `livre`: lá os dois lados são de quem joga (o outro é o robô dele).
  const recusada = jogarNaLoja(loja, mesa, copia.cena, quem, jogada, motor.sistema, regraDoAndar === 'naVez')
  if (recusada !== null) return recusada
  aplicarSangramentos(loja)
  // Só o golpe, a reação e a vez contam passo; a marca, a passiva, o Evoluir e as armas não (como andar).
  const contaPasso = jogada.tipo === 'agir' || jogada.tipo === 'reagir' || jogada.tipo === 'passar'
  const passos = contaPasso ? copia.passos + 1 : copia.passos
  return { ok: true, mexeuNaLuta: true, mesa: { lutadores: mesa.lutadores(), posicoes: copia.posicoes, montagem: false, cena: cenaDaLoja(loja), passos } }
}

/** O fim pela regra da luta de treino sobre os campos da jogada (os tetos de sempre). */
export function fimDaMesaDaJogada<L extends LadoDaLuta>(sistema: SistemaDeRpg | null, mesa: MesaDaJogada<L>): FimDaLuta<L> | null {
  return fimDaLuta(mesaDosLutadores(sistema, mesa.lutadores), { rodada: mesa.cena.turnos.rodada, passos: mesa.passos }, TETOS_DO_TREINO)
}

/**
 * Uma jogada da conta `contaId`. Confere, nesta ordem: a versão do motor, o
 * fim, a conta, o `seq`, o lado da ficha que age, reage ou anda; refaz o pedido
 * (dano, custo, ação, selo, Perfurante, bônus da reação) e passa pela mesma regra
 * da batalha da mesa. Aceita: o estado novo, com `seq` e `passos` + 1 (andar
 * e montar não contam passo) e o fim conferido; a primeira jogada que não é
 * `montar` fecha a montagem. Recusada: o motivo, e o duelo recebido fica como
 * estava. `regraDoAndar`: o duelo usa `naVez` (o padrão); o treino local, `livre`.
 */
export function aplicarJogada(duelo: DueloGravado, motor: MotorDoDuelo, contaId: string, jogada: JogadaDoDuelo, regraDoAndar: RegraDoAndar = 'naVez'): ResultadoDaJogada {
  if (duelo.versao !== VERSAO_DO_MOTOR_DO_DUELO) return recusa('versao')
  if (duelo.fim !== null) return recusa('acabou')
  const lado = ladoDaConta(duelo, contaId)
  if (lado === null) return recusa('naoJoga')
  if (jogada.seq !== duelo.seq) return recusa('seqVelho')
  const jogador = duelo.jogadores[lado]
  const quem: QuemJoga = {
    autor: { tipo: 'jogador', playerId: jogador.contaId, nome: jogador.nome },
    podeJogar: (vaga) => vaga.lado === lado,
    podeMontarEm: (casa) => ladoDaMetade(casa.col) === lado,
  }
  const feito = jogarNaMesa(duelo, motor, quem, jogada, GRADE_DO_TREINO, regraDoAndar)
  if (!feito.ok) return feito
  // O montar não mexe na luta: o fim fica o de antes (null: o acabado já foi recusado).
  const fim = feito.mexeuNaLuta ? fimDaMesaDaJogada(motor.sistema, feito.mesa) : duelo.fim
  return { ok: true, duelo: { ...duelo, ...feito.mesa, seq: duelo.seq + 1, fim } }
}

/**
 * A conta `contaId` desiste: o outro lado vence na hora, em qualquer vez (não
 * é jogada: não pede `seq`, não passa pela batalha). Como a ausência, não
 * muda `seq` nem `passos`. Recusada (versão, acabado, conta de fora): o
 * duelo recebido fica como estava.
 */
export function desistirDoDuelo(duelo: DueloGravado, contaId: string): ResultadoDaJogada {
  if (duelo.versao !== VERSAO_DO_MOTOR_DO_DUELO) return recusa('versao')
  if (duelo.fim !== null) return recusa('acabou')
  const lado = ladoDaConta(duelo, contaId)
  if (lado === null) return recusa('naoJoga')
  return { ok: true, duelo: { ...duelo, fim: { tipo: 'desistencia', vencedor: lado === 'a' ? 'b' : 'a' } } }
}

// ───────────────────────────────────────────────────────────────────────────
// Quem caiu (resposta 12.15): o estado; a contagem é do servidor (T6)
// ───────────────────────────────────────────────────────────────────────────

/** A conta ficou sem nenhum socket em `agora`. Já ausente: fica o primeiro instante. Duelo acabado ou conta de fora: o mesmo duelo. */
export function marcarAusente(duelo: DueloGravado, contaId: string, agora: number): DueloGravado {
  const lado = ladoDaConta(duelo, contaId)
  if (duelo.fim !== null || lado === null || duelo.jogadores[lado].ausenteDesde !== null) return duelo
  return { ...duelo, jogadores: { ...duelo.jogadores, [lado]: { ...duelo.jogadores[lado], ausenteDesde: agora } } }
}

/** A conta voltou (abriu um socket). Já presente, ou conta de fora: o mesmo duelo. */
export function marcarPresente(duelo: DueloGravado, contaId: string): DueloGravado {
  const lado = ladoDaConta(duelo, contaId)
  if (lado === null || duelo.jogadores[lado].ausenteDesde === null) return duelo
  return { ...duelo, jogadores: { ...duelo.jogadores, [lado]: { ...duelo.jogadores[lado], ausenteDesde: null } } }
}

/** O menor prazo de volta (ms) dos ausentes: a coluna `prazo` e o `alarm()` do DO. `null` = ninguém ausente, ou já acabou. Sem prazo por turno. */
export function prazoDoDuelo(duelo: DueloGravado): number | null {
  if (duelo.fim !== null) return null
  const prazos = LADOS_DO_TREINO.map((lado) => duelo.jogadores[lado].ausenteDesde).filter((desde): desde is number => desde !== null).map((desde) => desde + VOLTA_DO_AUSENTE_MS)
  return prazos.length === 0 ? null : Math.min(...prazos)
}

/** Em `agora`, quem passou do prazo perde; os dois passaram = ninguém vence. Ninguém passou (ou já acabou): o mesmo duelo. */
export function vencerAusencia(duelo: DueloGravado, agora: number): DueloGravado {
  if (duelo.fim !== null) return duelo
  const passouDoPrazo = (lado: LadoDoTreino): boolean => {
    const desde = duelo.jogadores[lado].ausenteDesde
    return desde !== null && agora >= desde + VOLTA_DO_AUSENTE_MS
  }
  const sairam = LADOS_DO_TREINO.filter(passouDoPrazo)
  if (sairam.length === 0) return duelo
  const vencedor = sairam.length === 2 ? null : sairam[0] === 'a' ? 'b' : 'a'
  return { ...duelo, fim: { tipo: 'ausencia', vencedor } }
}

// ───────────────────────────────────────────────────────────────────────────
// O fio
// ───────────────────────────────────────────────────────────────────────────

function seqValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

/** Um id da batalha no fio (token, golpe): texto não vazio até `ID_DA_BATALHA_MAX`. */
function idDoFio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= ID_DA_BATALHA_MAX
}

/** A coluna ou a linha pedida: inteiro de 0 em diante (a grade confere o teto na jogada). */
function indiceDaCasa(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function lerVez(valor: unknown): VezEsperada | null {
  if (!ehRegistro(valor)) return null
  const { cartaId, rodada } = valor
  if (typeof cartaId !== 'string' || cartaId.length === 0 || cartaId.length > ID_DA_BATALHA_MAX) return null
  if (typeof rodada !== 'number' || !Number.isSafeInteger(rodada) || rodada < 1 || rodada > RODADA_MAX) return null
  return { cartaId, rodada }
}

/**
 * O dano e o custo do pedido viram `null` ANTES da leitura: o servidor os
 * recalcula, então nem o número fora do teto ("1e12", "abc") recusa a jogada
 * por formato. O resto do pedido passa pela leitura do fio da batalha.
 */
function semDanoNemCusto(pedido: unknown): unknown {
  if (!ehRegistro(pedido)) return pedido
  const limpo: Record<string, unknown> = { ...pedido }
  if (Array.isArray(limpo.alvos)) limpo.alvos = limpo.alvos.map((alvo: unknown) => (ehRegistro(alvo) ? { ...alvo, dano: null } : alvo))
  if (limpo.tipo === 'habilidade') limpo.custo = null
  return limpo
}

/** O contra-ataque que o pedido usa (`contraDe`); `undefined` = pedido da vez. */
function contraDoPedido(pedido: PedidoDeAcao): string | undefined {
  return pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
}

/**
 * A resposta à marca do fio: `como` em enum fechado (`COMO_MARCA`). O
 * modificador digitado fica de fora ANTES da leitura, como o dano: o servidor
 * usa o da ficha, então nem um número torto recusa a jogada por formato.
 */
function lerPedidoDeMarca(valor: unknown): PedidoDeMarca | null {
  if (!ehRegistro(valor) || valor.tipo !== 'marcar' || !idDoFio(valor.lembreteId)) return null
  const como = COMO_MARCA.find((candidato) => candidato === valor.como)
  return como === undefined ? null : { tipo: 'marcar', lembreteId: valor.lembreteId, como }
}

/** A jogada de um valor do fio já lido como JSON; `null` = forma torta (enum fechado no `tipo`). */
export function jogadaDoValor(valor: unknown): JogadaDoDuelo | null {
  if (!ehRegistro(valor) || !seqValido(valor.seq)) return null
  const { seq } = valor
  switch (valor.tipo) {
    case 'agir': {
      const vez = valor.vez === null ? null : lerVez(valor.vez)
      const pedido = lerPedidoDeAcao(semDanoNemCusto(valor.pedido))
      if (pedido === null || (valor.vez !== null && vez === null)) return null
      // Sem vez SÓ o contra-ataque, e o contra-ataque nunca vem com vez (como `parseBatalhaAgir`).
      if ((vez === null) !== (contraDoPedido(pedido) !== undefined)) return null
      return { tipo: 'agir', seq, vez, pedido }
    }
    case 'reagir': {
      const pedido = lerPedidoDeReacao(valor.pedido)
      return pedido === null ? null : { tipo: 'reagir', seq, pedido }
    }
    case 'passar': {
      const vez = lerVez(valor.vez)
      return vez === null ? null : { tipo: 'passar', seq, vez }
    }
    case 'andar': {
      const vez = valor.vez === null ? null : lerVez(valor.vez)
      const { tokenId, col, row, contraDe } = valor
      if ((valor.vez !== null && vez === null) || !idDoFio(tokenId) || !indiceDaCasa(col) || !indiceDaCasa(row)) return null
      if (contraDe !== undefined && !idDoFio(contraDe)) return null
      // Como no `agir`: sem vez SÓ o contra-ataque, e o contra-ataque nunca vem com vez.
      if ((vez === null) !== (contraDe !== undefined)) return null
      return contraDe === undefined ? { tipo: 'andar', seq, vez, tokenId, col, row } : { tipo: 'andar', seq, vez, tokenId, col, row, contraDe }
    }
    case 'montar': {
      const { tokenId, col, row } = valor
      return idDoFio(tokenId) && indiceDaCasa(col) && indiceDaCasa(row) ? { tipo: 'montar', seq, tokenId, col, row } : null
    }
    case 'marcar': {
      const pedido = lerPedidoDeMarca(valor.pedido)
      return pedido === null ? null : { tipo: 'marcar', seq, pedido }
    }
    case 'passiva': {
      // O custo e o selo digitados saem ANTES da leitura (como o dano): o servidor usa os da ficha.
      const cru = ehRegistro(valor.pedido) && valor.pedido.tipo === 'passiva' ? { ...valor.pedido, custo: null, selo: undefined } : valor.pedido
      const pedido = lerPedidoDePassiva(cru)
      return pedido === null ? null : { tipo: 'passiva', seq, pedido }
    }
    case 'evoluir': {
      const pedido = lerPedidoDeEvolucao(valor.pedido)
      return pedido === null ? null : { tipo: 'evoluir', seq, pedido }
    }
    case 'armas': {
      // A forma é a do fio da mesa (`batalha.armas`: ids no teto, sem repetir, até o máximo de armas).
      const lido = parseBatalhaArmas({ type: 'batalha.armas', reqId: 'site', personagemId: valor.personagemId, armas: valor.armas })
      return lido === null ? null : { tipo: 'armas', seq, personagemId: lido.personagemId, armas: lido.armas }
    }
    default:
      return null
  }
}

/**
 * A jogada como chega do cliente: acima de 64 KiB (`LIMITES.frameBytes`) é
 * recusada antes de ler; depois o JSON seguro (`lerJsonSeguro`) e a forma.
 */
export function lerJogadaDoDuelo(texto: string): LeituraDaJogada {
  // Cada unidade UTF-16 é ao menos 1 byte em UTF-8: acima do teto em unidades já passa em bytes, sem codificar.
  if (texto.length > LIMITES.frameBytes || bytesDoTexto(texto) > LIMITES.frameBytes) return { ok: false, motivo: 'grandeDemais' }
  let valor: unknown
  try {
    valor = lerJsonSeguro(texto)
  } catch {
    return { ok: false, motivo: 'formato' }
  }
  const jogada = jogadaDoValor(valor)
  return jogada === null ? { ok: false, motivo: 'formato' } : { ok: true, jogada }
}

/**
 * O estado que vai aos dois jogadores: as cópias projetadas como o colega as
 * vê (`projetarParaJogador`: sem nota do mestre nem dono), a ordem, as regras,
 * os efeitos e só a cauda do registro, sem a reversão
 * (`registroParaJogador`, as `REGISTRO_PARA_JOGADOR_MAX` mais novas). Sem
 * teto: o de 64 KiB é só do cliente para o DO.
 */
export function dueloParaOFio(duelo: DueloGravado): DueloNoFio {
  const { vagas, personagens } = duelo.lutadores
  const registro = registroParaJogador(duelo.cena.registro, {
    // Ninguém desfaz no duelo: `minhaVez` falso apaga o Desfazer; os dois veem todas as fichas.
    playerId: '',
    minhaVez: false,
    tokensNoRecorte: new Set(vagas.map((vaga) => vaga.tokenId)),
    personagensVisiveis: new Set(personagens.map((personagem) => personagem.id)),
    npcs: new Set(),
  })
  return {
    versao: duelo.versao,
    id: duelo.id,
    seq: duelo.seq,
    fim: duelo.fim,
    jogadores: duelo.jogadores,
    lutadores: { vagas, personagens: personagens.map(projetarParaJogador) },
    posicoes: duelo.posicoes,
    montagem: duelo.montagem,
    turnos: duelo.cena.turnos,
    regras: duelo.cena.regras,
    efeitos: duelo.cena.efeitos ?? [],
    registro,
  }
}

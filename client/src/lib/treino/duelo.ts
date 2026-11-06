import { ID_DA_BATALHA_MAX, lerPedidoDeAcao, lerPedidoDeReacao, RODADA_MAX } from '../../net/protocoloDaBatalha'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from '../../stores/batalhaFabrica'
import { tecnicasNoMenu } from '../batalha/acoes'
import type { AcaoDaTecnica, EfeitoDaBatalha, PedidoDeAcao, PedidoDeAlvo, PedidoDeReacao } from '../batalha/combate'
import { preenchimentoDaVariante, varianteDoPedido } from '../batalha/escolhaEEvolucao'
import { acoesDaCarta, danoSugeridoDoAtaque } from '../batalha/golpe'
import { armasDe, balaDaArma, ehPerfurante, perfuracaoDe, tecnicaPorId } from '../batalha/leituraDaFicha'
import type { VezEsperada } from '../batalha/ponte'
import type { RegrasDaBatalha } from '../batalha/regrasDoCampo'
import { registroParaJogador, type LinhaParaJogador } from '../batalha/registro'
import { bonusDaBatalha, bonusDaReacao, seloPedidoValido } from '../batalha/selos'
import { modoDaReacao, saidaSugerida, seloDaReacao } from '../batalha/tiposDaHabilidade'
import { acaoDaForma, formaDaFicha } from '../batalha/transformacao'
import { cartaDaVez, combatentesIniciais, type AutorDaAcao, type CartaDaOrdem, type TurnosDaCena } from '../batalha/turnos'
import { bytesDoTexto, ehRegistro, lerJsonSeguro } from '../nuvem/json'
import { LIMITES } from '../nuvem/limites'
import { projetarParaJogador } from '../nuvem/projecao'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { fimDaLuta, type FimDaLuta } from './fimDaLuta'
import { TETOS_DO_TREINO } from './lutaAutomatica'
import { criarMesaEmMemoria, LADOS_DO_TREINO, montarLutadores, type EscolhaDaVaga, type LadoDoTreino, type LutadoresDoTreino, type MesaEmMemoria, type VagaDoTreino } from './mesaEmMemoria'
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
 * O servidor não confia no cliente (achados Tr2, Tr3, Tr5 e Tr7, §11):
 *  - RECALCULA dano, custo e ação pela cópia: o dano de cada alvo é o que a
 *    mira sugere (o mesmo cálculo do robô, `robo.ts`), o custo e a ação são
 *    os da ficha (a ação que a ficha não diz = Simples, `ACAO_SEM_A_FICHA`;
 *    a de Ativar a forma = a do campo Ação, `acaoDaForma`); os do pedido
 *    são ignorados. Golpe de dano que a ficha não calcula ("dano à
 *    mão") é recusado: no duelo ninguém digita dano;
 *  - recusa a Surpresa e o "dano livre" (não existe jogada de dano livre:
 *    só agir, reagir e passar). Também refaz o que a tela deixaria trocar à
 *    vontade: o Perfurante só se a ficha diz, o selo só o sugerido, o bônus
 *    da reação só o dos selos, a saída da técnica de reação só a da ficha;
 *    e recusa o que na mesa é decisão do mestre (rerolar com Ponto Saga,
 *    passar sem dano) ou não tem mapa (mover pelo contra-ataque);
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
 * `prazoDoDuelo`, `vencerAusencia`).
 *
 * Sem Tauri, sem DOM.
 */

/** A versão do motor (coluna `versaoDoMotor` da tabela `duelos`): estado de outra versão não continua. */
export const VERSAO_DO_MOTOR_DO_DUELO = 1

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

/** Como o duelo acabou: o fim da luta, ou a ausência (`vencedor` null = os dois passaram do prazo). */
export type FimDoDuelo = FimDaLuta | { tipo: 'ausencia'; vencedor: LadoDoTreino | null }

/** O duelo guardado no servidor (coluna `estadoJson`), só dados: vai a JSON e volta igual. */
export interface DueloGravado {
  versao: typeof VERSAO_DO_MOTOR_DO_DUELO
  id: string
  jogadores: Readonly<Record<LadoDoTreino, JogadorDoDuelo>>
  lutadores: LutadoresDoTreino
  cena: BatalhaDaCena
  /** Quantas jogadas foram aceitas. A jogada leva o `seq` do estado que viu. */
  seq: number
  /** Os passos do relógio da luta (`fimDaLuta`): uma jogada aceita, um passo. */
  passos: number
  fim: FimDoDuelo | null
}

export type JogadaDoDuelo =
  /** `vez` null só com o contra-ataque (`contraDe`), como na batalha da mesa. */
  | { tipo: 'agir'; seq: number; vez: VezEsperada | null; pedido: PedidoDeAcao }
  | { tipo: 'reagir'; seq: number; pedido: PedidoDeReacao }
  | { tipo: 'passar'; seq: number; vez: VezEsperada }

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
  /** Dano que a ficha não calcula (À mão, "1d6", "% da vida do alvo", "Dano da arma" sem arma): no duelo ninguém digita dano. */
  | 'danoAMao'
  /** Fora do duelo: mover pelo contra-ataque (sem mapa), reação livre, rerolar e passar sem dano (decisões do mestre na mesa). */
  | 'foraDoDuelo'
  /** A batalha recusou: não é a vez, ação gasta, técnica em recarga, alvo que não reage... */
  | 'regra'

export type ResultadoDaJogada = { ok: true; duelo: DueloGravado } | { ok: false; motivo: MotivoDaRecusa }

export type CriacaoDoDuelo =
  | { ok: true; duelo: DueloGravado }
  | { ok: false; motivo: 'mesmaConta' }
  /** `naoEDono` = alguma ficha do lado não é da conta dele; `vazio`/`cheio` como em `montarLutadores`. */
  | { ok: false; motivo: 'naoEDono' | 'vazio' | 'cheio'; lado: LadoDoTreino }

export type LeituraDaJogada = { ok: true; jogada: JogadaDoDuelo } | { ok: false; motivo: 'grandeDemais' | 'formato' }

/** O duelo como os dois o recebem: as fichas projetadas e só a cauda do registro (`REGISTRO_PARA_JOGADOR_MAX`). */
export interface DueloNoFio {
  versao: number
  id: string
  seq: number
  fim: FimDoDuelo | null
  jogadores: Readonly<Record<LadoDoTreino, JogadorDoDuelo>>
  lutadores: LutadoresDoTreino
  turnos: TurnosDaCena
  regras: RegrasDaBatalha | null
  efeitos: readonly EfeitoDaBatalha[]
  registro: readonly LinhaParaJogador[]
}

function lojaDoDuelo(mesa: MesaEmMemoria, motor: MotorDoDuelo): LojaDaBatalha {
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
      cena,
      seq: 0,
      passos: 0,
      fim: fimNaMesa(mesa, cena, 0),
    },
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O servidor recalcula
// ───────────────────────────────────────────────────────────────────────────

type Recalculo<T> = { ok: true; pedido: T } | { ok: false; motivo: MotivoDaRecusa }

function recusa(motivo: MotivoDaRecusa): { ok: false; motivo: MotivoDaRecusa } {
  return { ok: false, motivo }
}

/** Quem age: a carta (da vez, ou a do contra-ataque) e a cópia dela. */
interface QuemAge {
  carta: CartaDaOrdem
  personagem: Personagem
}

/** Os alvos do pedido com o dano do servidor (o mesmo em todos, como a mira preenche). */
function comODano(alvos: readonly PedidoDeAlvo[], dano: number | null): PedidoDeAlvo[] {
  return alvos.map((alvo) => ({ tokenId: alvo.tokenId, dano }))
}

/** O Atacar refeito: o dano da arma (e da bala) pela cópia; Perfurante só se a arma diz; o Atacar não leva selo (a mira só o sugere na técnica). */
function ataqueRecalculado(pedido: Extract<PedidoDeAcao, { tipo: 'atacar' }>, personagem: Personagem, sistema: SistemaDeRpg): Recalculo<PedidoDeAcao> {
  if (pedido.surpresa) return recusa('surpresa')
  const arma = pedido.armaId === null ? null : armasDe(personagem).find((candidata) => candidata.id === pedido.armaId)
  if (arma === undefined) return recusa('regra')
  if (arma !== null && arma.aMao === true) return recusa('danoAMao')
  const bala = pedido.balaId === undefined ? null : arma === null ? null : balaDaArma(arma, pedido.balaId)
  if (pedido.balaId !== undefined && bala === null) return recusa('regra')
  const valor = danoSugeridoDoAtaque(personagem, sistema, arma, bala)
  if (valor === null) return recusa('danoAMao')
  const perfurante = pedido.perfurante && arma !== null && ehPerfurante(arma)
  const perfuracao = perfurante && arma !== null ? perfuracaoDe(arma) : null
  const novo: PedidoDeAcao = { tipo: 'atacar', armaId: pedido.armaId, alvos: comODano(pedido.alvos, danoNoTeto(valor)), surpresa: false, perfurante }
  if (perfuracao !== null) novo.perfuracao = perfuracao
  if (pedido.contraDe !== undefined) novo.contraDe = pedido.contraDe
  if (pedido.balaId !== undefined) novo.balaId = pedido.balaId
  return { ok: true, pedido: novo }
}

/**
 * A Habilidade refeita: o dano lido da técnica (ou da opção escolhida) pela
 * cópia, com o bônus dos selos de quem age, como a mira e o robô; o custo da
 * ficha (`custo: null`); a ação da ficha (`ACAO_SEM_A_FICHA` quando ela não
 * diz); Perfurante só se a técnica diz; o selo só o sugerido.
 */
function tecnicaRecalculada(pedido: Extract<PedidoDeAcao, { tipo: 'habilidade' }>, quem: QuemAge, cena: BatalhaDaCena, sistema: SistemaDeRpg): Recalculo<PedidoDeAcao> {
  if (pedido.surpresa) return recusa('surpresa')
  const { carta, personagem } = quem
  const { turnos } = cena
  const arma = pedido.armaId === null ? null : armasDe(personagem).find((candidata) => candidata.id === pedido.armaId)
  if (arma === undefined) return recusa('regra')
  const bonus = bonusDaBatalha(turnos.selos, carta.tokenId)
  const acoes = acoesDaCarta({ turnos, carta, personagem, sistema, regras: cena.regras })
  const tecnica = tecnicasNoMenu(personagem, sistema, turnos.combate?.[personagem.id], acoes, arma, bonus).find((candidata) => candidata.cartao.id === pedido.cartaoId)
  if (tecnica === undefined) return recusa('regra')
  if (tecnica.cartao.aMao === true) return recusa('danoAMao')
  const variante = pedido.variante === undefined ? null : varianteDoPedido(tecnica.cartao, pedido.variante)
  if (pedido.variante !== undefined && variante === null) return recusa('regra')
  // A opção que não é a principal pode trazer o dano e o selo dela (`preenchimentoDaVariante`, como a mira).
  const daOpcao = variante === null || variante.principal ? null : preenchimentoDaVariante(tecnica.cartao, variante, { personagem, sistema, arma, vidaDoAlvo: null, bonusDaBatalha: bonus })
  const leitura = daOpcao?.dano ?? tecnica.dano
  if (leitura.tipo !== 'valor' && leitura.tipo !== 'semDano') return recusa('danoAMao')
  const perfurante = pedido.perfurante && tecnica.perfurante
  const novo: PedidoDeAcao = {
    tipo: 'habilidade',
    cartaoId: pedido.cartaoId,
    armaId: pedido.armaId,
    alvos: comODano(pedido.alvos, leitura.tipo === 'valor' ? danoNoTeto(leitura.valor) : null),
    surpresa: false,
    perfurante,
    custo: null,
    // A ação do pedido é ignorada: `null` = a da ficha (a store lê); a ficha que não diz gasta a Simples.
    acao: tecnica.acao === null ? ACAO_SEM_A_FICHA : null,
  }
  if (perfurante && tecnica.perfuracao !== undefined) novo.perfuracao = tecnica.perfuracao
  if (pedido.contraDe !== undefined) novo.contraDe = pedido.contraDe
  if (pedido.variante !== undefined) novo.variante = pedido.variante
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
 * Simples ou Bônus e sobraria ação na vez. Forma que não é da cópia = recusada.
 */
function formaRecalculada(pedido: Extract<PedidoDeAcao, { tipo: 'transformar' }>, personagem: Personagem, sistema: SistemaDeRpg): Recalculo<PedidoDeAcao> {
  const cartao = formaDaFicha(personagem, sistema, pedido.cartaoId)
  if (cartao === null) return recusa('regra')
  return { ok: true, pedido: { tipo: 'transformar', cartaoId: pedido.cartaoId, acao: acaoDaForma(cartao), trocarImagem: pedido.trocarImagem } }
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

/** A reação refeita: modificador dos selos; a técnica com a saída e o custo da ficha e o selo sugerido. */
function reacaoRecalculada(pedido: PedidoDeReacao, turnos: TurnosDaCena, personagem: Personagem | null, sistema: SistemaDeRpg): Recalculo<PedidoDeReacao> {
  switch (pedido.tipo) {
    case 'rolar':
      if (pedido.golpeId === null) return recusa('foraDoDuelo')
      return { ok: true, pedido: { ...pedido, modificador: modificadorDaReacao(turnos, pedido.tokenId) } }
    case 'rerolar':
    case 'semDano':
      return recusa('foraDoDuelo')
    case 'escolher':
    case 'naoReagir':
    case 'passar':
      return { ok: true, pedido }
    case 'tecnica': {
      const achada = personagem === null ? null : tecnicaPorId(personagem, sistema, pedido.cartaoId)
      if (achada === null) return recusa('regra')
      // O texto que não diz a saída (modo "escolher") rola o d20: no duelo ninguém escolhe a esquiva.
      const saida = saidaSugerida(modoDaReacao(achada.cartao)) ?? 'rolar'
      const novo: PedidoDeReacao = { tipo: 'tecnica', golpeId: pedido.golpeId, tokenId: pedido.tokenId, cartaoId: pedido.cartaoId, saida, custo: null }
      if (saida === 'rolar') novo.modificador = modificadorDaReacao(turnos, pedido.tokenId)
      const selo = pedido.seloNoAtacante === undefined ? null : seloDaReacao(achada.cartao)
      if (selo !== null) novo.seloNoAtacante = selo
      return { ok: true, pedido: novo }
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Jogar
// ───────────────────────────────────────────────────────────────────────────

function ladoDaConta(duelo: DueloGravado, contaId: string): LadoDoTreino | null {
  return LADOS_DO_TREINO.find((lado) => duelo.jogadores[lado].contaId === contaId) ?? null
}

function vagaDoToken(lutadores: LutadoresDoTreino, tokenId: string | undefined): VagaDoTreino | null {
  return lutadores.vagas.find((vaga) => vaga.tokenId === tokenId) ?? null
}

/** A carta que age: a do contra-ataque (`contraDe`, fora da vez) ou a da vez. */
function cartaQueAge(turnos: TurnosDaCena, pedido: PedidoDeAcao): CartaDaOrdem | null {
  const contraDe = contraDoPedido(pedido)
  if (contraDe === undefined) return cartaDaVez(turnos)
  const contra = (turnos.contras ?? []).find((candidato) => candidato.golpeId === contraDe)
  return contra === undefined ? null : (turnos.cartas.find((carta) => carta.tokenId === contra.tokenId) ?? null)
}

/** A jogada na store, com o pedido já refeito: `null` = aceita; senão, o motivo da recusa (antes da store, ou dela). */
function jogarNaLoja(loja: LojaDaBatalha, mesa: MesaEmMemoria, cena: BatalhaDaCena, lado: LadoDoTreino, autor: AutorDaAcao, jogada: JogadaDoDuelo, sistema: SistemaDeRpg): MotivoDaRecusa | null {
  const { turnos } = cena
  const lutadores = mesa.lutadores()
  const ehDoLado = (tokenId: string | undefined): boolean => vagaDoToken(lutadores, tokenId)?.lado === lado
  const copiaDe = (personagemId: string | null): Personagem | null => mesa.personagens().find((personagem) => personagem.id === personagemId) ?? null
  switch (jogada.tipo) {
    case 'passar': {
      if (!ehDoLado(cartaDaVez(turnos)?.tokenId)) return 'naoEDaConta'
      return loja.getState().passarVez(CENA_DO_DUELO, autor, jogada.vez) ? null : 'regra'
    }
    case 'agir': {
      const carta = cartaQueAge(turnos, jogada.pedido)
      if (carta === null || !ehDoLado(carta.tokenId)) return carta === null ? 'regra' : 'naoEDaConta'
      const personagem = copiaDe(carta.personagemId)
      if (personagem === null || carta.bando !== undefined) return 'regra'
      const refeito = acaoRecalculada(jogada.pedido, { carta, personagem }, cena, sistema)
      if (!refeito.ok) return refeito.motivo
      return loja.getState().agir(CENA_DO_DUELO, autor, jogada.vez, refeito.pedido) ? null : 'regra'
    }
    case 'reagir': {
      const vaga = vagaDoToken(lutadores, jogada.pedido.tokenId)
      if (vaga === null || vaga.lado !== lado) return vaga === null ? 'regra' : 'naoEDaConta'
      const refeito = reacaoRecalculada(jogada.pedido, turnos, copiaDe(vaga.personagemId), sistema)
      if (!refeito.ok) return refeito.motivo
      return loja.getState().reagir(CENA_DO_DUELO, autor, refeito.pedido) ? null : 'regra'
    }
  }
}

/**
 * Uma jogada da conta `contaId`. Confere, nesta ordem: a versão do motor, o
 * fim, a conta, o `seq`, o lado da ficha que age ou reage; refaz o pedido
 * (dano, custo, ação, selo, Perfurante, bônus da reação) e passa pela mesma regra
 * da batalha da mesa. Aceita: o estado novo, com `seq` e `passos` + 1 e o fim
 * conferido. Recusada: o motivo, e o duelo recebido fica como estava.
 */
export function aplicarJogada(duelo: DueloGravado, motor: MotorDoDuelo, contaId: string, jogada: JogadaDoDuelo): ResultadoDaJogada {
  if (duelo.versao !== VERSAO_DO_MOTOR_DO_DUELO) return recusa('versao')
  if (duelo.fim !== null) return recusa('acabou')
  const lado = ladoDaConta(duelo, contaId)
  if (lado === null) return recusa('naoJoga')
  if (jogada.seq !== duelo.seq) return recusa('seqVelho')
  // A loja e a mesa trabalham numa cópia: a recusa no meio não deixa o duelo recebido pela metade.
  const copia = structuredClone(duelo)
  const mesa = criarMesaEmMemoria(motor.sistema, copia.lutadores)
  const loja = lojaDoDuelo(mesa, motor)
  // A cena volta inteira pela store (o `setState` do zustand), como em `retomarLuta`.
  loja.setState({ cenas: { [CENA_DO_DUELO]: copia.cena } })
  const jogador = copia.jogadores[lado]
  const autor: AutorDaAcao = { tipo: 'jogador', playerId: jogador.contaId, nome: jogador.nome }
  const motivo = jogarNaLoja(loja, mesa, copia.cena, lado, autor, jogada, motor.sistema)
  if (motivo !== null) return recusa(motivo)
  const cena = cenaDaLoja(loja)
  const passos = copia.passos + 1
  return { ok: true, duelo: { ...copia, lutadores: mesa.lutadores(), cena, seq: copia.seq + 1, passos, fim: fimNaMesa(mesa, cena, passos) } }
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
    turnos: duelo.cena.turnos,
    regras: duelo.cena.regras,
    efeitos: duelo.cena.efeitos ?? [],
    registro,
  }
}

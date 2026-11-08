import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from '../../stores/batalhaFabrica'
import { chaveDaVez, type PedidoDeAcao, type PedidoDeReacao } from '../batalha/combate'
import { combatentesIniciais, type AutorDaAcao } from '../batalha/turnos'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem, type VidaDaFicha } from '../vidaDaFicha'
import { fimDaLuta, type FimDaLuta, type RelogioDaLuta, type TetosDaLuta } from './fimDaLuta'
import { criarMesaEmMemoria, type LadoDaLuta, type LadoDoTreino, type LutadoresDaLuta, type MesaDaLuta } from './mesaEmMemoria'
import { jogadaDoRobo, type JogadaDoRobo } from './robo'
import { criarSorteio, retomarSorteio, type EstadoDoSorteio, type Sorteio } from './sorteio'

/**
 * A LUTA AUTOMÁTICA DO TREINO (LOBBY v2, fatia T3 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): todas as vagas jogadas
 * pelo robô (`robo.ts`), sobre a MESMA regra da batalha One Piece do app
 * (`criarBatalhaStore`, a fábrica da T1) e a mesa em memória com as cópias
 * (`mesaEmMemoria.ts`): a ficha de verdade nunca é tocada.
 *
 * Um PASSO é uma chamada à batalha: uma reação (rolar ou escolher a saída),
 * um golpe, ou passar a vez. Depois de cada passo, `fimDaLuta` decide se
 * acabou (vitória, todos caídos, ou tempo pelos tetos de rodada e de passo:
 * é o teto que garante que a luta sempre para).
 *
 * Mesma semente = mesma luta: o d20 sai do sorteio com semente (`sorteio.ts`)
 * e o robô não decide por id aleatório. A luta pausa a qualquer passo
 * (`gravar`: só dados, vai a JSON) e volta por `retomarLuta`, terminando igual.
 *
 * N LADOS (Arena multijogador, fatia F2): os mesmos passos com até 12 lados
 * (`montarLutadoresDaLuta`); os tipos seguem o lado dos lutadores, e o
 * padrão é o treino de 2 lados.
 *
 * Sem DOM e sem Tauri: roda no navegador, num worker (T4) e no vitest.
 */

/** A chave da cena da batalha do treino (a store do treino só tem esta). */
export const CENA_DO_TREINO = 'treino'

/** Quem age no registro: a luta automática é do mestre da mesa em memória (como a arena, `AUTOR_DA_ARENA`). */
export const AUTOR_DO_ROBO: AutorDaAcao = { tipo: 'mestre' }

/** Os tetos de sempre: 30 rodadas, ou 3000 passos (uma vez de 6×6 com os golpes e as reações fica bem abaixo de 100). */
export const TETOS_DO_TREINO: TetosDaLuta = { rodadas: 30, passos: 3_000 }

/** A versão do formato da luta gravada. */
export const VERSAO_DA_LUTA_GRAVADA = 1

/** O que a luta precisa para começar. */
export interface PedidoDeLuta<L extends LadoDaLuta = LadoDoTreino> {
  /** O sistema do livro (One Piece). */
  sistema: SistemaDeRpg | null
  /** As vagas e as cópias (`montarLutadores`, ou `montarLutadoresDaLuta` com mais lados). */
  lutadores: LutadoresDaLuta<L>
  /** Inteiro de 0 a `SEMENTE_MAX` (`sorteio.ts`). */
  semente: number
  /** Ausente = `TETOS_DO_TREINO`. */
  tetos?: TetosDaLuta
}

/** Os golpes que a carta da vez já deu: a chave da vez (`chaveDaVez`) e quantos. */
export interface GolpesDaVez {
  chave: string
  golpes: number
}

/** A luta pausada, só dados: vai a JSON e volta por `retomarLuta` com o mesmo sistema. */
export interface LutaGravada<L extends LadoDaLuta = LadoDoTreino> {
  versao: typeof VERSAO_DA_LUTA_GRAVADA
  lutadores: LutadoresDaLuta<L>
  cena: BatalhaDaCena
  sorteio: EstadoDoSorteio
  passos: number
  tetos: TetosDaLuta
  golpesDaVez: GolpesDaVez | null
}

/** O que um passo fez. "parado" = não havia vez nem reação esperando (o passo conta, e o teto acaba a luta). */
export type PassoDaLuta =
  | { tipo: 'reagir'; pedido: PedidoDeReacao; aceito: boolean }
  | { tipo: 'agir'; tokenId: string; pedido: PedidoDeAcao }
  | { tipo: 'passarVez'; tokenId: string; aceito: boolean }
  | { tipo: 'parado' }

/** Uma vaga no fim da luta: a vida da cópia (`null` = sem vida legível). */
export interface LutadorNoResumo<L extends LadoDaLuta = LadoDoTreino> {
  vaga: string
  lado: L
  nome: string
  vida: VidaDaFicha | null
}

/** Como a luta acabou. Sem id nem hora: duas lutas com a mesma semente dão o mesmo resumo. */
export interface ResumoDaLuta<L extends LadoDaLuta = LadoDoTreino> {
  semente: number
  fim: FimDaLuta<L>
  /** A rodada da ordem no fim. */
  rodada: number
  passos: number
  /** Quantos d20 saíram do sorteio. */
  d20: number
  lutadores: readonly LutadorNoResumo<L>[]
  /** O texto de cada linha do registro, da mais velha à mais nova (as últimas `REGISTRO_MAX`). */
  registro: readonly string[]
}

export interface LutaEmAndamento<L extends LadoDaLuta = LadoDoTreino> {
  /** Um passo; `null` = a luta já tinha acabado (nada muda). */
  passo(): PassoDaLuta | null
  /** Passos até acabar; o resumo. */
  terminar(): ResumoDaLuta<L>
  /** Como acabou, ou `null` se continua. */
  fim(): FimDaLuta<L> | null
  relogio(): RelogioDaLuta
  /** A cena da batalha de agora (a ordem, os golpes, o registro). */
  cena(): BatalhaDaCena
  /** A mesa em memória (as vagas e as cópias de agora). */
  mesa(): MesaDaLuta<L>
  /** A luta de agora, só dados (cópia funda). */
  gravar(): LutaGravada<L>
  /** O resumo; `null` enquanto a luta não acabou. */
  resumo(): ResumoDaLuta<L> | null
}

interface EstadoDoRelogio {
  passos: number
  tetos: TetosDaLuta
  golpesDaVez: GolpesDaVez | null
}

function lojaDoTreino(mesa: MesaDaLuta, sorteio: Sorteio): LojaDaBatalha {
  return criarBatalhaStore(mesa, { rolarD20: () => sorteio.d20(), outraBatalhaLigada: () => false })
}

function lutadoresNoResumo<L extends LadoDaLuta>(mesa: MesaDaLuta<L>): LutadorNoResumo<L>[] {
  const recurso = recursoDeVida(mesa.sistema())
  const porId = new Map(mesa.personagens().map((personagem) => [personagem.id, personagem]))
  return mesa.vagas().map((vaga) => {
    const copia = porId.get(vaga.personagemId)
    const vida = copia === undefined || recurso === null ? null : vidaDoPersonagem(copia, recurso)
    return { vaga: vaga.id, lado: vaga.lado, nome: copia?.nome ?? vaga.id, vida }
  })
}

/** A luta sobre a mesa, o sorteio e a store já com a cena ligada (nova ou retomada). */
function lutaSobre<L extends LadoDaLuta>(mesa: MesaDaLuta<L>, sorteio: Sorteio, loja: LojaDaBatalha, inicial: EstadoDoRelogio): LutaEmAndamento<L> {
  let { passos, golpesDaVez } = inicial
  const { tetos } = inicial

  const cenaDeAgora = (): BatalhaDaCena => {
    const cena = loja.getState().cenas[CENA_DO_TREINO]
    if (cena === undefined) throw new RangeError('a batalha do treino não está ligada')
    return cena
  }
  const relogio = (): RelogioDaLuta => ({ rodada: cenaDeAgora().turnos.rodada, passos })
  let fim = fimDaLuta(mesa, relogio(), tetos)

  const golpesNaVez = (chave: string): number => (golpesDaVez !== null && golpesDaVez.chave === chave ? golpesDaVez.golpes : 0)

  const executar = (jogada: JogadaDoRobo | null): PassoDaLuta => {
    if (jogada === null) return { tipo: 'parado' }
    if (jogada.tipo === 'reagir') return { tipo: 'reagir', pedido: jogada.pedido, aceito: loja.getState().reagir(CENA_DO_TREINO, AUTOR_DO_ROBO, jogada.pedido) }
    const chave = chaveDaVez(jogada.esperado.rodada, jogada.esperado.cartaId)
    for (const pedido of jogada.golpes) {
      if (!loja.getState().agir(CENA_DO_TREINO, AUTOR_DO_ROBO, jogada.esperado, pedido)) continue
      golpesDaVez = { chave, golpes: golpesNaVez(chave) + 1 }
      return { tipo: 'agir', tokenId: jogada.tokenId, pedido }
    }
    return { tipo: 'passarVez', tokenId: jogada.tokenId, aceito: loja.getState().passarVez(CENA_DO_TREINO, AUTOR_DO_ROBO, jogada.esperado) }
  }

  const resumo = (): ResumoDaLuta<L> | null => {
    if (fim === null) return null
    const cena = cenaDeAgora()
    return {
      semente: sorteio.estado().semente,
      fim,
      rodada: cena.turnos.rodada,
      passos,
      d20: sorteio.estado().jogadas,
      lutadores: lutadoresNoResumo(mesa),
      registro: cena.registro.map((linha) => linha.texto),
    }
  }

  const passo = (): PassoDaLuta | null => {
    if (fim !== null) return null
    const cena = cenaDeAgora()
    const vez = cena.turnos.vez
    const jogada = jogadaDoRobo({
      turnos: cena.turnos,
      regras: cena.regras,
      vagas: mesa.vagas(),
      personagens: mesa.personagens(),
      sistema: mesa.sistema(),
      golpesNaVez: vez === null ? 0 : golpesNaVez(chaveDaVez(cena.turnos.rodada, vez)),
    })
    const feito = executar(jogada)
    passos += 1
    fim = fimDaLuta(mesa, relogio(), tetos)
    return feito
  }

  const gravar = (): LutaGravada<L> => {
    const agora: LutaGravada<L> = { versao: VERSAO_DA_LUTA_GRAVADA, lutadores: mesa.lutadores(), cena: cenaDeAgora(), sorteio: sorteio.estado(), passos, tetos, golpesDaVez }
    return structuredClone(agora)
  }

  const terminar = (): ResumoDaLuta<L> => {
    // Cada passo conta no relógio: o teto de passos de `fimDaLuta` garante que o laço acaba.
    let feito = resumo()
    while (feito === null) {
      passo()
      feito = resumo()
    }
    return feito
  }

  return { passo, terminar, fim: () => fim, relogio, cena: cenaDeAgora, mesa: () => mesa, gravar, resumo }
}

/**
 * Começa a luta: a mesa em memória com as cópias, o sorteio da semente, a
 * store da batalha e o Iniciar (todas as vagas na ordem pela Agilidade, o
 * empate no d20 da semente, a vez na primeira). Semente ou teto torto =
 * `RangeError`, antes de qualquer d20. Os lutadores do pedido não mudam: a
 * luta trabalha numa cópia (as 100 lutas da T4 reusam o mesmo pedido).
 */
export function comecarLuta<L extends LadoDaLuta = LadoDoTreino>(pedido: PedidoDeLuta<L>): LutaEmAndamento<L> {
  const tetos = pedido.tetos ?? TETOS_DO_TREINO
  const sorteio = criarSorteio(pedido.semente)
  const mesa = criarMesaEmMemoria(pedido.sistema, structuredClone(pedido.lutadores))
  // Confere os tetos antes de ligar (`fimDaLuta` recusa o torto).
  fimDaLuta(mesa, { rodada: 1, passos: 0 }, tetos)
  const loja = lojaDoTreino(mesa, sorteio)
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA_DO_TREINO, {}, { combatentes, regras: null, desempate: 'd20' })
  return lutaSobre(mesa, sorteio, loja, { passos: 0, tetos, golpesDaVez: null })
}

/** A luta inteira, do começo ao fim: o resumo. */
export function lutaAutomatica<L extends LadoDaLuta = LadoDoTreino>(pedido: PedidoDeLuta<L>): ResumoDaLuta<L> {
  return comecarLuta(pedido).terminar()
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function inteiroNaoNegativo(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

/** A forma de fora da luta gravada (a versão, os números, a cena com ordem e registro). O miolo da cena é a batalha que confere. */
function gravadaValida(gravada: LutaGravada<LadoDaLuta>): boolean {
  const { cena, golpesDaVez } = gravada
  const turnos: unknown = ehRegistro(cena) ? cena.turnos : null
  return (
    gravada.versao === VERSAO_DA_LUTA_GRAVADA &&
    inteiroNaoNegativo(gravada.passos) &&
    ehRegistro(turnos) &&
    Array.isArray(turnos.cartas) &&
    Array.isArray(cena.registro) &&
    (golpesDaVez === null || (ehRegistro(golpesDaVez) && typeof golpesDaVez.chave === 'string' && inteiroNaoNegativo(golpesDaVez.golpes)))
  )
}

/**
 * A luta pausada de volta (de `gravar`, depois de JSON), com o mesmo sistema:
 * os próximos passos são os que viriam. Forma torta = `RangeError` (o
 * sorteio, a mesa e os tetos também conferem os deles). A gravada não é
 * mudada: a luta trabalha numa cópia.
 */
export function retomarLuta<L extends LadoDaLuta = LadoDoTreino>(gravada: LutaGravada<L>, sistema: SistemaDeRpg | null): LutaEmAndamento<L> {
  if (!gravadaValida(gravada)) throw new RangeError('luta gravada do treino inválida')
  const copia = structuredClone(gravada)
  const sorteio = retomarSorteio(copia.sorteio)
  const mesa = criarMesaEmMemoria(sistema, copia.lutadores)
  fimDaLuta(mesa, { rodada: 1, passos: 0 }, copia.tetos)
  const loja = lojaDoTreino(mesa, sorteio)
  // A cena volta inteira pela store (o `setState` do zustand): a ordem, os golpes esperando, o registro e o combate de cada um.
  loja.setState({ cenas: { [CENA_DO_TREINO]: copia.cena } })
  return lutaSobre(mesa, sorteio, loja, { passos: copia.passos, tetos: copia.tetos, golpesDaVez: copia.golpesDaVez })
}

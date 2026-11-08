import { NOME_DO_MESTRE } from '../ajusteDaFicha'
import type { PedidoDeAjusteNaBatalha } from '../batalha/combate'
import { recursoDoEscudo } from '../batalha/leituraDaFicha'
import type { VezEsperada } from '../batalha/ponte'
import type { LinhaDoRegistro } from '../batalha/registro'
import type { RegrasDaBatalha } from '../batalha/regrasDoCampo'
import type { AutorDaAcao } from '../batalha/turnos'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida } from '../vidaDaFicha'
import { fimDaMesaDaJogada, type MotorDoDuelo } from './duelo'
import { recursoDaEnergia } from './juiz'
import { abrirNaLoja, CENA_DA_LUTA, comMarco, participanteDaConta, recusaNaLuta, semPausa, VERSAO_DO_MOTOR_DA_LUTA, type EstadoDaLuta, type LutaNaLoja, type ResultadoNaLuta } from './luta'
import { ladosDasVagas, type LadoDaLuta } from './mesaEmMemoria'

/**
 * O ÁRBITRO DA LUTA (Arena multijogador, fatia F3 de
 * docs/planos/arena-multijogador-2026-11-07.md §3): o mestre que escolheu
 * arbitrar (em vez de ser o Judge) não joga, vê tudo (`vistaDaLuta.ts`) e
 * decide pela mesa:
 *  - DESFAZER a última jogada: a última linha do registro que não está
 *    riscada, pela store da batalha (`desfazer` com o autor mestre: as fichas,
 *    a ordem e o golpe voltam como estavam); a linha fica riscada. A casa
 *    andada não volta: o `andar` não escreve linha. A saída de quem deixou a
 *    luta não se desfaz: o Desfazer para nela (`linhaQueOArbitroDesfaz`);
 *  - AJUSTAR o HP, o SP e o Escudo de uma ficha (`ajustar`, linha "ficha");
 *  - DECIDIR A REGRA do campo (`definirRegras`, ou nenhuma);
 *  - PASSAR A VEZ de quem sumiu (`passarVez`, na vez que ele viu);
 *  - PAUSAR e RETOMAR (`EstadoDaLuta.pausada`: jogada na pausa = `pausada`;
 *    o relógio dos ausentes para e, ao retomar, quem segue fora tem 3 min de
 *    novo; o árbitro que sai, ou fica fora 3 min, deixa a luta correr de
 *    novo, em `luta.ts`);
 *  - ENCERRAR, com um vencedor ou empate (o fim `arbitro`).
 * As quatro primeiras saem no registro assinadas `NOME_DO_ARBITRO`;
 * pausar, retomar e encerrar ficam nos `marcos`. Todo pedido leva o `seq` do
 * estado que o árbitro viu (o clique duplo não pausa duas vezes) e, aceito,
 * sobe o `seq` em 1. A luta com árbitro não tem o mestre como Judge (um papel
 * por luta, `criarLuta`): o robô nunca joga aqui.
 *
 * Puro: sem rede, sem DOM. O sistema e o d20 entram pelo motor; o relógio, por `agora`.
 */

/** O nome que assina, no registro, o que o árbitro fez ou desfez. */
export const NOME_DO_ARBITRO = `${NOME_DO_MESTRE} (árbitro)`

/** O mestre na store: desfaz qualquer linha, ajusta qualquer ficha e passa qualquer vez. */
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

export type PedidoDoArbitro =
  | { tipo: 'desfazer'; seq: number }
  | { tipo: 'ajustar'; seq: number; pedido: PedidoDeAjusteNaBatalha }
  | { tipo: 'regras'; seq: number; regras: RegrasDaBatalha | null }
  | { tipo: 'passarVez'; seq: number; vez: VezEsperada }
  | { tipo: 'pausar'; seq: number }
  | { tipo: 'retomar'; seq: number }
  | { tipo: 'encerrar'; seq: number; vencedor: LadoDaLuta | null }

type PedidoNaBatalha = Extract<PedidoDoArbitro, { tipo: 'desfazer' | 'ajustar' | 'regras' | 'passarVez' }>

/** A última linha que ainda não está riscada (a candidata do Desfazer do árbitro, `linhaQueOArbitroDesfaz`); `null` = nenhuma. */
export function ultimaNaoRiscada<T extends { desfeita?: unknown }>(linhas: readonly T[]): T | null {
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    const linha = linhas[i]
    if (linha !== undefined && linha.desfeita === undefined) return linha
  }
  return null
}

/**
 * A linha que `tirarContas` escreve por quem sai, de um token que ficou fora:
 * o "saiu da luta" (`combatente`) e a reação forçada (o autor mestre; a do
 * robô contra quem saiu cai aqui também, e fica de fora por segurança).
 */
function daSaida(linha: LinhaDoRegistro, tokensFora: ReadonlySet<string>): boolean {
  if (!linha.envolve.tokenIds.some((tokenId) => tokensFora.has(tokenId))) return false
  return linha.tipo === 'combatente' || (linha.tipo === 'reacao' && linha.autor.tipo === 'mestre')
}

/**
 * A linha que o Desfazer do árbitro desfaz: a última não riscada, se não é
 * da saída de alguém. A saída não se desfaz: a store devolveria a carta à
 * ordem, mas a vaga segue `fora` (a store não conhece o `fora`) e ninguém
 * jogaria a carta, travando a luta toda rodada; e a reação forçada, desfeita,
 * deixaria o golpe esperando a reação de quem saiu. O Desfazer para na
 * saída. `null` = nada a desfazer.
 */
export function linhaQueOArbitroDesfaz(luta: Pick<EstadoDaLuta, 'cena' | 'lutadores'>): LinhaDoRegistro | null {
  const ultima = ultimaNaoRiscada(luta.cena.registro)
  if (ultima === null) return null
  const tokensFora = new Set(luta.lutadores.vagas.flatMap((vaga) => (vaga.fora === true ? [vaga.tokenId] : [])))
  return daSaida(ultima, tokensFora) ? null : ultima
}

/** Só o HP, o SP e o Escudo (o atual e o máximo): o modificador de atributo do "Ajustar..." fica fora do árbitro (plano §3). */
function soVidaEnergiaEscudo(pedido: PedidoDeAjusteNaBatalha, sistema: SistemaDeRpg): boolean {
  const recursos = new Set([recursoDeVida(sistema), recursoDaEnergia(sistema), recursoDoEscudo(sistema)].flatMap((recurso) => (recurso === null ? [] : [recurso.id])))
  return pedido.mudancas.length > 0 && pedido.mudancas.every((mudanca) => mudanca.tipo !== 'atributo' && recursos.has(mudanca.recursoId))
}

/** O pedido na store da cópia, pelo autor mestre. `false` = a batalha recusou (ou não há o que desfazer). */
function naBatalha(aberta: LutaNaLoja, luta: EstadoDaLuta, pedido: PedidoNaBatalha, sistema: SistemaDeRpg): boolean {
  const batalha = aberta.loja.getState()
  switch (pedido.tipo) {
    case 'desfazer': {
      const linha = linhaQueOArbitroDesfaz(luta)
      return linha !== null && batalha.desfazer(CENA_DA_LUTA, linha.id, MESTRE)
    }
    case 'ajustar':
      return soVidaEnergiaEscudo(pedido.pedido, sistema) && batalha.ajustar(CENA_DA_LUTA, MESTRE, pedido.pedido)
    case 'regras':
      return batalha.definirRegras(CENA_DA_LUTA, pedido.regras)
    case 'passarVez':
      return batalha.passarVez(CENA_DA_LUTA, MESTRE, pedido.vez)
  }
}

/** "Mestre" (ou "Mestre (em parte)", como a store escreve) vira o nome do árbitro. */
function porDoArbitro(por: string): string {
  return por.startsWith(NOME_DO_MESTRE) ? `${NOME_DO_ARBITRO}${por.slice(NOME_DO_MESTRE.length)}` : por
}

/**
 * A assinatura do árbitro no registro: a linha nova é dele, e a que ficou
 * riscada agora foi desfeita por ele. O autor `mestre` não leva nome
 * (`nomeDoAutor` dá "Mestre"), então a linha nova leva o autor com o nome do
 * árbitro e a conta dele (ninguém desfaz pelo fio da luta: só o árbitro, pelo
 * autor mestre).
 */
function assinadoPeloArbitro(antes: readonly LinhaDoRegistro[], depois: readonly LinhaDoRegistro[], contaId: string): readonly LinhaDoRegistro[] {
  const deAntes = new Map(antes.map((linha) => [linha.id, linha]))
  const arbitro: AutorDaAcao = { tipo: 'jogador', playerId: contaId, nome: NOME_DO_ARBITRO }
  return depois.map((linha) => {
    const velha = deAntes.get(linha.id)
    if (velha === undefined) return { ...linha, autor: arbitro }
    if (linha.desfeita === undefined || velha.desfeita !== undefined) return linha
    return { ...linha, desfeita: { ...linha.desfeita, por: porDoArbitro(linha.desfeita.por) } }
  })
}

/** O pedido que passa pela batalha: numa cópia na loja; aceito, o registro assinado, `seq` + 1 e o fim conferido (o desfazer pode erguer quem caiu; o ajuste, derrubar). */
function pelaBatalha(luta: EstadoDaLuta, motor: MotorDoDuelo, contaId: string, pedido: PedidoNaBatalha): ResultadoNaLuta {
  const aberta = abrirNaLoja(luta, motor)
  if (!naBatalha(aberta, luta, pedido, motor.sistema)) return recusaNaLuta('regra')
  const cena = aberta.cena()
  const depois: EstadoDaLuta = {
    ...luta,
    lutadores: aberta.mesa.lutadores(),
    cena: { ...cena, registro: assinadoPeloArbitro(luta.cena.registro, cena.registro, contaId) },
    seq: luta.seq + 1,
  }
  return { ok: true, luta: { ...depois, fim: fimDaMesaDaJogada(motor.sistema, depois) } }
}

/**
 * Um pedido do árbitro (o `luta.arbitrar` do DO), da conta `contaId`.
 * Confere, nesta ordem: a versão do motor, o fim, a conta (só o árbitro: os
 * outros = `naoArbitra`), o `seq`. O árbitro age também na pausa. Recusa do
 * que não cabe (pausar a pausada, retomar a que corre, vencedor sem vaga,
 * nada a desfazer, a batalha que recusou) = `regra`. Aceito: o estado novo
 * com `seq` + 1. Recusado: o motivo, e a luta recebida fica como estava.
 */
export function arbitrarNaLuta(luta: EstadoDaLuta, motor: MotorDoDuelo, contaId: string, pedido: PedidoDoArbitro, agora: number): ResultadoNaLuta {
  if (luta.versao !== VERSAO_DO_MOTOR_DA_LUTA) return recusaNaLuta('versao')
  if (luta.fim !== null) return recusaNaLuta('acabou')
  const eu = participanteDaConta(luta, contaId)
  if (eu === null || eu.papel !== 'arbitro') return recusaNaLuta('naoArbitra')
  if (pedido.seq !== luta.seq) return recusaNaLuta('seqVelho')
  switch (pedido.tipo) {
    case 'pausar':
      return luta.pausada === true ? recusaNaLuta('regra') : { ok: true, luta: comMarco({ ...luta, pausada: true }, 'pausar', agora) }
    case 'retomar':
      return luta.pausada === true ? { ok: true, luta: comMarco(semPausa(luta, agora, true), 'retomar', agora) } : recusaNaLuta('regra')
    case 'encerrar': {
      const { vencedor } = pedido
      if (vencedor !== null && !ladosDasVagas(luta.lutadores.vagas).includes(vencedor)) return recusaNaLuta('regra')
      return { ok: true, luta: comMarco({ ...semPausa(luta, agora, false), fim: { tipo: 'arbitro', vencedor } }, 'encerrar', agora) }
    }
    default:
      return pelaBatalha(luta, motor, contaId, pedido)
  }
}

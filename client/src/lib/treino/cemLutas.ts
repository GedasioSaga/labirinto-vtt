import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { FimDaLuta, TetosDaLuta } from './fimDaLuta'
import { lutaAutomatica } from './lutaAutomatica'
import type { LadoDoTreino, LutadoresDoTreino } from './mesaEmMemoria'
import { sementeValida } from './sorteio'

/**
 * AS 100 LUTAS E O COMPARAR BUILD DO TREINO (LOBBY v2, fatia T4 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): a mesma luta automática da
 * T3 (`lutaAutomatica`) rodada 100 vezes, cada uma com a sua semente, e a
 * contagem de vitórias e empates. O comparar build roda as MESMAS 100
 * sementes com a ficha atual e com o rascunho, e a diferença é só da build.
 *
 * A semente da série gera a de cada luta (`sementeDaLuta`): mesma semente =
 * mesma série; a semente de cada luta vai no resultado, para o "repetir esta
 * luta" turno a turno.
 *
 * Puro e síncrono: roda num Web Worker (`lutas.worker.ts`, para não travar a
 * página) e no vitest. Sem DOM, sem Tauri.
 */

/** Quantas lutas tem a série. */
export const LUTAS_DA_SERIE = 100

/** A razão áurea em 32 bits: espalha índices vizinhos antes da mistura. */
const PASSO_DO_INDICE = 0x9e3779b9
/** As constantes do lowbias32 (C. Wellons, hash-prospector): mistura um inteiro de 32 bits em outro. */
const MISTURA_1 = 0x7feb352d
const MISTURA_2 = 0x846ca68b

/** O que a série precisa. */
export interface PedidoDaSerie {
  /** O sistema do livro (One Piece). */
  sistema: SistemaDeRpg | null
  /** As vagas e as cópias (`montarLutadores`): não mudam, cada luta trabalha numa cópia. */
  lutadores: LutadoresDoTreino
  /** A semente da série: inteiro de 0 a `SEMENTE_MAX` (`sorteio.ts`). */
  semente: number
  /** Ausente = `TETOS_DO_TREINO` (`lutaAutomatica.ts`). */
  tetos?: TetosDaLuta
}

/** Uma luta da série: a semente dela e como acabou. */
export interface LutaDaSerie {
  semente: number
  fim: FimDaLuta
  /** A rodada da ordem no fim. */
  rodada: number
}

export interface ResultadoDaSerie {
  /** A semente da série. */
  semente: number
  vitorias: Record<LadoDoTreino, number>
  /** Empate por todos caídos no mesmo passo, ou por tempo (teto de rodada ou de passo). */
  empates: { todosCaidos: number; tempo: number }
  /** Cada luta, na ordem em que rodou. */
  lutas: readonly LutaDaSerie[]
}

/** Avisa depois de cada luta: quantas já acabaram e de quantas. */
export type AvisoDeProgresso = (feitas: number, total: number) => void

/** O que o comparar build precisa: os mesmos inimigos, a build atual e o rascunho. */
export interface PedidoDeComparacao {
  sistema: SistemaDeRpg | null
  /** Os lutadores com a ficha como ela está. */
  atual: LutadoresDoTreino
  /** Os mesmos lutadores com o rascunho de build no lugar da ficha. */
  rascunho: LutadoresDoTreino
  /** O lado da build (o do jogador): é a vitória dele que se compara. */
  lado: LadoDoTreino
  semente: number
  tetos?: TetosDaLuta
}

export interface ComparacaoDeBuild {
  lado: LadoDoTreino
  atual: ResultadoDaSerie
  rascunho: ResultadoDaSerie
  /** Vitórias do lado com o rascunho menos com a atual, nas mesmas sementes: de -100 a +100. */
  diferenca: number
}

/** O lowbias32 sobre um inteiro de 32 bits sem sinal: devolve outro, espalhado. */
function misturar(valor: number): number {
  let h = valor >>> 0
  h ^= h >>> 16
  h = Math.imul(h, MISTURA_1)
  h ^= h >>> 15
  h = Math.imul(h, MISTURA_2)
  h ^= h >>> 16
  return h >>> 0
}

/**
 * A semente da luta `indice` (0 em diante) da série: um inteiro de 32 bits sem
 * sinal, sempre válido para o sorteio. A mistura evita que as séries de
 * sementes vizinhas (1 e 2) repitam 99 lutas, como aconteceria com `semente + indice`.
 */
export function sementeDaLuta(semente: number, indice: number): number {
  return misturar((semente + Math.imul(indice, PASSO_DO_INDICE)) >>> 0)
}

/** A série sem conferir a semente; `jaFeitas` e `total` são só para o aviso (o comparar soma as duas séries). */
function serieSobre(pedido: PedidoDaSerie, aviso: AvisoDeProgresso | undefined, jaFeitas: number, total: number): ResultadoDaSerie {
  const vitorias: Record<LadoDoTreino, number> = { a: 0, b: 0 }
  const empates = { todosCaidos: 0, tempo: 0 }
  const lutas: LutaDaSerie[] = []
  for (let indice = 0; indice < LUTAS_DA_SERIE; indice += 1) {
    const semente = sementeDaLuta(pedido.semente, indice)
    const resumo = lutaAutomatica({ sistema: pedido.sistema, lutadores: pedido.lutadores, semente, tetos: pedido.tetos })
    const { fim } = resumo
    if (fim.tipo === 'vitoria') vitorias[fim.vencedor] += 1
    else if (fim.tipo === 'todosCaidos') empates.todosCaidos += 1
    else empates.tempo += 1
    lutas.push({ semente, fim, rodada: resumo.rodada })
    aviso?.(jaFeitas + indice + 1, total)
  }
  return { semente: pedido.semente, vitorias, empates, lutas }
}

function conferirSemente(semente: number): void {
  if (!sementeValida(semente)) throw new RangeError(`semente da série do treino inválida: ${String(semente)}`)
}

/**
 * As `LUTAS_DA_SERIE` lutas automáticas da semente, uma depois da outra.
 * Semente torta = `RangeError` antes da primeira luta; ficha ou teto torto
 * sobem da luta (`comecarLuta`).
 */
export function rodarSerie(pedido: PedidoDaSerie, aviso?: AvisoDeProgresso): ResultadoDaSerie {
  conferirSemente(pedido.semente)
  return serieSobre(pedido, aviso, 0, LUTAS_DA_SERIE)
}

/**
 * A série com a build atual e depois com o rascunho, nas mesmas sementes: a
 * luta `i` das duas tem o mesmo dado, então o que muda o resultado é a build.
 * O aviso conta as duas séries (de 1 a 200).
 */
export function compararBuild(pedido: PedidoDeComparacao, aviso?: AvisoDeProgresso): ComparacaoDeBuild {
  conferirSemente(pedido.semente)
  const total = 2 * LUTAS_DA_SERIE
  const base = { sistema: pedido.sistema, semente: pedido.semente, tetos: pedido.tetos }
  const atual = serieSobre({ ...base, lutadores: pedido.atual }, aviso, 0, total)
  const rascunho = serieSobre({ ...base, lutadores: pedido.rascunho }, aviso, LUTAS_DA_SERIE, total)
  return { lado: pedido.lado, atual, rascunho, diferenca: rascunho.vitorias[pedido.lado] - atual.vitorias[pedido.lado] }
}

/**
 * RELÓGIO DOS TESTES DE DESEMPENHO — a LÓGICA separada da MEDIDA. O orçamento
 * da agenda é de relógio (`performance.now` no app): com a CPU dividida (a
 * suíte inteira rodando) cabem menos fatias no quadro, e a mesma conta de
 * pedidos dava outro número. Então:
 * - a lógica (quantos pedidos saem em quantos quadros, revezamento, ninguém
 *   passa fome, nenhum quadro passa do orçamento) roda no relógio lógico: o
 *   mesmo número com a CPU livre ou ocupada;
 * - a medida (ms da consulta, ms do quadro e do tique) segue no relógio de
 *   verdade, contra as mesmas metas, pela primeira de até
 *   `RODADAS_DE_RELOGIO` rodadas que as cumpre (ou pelo menor de várias
 *   medidas): o ruído de outro teste disputando a máquina só soma tempo, e
 *   uma regressão de verdade reprova todas as rodadas.
 * Só teste importa este arquivo.
 */

/**
 * Custo de uma fatia no relógio lógico: o medido com a máquina livre nos 30
 * NPCs do mapa de 300 x 300 casas do desempenho (ms do quadro dividido pelas
 * fatias dele, p50 de 0,58 a 0,64 ms em três rodadas, 22/10/2026; mediana de 2
 * fatias por quadro). Cabem 2 no quadro de `ORCAMENTO_POR_QUADRO_MS`, como na
 * máquina livre. Exato em binário (5/8): as contas do orçamento não arredondam.
 */
export const MS_DA_FATIA_LOGICA = 0.625

/** Rodadas de uma medida de relógio antes de reprovar. */
export const RODADAS_DE_RELOGIO = 3

export interface RelogioLogico {
  /** O relógio da agenda: cada leitura anda `MS_DA_FATIA_LOGICA` (ela lê no começo do `rodar` e depois de cada fatia). */
  readonly ler: () => number
  /** Leva o relógio à hora `ms` da simulação (o tique, o quadro), se ainda não passou dela: o cache de malhas vê o tempo passar. */
  irPara(ms: number): void
}

export function relogioLogico(): RelogioLogico {
  let ms = 0
  return {
    ler: () => {
      ms += MS_DA_FATIA_LOGICA
      return ms
    },
    irPara: (hora) => {
      ms = Math.max(ms, hora)
    },
  }
}

/**
 * Roda a medida de relógio até ela cumprir as metas (`cumpre`) ou até
 * `RODADAS_DE_RELOGIO` rodadas. `escolhida`: a que cumpriu, ou a última — os
 * expects dizem qual meta caiu. `todas`: para o console.
 */
export function primeiraQueCumpre<T>(rodada: () => T, cumpre: (r: T) => boolean): { escolhida: T; todas: T[] } {
  let escolhida = rodada()
  const todas = [escolhida]
  while (!cumpre(escolhida) && todas.length < RODADAS_DE_RELOGIO) {
    escolhida = rodada()
    todas.push(escolhida)
  }
  return { escolhida, todas }
}

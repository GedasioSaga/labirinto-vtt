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
 *   `RODADAS_DE_RELOGIO` rodadas que as cumpre, ou pelo menor de várias
 *   medidas: o ruído de outro teste disputando a máquina só soma tempo, e
 *   uma regressão de verdade reprova todas as rodadas. Onde a margem é curta
 *   (a consulta), a medida ainda é dividida pela lentidão da máquina na hora
 *   (`lentidaoEntre`, por uma obra de referência que não usa o motor).
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

const LADO_DA_REFERENCIA = 300
const VOLTAS_DA_REFERENCIA = 3
const MEDIDAS_DA_REFERENCIA = 3
/**
 * A obra de referência com a máquina livre: `msDaReferencia` isolada nesta
 * máquina, 45 medidas em 22/10/2026, de 2,59 a 3,36 ms (quase todas abaixo de
 * 3,1). Fica o lado alto: compensa menos, nunca mais do que a carga.
 */
export const MS_DA_REFERENCIA_LIVRE = 3

/**
 * Quanto a máquina está mais lenta que livre agora (nunca abaixo de 1): a obra
 * de referência medida antes e depois (`depois`, a função que mede no fim), a
 * mais rápida das duas — a que menos compensa. `livre`: a referência com a
 * máquina livre onde ela roda (no navegador ela custa outro tanto que no Node).
 */
export function lentidaoEntre(antes: number, depois: number, livre: number = MS_DA_REFERENCIA_LIVRE): number {
  return Math.max(1, Math.min(antes, depois) / livre)
}

/** Parede de mentira da obra de referência: colunas com uma fresta em lugar diferente cada uma. */
function barra(x: number, y: number): boolean {
  return x % 8 === 4 && y % 50 !== (x * 3) % 50
}

/**
 * A obra de referência: busca em largura por uma grade de 300 x 300 pontos com
 * paredes de mentira, em vetores tipados — o mesmo tipo de trabalho da busca
 * do motor (memória espalhada, fila, desvio), sem o código dele. Se a busca do
 * motor ficar mais cara, a referência não muda; se a máquina estiver dividida
 * (outro teste no mesmo núcleo, ou o processo num núcleo mais lento), pesa nas
 * duas. Devolve quantos pontos visitou (para o trabalho não ser jogado fora).
 */
function obraDeReferencia(): number {
  const lado = LADO_DA_REFERENCIA
  const visto = new Uint8Array(lado * lado)
  const fila = new Int32Array(lado * lado)
  let inicio = 0
  let fim = 0
  const tentar = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= lado || y >= lado || barra(x, y)) return
    const p = y * lado + x
    if (visto[p] === 1) return
    visto[p] = 1
    fila[fim] = p
    fim += 1
  }
  tentar(0, 0)
  while (inicio < fim) {
    const p = fila[inicio] ?? 0
    inicio += 1
    const x = p % lado
    const y = (p - x) / lado
    tentar(x + 1, y)
    tentar(x - 1, y)
    tentar(x, y + 1)
    tentar(x, y - 1)
  }
  return fim
}

/** Ms da obra de referência agora (`VOLTAS_DA_REFERENCIA` buscas): o menor de `MEDIDAS_DA_REFERENCIA`. */
export function msDaReferencia(): number {
  let menor = Number.POSITIVE_INFINITY
  for (let medida = 0; medida < MEDIDAS_DA_REFERENCIA; medida += 1) {
    const inicio = performance.now()
    let visitados = 0
    for (let volta = 0; volta < VOLTAS_DA_REFERENCIA; volta += 1) visitados += obraDeReferencia()
    const ms = performance.now() - inicio
    if (visitados === 0) throw new Error('a obra de referência não visitou nada')
    menor = Math.min(menor, ms)
  }
  return menor
}

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

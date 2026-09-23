/**
 * Quantos QUADRADOS a ficha já andou, enquanto o mestre ainda segura o botão.
 *
 * Aqui não existe regra de distância nova: tudo desce para `measureCells` de
 * `lib/measurement.ts` — a MESMA função que a ferramenta Medir usa. Duas
 * réguas no mesmo app divergiriam (a de arrastar diria 5 onde a de medir diz
 * 4), e a mesa deixaria de confiar nas duas. Este módulo só faz duas coisas
 * que a régua de medir não faz:
 *
 *  1. usa como unidade o QUADRADO da grade (`cells`), não a unidade de mundo
 *     (`units`, ex. "25 ft") — a pergunta de quem arrasta é "cabe no meu
 *     movimento?", que a mesa conta em quadrados;
 *  2. devolve `null` quando a ficha não saiu do lugar, para o integrador
 *     esconder o rótulo em vez de escrever "0 quadrados" por cima do gesto.
 *
 * Tudo puro: quem desenha é `pixi/drawMeasurementIndicator.ts` (o mesmo
 * desenhista da régua) e quem decide QUANDO chamar é `pixi/PixiCanvas.tsx`.
 */
import type { GridShape, MeasurementMode } from '../types/map'
import type { Point } from '../pixi/world'
import { measureCells } from './measurement'

/**
 * Abaixo disto a ficha não saiu da célula onde estava e o rótulo não aparece.
 * Meio décimo de quadrado: o snap de token trava em centro de célula, então
 * na prática o valor é 0 ou >= 1; a folga existe só para o caso sem snap
 * (Alt apertado) não piscar "0,1 quadrado" no primeiro pixel do gesto.
 */
export const MINIMO_DE_QUADRADOS_PARA_MOSTRAR = 0.5

/** Casas decimais do rótulo — um décimo de quadrado é o mais fino que a mesa lê. */
const CASAS = 1

function arredondar(quadrados: number): number {
  const fator = 10 ** CASAS
  return Math.round(quadrados * fator) / fator
}

/**
 * "5 quadrados", "1 quadrado", "1,5 quadrados" — vírgula decimal (pt-BR) e
 * sem separador de milhar, mesma convenção do rótulo de `measureDistance`.
 * Número inteiro sai sem casa decimal de propósito: "5" e não "5,0", porque
 * o caso esmagadoramente comum (snap em centro de célula) é inteiro e a
 * casa vazia só rouba legibilidade de uma informação passageira.
 */
export function formatarQuadrados(quadrados: number): string {
  const valor = arredondar(quadrados)
  const numero = Number.isInteger(valor)
    ? String(valor)
    : valor.toLocaleString('pt-BR', {
        minimumFractionDigits: CASAS,
        maximumFractionDigits: CASAS,
        useGrouping: false,
      })
  return `${numero} ${valor === 1 ? 'quadrado' : 'quadrados'}`
}

/**
 * Rótulo do arrasto de `origem` até `atual`, ou `null` quando a ficha ainda
 * não andou um quadrado (aí o integrador esconde o indicador).
 *
 * `modo` é o MESMO `MapData.measurementMode` que a ferramenta Medir usa: se a
 * mesa joga 3.5e ("5-10-5"), a diagonal custa o mesmo nos dois lugares.
 */
export function rotuloDeQuadradosAndados(
  origem: Point,
  atual: Point,
  gridSize: number,
  gridShape: GridShape,
  modo: MeasurementMode,
): string | null {
  const quadrados = measureCells(origem, atual, gridSize, gridShape, modo)
  if (!Number.isFinite(quadrados) || quadrados < MINIMO_DE_QUADRADOS_PARA_MOSTRAR) return null
  return formatarQuadrados(quadrados)
}

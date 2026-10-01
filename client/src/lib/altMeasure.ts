/**
 * ALT SEGURADO MEDE (pedido 3 de 30/09/2026, fatia 5): com algo selecionado,
 * segurar o Alt e pôr o mouse sobre outra peça mostra a distância entre as
 * duas, em magenta, como no Figma. Medir é só olhar: o mapa nunca muda.
 *
 * Duas partes, as duas PURAS (sem Pixi, sem store, sem DOM):
 *  - `measureBetween`: as cotas entre a caixa da seleção e a da peça sob o
 *    mouse. A cota é o `GapMark` das guias (fatia 3): o mesmo desenho e o
 *    mesmo número, na unidade do mapa.
 *  - `criarMedidorDoAlt`: QUANDO o Alt é do medir. A régua é a de
 *    `lib/toqueDeAlt.ts` (decisão d de `smartGuides.ts`): o Alt mede quando
 *    soltá-lo AGORA daria 'segurado'. Antes da janela do toque ele ainda pode
 *    ser o toque que endireita a linha (pedido 5); qualquer clique, arrasto,
 *    rolagem ou outra tecla no meio faz dele um modificador ('combinado'), e
 *    aí não mede nem endireita. Como a medida só aparece depois de a soltura
 *    deixar de poder ser toque, o endireitar e a medida nunca agem sobre o
 *    mesmo Alt.
 *
 * O medidor ESPELHA a contabilidade de `criarDetectorDeToqueDeAlt` (o que
 * conta como outra entrada, a origem do movimento, o botão já apertado) e
 * classifica pela mesma `classificarSolturaDoAlt`. Espelha porque o detector
 * só responde no keyup, e a medida precisa da resposta enquanto o Alt está
 * apertado. O teste "nunca os dois" (`altMeasure.test.ts`) roda as mesmas
 * sequências sorteadas nos dois e fica vermelho se um dia divergirem.
 */
import type { AreaBounds } from './areaSelection'
import { crossAxis, high, low, sameGaps, type GapMark, type GuideAxis } from './smartGuides'
import { ALT_TOQUE_JANELA_MS, classificarSolturaDoAlt, type TeclaDoAlt } from './toqueDeAlt'

/**
 * O que o Alt segurado desenha. `gaps` são as cotas, cada uma com número.
 * `extensions` são os tracejados da peça na diagonal: a cota sai do meio da
 * seleção e para na reta da borda da peça, fora dela, e o tracejado leva a
 * ponta até a peça para o olho saber o que foi medido. Mesma convenção do
 * `GapMark`: `axis: 'x'` é deitado em y = `at`; `'y'`, em pé em x = `at`.
 */
export interface AltMeasure {
  gaps: GapMark[]
  extensions: GapMark[]
}

/** Abaixo disto (px de mundo) duas bordas contam como a mesma posição: vão zero não tem cota. */
const SAME_EDGE_EPSILON = 1e-6

const AXES: readonly GuideAxis[] = ['x', 'y']

function isFiniteBox(box: AreaBounds): boolean {
  return Number.isFinite(box.minX) && Number.isFinite(box.minY) && Number.isFinite(box.maxX) && Number.isFinite(box.maxY)
}

function center(box: AreaBounds, axis: GuideAxis): number {
  return (low(box, axis) + high(box, axis)) / 2
}

/** Quanto falta para as duas faixas do eixo se tocarem: positivo é vão; zero ou negativo, encostam ou se sobrepõem. */
function separation(a: AreaBounds, b: AreaBounds, axis: GuideAxis): number {
  return Math.max(low(a, axis), low(b, axis)) - Math.min(high(a, axis), high(b, axis))
}

/** O meio da faixa que as duas têm em comum no eixo (elas se sobrepõem ou encostam nele). */
function middleOfOverlap(a: AreaBounds, b: AreaBounds, axis: GuideAxis): number {
  return (Math.max(low(a, axis), low(b, axis)) + Math.min(high(a, axis), high(b, axis))) / 2
}

/** Uma encosta na outra por fora no eixo (lado a lado): não há folga entre bordas correspondentes para medir. */
function sideBySide(a: AreaBounds, b: AreaBounds, axis: GuideAxis): boolean {
  return Math.abs(high(a, axis) - low(b, axis)) <= SAME_EDGE_EPSILON || Math.abs(high(b, axis) - low(a, axis)) <= SAME_EDGE_EPSILON
}

/** A cota do vão entre as bordas que se olham, no eixo em que as peças estão separadas, na altura `at`. */
function nearGap(a: AreaBounds, b: AreaBounds, axis: GuideAxis, at: number): GapMark {
  return low(b, axis) >= high(a, axis)
    ? { axis, from: high(a, axis), to: low(b, axis), at }
    : { axis, from: high(b, axis), to: low(a, axis), at }
}

/**
 * Uma dentro da outra, ou se cruzando: a folga entre as bordas
 * correspondentes (esquerda com esquerda, direita com direita), passando pelo
 * meio da faixa em comum. Com uma dentro da outra, é a reta que passa pelo
 * meio da de dentro: as 4 folgas do Figma.
 */
function edgeGaps(a: AreaBounds, b: AreaBounds, axis: GuideAxis): GapMark[] {
  if (sideBySide(a, b, axis)) return []
  const at = middleOfOverlap(a, b, crossAxis(axis))
  const correspondingEdges: ReadonlyArray<readonly [number, number]> = [
    [low(a, axis), low(b, axis)],
    [high(a, axis), high(b, axis)],
  ]
  const gaps: GapMark[] = []
  for (const [mine, theirs] of correspondingEdges) {
    if (Math.abs(mine - theirs) > SAME_EDGE_EPSILON) gaps.push({ axis, from: Math.min(mine, theirs), to: Math.max(mine, theirs), at })
  }
  return gaps
}

/** Sem faixa em comum em nenhum eixo: uma cota por eixo saindo do meio da seleção, e o tracejado até a peça. */
function diagonal(a: AreaBounds, b: AreaBounds): AltMeasure {
  const measure: AltMeasure = { gaps: [], extensions: [] }
  for (const axis of AXES) {
    const cross = crossAxis(axis)
    const at = center(a, cross)
    measure.gaps.push(nearGap(a, b, axis, at))
    // A ponta da cota do lado da peça: a borda dela que olha para a seleção.
    const tip = low(b, axis) >= high(a, axis) ? low(b, axis) : high(b, axis)
    // Até onde o tracejado vai no outro eixo: a borda da peça mais perto da cota.
    const edge = low(b, cross) >= at ? low(b, cross) : high(b, cross)
    measure.extensions.push({ axis: cross, from: Math.min(at, edge), to: Math.max(at, edge), at: tip })
  }
  return measure
}

/**
 * As cotas entre a caixa da seleção (`a`) e a da peça sob o mouse (`b`):
 *  - separadas num eixo e com faixa em comum no outro: uma cota só, de borda
 *    a borda, no meio da faixa em comum;
 *  - na diagonal: uma cota por eixo, com o tracejado (`diagonal`);
 *  - uma dentro da outra ou se cruzando: as folgas entre bordas
 *    correspondentes (`edgeGaps`).
 * Vão zero não tem cota, e caixa que não serve (NaN, infinita) não mede.
 */
export function measureBetween(a: AreaBounds, b: AreaBounds): AltMeasure {
  if (!isFiniteBox(a) || !isFiniteBox(b)) return { gaps: [], extensions: [] }
  const apartX = separation(a, b, 'x') > SAME_EDGE_EPSILON
  const apartY = separation(a, b, 'y') > SAME_EDGE_EPSILON
  if (apartX && apartY) return diagonal(a, b)
  if (apartX) return { gaps: [nearGap(a, b, 'x', middleOfOverlap(a, b, 'y'))], extensions: [] }
  if (apartY) return { gaps: [nearGap(a, b, 'y', middleOfOverlap(a, b, 'x'))], extensions: [] }
  return { gaps: [...edgeGaps(a, b, 'x'), ...edgeGaps(a, b, 'y')], extensions: [] }
}

/** A mesma medida? O mouse parado sobre a mesma peça dá dezenas de pointermove: redesenhar cada um seria trabalho jogado fora. */
export function sameAltMeasure(a: AltMeasure, b: AltMeasure): boolean {
  return sameGaps(a.gaps, b.gaps) && sameGaps(a.extensions, b.extensions)
}

/**
 * Recebe os mesmos eventos que o detector do toque (`DetectorDeToqueDeAlt`,
 * mesmos nomes e mesmos argumentos) e responde, a qualquer instante, se o
 * Alt está segurado PARA MEDIR.
 */
export interface MedidorDoAlt {
  teclaDesceu(tecla: TeclaDoAlt): void
  teclaSubiu(tecla: Pick<TeclaDoAlt, 'key' | 'timeStamp'>): void
  ponteiroDesceu(): void
  ponteiroSubiu(): void
  /** Em px de tela; `botoes` é o `MouseEvent.buttons` (0 = nenhum apertado). */
  ponteiroMoveu(x: number, y: number, botoes: number): void
  interromper(): void
  zerar(): void
  /** Soltar o Alt em `agora` (o relógio do `timeStamp` dos eventos) daria 'segurado'? */
  medindo(agora: number): boolean
  /**
   * O instante em que o Alt apertado passa a medir só pelo tempo (o mouse
   * parado em cima da peça também mede). `null` sem Alt, ou com o Alt já
   * combinado com outra entrada.
   */
  medePeloTempoEm(): number | null
}

interface AltApertado {
  apertouEm: number
  /** Onde o mouse estava quando o Alt desceu; `null` até o primeiro movimento conhecido. */
  origem: { x: number; y: number } | null
  movimentoPx: number
  outraEntrada: boolean
}

export function criarMedidorDoAlt(): MedidorDoAlt {
  let apertado: AltApertado | null = null
  let botaoApertado = false
  let ultimaPosicao: { x: number; y: number } | null = null

  const marcarOutraEntrada = (): void => {
    if (apertado !== null) apertado.outraEntrada = true
  }

  return {
    teclaDesceu(tecla) {
      if (tecla.key !== 'Alt') {
        marcarOutraEntrada()
        return
      }
      // Segurar o Alt repete o keydown: não rearma nem estende a janela.
      if (tecla.repeat) return
      if (apertado !== null) {
        // Os dois Alts juntos: o detector conta como combinado.
        apertado.outraEntrada = true
        return
      }
      apertado = {
        apertouEm: tecla.timeStamp,
        origem: ultimaPosicao,
        movimentoPx: 0,
        // AltGr (Ctrl+Alt), Alt+Shift, Alt+Windows, ou o Alt no meio de um arrasto.
        outraEntrada: tecla.ctrlKey || tecla.metaKey || tecla.shiftKey || botaoApertado,
      }
    },
    teclaSubiu(tecla) {
      if (tecla.key !== 'Alt') {
        marcarOutraEntrada()
        return
      }
      apertado = null
    },
    ponteiroDesceu() {
      botaoApertado = true
      marcarOutraEntrada()
    },
    ponteiroSubiu() {
      botaoApertado = false
      marcarOutraEntrada()
    },
    ponteiroMoveu(x, y, botoes) {
      botaoApertado = botoes !== 0
      ultimaPosicao = { x, y }
      if (apertado === null) return
      if (botaoApertado) apertado.outraEntrada = true
      if (apertado.origem === null) {
        apertado.origem = { x, y }
        return
      }
      apertado.movimentoPx = Math.max(apertado.movimentoPx, Math.hypot(x - apertado.origem.x, y - apertado.origem.y))
    },
    interromper: marcarOutraEntrada,
    zerar() {
      apertado = null
      botaoApertado = false
      ultimaPosicao = null
    },
    medindo(agora) {
      if (apertado === null) return false
      // O detector classifica um instante inválido como 'segurado' (na dúvida,
      // nada de toque). Aqui a dúvida é a outra: sem instante de verdade, nada
      // de medida na tela.
      if (!Number.isFinite(agora) || agora < apertado.apertouEm) return false
      const { apertouEm, movimentoPx, outraEntrada } = apertado
      return classificarSolturaDoAlt({ apertouEm, soltouEm: agora, movimentoPx, outraEntrada }) === 'segurado'
    },
    medePeloTempoEm() {
      if (apertado === null || apertado.outraEntrada) return null
      return apertado.apertouEm + ALT_TOQUE_JANELA_MS
    },
  }
}

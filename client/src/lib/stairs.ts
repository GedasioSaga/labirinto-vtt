import type { Stair, StairDirection, StairSegment, StairShape } from '../types/map'
import type { Point } from '../pixi/world'

/** Mesmo critério de isValidWallDraft (drawingFactory.ts) — arrasto de
 *  comprimento zero (clique sem mover) não vira lance de escada. */
export function isValidStairDraft(start: Point, end: Point): boolean {
  return start.x !== end.x || start.y !== end.y
}

/**
 * Escada de 1 lance. `shape` default 'straight' — a ferramenta de criação
 * (PixiCanvas, arrasto de 2 pontos) só chama este builder sem o argumento,
 * então o comportamento de hoje não muda; 'l'/'double' já existem no
 * schema/render (types/map.ts, StairShape) e este builder já aceita
 * construí-los se algum chamador futuro tiver os `segments` prontos — falta
 * só a ferramenta de 3 cliques que monta esses segments a partir do gesto do
 * usuário (fora do escopo desta tarefa, ver CONTRATO). `stepWidth` é
 * responsabilidade do chamador: o schema documenta "default na criação =
 * map.grid" (types/map.ts), então quem constrói o draft (PixiCanvas) passa
 * `map.grid`, não um literal aqui. `direction` default 'up': usuário troca
 * depois via StairControls (setStairDirection, com histórico) sem precisar
 * escolher no momento do arrasto — mesma filosofia de wallKind/polygonSides,
 * só que a troca acontece na entidade já criada em vez de numa preferência
 * "próxima escada".
 */
export function buildStairFromDraft(
  id: string,
  start: Point,
  end: Point,
  stepWidth: number,
  direction: StairDirection = 'up',
  shape: StairShape = 'straight',
): Stair {
  return {
    id,
    shape,
    direction,
    segments: [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y }],
    stepWidth,
  }
}

/** Tamanho nomeado do lance — eixo diferente de `StairShape` (forma). Só os
 *  3 valores que o usuário pediu por nome (ROADMAP.md N1: "pequena média ou
 *  grande"), nunca um 4º inventado. */
export type StairSizePreset = 'small' | 'medium' | 'large'

/**
 * `stepWidth` de cada preset, como múltiplo de `map.grid` — não um px fixo,
 * porque `stepWidth` já é sempre relativo à grade do mapa (o próprio schema
 * documenta "default na criação = map.grid", ou seja, hoje toda escada nasce
 * exatamente na proporção que aqui vira "média"). Critério dos outros dois:
 * 'small' = metade de uma célula (passagem justa, mal cabe 1 token de grid
 * padrão lado a lado); 'large' = duas células (larga o bastante pra 2 tokens
 * lado a lado com folga). 1 é o único valor que precisa bater com o default
 * de criação existente — os outros dois são critério novo desta tarefa.
 */
export const STAIR_SIZE_PRESET_RATIO: Record<StairSizePreset, number> = {
  small: 0.5,
  medium: 1,
  large: 2,
}

/** `stepWidth` (px de mundo) de um preset, para o `grid` do mapa atual. */
export function stairStepWidthForPreset(preset: StairSizePreset, grid: number): number {
  return STAIR_SIZE_PRESET_RATIO[preset] * grid
}

/**
 * Preset cujo `stepWidth` bate exatamente com o valor atual — só para
 * destacar o botão ativo (`aria-checked`) no controle de presets; nunca usado
 * para decidir o que gravar (o campo numérico fino sempre grava o valor
 * exato digitado, sem arredondar para o preset mais próximo). `undefined`
 * quando o valor atual não bate com nenhum preset (usuário usou o campo
 * fino, ou a escada foi criada/editada com outro valor) — nenhum botão fica
 * marcado, que é o estado correto: nenhum dos três É o valor atual.
 */
export function stairSizePresetForStepWidth(stepWidth: number, grid: number): StairSizePreset | undefined {
  const entries = Object.entries(STAIR_SIZE_PRESET_RATIO) as Array<[StairSizePreset, number]>
  const match = entries.find(([, ratio]) => stepWidth === ratio * grid)
  return match?.[0]
}

/**
 * LANCE EM GALÃO (17/09/2026) — desenho aposentado do mapa, mantido como
 * geometria de referência.
 *
 * Queixa do mestre em 17/09: "como eu sei que essa escada vai para cima ou
 * para baixo? como eu sei que isso é uma escada... ta meio feio". A resposta
 * daquele dia foi um lance entre duas vigas com degraus em galão: o bico do
 * degrau avançava ladeira acima (`STAIR_TREAD_NOSE_RATIO`), o traço engordava
 * (`STAIR_TREAD_WIDTH_AT_FOOT` -> `..._AT_TOP`) e o tom clareava rumo ao topo.
 *
 * Em 28/09 o galão perdeu no swap cego: lia-se como seta, não como escada. O
 * mapa passou a desenhar o lance de minimapa de `planStairFlight`
 * (`pixi/stairFlight.ts`): placa chapada, degraus finos que se apertam rumo ao
 * pé e patamar marcando o topo. Nenhum código de produção chama
 * `computeStairPlan` hoje; ela só fica porque `pixi/stairFlight.test.ts`
 * confere nela a convenção de pé e topo.
 *
 * Tudo em proporção de `stepWidth`, nunca em px fixo: um lance Grande (2
 * células) ganha degrau proporcionalmente maior em vez de virar um pente de
 * traços apertados, e um lance Pequeno não vira bloco.
 */

/** Distância entre degraus, como fração da largura do lance. */
export const STAIR_TREAD_SPACING_RATIO = 0.34
/**
 * Avanço do bico do degrau, como fração da MEIA largura. Vale mais que
 * `STAIR_TREAD_SPACING_RATIO x 2` de propósito: assim o bico de um degrau
 * alcança a base do seguinte e o lance nunca fica com uma faixa de chão vazio
 * atravessada — que era exatamente a queixa do "pente de fios de cabelo".
 */
export const STAIR_TREAD_NOSE_RATIO = 0.75
/** Espessura do degrau do pé do lance, como fração da largura do lance. */
export const STAIR_TREAD_WIDTH_AT_FOOT = 0.045
/** ... e do degrau mais alto. */
export const STAIR_TREAD_WIDTH_AT_TOP = 0.11
/**
 * Teto de intervalos entre degraus. Largura minúscula (0,05 px num lance de
 * 256) pedia 15 mil degraus e 1e-9 pedia centenas de bilhões; o teto segura a
 * conta no mesmo valor que `pixi/stairFlight.ts` usa para o lance do mapa.
 */
export const STAIR_PLAN_MAX_INTERVALS = 256

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

export interface StairTread {
  /** Galão apontando ladeira acima: viga de um lado, bico no eixo, viga do outro. */
  points: [Point, Point, Point]
  /** Espessura do traço em px de mundo. */
  width: number
  /** 0 no degrau do pé, 1 no mais alto — o renderer converte em tom. */
  climb: number
}

export interface StairPlan {
  /** Pé (nível de baixo) e topo (nível de cima) já resolvidos por `direction`. */
  foot: Point
  top: Point
  /** As duas vigas laterais do lance, cada uma do pé ao topo. */
  rails: [[Point, Point], [Point, Point]]
  /** Degraus, do pé para o topo. */
  treads: StairTread[]
}

/**
 * Geometria do lance em galão, em px de mundo — pura, sem nada de Pixi. O mapa
 * não desenha mais com ela (ver o bloco LANCE EM GALÃO acima).
 *
 * `direction` decide qual PONTA do segmento é o alto: 'up' sobe no sentido do
 * traço (topo em x2,y2), 'down' desce no sentido do traço (topo em x1,y1) — a
 * mesma convenção que `planStairFlight` segue para pôr o patamar.
 *
 * Devolve `null` quando não há lance para planejar: segmento de comprimento
 * zero, ponta NaN ou infinita, ou largura que não forma lance (0, negativa,
 * NaN, infinita). Largura 0 chegava a travar o app: a conta de degraus dava
 * Infinity e o laço nunca terminava. Largura positiva minúscula ainda desenha,
 * com no máximo `STAIR_PLAN_MAX_INTERVALS` intervalos.
 */
export function computeStairPlan(segment: StairSegment, stepWidth: number, direction: StairDirection): StairPlan | null {
  if (!(stepWidth > 0) || !Number.isFinite(stepWidth)) return null

  const ascends = direction === 'up'
  const foot: Point = ascends ? { x: segment.x1, y: segment.y1 } : { x: segment.x2, y: segment.y2 }
  const top: Point = ascends ? { x: segment.x2, y: segment.y2 } : { x: segment.x1, y: segment.y1 }

  const dx = top.x - foot.x
  const dy = top.y - foot.y
  const length = Math.hypot(dx, dy)
  if (!(length > 0) || !Number.isFinite(length)) return null

  const ux = dx / length
  const uy = dy / length
  // perpendicular unitário (rotação de 90° do vetor de subida)
  const px = -uy
  const py = ux
  const half = stepWidth / 2

  /** Ponto a `along` px do pé, subindo, e `across` px para o lado. */
  const at = (along: number, across: number): Point => ({
    x: foot.x + ux * along + px * across,
    y: foot.y + uy * along + py * across,
  })

  // O bico do degrau mais alto encosta no fim do lance: nenhum traço passa da
  // ponta do segmento, e o pé começa no zero.
  const nose = Math.min(STAIR_TREAD_NOSE_RATIO * half, length)
  const run = length - nose
  const count = Math.min(STAIR_PLAN_MAX_INTERVALS, Math.max(1, Math.round(run / (STAIR_TREAD_SPACING_RATIO * stepWidth))))
  const pitch = run / count

  const treads: StairTread[] = []
  for (let i = 0; i <= count; i += 1) {
    const climb = i / count
    const base = i * pitch
    treads.push({
      points: [at(base, half), at(base + nose, 0), at(base, -half)],
      width: stepWidth * lerp(STAIR_TREAD_WIDTH_AT_FOOT, STAIR_TREAD_WIDTH_AT_TOP, climb),
      climb,
    })
  }

  return {
    foot,
    top,
    rails: [
      [at(0, half), at(length, half)],
      [at(0, -half), at(length, -half)],
    ],
    treads,
  }
}

/**
 * ESCADA EM ESPIRAL vista de cima: o lance reto enrolado num poste.
 *
 * O arrasto (o primeiro lance) é o DIÂMETRO: quem troca "Reta" por "Espiral"
 * vê o círculo nascer em cima do lance que já estava lá, e a boca (`x1, y1`,
 * onde mora o pino da escada, `lib/stairTravel.ts`) fica na borda.
 *
 * Todo ponto da escada se diz por `sweep`, o ângulo andado desde a boca no
 * sentido da subida, e pela distância ao centro (`spiralPoint`). A subida vai
 * de 0 a `climbSweep`; o patamar é o último `landingSweep`, que fecha a volta
 * e encosta na boca pelo outro lado. 'up' sobe no sentido horário da tela;
 * 'down' é o espelho no eixo da boca, a mesma escada percorrida do alto: quem
 * entra pela boca pisa no patamar e desce. Quantos degraus, onde cada um cai,
 * cores e espessuras são do renderer (pixi/drawStairs.ts), como no lance reto.
 */
/** Raio do poste central, como fração do raio do círculo. */
export const SPIRAL_POST_RATIO = 0.18
/** Fatia do patamar: um quarto de volta. */
export const SPIRAL_LANDING_SWEEP = Math.PI / 2

export interface SpiralPlan {
  center: Point
  radius: number
  postRadius: number
  /** Ângulo da boca visto do centro, em radianos de tela (y para baixo). */
  mouthAngle: number
  /** 1 quando o `sweep` cresce no sentido horário da tela ('up'); -1 no anti-horário ('down'). */
  turn: 1 | -1
  /** Ângulo da subida, da boca até o patamar. */
  climbSweep: number
  /** Ângulo do patamar; com a subida, fecha a volta. */
  landingSweep: number
}

/** O ponto a `distance` do centro, depois de andar `sweep` desde a boca no sentido da subida. */
export function spiralPoint(plan: SpiralPlan, sweep: number, distance: number): Point {
  const angle = plan.mouthAngle + plan.turn * sweep
  return { x: plan.center.x + Math.cos(angle) * distance, y: plan.center.y + Math.sin(angle) * distance }
}

/** Centro e raio do círculo de uma espiral: o lance é o diâmetro. `null` = lance de comprimento zero. */
export function spiralCircle(segment: StairSegment): { center: Point; radius: number } | null {
  const radius = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) / 2
  if (radius === 0) return null
  return { center: { x: (segment.x1 + segment.x2) / 2, y: (segment.y1 + segment.y2) / 2 }, radius }
}

/**
 * O círculo que a escada OCUPA quando é espiral; `null` para qualquer outra
 * forma (ou espiral sem lance). Fonte única para clique, borracha, hover e
 * seleção por área: todos tratam a espiral como o círculo desenhado, nunca
 * como o diâmetro arrastado.
 */
export function stairSpiralCircle(stair: Stair): { center: Point; radius: number } | null {
  if (stair.shape !== 'spiral') return null
  const first = stair.segments[0]
  return first === undefined ? null : spiralCircle(first)
}

/** Geometria da espiral em px de mundo — pura, sem Pixi. Lance de comprimento zero devolve `null`. */
export function computeSpiralPlan(segment: StairSegment, direction: StairDirection): SpiralPlan | null {
  const circle = spiralCircle(segment)
  if (circle === null) return null
  const { center, radius } = circle
  return {
    center,
    radius,
    postRadius: radius * SPIRAL_POST_RATIO,
    mouthAngle: Math.atan2(segment.y1 - center.y, segment.x1 - center.x),
    // Na tela o y cresce para baixo: ângulo crescente é sentido horário.
    turn: direction === 'up' ? 1 : -1,
    climbSweep: 2 * Math.PI - SPIRAL_LANDING_SWEEP,
    landingSweep: SPIRAL_LANDING_SWEEP,
  }
}

/**
 * ESCADA EM L E EM U, a "escadaria de dois lances" (lote de referências de
 * 15/11/2026). `segments` guarda a LINHA DO MEIO do caminho, a partir da boca
 * (x1, y1): na L, boca → meio do patamar da volta → ponta; na U, boca → meio
 * do patamar no lance de ida → meio do patamar no lance de volta → ponta, e o
 * trecho do meio, de uma largura, atravessa o patamar. É essa linha que o
 * clique, a borracha, a seleção por área, a caixa de giro e o alcance já leem
 * (`stairCenterline`): a escada inteira conta, e mover, girar e mudar o
 * comprimento valem para os lances todos. O desenho sai de
 * `planoDaEscadaDobrada`: a volta é patamar, e cada lance é a linha do meio
 * aparada meia largura na volta. A escada dobra para a direita de quem anda a
 * partir da boca; girar a escada leva a volta junto.
 */
export type FormaDobrada = Extract<StairShape, 'l' | 'double'>

/** Folga de conta para pontas que deviam coincidir (o giro e a escala mexem nelas com ponto flutuante). */
const FOLGA_DA_DOBRA_PX = 1e-6

function unitario(dx: number, dy: number): Point | null {
  const length = Math.hypot(dx, dy)
  return length > 0 && Number.isFinite(length) ? { x: dx / length, y: dy / length } : null
}

function comprimentoDoLance(segment: StairSegment): number {
  return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1)
}

/** A direita de quem anda no sentido `ida`, com o y da tela para baixo. */
function direitaDe(ida: Point): Point {
  return { x: -ida.y, y: ida.x }
}

function encadeados(segments: readonly StairSegment[]): boolean {
  for (let i = 1; i < segments.length; i += 1) {
    const antes = segments[i - 1]
    const agora = segments[i]
    if (Math.abs(antes.x2 - agora.x1) > FOLGA_DA_DOBRA_PX || Math.abs(antes.y2 - agora.y1) > FOLGA_DA_DOBRA_PX) return false
  }
  return true
}

/** A escada tem o desenho dobrado: L com dois trechos encadeados, U com três. Fora disso, cada lance é um lance reto, como sempre. */
export function ehEscadaDobrada(stair: Pick<Stair, 'shape' | 'segments'>): boolean {
  if (stair.shape === 'l') return stair.segments.length === 2 && encadeados(stair.segments)
  if (stair.shape === 'double') return stair.segments.length === 3 && encadeados(stair.segments)
  return false
}

/** A dobra lida dos trechos: boca, sentido de ida, lado da volta e o comprimento de cada braço na linha do meio. */
interface Dobra {
  forma: FormaDobrada
  boca: Point
  ida: Point
  lado: Point
  /** Da boca ao meio do patamar. */
  bracoDeIda: number
  /** Do meio do patamar à ponta. */
  bracoDeVolta: number
}

function lerDobra(stair: Pick<Stair, 'shape' | 'segments'>): Dobra | null {
  if (!ehEscadaDobrada(stair)) return null
  const forma: FormaDobrada = stair.shape === 'l' ? 'l' : 'double'
  const [primeiro, segundo] = stair.segments
  const ultimo = stair.segments[stair.segments.length - 1]
  const ida = unitario(primeiro.x2 - primeiro.x1, primeiro.y2 - primeiro.y1)
  if (ida === null) return null
  // O lado vem do segundo trecho (o braço da L, a travessa da U), sempre em ângulo reto com a ida.
  const direita = direitaDe(ida)
  const lado = (segundo.x2 - segundo.x1) * direita.x + (segundo.y2 - segundo.y1) * direita.y < 0 ? { x: -direita.x, y: -direita.y } : direita
  return {
    forma,
    boca: { x: primeiro.x1, y: primeiro.y1 },
    ida,
    lado,
    bracoDeIda: comprimentoDoLance(primeiro),
    bracoDeVolta: comprimentoDoLance(ultimo),
  }
}

/** A linha do meio da L ou da U a partir da boca. Na U, a travessa tem `largura`: os dois lances encostam. */
function caminhoDobrado(dobra: Dobra, largura: number): StairSegment[] {
  const { boca, ida, lado, bracoDeIda, bracoDeVolta } = dobra
  const volta = { x: boca.x + ida.x * bracoDeIda, y: boca.y + ida.y * bracoDeIda }
  const trecho = (a: Point, b: Point): StairSegment => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
  if (dobra.forma === 'l') {
    return [trecho(boca, volta), trecho(volta, { x: volta.x + lado.x * bracoDeVolta, y: volta.y + lado.y * bracoDeVolta })]
  }
  const outroLado = { x: volta.x + lado.x * largura, y: volta.y + lado.y * largura }
  const ponta = { x: outroLado.x - ida.x * bracoDeVolta, y: outroLado.y - ida.y * bracoDeVolta }
  return [trecho(boca, volta), trecho(volta, outroLado), trecho(outroLado, ponta)]
}

function larguraValida(stepWidth: number): number {
  return Number.isFinite(stepWidth) ? Math.max(0, stepWidth) : 0
}

/** Os mesmos trechos, a menos da folga de conta? Então a escada fica com a MESMA referência. */
function mesmosTrechos(a: readonly StairSegment[], b: readonly StairSegment[]): boolean {
  return (
    a.length === b.length &&
    a.every((s, i) => {
      const t = b[i]
      return (
        Math.abs(s.x1 - t.x1) <= FOLGA_DA_DOBRA_PX &&
        Math.abs(s.y1 - t.y1) <= FOLGA_DA_DOBRA_PX &&
        Math.abs(s.x2 - t.x2) <= FOLGA_DA_DOBRA_PX &&
        Math.abs(s.y2 - t.y2) <= FOLGA_DA_DOBRA_PX
      )
    })
  )
}

/**
 * Os trechos da escada na forma `forma`, para quem troca a forma na ficha. A
 * boca (x1, y1, onde mora o pino da escada) nunca sai do lugar, e o caminho
 * guarda o comprimento: a reta de 4 casas vira a L de dois braços de 2 casas
 * (ou a U de dois lances de 2), e volta a ser a mesma reta. Braço menor que a
 * largura cresce até ela, para os dois lances não sumirem na volta. Entre a
 * reta e a espiral os trechos ficam onde estão (a espiral usa o primeiro como
 * diâmetro). Mesma forma, ou escada sem lance: os MESMOS trechos.
 */
export function segmentosDaForma(stair: Pick<Stair, 'shape' | 'segments' | 'stepWidth'>, forma: StairShape): StairSegment[] {
  const primeiro = stair.segments[0]
  if (forma === stair.shape || primeiro === undefined) return stair.segments
  const dobra = lerDobra(stair)
  const ida = dobra?.ida ?? unitario(primeiro.x2 - primeiro.x1, primeiro.y2 - primeiro.y1)
  if (ida === null) return stair.segments
  // O comprimento do caminho: a soma dos braços na escada dobrada (a travessa da U não conta), a dos lances nas outras.
  const caminho = dobra === null ? stair.segments.reduce((total, s) => total + comprimentoDoLance(s), 0) : dobra.bracoDeIda + dobra.bracoDeVolta
  const boca = { x: primeiro.x1, y: primeiro.y1 }
  if (forma === 'straight' || forma === 'spiral') {
    if (dobra === null) return stair.segments
    return [{ x1: boca.x, y1: boca.y, x2: boca.x + ida.x * caminho, y2: boca.y + ida.y * caminho }]
  }
  const largura = larguraValida(stair.stepWidth)
  const braco = Math.max(caminho / 2, largura)
  return caminhoDobrado({ forma, boca, ida, lado: dobra?.lado ?? direitaDe(ida), bracoDeIda: braco, bracoDeVolta: braco }, largura)
}

/**
 * A U com a travessa de UMA largura, para os dois lances seguirem encostados
 * depois de a largura mudar (alças, ficha) ou de o comprimento escalar a
 * escada inteira. `comprimento`, quando vem, é o novo comprimento de ponta a
 * ponta (`stairLength`, travessa incluída): os braços crescem juntos, na
 * mesma proporção, e nunca ficam menores que a largura. Escada que não é U
 * dobrada, ou já certa: os MESMOS trechos.
 */
export function trechosDaUAjustados(stair: Pick<Stair, 'shape' | 'segments' | 'stepWidth'>, comprimento?: number): StairSegment[] {
  const dobra = lerDobra(stair)
  if (dobra === null || dobra.forma !== 'double') return stair.segments
  const largura = larguraValida(stair.stepWidth)
  const bracos = dobra.bracoDeIda + dobra.bracoDeVolta
  const fator = comprimento === undefined || !Number.isFinite(comprimento) || !(bracos > 0) ? 1 : Math.max(0, comprimento - largura) / bracos
  const ajustada: Dobra = {
    ...dobra,
    bracoDeIda: Math.max(dobra.bracoDeIda * fator, largura),
    bracoDeVolta: Math.max(dobra.bracoDeVolta * fator, largura),
  }
  const trechos = caminhoDobrado(ajustada, largura)
  return mesmosTrechos(trechos, stair.segments) ? stair.segments : trechos
}

/** Um lance de degraus da escada dobrada. */
export interface LanceDaDobra {
  segmento: StairSegment
  /** Só o lance que chega ao alto tem o patamar de chegada; o da volta é o patamar da dobra. */
  patamarNoTopo: boolean
}

/** O desenho da escada dobrada em px de mundo — puro, sem Pixi. Quem pinta é `pixi/drawStairs.ts`. */
export interface PlanoDaEscadaDobrada {
  /** Os lances de degraus, aparados meia largura na volta. Braço curto demais não tem lance. */
  lances: LanceDaDobra[]
  /** O contorno da escada inteira, `folga` px para fora (negativa: para dentro). */
  contorno: (folga: number) => Point[]
  /** O patamar da volta (o quadrado da L, o retângulo da U), recolhido `recuo` px nos lados de fora. */
  patamar: (recuo: number) => Point[]
  /** A divisa entre os dois lances da U, do pé até o patamar; `null` na L. */
  divisa: [Point, Point] | null
}

/**
 * Plano da escada dobrada (ver `FormaDobrada`). Quem sobe ('up') entra pela
 * boca; quem desce ('down') também, pelo alto: o patamar de chegada fica na
 * ponta na que sobe e na boca na que desce, e o da volta é o mesmo nas duas.
 * `null` = não é escada dobrada (aí cada lance é um lance reto, como sempre).
 */
export function planoDaEscadaDobrada(stair: Pick<Stair, 'shape' | 'segments' | 'stepWidth' | 'direction'>): PlanoDaEscadaDobrada | null {
  const dobra = lerDobra(stair)
  if (dobra === null) return null
  const { boca, ida, lado, bracoDeIda, bracoDeVolta } = dobra
  const largura = larguraValida(stair.stepWidth)
  const meia = largura / 2
  /** O ponto a `u` px no sentido da ida e `v` px para o lado da volta, a partir de `p`. */
  const em = (p: Point, u: number, v: number): Point => ({ x: p.x + ida.x * u + lado.x * v, y: p.y + ida.y * u + lado.y * v })
  const trecho = (a: Point, b: Point): StairSegment => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
  const sobe = stair.direction === 'up'
  const volta = em(boca, bracoDeIda, 0)

  const lances: LanceDaDobra[] = []
  // O lance de ida tem o topo na boca quando a escada desce; o de volta, na ponta quando sobe.
  if (bracoDeIda - meia > FOLGA_DA_DOBRA_PX) lances.push({ segmento: trecho(boca, em(boca, bracoDeIda - meia, 0)), patamarNoTopo: !sobe })

  if (dobra.forma === 'l') {
    const ponta = em(volta, 0, bracoDeVolta)
    if (bracoDeVolta - meia > FOLGA_DA_DOBRA_PX) lances.push({ segmento: trecho(em(volta, 0, meia), ponta), patamarNoTopo: sobe })
    return {
      lances,
      contorno: (folga) => {
        const borda = meia + folga
        return [em(boca, -folga, -borda), em(volta, borda, -borda), em(ponta, borda, folga), em(ponta, -borda, folga), em(volta, -borda, borda), em(boca, -folga, borda)]
      },
      patamar: (recuo) => [em(volta, -meia, recuo - meia), em(volta, meia - recuo, recuo - meia), em(volta, meia - recuo, meia), em(volta, -meia, meia)],
      divisa: null,
    }
  }

  const outroLado = em(volta, 0, largura)
  const ponta = em(outroLado, -bracoDeVolta, 0)
  if (bracoDeVolta - meia > FOLGA_DA_DOBRA_PX) lances.push({ segmento: trecho(em(outroLado, -meia, 0), ponta), patamarNoTopo: sobe })
  return {
    lances,
    contorno: (folga) => {
      const borda = meia + folga
      return [em(boca, -folga, -borda), em(volta, borda, -borda), em(outroLado, borda, borda), em(ponta, -folga, borda), em(ponta, -folga, -borda), em(boca, -folga, borda)]
    },
    patamar: (recuo) => [em(volta, -meia, recuo - meia), em(volta, meia - recuo, recuo - meia), em(outroLado, meia - recuo, meia - recuo), em(outroLado, -meia, meia - recuo)],
    divisa: [em(boca, 0, meia), em(volta, -meia, meia)],
  }
}

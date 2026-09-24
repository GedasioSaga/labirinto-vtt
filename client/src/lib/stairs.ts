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

/** Espaçamento (px de mundo) entre degraus ao longo do lance — puramente
 *  visual, não afeta jogo/colisão (escada não bloqueia nem restringe hoje,
 *  mesmo padrão de Prop). 16px dá 4 degraus por célula de grid default (64px),
 *  densidade legível sem virar rabisco em lance curto. */
export const STAIR_STEP_SPACING = 16

export interface StairStepLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Linhas perpendiculares dos degraus de um StairSegment — geometria pura, sem
 * nada de Pixi. Hoje só `pixi/drawDraft.ts` usa: é o esqueleto do preview
 * enquanto o arrasto acontece. O render final (`pixi/drawStairs.ts`) passou a
 * pedir `computeStairPlan`, que devolve o lance com vigas e degraus em galão —
 * o preview segue um pente reto, e a escada solta vira o desenho de verdade.
 * Um degrau em cada ponta do
 * lance (t=0 e t=1) mais um a cada STAIR_STEP_SPACING entre elas, sempre
 * espaçados igualmente (divide o comprimento pelo nº de passos, não corta em
 * pedaços de tamanho fixo com sobra no fim). Segmento de comprimento zero
 * devolve lista vazia — não há lance pra desenhar degrau nenhum.
 */
export function computeStairSteps(segment: StairSegment, stepWidth: number): StairStepLine[] {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const length = Math.hypot(dx, dy)
  if (length === 0) return []

  const ux = dx / length
  const uy = dy / length
  // perpendicular unitário (rotação de 90° do vetor de avanço)
  const px = -uy
  const py = ux
  const halfWidth = stepWidth / 2

  const stepCount = Math.max(1, Math.round(length / STAIR_STEP_SPACING))
  const steps: StairStepLine[] = []
  for (let i = 0; i <= stepCount; i += 1) {
    const t = i / stepCount
    const cx = segment.x1 + ux * length * t
    const cy = segment.y1 + uy * length * t
    steps.push({
      x1: cx + px * halfWidth,
      y1: cy + py * halfWidth,
      x2: cx - px * halfWidth,
      y2: cy - py * halfWidth,
    })
  }
  return steps
}

/**
 * PROPORÇÕES DO LANCE — o que faz a escada se ler como escada e dizer o lado.
 *
 * Queixa do mestre (17/09/2026): "como eu sei que essa escada vai para cima ou
 * para baixo? como eu sei que isso é uma escada... ta meio feio". O desenho
 * antigo era um pente de traços de 2 px com chão vazio no meio, mais uma setinha
 * de 10 px que trocava de ponta: 3,6% dos pixels de diferença entre subir e
 * descer, e degrau nenhum no meio do lance.
 *
 * O desenho novo é um LANCE ENTRE DUAS VIGAS com degraus em galão — o degrau
 * tem um bico que avança ladeira acima (`STAIR_TREAD_NOSE_RATIO`), como o nariz
 * de uma pisada. Três pistas, todas dizendo a mesma coisa, para ninguém precisar
 * decorar código nenhum:
 *
 *   1. todo degrau APONTA para o alto do lance;
 *   2. o degrau ENGORDA ladeira acima (`STAIR_TREAD_WIDTH_AT_FOOT` ->
 *      `..._AT_TOP`) — é o que se vê olhando um lance de cima: as pisadas de
 *      cima aparecem inteiras, as de baixo somem atrás delas;
 *   3. o TOM clareia ladeira acima (quem aplica é o renderer,
 *      `pixi/drawStairs.ts`) — o pé do lance afunda na sombra.
 *
 * Subir e descer viram desenhos espelhados, e não "a mesma escada com a seta do
 * outro lado". Continua sendo a gramática do minimapa de Resident Evil: fio de
 * cabelo e traço fino sobre chão chapado, uma cor só, nada de massa preta.
 * Também não é hachura: hachura é textura paralela preenchendo área para dizer
 * "material"; aqui cada traço é UM degrau, no espaçamento de degrau, dentro de
 * duas vigas que delimitam o lance.
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
 * Geometria completa de um lance, em px de mundo — pura, sem nada de Pixi, para
 * `pixi/drawStairs.ts` desenhar e para o teste medir os mesmos pixels que a
 * jornada mede.
 *
 * `direction` decide qual PONTA do segmento é o alto: 'up' sobe no sentido do
 * traço (topo em x2,y2), 'down' desce no sentido do traço (topo em x1,y1) — a
 * mesma convenção geométrica que a seta antiga usava para escolher em que ponta
 * nascer, agora dita pelo desenho inteiro.
 *
 * Segmento de comprimento zero devolve `null`: não há lance para planejar.
 */
export function computeStairPlan(segment: StairSegment, stepWidth: number, direction: StairDirection): StairPlan | null {
  const ascends = direction === 'up'
  const foot: Point = ascends ? { x: segment.x1, y: segment.y1 } : { x: segment.x2, y: segment.y2 }
  const top: Point = ascends ? { x: segment.x2, y: segment.y2 } : { x: segment.x1, y: segment.y1 }

  const dx = top.x - foot.x
  const dy = top.y - foot.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return null

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
  const count = Math.max(1, Math.round(run / (STAIR_TREAD_SPACING_RATIO * stepWidth)))
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
 * ESCADA EM ESPIRAL vista de cima, na gramática do minimapa: um círculo de
 * traço fino, o poste no meio e um raio fino por degrau. Sem galão nem massa —
 * a torre se lê pela forma, não pela espessura.
 *
 * O arrasto (o primeiro lance) é o DIÂMETRO: quem troca "Reta" por "Espiral"
 * vê o círculo nascer em cima do lance que já estava lá, e a boca (`x1, y1`,
 * onde mora o pino da escada, `lib/stairTravel.ts`) fica na borda. O primeiro
 * raio aponta para a boca; 'up' gira no sentido horário da tela a partir dela
 * e 'down' no anti-horário — subir e descer viram desenhos espelhados, como no
 * lance reto, e o tom clareia rumo ao alto (`climb`, o renderer converte).
 */
export const SPIRAL_SPOKE_COUNT = 12
/** Raio do poste central, como fração do raio do círculo. */
export const SPIRAL_POST_RATIO = 0.18

export interface SpiralSpoke {
  /** Na borda do poste. */
  from: Point
  /** Na borda do círculo. */
  to: Point
  /** 0 no raio da boca, 1 no último — o renderer converte em tom. */
  climb: number
}

export interface SpiralPlan {
  center: Point
  radius: number
  postRadius: number
  spokes: SpiralSpoke[]
}

/** Centro e raio do círculo de uma espiral: o lance é o diâmetro. `null` = lance de comprimento zero. */
export function spiralCircle(segment: StairSegment): { center: Point; radius: number } | null {
  const radius = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) / 2
  if (radius === 0) return null
  return { center: { x: (segment.x1 + segment.x2) / 2, y: (segment.y1 + segment.y2) / 2 }, radius }
}

/** Geometria da espiral em px de mundo — pura, sem Pixi. Lance de comprimento zero devolve `null`. */
export function computeSpiralPlan(segment: StairSegment, direction: StairDirection): SpiralPlan | null {
  const circle = spiralCircle(segment)
  if (circle === null) return null
  const { center, radius } = circle
  const postRadius = radius * SPIRAL_POST_RATIO
  const mouthAngle = Math.atan2(segment.y1 - center.y, segment.x1 - center.x)
  // Na tela o y cresce para baixo: ângulo crescente é sentido horário.
  const turn = direction === 'up' ? 1 : -1
  const at = (angle: number, distance: number): Point => ({
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance,
  })

  const spokes: SpiralSpoke[] = []
  for (let i = 0; i < SPIRAL_SPOKE_COUNT; i += 1) {
    const angle = mouthAngle + (turn * i * 2 * Math.PI) / SPIRAL_SPOKE_COUNT
    spokes.push({ from: at(angle, postRadius), to: at(angle, radius), climb: i / (SPIRAL_SPOKE_COUNT - 1) })
  }
  return { center, radius, postRadius, spokes }
}

/**
 * FRENTE B (ONDA 2, item #15 do PLANO-REFINAMENTO.md) — desenho do destaque
 * de hover. Metade "desenho" da entrega; a metade "detecção" é
 * `lib/hoverHitTest.ts` (`resolveHoverHit`), que decide QUAL entidade (se
 * alguma) está sob o ponteiro em `mode === 'idle'`. Este módulo só sabe
 * transformar esse `HoverTarget` num contorno na tela — nenhuma decisão de
 * prioridade, nenhuma leitura de `activeTool`/`selection` aqui.
 *
 * PROBLEMA (CONTRATO da tarefa): sem hover o usuário clica no escuro — não
 * sabe o que vai pegar antes de gastar o clique. O contorno abaixo antecipa
 * exatamente isso: a MESMA forma que `findSelectableAt` (`lib/
 * selectionHitTest.ts`) usaria para decidir "o quê" no próximo `pointerdown`.
 *
 * ## Por que este estilo visual (cor/peso), e não o de SELECIONADO
 *
 * `SELECTION_COLOR` (0xffdd55, `pixi/constants.ts`) é amarelo quente e já
 * significa "isto ESTÁ selecionado" em `drawWalls.ts`/`drawRegions.ts`/
 * `drawEditHandles.ts`/etc. — reusar a mesma cor aqui faria o usuário
 * confundir "vou pegar isto se eu clicar" com "isto já está pego" (o próprio
 * CONTRATO da tarefa pede pra evitar essa confusão). `HOVER_COLOR` é um azul
 * frio — oposto de temperatura, não só de matiz, o par mais fácil de
 * distinguir num relance — com metade da opacidade (`HOVER_ALPHA`) e, para
 * formas fechadas/delimitadas, metade do peso mínimo da escala do app
 * (`STROKE_WEIGHT.hairline`, `pixi/constants.ts`: "traço de referência, quase
 * invisível" — a descrição já pedida por este CONTRATO, "contorno discreto").
 *
 * Duas famílias de forma, porque uma largura só não serve pras duas:
 *  - `'circle'`/`'rect'`/`'ellipse'`/`'polygon'` (Token, Prop, Luz, Região,
 *    Drawing rect/ellipse/circle/polygon) já são áreas DELIMITADAS — o
 *    contorno na largura mínima (`HOVER_OUTLINE_WIDTH`) já é visível porque
 *    traça uma borda que existe de verdade.
 *  - `'segments'` (Parede, Escada, Drawing line/freehand/curve) são
 *    ENTIDADES FINAS — a própria parede pode ter 0.5px de espessura
 *    (`drawWalls.ts`, preset 'thin'); um contorno na mesma largura ficaria
 *    imperceptível. `HOVER_LINE_HALO_WIDTH` (6) desenha um halo translúcido
 *    ao REDOR do traço, na mesma ordem de grandeza da tolerância de clique
 *    real (`WALL_HIT_TOLERANCE`/`DRAWING_HIT_TOLERANCE` = 8,
 *    `lib/selectionHitTest.ts`) — o halo comunica o CORREDOR clicável, não só
 *    o traço de 1px.
 *
 * ## Custo
 *
 * `drawHover` é chamado no MESMO `pointermove` ocioso que já roda
 * `resolveHoverHit` (custo ~0 adicional, ver docstring daquele módulo) — o
 * trabalho novo aqui é só `graphics.clear()` + no máximo 1 forma. Nunca mais
 * de 1 entidade destacada por vez (`HoverTarget` é singular), então não há
 * crescimento com o tamanho do mapa.
 */
import type { Graphics } from 'pixi.js'
import type { MapData } from '../types/map'
import type { Point } from './world'
import type { HoverTarget } from '../lib/hoverHitTest'
import { tokenBoundingBox, propBoundingBox } from '../lib/objectTransform'
import { LIGHT_HIT_RADIUS, estimateTextWidth } from '../lib/selectionHitTest'
import { STROKE_WEIGHT } from './constants'

/** Azul frio — ver docstring do módulo para a justificativa de não reusar
 *  `SELECTION_COLOR`. */
const HOVER_COLOR = 0x6fc3ff
/** Translúcido de propósito — "contorno FRACO", pedido literal do CONTRATO. */
const HOVER_ALPHA = 0.55
/** Peso do contorno em forma fechada/delimitada — o próprio hairline da
 *  escala do app já documenta "quase invisível" (`pixi/constants.ts`). */
const HOVER_OUTLINE_WIDTH = STROKE_WEIGHT.hairline
/** Largura do halo sobre entidade fina (segmento) — ver docstring do módulo. */
const HOVER_LINE_HALO_WIDTH = 6

export type HoverGeometry =
  | { shape: 'circle'; cx: number; cy: number; radius: number }
  | { shape: 'rect'; x: number; y: number; w: number; h: number }
  | { shape: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { shape: 'polygon'; points: Point[] }
  | { shape: 'segments'; segments: Array<{ a: Point; b: Point }> }

function assertNeverKind(value: never): never {
  throw new Error(`drawHover: SelectionKind sem geometria de hover definida: ${JSON.stringify(value)}`)
}

function assertNeverDrawingKind(value: never): never {
  throw new Error(`drawHover: Drawing.kind sem geometria de hover definida: ${JSON.stringify(value)}`)
}

function assertNeverShape(value: never): never {
  throw new Error(`drawHover: HoverGeometry.shape sem instrução de desenho definida: ${JSON.stringify(value)}`)
}

/**
 * Geometria pura (sem PixiJS) do contorno de hover para `target` — busca a
 * entidade em `map` pelo `kind`+`id` e devolve a forma que `findSelectableAt`
 * usaria para acertar um clique nela. `null` quando a entidade não existe
 * mais em `map` (janela de corrida: o hover foi calculado num frame, a
 * entidade foi apagada antes do próximo `drawHover`) ou quando a geometria é
 * degenerada demais para desenhar (região/polígono com menos de 3 pontos,
 * traço com menos de 2 pontos) — mesma convenção defensiva de
 * `lib/objectTransform.ts` (`pointsBoundingBox` devolve `null` para lista
 * vazia) e `pixi/drawRegions.ts` (`isDegenerateRegion`).
 */
export function resolveHoverGeometry(map: MapData, target: HoverTarget): HoverGeometry | null {
  switch (target.kind) {
    case 'token': {
      const token = map.tokens.find((t) => t.id === target.id)
      if (!token) return null
      const box = tokenBoundingBox(token, map.grid)
      return { shape: 'circle', cx: token.x, cy: token.y, radius: (box.maxX - box.minX) / 2 }
    }
    case 'prop': {
      const prop = map.props.find((p) => p.id === target.id)
      if (!prop) return null
      const box = propBoundingBox(prop)
      return { shape: 'rect', x: box.minX, y: box.minY, w: box.maxX - box.minX, h: box.maxY - box.minY }
    }
    case 'light': {
      const light = map.lights.find((l) => l.id === target.id)
      if (!light) return null
      return { shape: 'circle', cx: light.x, cy: light.y, radius: LIGHT_HIT_RADIUS }
    }
    case 'wall': {
      const wall = map.walls.find((w) => w.id === target.id)
      if (!wall) return null
      return { shape: 'segments', segments: [{ a: { x: wall.x1, y: wall.y1 }, b: { x: wall.x2, y: wall.y2 } }] }
    }
    case 'stair': {
      const stair = map.stairs.find((s) => s.id === target.id)
      if (!stair) return null
      return {
        shape: 'segments',
        segments: stair.segments.map((seg) => ({ a: { x: seg.x1, y: seg.y1 }, b: { x: seg.x2, y: seg.y2 } })),
      }
    }
    case 'region': {
      const region = map.regions.find((r) => r.id === target.id)
      if (!region || region.points.length < 3) return null
      return { shape: 'polygon', points: region.points }
    }
    case 'drawing': {
      const drawing = map.drawings.find((d) => d.id === target.id)
      if (!drawing) return null
      switch (drawing.kind) {
        case 'rect':
          return { shape: 'rect', x: drawing.x, y: drawing.y, w: drawing.w, h: drawing.h }
        case 'ellipse':
          return { shape: 'ellipse', cx: drawing.cx, cy: drawing.cy, rx: drawing.rx, ry: drawing.ry }
        case 'circle':
          return { shape: 'circle', cx: drawing.cx, cy: drawing.cy, radius: drawing.radius }
        case 'polygon':
          if (drawing.points.length < 3) return null
          return { shape: 'polygon', points: drawing.points }
        case 'line':
          return { shape: 'segments', segments: [{ a: { x: drawing.x1, y: drawing.y1 }, b: { x: drawing.x2, y: drawing.y2 } }] }
        case 'freehand':
        case 'curve': {
          if (drawing.points.length < 2) return null
          const segments: Array<{ a: Point; b: Point }> = []
          for (let i = 0; i < drawing.points.length - 1; i += 1) {
            segments.push({ a: drawing.points[i], b: drawing.points[i + 1] })
          }
          return { shape: 'segments', segments }
        }
        case 'text': {
          const width = estimateTextWidth(drawing.text, drawing.fontSize)
          return { shape: 'rect', x: drawing.x, y: drawing.y, w: width, h: drawing.fontSize }
        }
        default:
          return assertNeverDrawingKind(drawing)
      }
    }
    default:
      // `target` (HoverTarget) não é união discriminada — só `target.kind` é
      // o union exaustivo; passar `target` inteiro aqui não narrowia pra
      // `never` (TS2345), diferente do `drawing.kind` logo acima, onde
      // `Drawing` É discriminada por `kind` e o `switch` narrowia o objeto
      // inteiro.
      return assertNeverKind(target.kind)
  }
}

function drawShape(graphics: Graphics, geometry: HoverGeometry): void {
  switch (geometry.shape) {
    case 'circle':
      graphics.circle(geometry.cx, geometry.cy, geometry.radius)
      graphics.stroke({ width: HOVER_OUTLINE_WIDTH, color: HOVER_COLOR, alpha: HOVER_ALPHA })
      return
    case 'rect':
      graphics.rect(geometry.x, geometry.y, geometry.w, geometry.h)
      graphics.stroke({ width: HOVER_OUTLINE_WIDTH, color: HOVER_COLOR, alpha: HOVER_ALPHA })
      return
    case 'ellipse':
      graphics.ellipse(geometry.cx, geometry.cy, geometry.rx, geometry.ry)
      graphics.stroke({ width: HOVER_OUTLINE_WIDTH, color: HOVER_COLOR, alpha: HOVER_ALPHA })
      return
    case 'polygon':
      graphics.poly(geometry.points)
      graphics.stroke({ width: HOVER_OUTLINE_WIDTH, color: HOVER_COLOR, alpha: HOVER_ALPHA })
      return
    case 'segments':
      for (const segment of geometry.segments) {
        graphics.moveTo(segment.a.x, segment.a.y).lineTo(segment.b.x, segment.b.y)
      }
      graphics.stroke({ width: HOVER_LINE_HALO_WIDTH, color: HOVER_COLOR, alpha: HOVER_ALPHA, cap: 'round' })
      return
    default:
      assertNeverShape(geometry)
  }
}

/**
 * Redesenha o contorno de hover em `graphics` — chamar a cada `pointermove`
 * ocioso, logo depois de `resolveHoverHit` (`lib/hoverHitTest.ts`), com o
 * `target` que ele devolveu. `target: null` (nada sob o cursor, algo já
 * selecionado, ou fora de `mode === 'idle'`) limpa o gráfico e não desenha
 * nada — mesmo padrão de `pixi/drawGuides.ts` (`graphics.clear()` incondicional
 * no topo, sem branch "já estava vazio").
 */
export function drawHover(graphics: Graphics, map: MapData, target: HoverTarget | null): void {
  graphics.clear()
  if (!target) return
  const geometry = resolveHoverGeometry(map, target)
  if (!geometry) return
  drawShape(graphics, geometry)
}

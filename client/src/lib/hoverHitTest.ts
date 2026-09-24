/**
 * FRENTE B (ONDA 2, item #15 do PLANO-REFINAMENTO.md) — hit-test de hover.
 *
 * Achado ANTES de escrever este arquivo (instrução da tarefa): a Onda 1 já
 * tinha criado `resolveHoverAtIdle` dentro da closure de `pixi/PixiCanvas.tsx`
 * (linhas 755-832 na revisão lida) — ela roda a cada `pointermove` ocioso e já
 * replica a MESMA cadeia de prioridade do `pointerdown` (alça de resize de
 * drawing/token/prop > vértice/raio > canto de sala > grupo de área >
 * `findSelectableAt` genérico), mas só para decidir o CURSOR
 * (`{ kind: HoverKind, corner: ResizeCorner | null }`, ver `pixi/cursorPolicy.ts`)
 * — nunca guarda QUAL entidade (kind+id) está por baixo do ponteiro, então não
 * havia como desenhar um destaque nela.
 *
 * Por isso esta entrega muda de natureza (texto da tarefa): em vez de
 * "detectar hover" (já existe), este módulo EXTRAI aquela cadeia de
 * prioridade para uma função pura testável — byte a byte a mesma lógica,
 * comparada linha a linha com `resolveHoverAtIdle` — e ACRESCENTA um campo
 * `target: { kind, id } | null` no retorno: a entidade que um clique agora
 * selecionaria, presente só quando `kind === 'selectable'` (o hit genérico do
 * fim da cadeia) E ela ainda não é a seleção atual. `pixi/drawHover.ts` (a
 * outra metade desta entrega) usa só esse campo para desenhar o contorno —
 * as alças de resize/vértice/raio da entidade JÁ selecionada não ganham
 * destaque extra (ela já tem o próprio contorno de SELECIONADO, ver
 * `pixi/drawWalls.ts`/`pixi/drawRegions.ts`/etc.; duplicar o anel ali é
 * exatamente a confusão "vou pegar" vs. "já está pego" que o CONTRATO deste
 * agente pede pra evitar).
 *
 * CUSTO (o CONTRATO pede atenção: isto roda em todo `pointermove` ocioso):
 * este módulo NÃO adiciona nenhum hit-test novo sobre o que a Onda 1 já paga
 * por frame — é a MESMA varredura, com 1 branch a mais (comparar o resultado
 * de `findSelectableAt` com `selection`) e nenhum novo `find*At`. Custo
 * marginal de `resolveHoverHit` sobre `resolveHoverAtIdle`: ~0. Não há
 * throttle por distância de pixel porque não há nada NOVO a conter — ver
 * relatório do agente para a medição/raciocínio completo.
 */
import type { MapData } from '../types/map'
import type { Selection, SelectionKind, DrawingTool } from '../types/tools'
import type { Point } from '../pixi/world'
import type { HoverKind, ResizeCorner } from '../pixi/cursorPolicy'
import { drawingBoundingBox, tokenBoundingBox, propBoundingBox } from './objectTransform'
import { isAxisAlignedRect } from './roomOps'
import { isOnRoomRotateHandle, roomRotationOf } from './roomRotation'
import { findSelectableAt } from './selectionHitTest'
import { findBoxCornerHandleAt, findRoomCornerHandleAt, findVertexHandleAt, isOnRadiusHandle } from './handleHitArea'
import { areaSelectionBounds, type AreaSelection } from './areaSelection'
import { canInteract, isHidden } from './itemTransform'

export interface HoverHitInput {
  map: MapData
  selection: Selection | null
  areaSelection: AreaSelection | null
  activeTool: DrawingTool
  worldPoint: Point
  /** Zoom da câmera: toda alça (girar, canto, vértice, raio) tem tamanho fixo
   *  na TELA, e a área de hover acompanha (`lib/handleHitArea.ts`). Ausente = 1. */
  cameraScale?: number
}

/** Entidade que um clique agora selecionaria — só presente quando `kind ===
 *  'selectable'` E ela não é já a seleção atual (ver docstring do módulo). */
export interface HoverTarget {
  kind: SelectionKind
  id: string
}

export interface HoverHit {
  kind: HoverKind
  corner: ResizeCorner | null
  target: HoverTarget | null
}

const NONE_HIT: HoverHit = { kind: 'none', corner: null, target: null }

/**
 * Mesmo filtro de `hitTestMap` em `PixiCanvas.tsx` — `findSelectableAt`
 * (`lib/selectionHitTest.ts`) já respeita camada oculta (`map.hiddenLayers`)
 * internamente, mas não o campo `hidden` POR ITEM de Token/Prop (outro eixo,
 * "oculto no editor" sem estar numa camada escondida). Filtrar aqui, antes de
 * `findSelectableAt`, em vez de editar `selectionHitTest.ts` (fora da lista
 * de escrita deste agente).
 */
function hitTestMap(map: MapData): MapData {
  return {
    ...map,
    tokens: map.tokens.filter((token) => !isHidden(token)),
    props: map.props.filter((prop) => !isHidden(prop)),
  }
}

/**
 * Cadeia de prioridade ÚNICA de hover em `mode === 'idle'` — cópia fiel de
 * `resolveHoverAtIdle` (`PixiCanvas.tsx`), com `target` acrescentado só no
 * ramo final. `tool !== 'select' && tool !== 'token'` devolve `'none'` direto:
 * as alças de resize/vértice/raio só existem sob a ferramenta "Selecionar"
 * (ver docstring de `HoverKind` em `pixi/cursorPolicy.ts`), e mesmo o hit
 * genérico de "algo por baixo do cursor" só faz sentido nessas 2 ferramentas
 * — as de criação/borracha têm o próprio cursor (`crosshair`/`cell`) e não
 * usam hover nenhum.
 */
export function resolveHoverHit(input: HoverHitInput): HoverHit {
  const { map, selection, areaSelection, activeTool: tool, worldPoint } = input
  const scale = input.cameraScale ?? 1
  if (tool !== 'select' && tool !== 'token') return NONE_HIT

  if (tool === 'select' && selection) {
    if (selection.kind === 'drawing') {
      const drawing = map.drawings.find((d) => d.id === selection.id)
      if (drawing && (drawing.kind === 'rect' || drawing.kind === 'ellipse' || drawing.kind === 'polygon')) {
        const box = drawingBoundingBox(drawing)
        const corner = box ? findBoxCornerHandleAt(box, worldPoint, scale) : null
        if (corner !== null) return { kind: 'resize-corner', corner, target: null }
      }
      if (drawing && drawing.kind === 'curve' && findVertexHandleAt(drawing.points, worldPoint, scale) !== null) {
        return { kind: 'vertex', corner: null, target: null }
      }
      if (drawing && drawing.kind === 'line') {
        const pts = [{ x: drawing.x1, y: drawing.y1 }, { x: drawing.x2, y: drawing.y2 }]
        if (findVertexHandleAt(pts, worldPoint, scale) !== null) return { kind: 'vertex', corner: null, target: null }
      }
    }
    if (selection.kind === 'light') {
      const light = map.lights.find((l) => l.id === selection.id)
      if (light && isOnRadiusHandle(light, worldPoint, scale)) return { kind: 'radius', corner: null, target: null }
    }
    if (selection.kind === 'token') {
      const token = map.tokens.find((t) => t.id === selection.id)
      if (token && canInteract(token)) {
        const corner = findBoxCornerHandleAt(tokenBoundingBox(token, map.grid), worldPoint, scale)
        if (corner !== null) return { kind: 'resize-corner', corner, target: null }
      }
    }
    if (selection.kind === 'prop') {
      const prop = map.props.find((p) => p.id === selection.id)
      if (prop && canInteract(prop)) {
        const corner = findBoxCornerHandleAt(propBoundingBox(prop), worldPoint, scale)
        if (corner !== null) return { kind: 'resize-corner', corner, target: null }
      }
    }
    let editRegionId: string | null = null
    if (selection.kind === 'region') editRegionId = selection.id
    else if (selection.kind === 'wall') {
      const wall = map.walls.find((w) => w.id === selection.id)
      if (wall && wall.regionId !== undefined) editRegionId = wall.regionId
    }
    if (editRegionId !== null) {
      const region = map.regions.find((r) => r.id === editRegionId)
      // Travada não tem alça nenhuma (`pixi/drawEditHandles.ts`) e o pointerdown
      // não deixa pegar canto, vértice nem girar: o cursor também não promete.
      if (region && canInteract(region)) {
        // Alça de girar: mesma condição do pointerdown (`pixi/roomRotateGesture.ts`)
        // — Sala destravada. Travada não tem alça, então não tem cursor de girar.
        if (region.room && isOnRoomRotateHandle(region.points, roomRotationOf(region.room), worldPoint, scale)) {
          return { kind: 'rotate', corner: null, target: null }
        }
        if (region.room?.shape === 'rect') {
          // Torta não tem alça de canto (ver `isAxisAlignedRect`), e também não cai no vértice solto abaixo.
          const corner = isAxisAlignedRect(region.points) ? findRoomCornerHandleAt(region.points, worldPoint, scale) : null
          if (corner !== null) return { kind: 'resize-corner', corner, target: null }
        } else if (findVertexHandleAt(region.points, worldPoint, scale) !== null) {
          return { kind: 'vertex', corner: null, target: null }
        }
      }
    }
    if (selection.kind === 'wall') {
      const wall = map.walls.find((w) => w.id === selection.id)
      if (wall && wall.regionId === undefined) {
        const pts = [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }]
        if (findVertexHandleAt(pts, worldPoint, scale) !== null) return { kind: 'vertex', corner: null, target: null }
      }
    }
  }

  if (tool === 'select' && areaSelection) {
    const bounds = areaSelectionBounds(map, areaSelection)
    if (
      bounds &&
      worldPoint.x >= bounds.minX && worldPoint.x <= bounds.maxX &&
      worldPoint.y >= bounds.minY && worldPoint.y <= bounds.maxY
    ) {
      return { kind: 'area-selection', corner: null, target: null }
    }
  }

  const hit = findSelectableAt(hitTestMap(map), worldPoint)
  if (hit) {
    const isCurrentSelection = selection !== null && selection.kind === hit.kind && selection.id === hit.id
    return { kind: 'selectable', corner: null, target: isCurrentSelection ? null : { kind: hit.kind, id: hit.id } }
  }
  return NONE_HIT
}

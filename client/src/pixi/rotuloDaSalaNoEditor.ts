import type { MapData, Region } from '../types/map'
import type { Point } from './world'
import { useMapStore } from '../stores/mapStore'
import { roomLabelAnchor } from './drawRoomNames'

/**
 * A4 — O ARRASTO DO NOME DA SALA no editor. Saiu do `PixiCanvas.tsx` (máquina
 * de gestos): o canvas põe o modo `dragging-room-label` no `pointerdown` e
 * chama `comecar`, `mover` no `pointermove` e `terminar` no fim de todo gesto.
 *
 * Offset absoluto a partir do ponto e do offset do aperto (não delta
 * acumulado), então o arredondamento não soma erro ao longo do gesto. O mapa
 * de antes fecha um Ctrl+Z só.
 */
export interface ArrastoDoRotulo {
  /** Começa o arrasto do nome da sala `regionId`; `antes` é o mapa do aperto (o Ctrl+Z volta a ele). */
  comecar: (regionId: string, antes: MapData, ponto: Point, offsetInicial: Point) => void
  /** Há arrasto do nome em curso. */
  emCurso: () => boolean
  /** O ponteiro andou: o nome segue a mão, sem snap e preso à sala (`offsetPresoNaSala`). */
  mover: (ponto: Point) => void
  /** Fim de qualquer gesto: grava o passo do desfazer, se houve arrasto, e esquece o arrasto. */
  terminar: () => void
}

/**
 * O nome de um cômodo não sai do cômodo.
 *
 * Prende o CENTRO do rótulo à caixa do polígono da sala e devolve o
 * offset (relativo à âncora, `roomLabelAnchor`) que corresponde a esse
 * ponto preso. Antes disto o arrasto do nome era livre: no passeio de
 * 17/09/2026 o rótulo de um quarto acabou desenhado por cima do quarto
 * vizinho, e quem lia o mapa passava a ler o nome errado na sala errada.
 *
 * Prende o centro, não a caixa do texto: um nome comprido numa sala
 * pequena não cabe inteiro de jeito nenhum, e encolher o alcance até a
 * caixa caber tiraria do mestre posições legítimas perto da parede.
 * Com o centro dentro da sala o nome sempre pertence visualmente a ela.
 */
export function offsetPresoNaSala(region: Region | undefined, offset: Point): Point {
  const arredondado = { x: Math.round(offset.x), y: Math.round(offset.y) }
  if (!region || region.points.length === 0) return arredondado
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of region.points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const anchor = roomLabelAnchor(region.points)
  const preso = (valor: number, menor: number, maior: number) => Math.min(maior, Math.max(menor, valor))
  return {
    x: Math.round(preso(anchor.x + arredondado.x, minX, maxX) - anchor.x),
    y: Math.round(preso(anchor.y + arredondado.y, minY, maxY) - anchor.y),
  }
}

export function criarArrastoDoRotulo(): ArrastoDoRotulo {
  let id: string | null = null
  let antes: MapData | null = null
  let inicio: Point | null = null
  let offsetDoInicio: Point | null = null

  return {
    comecar(regionId, mapaDeAntes, ponto, offsetInicial) {
      id = regionId
      antes = mapaDeAntes
      inicio = ponto
      offsetDoInicio = offsetInicial
    },
    emCurso: () => id !== null && inicio !== null && offsetDoInicio !== null,
    mover(ponto) {
      if (id === null || inicio === null || offsetDoInicio === null) return
      // Sem snap: o rótulo é texto solto, e o grid o prenderia em cima das paredes.
      // Mas preso à sala: ver `offsetPresoNaSala`.
      const salaId = id
      const regiaoDoRotulo = useMapStore.getState().map.regions.find((r) => r.id === salaId)
      useMapStore.getState().setRoomLabelOffsetLive(
        salaId,
        offsetPresoNaSala(regiaoDoRotulo, {
          x: offsetDoInicio.x + ponto.x - inicio.x,
          y: offsetDoInicio.y + ponto.y - inicio.y,
        }),
      )
    },
    terminar() {
      if (antes) useMapStore.getState().commitDragHistory(antes)
      id = null
      antes = null
      inicio = null
      offsetDoInicio = null
    },
  }
}

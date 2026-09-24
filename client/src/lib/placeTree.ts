import type { Region } from '../types/map'
import type { Bounds } from '../pixi/world'
import { pointsBoundingBox } from './objectTransform'
import { subtreeIds } from './roomNesting'

/**
 * ÁRVORE DE LOCAIS — Distrito > Quarteirão > Prédio > Piso > Cômodo, montada
 * só com o `Region.parentId` que o mapa já grava (`lib/roomNesting.ts`). Lib
 * pura, sem DOM nem store. A lista "Objetos do mapa" é plana e a busca só
 * procura; aqui o mestre anda pela cidade de fora para dentro.
 *
 * ESCALA: a cena a09-blocos tem 2.828 locais. Montar lê o `parentId` de cada
 * sala UMA vez e ordena os irmãos: O(N log N), nunca uma varredura da cena por
 * sala. Quem desenha só o que está aberto é `visibleRows`.
 *
 * É árvore do MESTRE: nada daqui vai ao jogador (a tela dele nem monta o
 * painel), por isso sala secreta e oculta aparecem com o nome.
 */

export interface PlaceNode {
  id: string
  /** O que a linha mostra: o nome da sala, ou "Sala sem nome". */
  name: string
  /** Mãe que existe na árvore; `null` = local de topo. */
  parentId: string | null
  /** 0 no topo (o distrito da cidade), +1 a cada nível para dentro. */
  depth: number
  /** Filhas, em ordem de nome (número natural: "Quarteirão 2" antes de "Quarteirão 10"). */
  childIds: string[]
  /** Quantos locais há dentro, em qualquer profundidade. */
  descendantCount: number
  /** Posição entre os irmãos, de 1 em diante (o `aria-posinset` da linha). */
  position: number
  /** Quantos irmãos o nível tem, contando o próprio (o `aria-setsize`). */
  siblings: number
}

export interface PlaceTree {
  nodes: ReadonlyMap<string, PlaceNode>
  /** Locais de topo, em ordem de nome. */
  rootIds: string[]
  /** Quantos locais a cena tem. */
  total: number
}

const UNNAMED_ROOM = 'Sala sem nome'

const COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

/**
 * Árvore das SALAS da cena (Região com `room`); região comum não é local.
 * `parentId` que não é de sala da cena (órfão, ou região comum) = local de topo,
 * a mesma regra do resto do app. Ciclo de arquivo corrompido não trava: a
 * primeira sala do ciclo, na ordem do mapa, sobe para o topo.
 */
export function buildPlaceTree(regions: readonly Region[]): PlaceTree {
  const nodes = new Map<string, PlaceNode>()
  const declaredParent = new Map<string, string | undefined>()
  for (const region of regions) {
    if (region.room === undefined || nodes.has(region.id)) continue
    // Um acesso só por sala: na a09 este laço roda 2.828 vezes.
    declaredParent.set(region.id, region.parentId)
    nodes.set(region.id, {
      id: region.id,
      name: region.room.name.trim() || UNNAMED_ROOM,
      parentId: null,
      depth: 0,
      childIds: [],
      descendantCount: 0,
      position: 1,
      siblings: 1,
    })
  }

  // Filhas candidatas pela mãe declarada; ciclo se resolve na descida abaixo.
  const candidates = new Map<string, string[]>()
  const tops: string[] = []
  for (const [id, parent] of declaredParent) {
    if (parent === undefined || parent === id || !nodes.has(parent)) {
      tops.push(id)
      continue
    }
    const list = candidates.get(parent)
    if (list === undefined) candidates.set(parent, [id])
    else list.push(id)
  }

  const byName = (a: string, b: string) => COLLATOR.compare(nameOf(nodes, a), nameOf(nodes, b))
  const rootIds: string[] = []
  const order: string[] = []
  const visited = new Set<string>()

  const descendFrom = (rootId: string) => {
    const stack = [rootId]
    visited.add(rootId)
    while (stack.length > 0) {
      const id = stack.pop()
      const node = id === undefined ? undefined : nodes.get(id)
      if (node === undefined) continue
      order.push(node.id)
      const kids = (candidates.get(node.id) ?? []).filter((kid) => !visited.has(kid)).sort(byName)
      node.childIds = kids
      kids.forEach((kid, index) => {
        visited.add(kid)
        const child = nodes.get(kid)
        if (child === undefined) return
        child.parentId = node.id
        child.depth = node.depth + 1
        child.position = index + 1
        child.siblings = kids.length
      })
      for (let i = kids.length - 1; i >= 0; i -= 1) stack.push(kids[i])
    }
  }

  tops.sort(byName)
  for (const id of tops) {
    rootIds.push(id)
    descendFrom(id)
  }
  // O que sobrou só é alcançável por um ciclo: a primeira sala dele vira topo.
  for (const id of declaredParent.keys()) {
    if (visited.has(id)) continue
    rootIds.push(id)
    descendFrom(id)
  }
  rootIds.forEach((id, index) => {
    const node = nodes.get(id)
    if (node === undefined) return
    node.position = index + 1
    node.siblings = rootIds.length
  })

  // Pré-ordem ao contrário: toda filha é contada antes da mãe.
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const node = nodes.get(order[i])
    const parent = node?.parentId === null || node === undefined ? undefined : nodes.get(node.parentId)
    if (node === undefined || parent === undefined) continue
    parent.descendantCount += node.descendantCount + 1
  }

  return { nodes, rootIds, total: nodes.size }
}

function nameOf(nodes: ReadonlyMap<string, PlaceNode>, id: string): string {
  return nodes.get(id)?.name ?? ''
}

/**
 * As linhas que a árvore mostra, em pré-ordem: desce só nos locais abertos.
 * Custa o que está visível, não a cena inteira.
 */
export function visibleRows(tree: PlaceTree, isOpen: (node: PlaceNode) => boolean): PlaceNode[] {
  const rows: PlaceNode[] = []
  const stack = [...tree.rootIds].reverse()
  while (stack.length > 0) {
    const id = stack.pop()
    const node = id === undefined ? undefined : tree.nodes.get(id)
    if (node === undefined) continue
    rows.push(node)
    if (node.childIds.length === 0 || !isOpen(node)) continue
    for (let i = node.childIds.length - 1; i >= 0; i -= 1) stack.push(node.childIds[i])
  }
  return rows
}

/**
 * Caixa do local e de tudo que há dentro dele, no mundo: "Enquadrar" o prédio
 * põe na tela o prédio inteiro, mesmo o anexo que passa da parede. `null` =
 * o local saiu do mapa (ou não tem ponto).
 */
export function placeBounds(regions: readonly Region[], id: string): Bounds | null {
  if (!regions.some((region) => region.id === id)) return null
  const ids = subtreeIds(regions, id)
  let box: Bounds | null = null
  for (const region of regions) {
    if (!ids.has(region.id)) continue
    const own = pointsBoundingBox(region.points)
    if (own === null) continue
    box =
      box === null
        ? { ...own }
        : { minX: Math.min(box.minX, own.minX), minY: Math.min(box.minY, own.minY), maxX: Math.max(box.maxX, own.maxX), maxY: Math.max(box.maxY, own.maxY) }
  }
  return box
}

import type { RegionPoint, Wall } from '../types/map'

/**
 * Índice da aresta anterior a `index` num polígono de `n` vértices, com wrap
 * (o caso armadilha é `index === 0`, que aponta pra última aresta, `n - 1`).
 */
export function previousEdgeIndex(index: number, n: number): number {
  return (index - 1 + n) % n
}

/** Ponto médio de cada aresta `i -> (i+1) % n` de um polígono. */
export function regionEdgeMidpoints(points: RegionPoint[]): RegionPoint[] {
  const n = points.length
  return points.map((point, i) => {
    const next = points[(i + 1) % n]
    return { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }
  })
}

/**
 * Resincroniza as paredes vinculadas a `regionId` depois que o vértice
 * `index` da região se moveu para `(x, y)`. A aresta `index` começa nesse
 * vértice (`x1,y1`); a aresta anterior (`previousEdgeIndex`) termina nele
 * (`x2,y2`). `n` é o tamanho ATUAL de `region.points` — esta função não tem
 * acesso à região, só ao array de paredes.
 *
 * Paredes de outro `regionId` (ou sem vínculo) voltam pela MESMA referência
 * (sem spread), preservando `toBe` em teste e evitando re-render à toa.
 */
export function syncWallsToRegionPoint(
  walls: Wall[],
  regionId: string,
  index: number,
  x: number,
  y: number,
  n: number,
): Wall[] {
  const prev = previousEdgeIndex(index, n)

  return walls.map((wall) => {
    if (wall.regionId !== regionId) return wall
    if (wall.regionEdgeIndex === index) return { ...wall, x1: x, y1: y }
    if (wall.regionEdgeIndex === prev) return { ...wall, x2: x, y2: y }
    return wall
  })
}

/**
 * Remapeia as paredes de `regionId` para a inserção de um vértice novo em
 * `(newX, newY)`, logo depois da aresta `afterEdgeIndex`.
 *
 * Ao contrário de `remapForRemove`, não precisa do tamanho do polígono: uma
 * inserção nunca reduz o maior índice existente, só desloca os maiores que
 * `afterEdgeIndex` em +1 — não há caso de wrap a considerar aqui.
 *
 * Se existir parede na aresta `afterEdgeIndex`, ela faz SPLIT: continua com
 * o mesmo `regionEdgeIndex`, mas passa a ir do ponto antigo até o ponto novo;
 * nasce uma parede irmã (`newWallId`) do ponto novo até o antigo fim daquela
 * aresta, herdando `blocksLight`/`blocksMove` mas com `door: null` (a porta
 * não duplica, fica só na metade original). Se a aresta não tiver parede
 * (buraco), só remapeia índices — nenhuma parede nasce.
 */
export function remapForInsert(
  walls: Wall[],
  regionId: string,
  afterEdgeIndex: number,
  newWallId: string,
  newX: number,
  newY: number,
): Wall[] {
  const splitWall = walls.find(
    (wall) => wall.regionId === regionId && wall.regionEdgeIndex === afterEdgeIndex,
  )

  const remapped = walls.map((wall) => {
    if (wall.regionId !== regionId || wall.regionEdgeIndex === undefined) return wall
    if (wall.regionEdgeIndex > afterEdgeIndex) return { ...wall, regionEdgeIndex: wall.regionEdgeIndex + 1 }
    if (wall === splitWall) return { ...wall, x2: newX, y2: newY }
    return wall
  })

  if (!splitWall) return remapped

  const newWall: Wall = {
    ...splitWall,
    id: newWallId,
    regionEdgeIndex: afterEdgeIndex + 1,
    x1: newX,
    y1: newY,
    x2: splitWall.x2,
    y2: splitWall.y2,
    door: null,
  }

  return [...remapped, newWall]
}

/**
 * Remapeia as paredes de `regionId` para a remoção do vértice `index` (`n` é
 * o tamanho do polígono ANTES da remoção; o chamador garante `n > 3`).
 *
 * As duas arestas que tocavam o vértice removido (`prev` e `index`) se
 * fundem numa só. A sobrevivente é a parede da aresta `prev`; se ela não
 * existir, promove a parede da aresta `index` no lugar (mesma fusão, id
 * diferente). Sem nenhuma das duas, a junção fica sem parede — só remapeia
 * índice de todo o resto.
 *
 * A sobrevivente precisa esticar até o ponto que sobrou em
 * `points[(index+1)%n]` — coordenada real, não dá pra derivar do array de
 * paredes, por isso o chamador (que tem os pontos ANTES da remoção) passa
 * `nextPoint`. `prevPoint` (`points[prev]`) só é usado no caso de promoção,
 * quando a parede de `index` precisa herdar o início que era da aresta
 * `prev` (o dela próprio, `points[index]`, está sendo removido).
 */
export function remapForRemove(
  walls: Wall[],
  regionId: string,
  index: number,
  n: number,
  prevPoint: RegionPoint,
  nextPoint: RegionPoint,
): Wall[] {
  const prev = previousEdgeIndex(index, n)
  const newIndex = prev > index ? prev - 1 : prev

  const prevWall = walls.find((wall) => wall.regionId === regionId && wall.regionEdgeIndex === prev)
  const indexWall = walls.find((wall) => wall.regionId === regionId && wall.regionEdgeIndex === index)
  const survivor = prevWall ?? indexWall

  return walls
    .filter((wall) => {
      if (wall.regionId !== regionId) return true
      if (wall === survivor) return true
      return wall.regionEdgeIndex !== index
    })
    .map((wall) => {
      if (wall.regionId !== regionId) return wall

      if (wall === survivor) {
        if (prevWall) return { ...wall, x2: nextPoint.x, y2: nextPoint.y, regionEdgeIndex: newIndex }
        return { ...wall, x1: prevPoint.x, y1: prevPoint.y, x2: nextPoint.x, y2: nextPoint.y, regionEdgeIndex: newIndex }
      }

      if (wall.regionEdgeIndex !== undefined && wall.regionEdgeIndex > index) {
        return { ...wall, regionEdgeIndex: wall.regionEdgeIndex - 1 }
      }

      return wall
    })
}

/**
 * Desloca todas as paredes vinculadas a `regionId` por `(dx, dy)` — usado
 * quando o corpo inteiro da região é arrastado. Paredes de outro `regionId`
 * voltam pela mesma referência (`toBe`).
 */
export function translateLinkedWalls(walls: Wall[], regionId: string, dx: number, dy: number): Wall[] {
  return walls.map((wall) =>
    wall.regionId === regionId
      ? { ...wall, x1: wall.x1 + dx, y1: wall.y1 + dy, x2: wall.x2 + dx, y2: wall.y2 + dy }
      : wall,
  )
}

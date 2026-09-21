export type DrawingTool =
  | 'select'
  | 'wall'
  | 'door'
  | 'light'
  | 'region'
  | 'room'
  | 'roomCircle'
  | 'roomPolygon'
  | 'roomFree'
  | 'stair'
  | 'token'
  | 'prop'
  | 'brush'
  | 'line'
  | 'circle'
  | 'ellipse'
  | 'rect'
  | 'polygon'
  | 'curve'
  | 'text'
  | 'measure'
  | 'eraser'
  | 'floor'
  | 'concealZone'
  | 'pin'

/**
 * O que o clique da ferramenta "Porta" abre na parede:
 *  - 'porta' — o objeto porta de sempre (`DoorKind`, folha/portão, que fecha
 *    e tranca);
 *  - 'vao' — o VÃO ABERTO: o trecho da parede simplesmente deixa de existir
 *    (`lib/mapFactory.addOpeningOnWall`), e por ali se passa sempre.
 *
 * Preferência de FERRAMENTA, não campo de schema: não é persistida em
 * map.json e por isso mora aqui, em `types/tools.ts`, e não em `types/map.ts`
 * — mesma classe de `eraseMode` ('objeto' | 'parte') no `mapStore`.
 */
export type DoorMode = 'porta' | 'vao'

export type SelectionKind = 'token' | 'wall' | 'light' | 'region' | 'stair' | 'prop' | 'drawing' | 'floor'

export interface Selection {
  kind: SelectionKind
  id: string
}

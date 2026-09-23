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
  /**
   * Caminho: a trilha de terra/pedra/tábua traçada ponto a ponto, com a cor
   * DAQUELE caminho escolhida no painel ANTES do primeiro ponto. Não é chão
   * (`floor`, cuja cor é do mapa inteiro) nem forma de desenho (`cluster:drawing`,
   * que fala de linha e polígono): é uma COISA própria, e é por isso que dois
   * caminhos convivem no mesmo mapa com duas cores diferentes.
   */
  | 'path'
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

import type { Wall, Light, Region, Token, Prop, Stair, Drawing, RegionPoint, StairSegment, FloorPiece, FloorShape, MapData, Pin } from '../types/map'
import type { SelectionKind } from '../types/tools'
import { moveBlocos } from './floorBlocks'
import { isStairPin } from './stairTravel'
import { withoutCarrier } from './carry'

/**
 * FRENTE A (ONDA 3, item 13 do PLANO-REFINAMENTO.md) — clonagem PURA por
 * tipo de entidade. Masmorra é repetição (porta, tocha, móvel, coluna); hoje
 * a única forma de repetir um objeto é recriar do zero e reconfigurar o
 * estilo toda vez. Este módulo é só a GEOMETRIA da cópia — decidir QUANDO
 * clonar (Ctrl+D, Alt+arrastar) e onde inserir o resultado no `MapData` é do
 * integrador (`stores/mapStore.ts`, `pixi/PixiCanvas.tsx`), fora desta
 * entrega.
 *
 * Três cuidados que uma clonagem ingênua (spread raso) erraria — cada um
 * coberto por teste em `entityClone.test.ts`:
 *
 * 1. **Id novo em toda entidade clonada.** Id repetido corrompe o mapa em
 *    silêncio (duas entidades competindo pelo mesmo id em buscas por `.find`
 *    espalhadas por `mapFactory.ts`/`selectionHitTest.ts`).
 * 2. **Clone PROFUNDO de array de pontos.** `Region.points`,
 *    `Drawing.points` (freehand/curve/polygon) e `Stair.segments` viram
 *    array E objetos novos — um spread raso compartilharia a referência do
 *    array, e arrastar um vértice do clone moveria o original junto (o bug
 *    clássico desta feature).
 * 3. **`Wall.regionId` não sobrevive à clonagem de UMA parede solta.** Ver
 *    `cloneWall` abaixo para a justificativa completa.
 */

export interface Offset {
  dx: number
  dy: number
}

// ─────────────────────────────────────────────────────────────
// pontos — clone profundo compartilhado por Region.points e os 3 kinds de
// Drawing com array de pontos (freehand/curve/polygon). RegionPoint e
// DrawingPoint são estruturalmente o mesmo shape ({x,y}), então uma função
// só cobre os dois sem precisar de generic nem de `as`.
// ─────────────────────────────────────────────────────────────
function offsetPoints(points: readonly RegionPoint[], offset: Offset): RegionPoint[] {
  return points.map((p) => ({ x: p.x + offset.dx, y: p.y + offset.dy }))
}

// ─────────────────────────────────────────────────────────────
// Wall
// ─────────────────────────────────────────────────────────────

/**
 * Clona uma Parede. `regionId`/`regionEdgeIndex` NÃO são copiados —
 * DECISÃO: soltar o vínculo, nunca mantê-lo.
 *
 * Por quê: `types/map.ts` documenta a invariante de `Wall.regionId` — uma
 * aresta pode ter vários pedaços colineares, cada um cobrindo um TRECHO dela
 * (a porta parte a parede sem soltar o vínculo). Uma cópia solta de uma
 * parede vinculada, se herdasse `regionId`+`regionEdgeIndex`, viraria um
 * pedaço SOBREPOSTO ao original na mesma aresta: `syncLinkedWallsToPoints`
 * e `translateLinkedWalls` (`lib/roomLink.ts`, usados por
 * `updateRegionPoint`/`moveRegion` em `mapFactory.ts`) moveriam as duas juntas
 * com a Sala, e a cópia deixaria de ser uma entidade independente — o oposto
 * do que "duplicar" promete.
 * Clonar a Região INTEIRA (com suas paredes) é uma operação diferente,
 * fora do escopo de "clonar uma Wall" — cabe ao integrador decidir se
 * duplicar uma Sala duplica as 4 paredes junto, compondo `cloneRegion` +
 * `cloneWall` (sem o vínculo) para cada uma.
 *
 * `door` é copiado por um objeto NOVO (não a mesma referência) pela mesma
 * lógica do cuidado nº2 do cabeçalho do arquivo — mesmo que nenhum código
 * hoje mute `Wall.door` in-place (todo setter em `mapFactory.ts` já troca o
 * objeto inteiro), aliasing num clone é o tipo de coisa que vira bug quando
 * alguém adiciona um setter novo sem saber que dois `Wall.id` diferentes
 * apontavam para o mesmo objeto `door`.
 */
export function cloneWall(wall: Wall, offset: Offset): Wall {
  return {
    ...wall,
    id: crypto.randomUUID(),
    x1: wall.x1 + offset.dx,
    y1: wall.y1 + offset.dy,
    x2: wall.x2 + offset.dx,
    y2: wall.y2 + offset.dy,
    door: wall.door ? { ...wall.door } : null,
    regionId: undefined,
    regionEdgeIndex: undefined,
  }
}

// ─────────────────────────────────────────────────────────────
// Light
// ─────────────────────────────────────────────────────────────

export function cloneLight(light: Light, offset: Offset): Light {
  return { ...light, id: crypto.randomUUID(), x: light.x + offset.dx, y: light.y + offset.dy }
}

// ─────────────────────────────────────────────────────────────
// Region
// ─────────────────────────────────────────────────────────────

/** Sufixo aplicado ao nome de uma Sala clonada (`Region.room.name`) — sem
 *  ele, duas Salas ficam com o MESMO nome depois de duplicar e o usuário não
 *  sabe qual é qual no painel (`RoomControls`). Esta função só enxerga a
 *  Região sendo clonada, não o mapa inteiro — não tenta evitar colisão com o
 *  nome de OUTRAS salas já existentes (isso exigiria conhecer `MapData`
 *  inteiro, fora do alcance de uma função pura "clona UMA entidade"); só
 *  garante que a cópia seja visivelmente diferente do original imediato. */
const ROOM_CLONE_SUFFIX = ' (cópia)'

function duplicateRoomName(name: string): string {
  // Sala sem nome continua sem nome: "(cópia)" solto no meio do chão parecia rótulo quebrado.
  return name.trim() === '' ? name : `${name}${ROOM_CLONE_SUFFIX}`
}

export function cloneRegion(region: Region, offset: Offset): Region {
  return {
    ...region,
    id: crypto.randomUUID(),
    points: offsetPoints(region.points, offset),
    data: { ...region.data },
    ...(region.room ? { room: { ...region.room, name: duplicateRoomName(region.room.name) } } : {}),
  }
}

/**
 * Paredes de uma Sala duplicada: cada parede vinculada a `sourceRegionId` vira
 * cópia vinculada a `targetRegionId`, na MESMA aresta (`regionEdgeIndex`), com
 * porta copiada. Sem isto a cópia da Sala saía só com o chão (bug visto em
 * 15/09/2026: "a cópia não tem as linhas brancas"). Não fere a invariante de
 * `cloneWall` (uma parede por aresta): as cópias apontam para a Região NOVA.
 */
export function cloneLinkedWalls(walls: readonly Wall[], sourceRegionId: string, targetRegionId: string, offset: Offset): Wall[] {
  return walls
    .filter((wall) => wall.regionId === sourceRegionId)
    .map((wall) => ({ ...cloneWall(wall, offset), regionId: targetRegionId, regionEdgeIndex: wall.regionEdgeIndex }))
}

/**
 * Sub-salas de uma Sala duplicada: cada descendente de `sourceRegionId` vira
 * cópia com id novo, `parentId` apontando para a cópia da mãe e paredes
 * vinculadas copiadas (`cloneLinkedWalls`). Mantém a ordem do array (a mãe
 * vem antes das filhas). As de dentro mantêm o nome: só a sala copiada ganha
 * "(cópia)".
 */
export function cloneRoomDescendants(
  regions: readonly Region[],
  walls: readonly Wall[],
  sourceRegionId: string,
  targetRegionId: string,
  offset: Offset,
): { regions: Region[]; walls: Wall[] } {
  // Id novo de cada descendente, em ondas (filha, neta…); para em ciclo.
  const idMap = new Map<string, string>([[sourceRegionId, targetRegionId]])
  let grew = true
  while (grew) {
    grew = false
    for (const r of regions) {
      if (idMap.has(r.id) || r.parentId === undefined || !idMap.has(r.parentId)) continue
      idMap.set(r.id, crypto.randomUUID())
      grew = true
    }
  }
  const outRegions: Region[] = []
  const outWalls: Wall[] = []
  for (const r of regions) {
    const copyId = idMap.get(r.id)
    if (r.id === sourceRegionId || copyId === undefined || r.parentId === undefined) continue
    outRegions.push({
      ...r,
      id: copyId,
      parentId: idMap.get(r.parentId),
      points: offsetPoints(r.points, offset),
      data: { ...r.data },
      ...(r.room ? { room: { ...r.room } } : {}),
    })
    outWalls.push(...cloneLinkedWalls(walls, r.id, copyId, offset))
  }
  return { regions: outRegions, walls: outWalls }
}

// ─────────────────────────────────────────────────────────────
// Token
// ─────────────────────────────────────────────────────────────

/**
 * Clona um Token. `image` é copiado como está (mesma string de caminho) —
 * DECISÃO: o clone reusa o MESMO arquivo de imagem em disco, nunca duplica o
 * arquivo. `Token.image` é só um caminho (`lib/imageImport.ts` já copia o
 * arquivo para a pasta do mapa UMA vez, no import); duplicar o arquivo por
 * trás de um Ctrl+D multiplicaria espaço em disco sem motivo — dois Tokens
 * apontando pro mesmo arquivo é seguro porque a imagem é só LIDA no render
 * (`pixi/tokensRenderer.ts`), nunca escrita a partir do editor.
 *
 * VEÍCULO: a cópia leva os lugares e sai VAZIA — quem está a bordo continua
 * só no original, senão a mesma ficha ocuparia lugar em dois cestos.
 */
export function cloneToken(token: Token, offset: Offset): Token {
  // A cópia nasce solta: dois feridos presos à mesma ficha seria um vínculo
  // que o mestre não pediu (LEVAR FICHA JUNTO, `lib/carry.ts`). VEÍCULO: a
  // cópia leva os lugares, não os passageiros.
  const clone: Token = { ...withoutCarrier(token), id: crypto.randomUUID(), x: token.x + offset.dx, y: token.y + offset.dy }
  if (token.veiculo !== undefined) clone.veiculo = { lugares: token.veiculo.lugares }
  return clone
}

// ─────────────────────────────────────────────────────────────
// Prop
// ─────────────────────────────────────────────────────────────

/**
 * Clona um Prop. `linkedMapPath` (portal para outro mapa) é copiado como
 * está — DECISÃO: o clone aponta para o MESMO mapa-alvo.
 *
 * Por quê: ao contrário de `Wall.regionId` (que é um vínculo DENTRO do mesmo
 * mapa, com uma invariante de unicidade por aresta — ver `cloneWall`),
 * `linkedMapPath` é só uma referência de LEITURA a um arquivo externo
 * (`lib/mapFileIO.ts`, `PixiCanvas.tsx` navega ao clicar). Duplicar o Prop
 * não cria conflito nenhum em ter duas portas/escadas apontando para a
 * mesma sala vizinha — é exatamente o que se espera ao copiar, por exemplo,
 * uma segunda porta que leva ao mesmo corredor.
 */
export function cloneProp(prop: Prop, offset: Offset): Prop {
  return { ...prop, id: crypto.randomUUID(), x: prop.x + offset.dx, y: prop.y + offset.dy }
}

// ─────────────────────────────────────────────────────────────
// Stair
// ─────────────────────────────────────────────────────────────

function offsetSegments(segments: readonly StairSegment[], offset: Offset): StairSegment[] {
  return segments.map((s) => ({ x1: s.x1 + offset.dx, y1: s.y1 + offset.dy, x2: s.x2 + offset.dx, y2: s.y2 + offset.dy }))
}

export function cloneStair(stair: Stair, offset: Offset): Stair {
  return { ...stair, id: crypto.randomUUID(), segments: offsetSegments(stair.segments, offset) }
}

// ─────────────────────────────────────────────────────────────
// Drawing — 8 kinds. Switch exaustivo: se um kind novo aparecer em
// types/map.ts sem entrar aqui, o `default` abaixo vira erro em RUNTIME
// (não em compile-time, porque TS já provaria a exaustão dos 8 casos
// conhecidos) — mesmo padrão de `assertNeverKind` em `pixi/drawHover.ts`.
// ─────────────────────────────────────────────────────────────

function assertNeverDrawingKind(value: never): never {
  throw new Error(`cloneDrawing: Drawing.kind sem regra de clonagem definida: ${JSON.stringify(value)}`)
}

export function cloneDrawing(drawing: Drawing, offset: Offset): Drawing {
  const id = crypto.randomUUID()
  switch (drawing.kind) {
    case 'freehand':
      return { ...drawing, id, points: offsetPoints(drawing.points, offset) }
    case 'line':
      return { ...drawing, id, x1: drawing.x1 + offset.dx, y1: drawing.y1 + offset.dy, x2: drawing.x2 + offset.dx, y2: drawing.y2 + offset.dy }
    case 'circle':
      return { ...drawing, id, cx: drawing.cx + offset.dx, cy: drawing.cy + offset.dy }
    case 'curve':
      return { ...drawing, id, points: offsetPoints(drawing.points, offset) }
    case 'text':
      return { ...drawing, id, x: drawing.x + offset.dx, y: drawing.y + offset.dy }
    case 'rect':
      return { ...drawing, id, x: drawing.x + offset.dx, y: drawing.y + offset.dy }
    case 'ellipse':
      return { ...drawing, id, cx: drawing.cx + offset.dx, cy: drawing.cy + offset.dy }
    case 'polygon':
    case 'path':
      return { ...drawing, id, points: offsetPoints(drawing.points, offset) }
    default:
      return assertNeverDrawingKind(drawing)
  }
}

// ─────────────────────────────────────────────────────────────
// FloorPiece
// ─────────────────────────────────────────────────────────────

/** Peça de chão: pontos (corredor/poly) e `noise` viram objetos novos, mesmo cuidado nº2 do cabeçalho. */
export function cloneFloorPiece(piece: FloorPiece, offset: Offset): FloorPiece {
  const { shape } = piece
  const moved: FloorShape =
    shape.kind === 'corridor'
      ? { ...shape, points: shape.points.map((p) => ({ x: p.x + offset.dx, y: p.y + offset.dy, width: p.width })) }
      : shape.kind === 'poly'
        ? { ...shape, points: offsetPoints(shape.points, offset) }
        : // Blocos: a cópia também anda em célula inteira, e `cells` vira lista
          // nova (mesmo cuidado nº2 do cabeçalho).
          shape.kind === 'blocos'
          ? moveBlocos({ ...shape, cells: shape.cells.map((c) => ({ col: c.col, row: c.row })) }, offset.dx, offset.dy)
          : { ...shape, cx: shape.cx + offset.dx, cy: shape.cy + offset.dy }
  const { noise } = piece.modifiers
  return {
    ...piece,
    id: crypto.randomUUID(),
    shape: moved,
    modifiers: noise ? { ...piece.modifiers, noise: { ...noise } } : { ...piece.modifiers },
  }
}

// ─────────────────────────────────────────────────────────────
// Dispatcher — cobre os 8 `SelectionKind` (types/tools.ts), o mesmo
// discriminante que `stores/mapStore.ts`/`pixi/PixiCanvas.tsx` já usam para
// os `Record<SelectionKind, ...>` de remoção/desenho. Pensado para o
// integrador montar `cloneEntity({ kind: selection.kind, entity }, offset)`
// a partir de uma `Selection` já resolvida, sem precisar de um `switch`
// próprio — ver CONTRATO no relatório da tarefa.
// ─────────────────────────────────────────────────────────────

interface EntityByKind {
  wall: Wall
  light: Light
  region: Region
  token: Token
  prop: Prop
  stair: Stair
  drawing: Drawing
  floor: FloorPiece
}

/**
 * Construída a partir de `SelectionKind` (`types/tools.ts`), não de uma
 * lista literal solta — se `SelectionKind` ganhar um membro novo sem
 * `EntityByKind` acompanhar, o erro aparece em COMPILE-TIME aqui (TS2345 em
 * `EntityByKind[K]`), não só quando `assertNeverSelectionKind` disparar em
 * runtime.
 */
export type CloneableEntity = { [K in SelectionKind]: { kind: K; entity: EntityByKind[K] } }[SelectionKind]

function assertNeverSelectionKind(value: never): never {
  throw new Error(`cloneEntity: SelectionKind sem regra de clonagem definida: ${JSON.stringify(value)}`)
}

export function cloneEntity(input: CloneableEntity, offset: Offset): CloneableEntity {
  switch (input.kind) {
    case 'wall':
      return { kind: 'wall', entity: cloneWall(input.entity, offset) }
    case 'light':
      return { kind: 'light', entity: cloneLight(input.entity, offset) }
    case 'region':
      return { kind: 'region', entity: cloneRegion(input.entity, offset) }
    case 'token':
      return { kind: 'token', entity: cloneToken(input.entity, offset) }
    case 'prop':
      return { kind: 'prop', entity: cloneProp(input.entity, offset) }
    case 'stair':
      return { kind: 'stair', entity: cloneStair(input.entity, offset) }
    case 'drawing':
      return { kind: 'drawing', entity: cloneDrawing(input.entity, offset) }
    case 'floor':
      return { kind: 'floor', entity: cloneFloorPiece(input.entity, offset) }
    default:
      return assertNeverSelectionKind(input)
  }
}

// ─────────────────────────────────────────────────────────────
// Cena inteira — "Duplicar" do menu da lista Cenas
// ─────────────────────────────────────────────────────────────

const NO_OFFSET: Offset = { dx: 0, dy: 0 }

/**
 * Pino da cena copiada: id novo e SOLTO. Um pino de viagem ligado leva a um
 * par que só volta para o ORIGINAL (mão dupla, `lib/pinTravel.ts`); a cópia
 * herdando `destino` teria uma ida sem volta, e a chegada oculta sem origem
 * ficaria escondida do jogador para sempre.
 */
function cloneLoosePin(pin: Pin): Pin {
  const { destino: _destino, saidas: _saidas, soChegada: _soChegada, escolhas: _escolhas, ...rest } = pin
  return { ...rest, id: crypto.randomUUID() }
}

/**
 * Cópia de um mapa inteiro para ser OUTRA cena da aventura: toda entidade
 * ganha id novo (dois ids iguais em cenas diferentes confundem a travessia de
 * ficha, que procura pelo id), o vínculo sala-parede e a sub-sala continuam
 * apontando para as cópias, os pinos de viagem saem soltos (`cloneLoosePin`)
 * e as fichas cujo id está em `dropTokenIds` (as dos jogadores) ficam de
 * fora — cada jogador tem UMA ficha, na cena onde ele está.
 *
 * As salas mantêm o nome: a cena inteira é a cópia, não cada sala dela.
 */
export function cloneSceneMap(map: MapData, mapId: string, name: string, dropTokenIds: ReadonlySet<string>): MapData {
  const regionIds = new Map(map.regions.map((region) => [region.id, crypto.randomUUID()]))
  const regions = map.regions.map((region) => {
    const copy: Region = {
      ...region,
      id: regionIds.get(region.id) ?? crypto.randomUUID(),
      points: offsetPoints(region.points, NO_OFFSET),
      data: { ...region.data },
      ...(region.room ? { room: { ...region.room } } : {}),
    }
    if (region.parentId === undefined) return copy
    // Mãe que não existe mais no mapa já era "sala de topo" (types/map.ts): continua sendo.
    const parentId = regionIds.get(region.parentId)
    if (parentId !== undefined) return { ...copy, parentId }
    const { parentId: _orfao, ...topo } = copy
    return topo
  })
  const walls = map.walls.map((wall) => {
    const copy = cloneWall(wall, NO_OFFSET)
    const regionId = wall.regionId === undefined ? undefined : regionIds.get(wall.regionId)
    return regionId === undefined ? copy : { ...copy, regionId, regionEdgeIndex: wall.regionEdgeIndex }
  })
  return {
    ...map,
    id: mapId,
    name,
    ...(map.gridOffset ? { gridOffset: { ...map.gridOffset } } : {}),
    gridSettings: { ...map.gridSettings },
    background: { ...map.background },
    walls,
    lights: map.lights.map((light) => cloneLight(light, NO_OFFSET)),
    regions,
    tokens: map.tokens.filter((token) => !dropTokenIds.has(token.id)).map((token) => cloneToken(token, NO_OFFSET)),
    props: map.props.map((prop) => cloneProp(prop, NO_OFFSET)),
    stairs: map.stairs.map((stair) => cloneStair(stair, NO_OFFSET)),
    drawings: map.drawings.map((drawing) => cloneDrawing(drawing, NO_OFFSET)),
    floor: map.floor.map((piece) => cloneFloorPiece(piece, NO_OFFSET)),
    floorStyle: { ...map.floorStyle },
    lines: map.lines.map((line) => ({ ...line, id: crypto.randomUUID(), points: line.points.map((p) => ({ x: p.x, y: p.y })) })),
    markers: map.markers.map((marker) => ({ ...marker, id: crypto.randomUUID() })),
    concealZones: map.concealZones.map((zone) => ({ ...zone, id: crypto.randomUUID(), points: offsetPoints(zone.points, NO_OFFSET) })),
    // O pino de uma escada que leva a outro andar NÃO vem: solto, ele não leva a
    // lugar nenhum, e com o `escadaId` da escada original (a cópia ganhou id
    // novo) ficaria órfão — invisível ao mestre e impossível de apagar. A escada
    // copiada sai como a escada de sempre; o "Leva a…" dela liga de novo.
    pins: map.pins.filter((pin) => !isStairPin(pin)).map(cloneLoosePin),
    frame: map.frame ? { ...map.frame } : null,
    fog: { mode: map.fog.mode, revealed: [...map.fog.revealed] },
    hiddenLayers: [...map.hiddenLayers],
    lockedLayers: [...map.lockedLayers],
    scale: { ...map.scale },
  }
}

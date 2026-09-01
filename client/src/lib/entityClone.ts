import type { Wall, Light, Region, Token, Prop, Stair, Drawing, RegionPoint, StairSegment } from '../types/map'
import type { SelectionKind } from '../types/tools'

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
 * Por quê: `types/map.ts` documenta a invariante de `Wall.regionId` — "para
 * um dado `regionId`, o conjunto de `regionEdgeIndex` em uso é um
 * SUBCONJUNTO de `0..n-1`, nunca presumido completo" (isto é, cada aresta da
 * Região tem NO MÁXIMO uma parede vinculada). Se o clone herdasse
 * `regionId`+`regionEdgeIndex`, duas paredes passariam a reivindicar a
 * MESMA aresta da mesma Região — `syncWallsToRegionPoint`
 * (`lib/roomLink.ts`, usado por `updateRegionPoint`/`moveRegion` em
 * `mapFactory.ts`) atualiza QUALQUER parede cujo `regionEdgeIndex` bata,
 * então mover a Região passaria a mover as duas juntas, e a cópia deixaria
 * de ser uma entidade independente — o oposto do que "duplicar" promete.
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
  return `${name}${ROOM_CLONE_SUFFIX}`
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
 */
export function cloneToken(token: Token, offset: Offset): Token {
  return { ...token, id: crypto.randomUUID(), x: token.x + offset.dx, y: token.y + offset.dy }
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
      return { ...drawing, id, points: offsetPoints(drawing.points, offset) }
    default:
      return assertNeverDrawingKind(drawing)
  }
}

// ─────────────────────────────────────────────────────────────
// Dispatcher — cobre os 7 `SelectionKind` (types/tools.ts), o mesmo
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
    default:
      return assertNeverSelectionKind(input)
  }
}

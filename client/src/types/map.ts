/**
 * Todas as coordenadas e distâncias (x, y, x1/y1/x2/y2, radius) estão em pixels
 * do mundo. `grid` define o tamanho de uma célula em pixels — é a unidade que
 * a UI usa para "1 quadrado", não uma unidade separada.
 */

// ─────────────────────────────────────────────────────────────
// CAMADAS — 9 camadas. 'grid' NÃO entra: MapData.showGrid já é o
// toggle da grade (map.ts:110 no schema anterior) e duplicá-lo criaria duas
// fontes de verdade. Camada é DERIVADA do tipo da entidade; só Prop tem
// override (ver Prop.layer).
// ─────────────────────────────────────────────────────────────
export type LayerId =
  | 'paredes'
  | 'portas'
  | 'salas'
  | 'escadas'
  | 'objetos'
  | 'decoracao'
  | 'iluminacao'
  | 'tokens'
  | 'anotacoes'

export const LAYER_IDS: readonly LayerId[] = [
  'paredes', 'portas', 'salas', 'escadas',
  'objetos', 'decoracao', 'iluminacao', 'tokens', 'anotacoes',
] as const

export interface Wall {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  blocksLight: boolean
  blocksMove: boolean
  door: DoorState | null
  /**
   * Classificação PURAMENTE VISUAL — controla só espessura/cor em
   * drawWalls.ts. Não afeta blocksLight/blocksMove nem collision.ts.
   * `undefined` === 'exterior' (aparência idêntica à de hoje), por isso
   * não precisa de linha de migração — mesmo padrão de regionId (abaixo).
   * Nome `wallKind` e não `kind` de propósito: `kind` já é discriminante
   * de união em Drawing/DoorState e grep ficaria inútil.
   */
  wallKind?: 'interior' | 'exterior'
  /**
   * Vínculo opcional com uma Região (ex.: a ferramenta Sala cria as 4 paredes
   * do contorno já vinculadas). Ambos `undefined` numa parede solta —
   * compatível com mapa salvo antigo, sem migração.
   *
   * Convenção: esta parede traça a aresta de `region.points[regionEdgeIndex]`
   * até `region.points[(regionEdgeIndex + 1) % region.points.length]`.
   *
   * Invariante: para um dado `regionId`, o conjunto de `regionEdgeIndex` em
   * uso é um SUBCONJUNTO de `0..n-1` — nunca presumido completo. Uma parede
   * vinculada continua apagável individualmente, deixando um "buraco" (aresta
   * sem parede) nesse conjunto.
   */
  regionId?: string
  regionEdgeIndex?: number
  /**
   * Espessura visual — Fase 6, pedido literal do usuário: "se eu quero
   * poligono finos ou medios ou gordos" (aplicado aqui a Parede pelo mesmo
   * vocabulário P/M/G). EIXO SEPARADO de `wallKind`: `wallKind` é
   * classificação SEMÂNTICA (estrutural/divisória) já persistida em mapa
   * salvo; `thickness` é preferência de ESTILO por cima, ortogonal — dá pra
   * ter "externa fina" (rua/construção artesanal) sem contradição. Só
   * controla `pixi/drawWalls.ts`, nunca `blocksLight`/`blocksMove`/collision.
   * `undefined` === 'medium' (aparência idêntica à de antes desta fase) —
   * sem linha de migração, mesmo padrão de wallKind/locked/hidden (acima).
   */
  thickness?: 'thin' | 'medium' | 'thick'
  /**
   * Ponta/canto reto ou arredondado — Fase 6, pedido literal: "essas paredes
   * tem a ponta redonda, quero a opcao de colocar reta ou redondo". Um único
   * eixo cobre ponta de parede SOLTA (vira `cap` do stroke) e canto de Sala
   * FECHADA (vira `join`) — são a mesma escolha visual em dois contextos, ver
   * `pixi/drawWalls.ts`. `undefined` === 'round' (comportamento hardcoded de
   * antes desta fase) — sem linha de migração, mesmo padrão de wallKind
   * (acima).
   */
  lineStyle?: 'round' | 'straight'
  /** Parede não pode ser movida/editada. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração, mesmo padrão de wallKind
   *  (acima). */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

/** 3 tipos estruturais. Cada um muda só render + comprimento do vão. */
export type DoorKind = 'normal' | 'double' | 'gate'

export interface DoorState {
  open: boolean
  locked: boolean
  /** OBRIGATÓRIO. Porta de mapa antigo migra para 'normal' (mesma
   *  aparência de hoje). Ver mapFile.ts. */
  kind: DoorKind
}

export interface Light {
  id: string
  x: number
  y: number
  radius: number
  color: string
  intensity: number
  /** Luz não pode ser movida/editada. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

export interface RegionPoint {
  x: number
  y: number
}

export interface RoomMeta {
  /** 'rect' = 4 vértices ortogonais (ferramenta Sala). 'polygon' = Sala
   *  Circular / Polígono Regular. Resize por canto e largura/altura
   *  numérica só valem para 'rect'. */
  shape: 'rect' | 'polygon'
  /** Rótulo editável. Distinto de `tag`, que é genérico e hoje não tem UI. */
  name: string
}

export interface Region {
  id: string
  points: RegionPoint[]
  tag: string
  fillColor: string
  fillPattern: 'solid' | 'hatch'
  data: Record<string, unknown>
  /** Presença marca "isto é uma Sala". Ausente = região comum.
   *  SEM retroatividade: sala desenhada antes desta mudança carrega como
   *  região comum e não ganha nome/resize — comportamento aceito. */
  room?: RoomMeta
  /** Pedido N2 do usuário ("tirar o fundo" de Região/Sala). Diferente de
   *  `Drawing`, que já tem `filled` por kind, `Region` sempre preenchia sem
   *  guarda nenhuma (`drawRegions.ts` chamava `g.fill(...)` incondicional) —
   *  por isso este campo é novo, ao contrário do de `Drawing`. `undefined`
   *  === true (preenche, aparência idêntica à de hoje) — sem linha de
   *  migração, mesmo padrão de wallKind/locked/hidden. */
  filled?: boolean
  /**
   * Espessura do contorno em px de mundo — Fase 6, pedido literal do usuário:
   * "as propriedades das paredes/sala ... se eu quero poligono finos ou
   * medios ou gordos ... vou usar os poligonos para criar ruas ou
   * construcoes mais artesanais" (ver `pixi/drawRegions.ts`, agente G2).
   * `undefined` === 2 (o que o render já hardcodava antes deste campo
   * existir) — sem linha de migração, mesmo padrão de wallKind/locked/hidden.
   */
  strokeWidth?: number
  /**
   * Junção do vértice do contorno — 'round' arredonda o canto, 'miter'
   * mantém anguloso. `undefined` === 'miter' (default do próprio Pixi
   * quando `join` não é passado no `stroke()`) — sem linha de migração.
   * Não existe `strokeCap`: o contorno de uma Região é sempre um path
   * FECHADO (`g.closePath()`), então `cap` nunca teria efeito visual —
   * confirmado lendo o código-fonte do Pixi instalado (ver
   * `pixi/drawRegions.ts`, agente G2). "Arredondado/reto" num contorno
   * fechado é sempre join, nunca cap.
   */
  strokeJoin?: 'round' | 'miter'
  /** Região não pode ser movida/editada. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

export interface Token {
  id: string
  characterId: string | null
  name: string
  x: number
  y: number
  size: number
  /** Caminho absoluto da imagem importada (mesmo pipeline de Prop.src).
   *  null = círculo genérico, render idêntico ao de drawTokens.ts:10-18. */
  image: string | null
  /** Rotação em graus, sentido horário. `undefined` === 0 (aparência
   *  idêntica à de hoje) — sem linha de migração, mesmo padrão de wallKind
   *  (Wall, acima). */
  rotation?: number
  /** Token não pode ser movido/editado. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

export interface Prop {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  linkedMapPath: string | null
  /** ÚNICO override de camada do schema. 'objetos' vs 'decoracao' é a
   *  única distinção que o tipo da entidade não deriva sozinho.
   *  undefined = 'objetos'. */
  layer?: 'objetos' | 'decoracao'
  /** Rotação em graus, sentido horário. `undefined` === 0 (aparência
   *  idêntica à de hoje) — sem linha de migração, mesmo padrão de wallKind
   *  (Wall, acima). */
  rotation?: number
  /** Prop não pode ser movido/editado. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

export interface DrawingPoint {
  x: number
  y: number
}

/**
 * Ponta do traço (line cap) para os kinds com traço visível (não-preenchível
 * por área). `undefined` === 'round' — é o que `drawDrawings.ts` já hardcoda
 * hoje para freehand/line/curve — então não precisa de linha de migração,
 * mesmo padrão de wallKind/locked/hidden (Wall, acima). Bug B2 do usuário:
 * ele quer poder trocar para ponta reta ('butt') numa `line`.
 */
export type DrawingCap = 'round' | 'butt' | 'square'

/**
 * Textura do traço livre (pincel) — N1 do usuário ("caneta, lápis e afins",
 * ROADMAP.md Fase 4). `undefined` === 'pen' (traço sólido de hoje,
 * `drawDrawings.ts`/`drawDraft.ts` já tratam a ausência assim) — sem linha de
 * migração, mesmo padrão de wallKind/cap/locked/hidden (acima). Geometria de
 * cada textura em `lib/brushTexture.ts`.
 */
export type FreehandTexture = 'pen' | 'pencil' | 'marker'

export type Drawing =
  | { id: string; kind: 'freehand'; points: DrawingPoint[]; color: string; width: number; cap?: DrawingCap; texture?: FreehandTexture }
  | { id: string; kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; cap?: DrawingCap }
  | { id: string; kind: 'circle'; cx: number; cy: number; radius: number; color: string; width: number; filled: boolean; fillAlpha: number }
  | { id: string; kind: 'curve'; points: DrawingPoint[]; color: string; width: number; cap?: DrawingCap }
  | { id: string; kind: 'text'; x: number; y: number; text: string; color: string; fontSize: number; fontFamily?: string }
  // NOVOS. `width` continua = espessura de traço; `w`/`h` = geometria.
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; color: string; width: number; filled: boolean; fillAlpha: number }
  | { id: string; kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; color: string; width: number; filled: boolean; fillAlpha: number }
  | { id: string; kind: 'polygon'; points: DrawingPoint[]; color: string; width: number; filled: boolean; fillAlpha: number }

export type StairDirection = 'up' | 'down'
/** 'l' e 'double' existem no schema e no render desde já; a UI desta
 *  rodada só produz 'straight'. */
export type StairShape = 'straight' | 'l' | 'double'

export interface StairSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Stair {
  id: string
  shape: StairShape
  direction: StairDirection
  segments: StairSegment[]
  /** Largura do lance em px de mundo. Default na criação = map.grid. */
  stepWidth: number
  /** Rotação em graus, sentido horário. `undefined` === 0 (aparência
   *  idêntica à de hoje) — sem linha de migração, mesmo padrão de wallKind
   *  (Wall, acima). */
  rotation?: number
  /** Escada não pode ser movida/editada. `undefined` === false
   *  (comportamento idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

/**
 * Chão construído por peças geométricas (etapa 1 do plano "chão por peças").
 * Todas as coordenadas em px de mundo. `rect`/`ellipse`/`polygon` giram em
 * torno do próprio centro; `corridor` é um caminho em que cada ponto tem a
 * sua largura, interpolada ao longo do segmento.
 */
export type FloorShape =
  | { kind: 'rect'; cx: number; cy: number; w: number; h: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'polygon'; cx: number; cy: number; radius: number; sides: number }
  | { kind: 'corridor'; points: { x: number; y: number; width: number }[] }
  /** Polígono livre: vértices em px de mundo, gira em torno do centro do retângulo que o envolve. */
  | { kind: 'poly'; points: { x: number; y: number }[] }

/** Borda irregular determinística: mesma `seed` reabre idêntica. */
export interface FloorNoise {
  /** Desvio máximo da borda, em px de mundo. */
  amplitude: number
  /** Comprimento de onda do "dente", em px de mundo. */
  scale: number
  seed: number
}

export interface FloorModifiers {
  /** Raio de arredondamento dos cantos, em px de mundo. */
  rounding?: number
  noise?: FloorNoise
  /**
   * Engordar (positivo) ou emagrecer (negativo) a peça inteira, em px de
   * mundo — desloca a borda na direção da normal. `undefined` === 0.
   */
  grow?: number
}

/**
 * Uma peça do chão. A ordem em `MapData.floor` importa: cada peça se aplica
 * sobre o resultado das anteriores — 'add' soma chão, 'subtract' abre buraco.
 */
export interface FloorPiece {
  id: string
  shape: FloorShape
  op: 'add' | 'subtract'
  /** Graus, sentido horário, em torno do centro. `undefined` === 0. */
  rotation?: number
  modifiers: FloorModifiers
  locked?: boolean
  hidden?: boolean
}

export interface FloorStyle {
  fillColor: string
  /** `null` = sem contorno. */
  strokeColor: string | null
  strokeWidth: number
  /**
   * Precisão do contorno: distância entre amostras do campo, em px de mundo.
   * `undefined` === 2. Menor = detalhe de 1 px sobrevive, cálculo mais lento.
   */
  sampleStep?: number
  /**
   * 'raster' = render fiel de minimapa: chão, contorno, linhas e portas
   * rasterizados por software com antisserrilhado por cobertura
   * (lib/minimapRaster.ts). `undefined` === 'vector' (renderers do Pixi).
   */
  renderMode?: 'vector' | 'raster'
  /** Opacidade do contorno no render fiel. `undefined` === 1. */
  strokeAlpha?: number
  /** Opacidade das linhas no render fiel. `undefined` === 1. */
  lineAlpha?: number
}

/**
 * Traço de mapa estilo minimapa (contorno de prédio, divisória), contínuo ou
 * pontilhado. Só visual — não bloqueia movimento nem luz (isso é `Wall`).
 * Vértices em px de mundo; vértice em (x + 0.5, y + 0.5) cai no centro do pixel.
 */
export interface MapLine {
  id: string
  points: { x: number; y: number }[]
  closed: boolean
  dotted: boolean
  color: string
  /** Espessura em px de mundo. */
  width: number
  /** Pontilhado: distância entre centros de pontos, em px ao longo do caminho. `undefined` === 2. */
  dotPeriod?: number
  /** Pontilhado: comprimento de cada ponto, em px. `undefined` === 1. */
  dotLength?: number
  /**
   * Pontilhado com ponto em caixa ALINHADA À TELA (largura × altura), igual em
   * linha horizontal e vertical — é o que os mapas de referência fazem (Mapa3:
   * ~1,85 × 1,42 px). Com os dois definidos, `dotLength` e `width` são ignorados.
   */
  dotWidth?: number
  dotHeight?: number
}

/** Marcador sólido girado (porta de minimapa). Só visual. */
export interface MapMarker {
  id: string
  cx: number
  cy: number
  w: number
  h: number
  /** Graus, sentido horário. */
  rotation: number
  color: string
  /** 'ellipse' = poço/decoração redonda com eixos `w` × `h`. `undefined` === 'rect'. */
  shape?: 'rect' | 'ellipse'
}

/** Moldura com título lateral em volta do retângulo `x, y, w, h` do mundo (ver lib/mapFrame.ts). */
export interface MapFrame {
  title: string
  /** Fonte do título ajustada à referência (pixi/frameTitle.ts). `undefined` = fonte padrão escalada. */
  titleFont?: { family: string; size: number; weight: 'normal' | 'bold' }
  x: number
  y: number
  w: number
  h: number
}

export interface FogState {
  mode: 'per-token' | 'none'
  revealed: string[]
}

export interface MapBackground {
  type: 'image' | 'color'
  src: string
}

/** 'triangle' (F3, dívida "grid-triangular"): matemática em pixi/triGrid.ts.
 *  Render/snap/medição ainda não ligados no PixiCanvas — ver contrato do
 *  agente C6. Nenhum consumidor existente faz switch exaustivo sobre este
 *  tipo (confirmado por rg antes de acrescentar 'triangle'), então a adição
 *  não quebra nenhum arquivo fora desta fase. */
export type GridShape = 'square' | 'hex' | 'triangle'

/** Valores default = cópia literal do que drawGrid.ts:4 / drawHexGrid.ts:4
 *  hardcodam hoje, para que mapa antigo abra visualmente idêntico. */
export interface GridSettings {
  color: string
  opacity: number
  lineWidth: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
}

export interface MapScale {
  unitsPerCell: number // 5 (ft) ou 1.5 (m)
  unit: string // texto livre, sem enum
  precision: number // casas decimais no rótulo
}

/** 'hex' só é válido com gridShape 'hex'; os outros 4, com 'square'.
 *  'euclidean' vale nos dois. setGridShape reseta o modo. */
export type MeasurementMode =
  | 'chessboard' // D&D 5e: max(dx,dy)
  | 'alternating' // 3.5e 5-10-5
  | 'euclidean'
  | 'manhattan'
  | 'hex'

export interface MapData {
  id: string
  name: string
  width: number
  height: number
  grid: number
  /** Deslocamento da linha "0,0" da grade em relação à origem da imagem de
   *  fundo, em px de mundo (F3, "alinhar grade à imagem" — lib/gridAlign.ts).
   *  `undefined` === {x:0, y:0} (aparência idêntica à de hoje) — sem linha de
   *  migração, mesmo padrão de wallKind/locked/hidden acima. */
  gridOffset?: { x: number; y: number }
  gridShape: GridShape
  showGrid: boolean
  gridSettings: GridSettings
  background: MapBackground
  walls: Wall[]
  lights: Light[]
  regions: Region[]
  tokens: Token[]
  props: Prop[]
  stairs: Stair[]
  drawings: Drawing[]
  /** Chão por peças. Vazio em mapa antigo — migração em `lib/mapFile.ts`. */
  floor: FloorPiece[]
  floorStyle: FloorStyle
  lines: MapLine[]
  markers: MapMarker[]
  frame: MapFrame | null
  fog: FogState
  hiddenLayers: LayerId[] // vazio = tudo visível
  /** Onda 4, Frente D (camadas) — "travar camada inteira": item na camada
   *  listada aqui continua VISÍVEL (independente de hiddenLayers) mas não
   *  pode ser selecionado nem movido. Mesma forma de hiddenLayers, por
   *  pedido explícito do CONTRATO da frente — ver lib/layers.ts
   *  (isLayerLocked/canInteractInLayer). Vazio = nada travado. */
  lockedLayers: LayerId[]
  scale: MapScale
  measurementMode: MeasurementMode
  ownerId: string | null
  scenarioLink: string | null
}

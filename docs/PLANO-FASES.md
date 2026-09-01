# PLANO DE EXECUÇÃO CONSOLIDADO — Labirinto VTT

Base: `C:\dev\labirinto\client\src`. Todas as âncoras verificadas em `types/map.ts:1-121`, `lib/mapFile.ts:19-38`, `types/tools.ts:1-8`, `components/labels.ts:13-68`, `stores/mapStore.ts:116-189`, `pixi/PixiCanvas.tsx:109-191`.

---

## 1. DECISÕES DE SCHEMA

### 1.1 Regra que governa todas as decisões abaixo

**`types/map.ts` tem UM dono por fase, e nesta rodada é um agente só, na Fase 0.** Todo campo que as fases 1–2 vão usar entra de uma vez. O que foi adiado (§4) **não** entra como campo reservado — schema morto apodrece; quando a feature adiada for agendada, ela ganha sua própria etapa de fundação.

### 1.2 Conflitos entre áreas — resolvidos

| Conflito | Decisão | Por quê (1 linha) |
|---|---|---|
| Camadas: `layer?: LayerId` em 6 entidades (área camadas) vs. derivação por tipo | **Derivação por tipo + override APENAS em `Prop`** | `Prop` é o único tipo que não distingue duas camadas (Objetos vs. Decoração); todo o resto deriva (`wall.door → portas`, `Stair → escadas`, etc.), então 5 dos 6 campos propostos são schema morto. |
| Camadas: `'grid'` como `LayerId` | **Fora** — `MapData.showGrid` (`map.ts:110`) já é a fonte de verdade | Duas fontes de verdade pro mesmo booleano é bug garantido. |
| Portas: `DoorKind` com 6 valores + `linkedMapPath` no `DoorState` | **3 valores: `normal \| double \| gate`, sem `linkedMapPath`** | `secret`/`automatic` dependem de modo-jogador e trigger de proximidade que não existem; `portal` já é resolvido por `Prop.linkedMapPath` (`map.ts:76`) — um segundo mecanismo de portal é duplicação. |
| Portas: `trancada`/`destrancada` como kind | **Não** — é o `locked` que já existe (`map.ts:34`), só sem UI | Kind e locked são eixos ortogonais; uma porta dupla também tranca. |
| Sala: array `rooms: Room[]` novo vs. `Region.room?` | **`Region.room?: RoomMeta`** | `roomLink.ts` já resolve vínculo Região↔Parede; um segundo sistema paralelo é o antipadrão da regra 14. |
| Escada: `Prop` vs. entidade `Stair` | **Entidade `Stair`** | `Prop` é sprite de imagem sem geometria; degrau é procedural. Elevador/alçapão/buraco continuam `Prop` + `linkedMapPath` (custo zero). |
| Corredor: entidade `Corridor` + `Wall.corridorId` | **ADIADO inteiro** (§4) | Sala fina + parede já produzem corredor na prática; a entidade custa G e ainda obriga guards novos em `updateWallPoint`/`moveWall`/`addDoorOnWall`. |
| Formas: `width` de forma vs. `width` de traço | **`w`/`h` para geometria de `rect`; `width` continua sendo espessura em todo kind** | Reusar `width` quebraria a convenção que os 5 kinds atuais já seguem. |
| Formas: `circle` ganha `fillAlpha` obrigatório | **Sim, obrigatório, com migração** | `drawDrawings.ts:50` hardcoda `0.5` hoje; deixar opcional faria `alpha: undefined` virar 1 no Pixi e mudar a aparência de todo mapa salvo. |
| Grid: `GridShape += 'triangle' \| 'isometric'` | **Nenhum dos dois nesta rodada** — `GridShape` fica `'square' \| 'hex'` | Isométrico é G sem reuso; triangular é M com valor baixo para mesa de RPG. Sem campo `isoRatio` reservado. |
| Grid: `snapEnabled` → `snapTargets` | **Sim, mas no store, não em `MapData`** | `snapEnabled` já vive fora do `map` (`mapStore.ts:142`); é preferência de sessão, undo nunca deveria revertê-la. |
| Medição: régua permanente (`measurements: Measurement[]`) | **ADIADA**; `scale` + `measurementMode` entram agora | A régua efêmera entrega "medir distância" com 1 função pura e zero entidade nova; a permanente arrasta `SelectionKind`, hit-test, drag e undo junto. |
| Token/Prop: `rotation`/`locked`/`hidden` | **ADIADOS**; só `Token.image` entra | Cada um pede sua própria alça/UI em `PixiCanvas.tsx` (1250 linhas, state machine de `mode`); a imagem sozinha é a lacuna visível e reusa 100% do pipeline de `drawProps.ts`. |
| Assets: `libraryAssetId?` em `Prop`/`MapBackground` | **ADIADO** com a biblioteca inteira | Sem reescrever `mapExport.ts:19-34` a biblioteca introduz regressão (mapa exportado com peça quebrada) — é pré-requisito, não detalhe. |
| Luz/Névoa: `ambientLight`, `FogState.shapes`, `Token.facing/vision` | **ADIADOS** | Dependem do raycast, o único item genuinamente G do dossiê; luz colorida/raio editável não dependem de nada e ficam. |

### 1.3 TypeScript final — `client/src/types/map.ts`

Acréscimos e alterações. Tudo o mais fica byte a byte como está.

```ts
// ─────────────────────────────────────────────────────────────
// CAMADAS — 9 camadas. 'grid' NÃO entra: MapData.showGrid já é o
// toggle da grade (map.ts:110) e duplicá-lo criaria duas fontes
// de verdade. Camada é DERIVADA do tipo da entidade; só Prop tem
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

// ─── Wall ────────────────────────────────────────────────────
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
   * não precisa de linha de migração — mesmo padrão de regionId (map.ts:15-18).
   * Nome `wallKind` e não `kind` de propósito: `kind` já é discriminante
   * de união em Drawing/DoorState e grep ficaria inútil.
   */
  wallKind?: 'interior' | 'exterior'
  regionId?: string
  regionEdgeIndex?: number
}

// ─── DoorState ───────────────────────────────────────────────
/** 3 tipos estruturais. Cada um muda só render + comprimento do vão. */
export type DoorKind = 'normal' | 'double' | 'gate'

export interface DoorState {
  open: boolean
  locked: boolean
  /** OBRIGATÓRIO. Porta de mapa antigo migra para 'normal' (mesma
   *  aparência de hoje). Ver mapFile.ts §1.4. */
  kind: DoorKind
}

// ─── Region ──────────────────────────────────────────────────
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
   *  região comum e não ganha nome/resize — comportamento aceito, ver §5. */
  room?: RoomMeta
}

// ─── Token ───────────────────────────────────────────────────
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
}

// ─── Prop ────────────────────────────────────────────────────
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
}

// ─── Drawing ─────────────────────────────────────────────────
export type Drawing =
  | { id: string; kind: 'freehand'; points: DrawingPoint[]; color: string; width: number }
  | { id: string; kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { id: string; kind: 'circle'; cx: number; cy: number; radius: number; color: string; width: number; filled: boolean; fillAlpha: number }
  | { id: string; kind: 'curve'; points: DrawingPoint[]; color: string; width: number }
  | { id: string; kind: 'text'; x: number; y: number; text: string; color: string; fontSize: number; fontFamily?: string }
  // NOVOS. `width` continua = espessura de traço; `w`/`h` = geometria.
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; color: string; width: number; filled: boolean; fillAlpha: number }
  | { id: string; kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; color: string; width: number; filled: boolean; fillAlpha: number }
  | { id: string; kind: 'polygon'; points: DrawingPoint[]; color: string; width: number; filled: boolean; fillAlpha: number }

// ─── Stair (entidade nova) ───────────────────────────────────
export type StairDirection = 'up' | 'down'
/** 'l' e 'double' existem no schema e no render desde já; a UI desta
 *  rodada só produz 'straight' (ver §4). */
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
}

// ─── Grid ────────────────────────────────────────────────────
/** Valores default = cópia literal do que drawGrid.ts:4 / drawHexGrid.ts:4
 *  hardcodam hoje, para que mapa antigo abra visualmente idêntico. */
export interface GridSettings {
  color: string
  opacity: number
  lineWidth: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
}

// ─── Medição ─────────────────────────────────────────────────
export interface MapScale {
  unitsPerCell: number   // 5 (ft) ou 1.5 (m)
  unit: string           // texto livre, sem enum
  precision: number      // casas decimais no rótulo
}

/** 'hex' só é válido com gridShape 'hex'; os outros 4, com 'square'.
 *  'euclidean' vale nos dois. setGridShape reseta o modo (ver §5). */
export type MeasurementMode =
  | 'chessboard'    // D&D 5e: max(dx,dy)
  | 'alternating'   // 3.5e 5-10-5
  | 'euclidean'
  | 'manhattan'
  | 'hex'

// ─── MapData ─────────────────────────────────────────────────
export interface MapData {
  id: string
  name: string
  width: number
  height: number
  grid: number
  gridShape: GridShape
  showGrid: boolean
  gridSettings: GridSettings      // NOVO
  background: MapBackground
  walls: Wall[]
  lights: Light[]
  regions: Region[]
  tokens: Token[]
  props: Prop[]
  stairs: Stair[]                 // NOVO
  drawings: Drawing[]
  fog: FogState
  hiddenLayers: LayerId[]         // NOVO — vazio = tudo visível
  scale: MapScale                 // NOVO
  measurementMode: MeasurementMode // NOVO
  ownerId: string | null
  scenarioLink: string | null
}
```

`Light`, `RegionPoint`, `DrawingPoint`, `FogState`, `MapBackground`, `GridShape` — **inalterados**.

### 1.4 Estratégia de migração — `client/src/lib/mapFile.ts`

`deserializeMap` (`mapFile.ts:19-37`) passa a devolver:

```ts
return {
  id: parsed.id,
  name: parsed.name ?? 'Mapa sem título',
  width: parsed.width ?? 30,
  height: parsed.height ?? 20,
  grid: parsed.grid ?? 64,
  gridShape: parsed.gridShape ?? 'square',
  showGrid: parsed.showGrid ?? true,
  // NOVO — valores = cópia literal dos hardcodes de drawGrid.ts:4
  gridSettings: parsed.gridSettings ?? {
    color: '#4a4a4a', opacity: 1, lineWidth: 1, lineStyle: 'solid',
  },
  background: parsed.background ?? { type: 'color', src: '#2b2b2b' },
  // MUDA de cru para .map(): DoorState ganhou campo obrigatório.
  // wallKind ausente fica undefined de propósito (=== 'exterior').
  walls: (parsed.walls ?? []).map((w) => ({
    ...w,
    door: w.door ? { ...w.door, kind: w.door.kind ?? 'normal' } : null,
  })),
  lights: parsed.lights ?? [],
  // inalterado — `room` ausente fica undefined (região comum)
  regions: (parsed.regions ?? []).map((r) => ({ ...r, fillColor: r.fillColor ?? '#3a7ad0', fillPattern: r.fillPattern ?? 'solid' })),
  // MUDA de cru para .map(): Token.image é obrigatório
  tokens: (parsed.tokens ?? []).map((t) => ({ ...t, image: t.image ?? null })),
  // inalterado fora o que já existia — Prop.layer ausente fica undefined
  props: (parsed.props ?? []).map((p) => ({ ...p, linkedMapPath: p.linkedMapPath ?? null })),
  stairs: parsed.stairs ?? [],
  // MUDA de cru para .map(): PONTO DE MAIOR RISCO DE TODA A MIGRAÇÃO.
  // 0.5 é o alpha que drawDrawings.ts:50 já aplicava; sem esta linha,
  // alpha: undefined vira 1 no Pixi e TODO círculo preenchido de mapa
  // salvo muda de aparência ao abrir.
  drawings: (parsed.drawings ?? []).map((d) =>
    d.kind === 'circle' && (d as { fillAlpha?: number }).fillAlpha === undefined
      ? { ...d, fillAlpha: d.filled ? 0.5 : 0 }
      : d,
  ),
  fog: parsed.fog ?? { mode: 'none', revealed: [] },
  hiddenLayers: parsed.hiddenLayers ?? [],
  scale: parsed.scale ?? { unitsPerCell: 5, unit: 'ft', precision: 0 },
  // depende do gridShape JÁ RESOLVIDO, não do literal cru — senão mapa hex
  // antigo sem gridShape salvo cairia em 'chessboard' por engano
  measurementMode:
    parsed.measurementMode ?? ((parsed.gridShape ?? 'square') === 'hex' ? 'hex' : 'chessboard'),
  ownerId: parsed.ownerId ?? null,
  scenarioLink: parsed.scenarioLink ?? null,
}
```

**Três campos NÃO ganham linha de migração de propósito** — `Wall.wallKind`, `Prop.layer`, `Region.room`: são opcionais cujo default correto É `undefined`, exatamente o precedente já documentado em `map.ts:15-18`. Bakear `'paredes'`/`'objetos'` no load quebraria a derivação dinâmica (uma parede que ganhasse porta depois via `setWallDoor` ficaria travada na camada errada).

**`mapFactory.createEmptyMap` (`mapFactory.ts:5-12`) tem que produzir exatamente os mesmos defaults.** Se divergir, mapa novo e mapa migrado se comportam diferente — é o erro mais fácil de cometer nesta fase e o mais difícil de notar.

### 1.5 `client/src/types/tools.ts`

```ts
export type DrawingTool =
  | 'select'
  | 'wall' | 'door' | 'light' | 'region' | 'room' | 'roomCircle' | 'roomPolygon'
  | 'stair' | 'token' | 'prop'
  | 'brush' | 'line' | 'circle' | 'ellipse' | 'rect' | 'polygon' | 'curve' | 'text'
  | 'measure' | 'eraser'

export type SelectionKind = 'token' | 'wall' | 'light' | 'region' | 'stair' | 'prop' | 'drawing'
```

`SelectionKind += 'stair'` **é mudança quebra-compilação de propósito**: `Record<SelectionKind, …>` em `mapStore.ts:156` (`removers`) para de compilar até ganhar `stair: get().removeStair`. Por isso ela entra só na Fase 2, junto com a action — ver §3.

---

## 2. ORDEM DE FASES

| Fase | Conteúdo | Justificativa (1 linha) |
|---|---|---|
| **F0 — Fundação** | schema final + migração + registro de ferramentas | `types/map.ts`, `mapFile.ts` e `types/tools.ts` são o chão de tudo; qualquer fan-out antes disso escreve no mesmo arquivo. |
| **F1 — Camadas + valor visual barato** | camadas, token com imagem, formas, grid/snap, luz, parede interna/externa | Camadas filtra render **e** hit-test de toda entidade — entidade criada depois dela entra no filtro de graça; criada antes, obriga retrabalho em 5 arquivos. |
| **F2 — Entidades e refinamento estrutural** | portas com tipo, escada reta, sala com identidade/resize, medição | Depende de F1: escada precisa de `stairLayer` em `lib/layers.ts`; porta precisa que `drawWalls.ts` já tenha estabilizado com `wallKind`. |
| **CAUDA** | ver §4 | Cada item da cauda re-abre `types/map.ts` e por isso ganha sua própria etapa de fundação quando for agendado. |

**Dentro de cada fase, o formato é sempre o mesmo: fan-out de N agentes em arquivos disjuntos → fan-in de 2 integradores sequenciais.** Os "arquivos de integrador" são os 5 de alto risco: `stores/mapStore.ts`, `lib/mapFactory.ts`, `pixi/PixiCanvas.tsx`, `client/src/App.tsx`, `client/src/main.css` (+ `components/PropertiesPanel.tsx`, `components/labels.ts` e `stores/shapesSubscription.ts`, que caem na mesma categoria). Nenhum agente de feature encosta neles — cada um entrega funções puras, renderers e componentes próprios, mais um **contrato de wiring** (assinaturas exatas das actions e os call sites) que o integrador aplica.

---

## 3. PARTIÇÃO DE ARQUIVO POR FASE

### FASE 0 — Fundação (2 agentes em PARALELO)

| Agente | Arquivos que ESCREVE |
|---|---|
| **F0-A · schema** | `client/src/types/map.ts` · `client/src/lib/mapFile.ts` · `client/src/lib/mapFactory.ts` **(só `createEmptyMap`, linhas 5-12)** · `client/src/lib/mapFile.test.ts` · `client/src/lib/mapFactory.test.ts` · `client/src/lib/mapFileIO.test.ts` · `client/src/lib/mapExport.test.ts` · `client/src/stores/mapStore.test.ts` (só ajuste de `toEqual`) · **novo** `client/src/lib/__fixtures__/legacy-map.json` |
| **F0-B · registro** | `client/src/types/tools.ts` (**só `DrawingTool`**) · `client/src/components/labels.ts` (`TOOL_LABELS`, `TOOL_HINTS`, `DRAWING_TOOLS`) · `client/src/components/icons.tsx` · `client/src/components/Toolbar.tsx` (`TOOL_ICONS`) |

**Duas travas duras nesta fase:**
1. F0-B **não toca `SelectionKind`** — `'stair'` só entra na F2, junto de `removeStair`, senão `Record<SelectionKind>` em `mapStore.ts:156` derruba o `tsc --noEmit`.
2. F0-B **não toca `TOOL_GROUPS`** (`labels.ts:61-65`). Ferramenta registrada sem entrada no grupo não é desenhada pela `Toolbar` — é o que impede que a F0 despeje 8 botões inertes na barra. Cada fase adiciona sua linha em `TOOL_GROUPS` pela mão do integrador.

Ambos rodam com `isolation: 'worktree'` (§4b do CLAUDE.md — dois escritores no mesmo repo).

Gate de saída da F0: `rtk proxy npx tsc --noEmit` limpo + 373 vitest + 87 playwright verdes.

---

### FASE 1 — 6 agentes em PARALELO, depois 2 integradores SEQUENCIAIS

| # | Agente | Arquivos que ESCREVE (exclusivos) |
|---|---|---|
| A1 | **Camadas** | **novo** `lib/layers.ts` · **novo** `lib/layers.test.ts` · **novo** `components/LayersPanel.tsx` · `lib/selectionHitTest.ts` |
| A2 | **Token com imagem** | **novo** `pixi/tokensRenderer.ts` · `pixi/drawTokens.ts` (substituído) · `lib/imageImport.ts` |
| A3 | **Formas + transparência** | `lib/drawingFactory.ts` · `pixi/drawDrawings.ts` · `pixi/drawDraft.ts` · `components/DrawingStyleControls.tsx` |
| A4 | **Grid + snap** | `pixi/drawGrid.ts` · `pixi/drawHexGrid.ts` · `pixi/grid.ts` · `pixi/tokenInteraction.ts` · `components/GridControls.tsx` · `components/GridShapePicker.tsx` |
| A5 | **Luz editável** | `pixi/drawLights.ts` · **novo** `components/LightControls.tsx` · `pixi/drawEditHandles.ts` |
| A6 | **Parede interna/externa** | `pixi/drawWalls.ts` · **novo** `components/WallStyleControls.tsx` |
| I1 | **Integrador · store** | `stores/mapStore.ts` · `lib/mapFactory.ts` |
| I2 | **Integrador · canvas/UI** | `pixi/PixiCanvas.tsx` · `App.tsx` · `components/PropertiesPanel.tsx` · `components/labels.ts` (`TOOL_GROUPS`) · `client/src/main.css` · `stores/shapesSubscription.ts` |

**Colisões que essa partição resolve explicitamente:**
- `lib/drawingFactory.ts` é de **A3 sozinho**. A6 precisa que `buildWallFromDraft` (`drawingFactory.ts:9-20`) ganhe o parâmetro `wallKind` — A6 **não** edita o arquivo; passa a assinatura no contrato e A3 aplica (mudança mecânica de 2 linhas).
- `pixi/drawEditHandles.ts` é de **A5 sozinho** nesta fase (alça de raio de luz). A1 não precisa dele: filtrar alça de camada oculta acontece em `redrawShapes` (`PixiCanvas.tsx:168-176`), território do I2.
- `lib/selectionHitTest.ts` é de **A1 sozinho**. Além do filtro de camada, A1 corrige `findNearestExistingVertex` (`selectionHitTest.ts:128-163`), que hoje varre `walls`/`regions`/`drawings` crus — sem isso o ímã de vértice gruda em item oculto e a feature parece meio-quebrada.
- `components/GridControls.tsx` é de **A4 sozinho**, incluindo a troca de "Travar na grade" pelos 3 toggles de `snapTargets`.

**Contrato mínimo para o I1** (actions novas em `mapStore.ts` + funções puras espelho em `mapFactory.ts`):

| Action | `withHistory`? | Por quê |
|---|---|---|
| `toggleLayerVisibility(id)` | **sim** | `hiddenLayers` é campo de `MapData`, mesma classe de `setShowGrid` (`mapStore.ts:236`). Ao ocultar, também limpa `selection` se o item selecionado ficou invisível. |
| `setPropLayer(id, layer \| undefined)` | sim | conteúdo do mapa |
| `setTokenImage(id, image)` | sim | conteúdo do mapa |
| `setDrawingFillAlpha`, `setDrawingFilled` | sim | espelham `setRegionColor` (`mapStore.ts:211-219`) |
| `setWallKindForWall(id, kind)` | sim | espelha `setWallDoor` (`mapStore.ts:238`) |
| `setGridSettings(patch: Partial<GridSettings>)` | sim | `gridSettings` é `MapData` |
| `updateLight(id, patch)` | sim | commit final do color picker / soltar a alça |
| `updateLightRadiusLive(id, radius)` | **não** + `commitDragHistory(before)` no pointerup | 1 snapshot por pixel de arrasto estoura o undo — mesmo motivo de `updateCurvePointLive` (`mapStore.ts:259-267`) |
| `wallKind`, `setWallKind` (próximo traço) | **não** | preferência de ferramenta, mesma classe de `polygonSides` (`mapStore.ts:174`) |
| `snapTargets`, `setSnapTarget(kind, on)` | **não** | substitui `snapEnabled` (`mapStore.ts:142,168`), que já está fora do histórico |
| `drawFillAlpha`, `setDrawFillAlpha` (próxima forma) | **não** | idem `drawFilled` (`mapStore.ts:171`) |

**Ponto crítico do I2:** `applySnap` (`PixiCanvas.tsx:296-300`) ganha 2 parâmetros — o alvo (`'token' \| 'wall' \| 'prop'`, para consultar `snapTargets`) e `event.altKey` (Alt inverte o snap naquele gesto; `Ctrl` já está ocupado pela trava de ângulo em `:640,:670,:1026`, e grep de `altKey` no arquivo dá zero). São **6 call sites** (`:643, :673, :852, :865, :1044, :1103`) — esquecer um é a falha mais provável da fase.

---

### FASE 2 — 4 agentes em PARALELO, depois 2 integradores SEQUENCIAIS

| # | Agente | Arquivos que ESCREVE (exclusivos) |
|---|---|---|
| B1 | **Portas com tipo + locked** | **novo** `pixi/drawDoors.ts` · `pixi/drawWalls.ts` · `components/WallDoorControls.tsx` · **novo** `components/DoorKindControls.tsx` |
| B2 | **Escada reta** | **novo** `lib/stairs.ts` · **novo** `lib/stairs.test.ts` · **novo** `pixi/drawStairs.ts` · **novo** `components/StairControls.tsx` · `lib/selectionHitTest.ts` · `pixi/constants.ts` · `pixi/drawDraft.ts` |
| B3 | **Sala: identidade + resize** | **novo** `lib/roomOps.ts` · **novo** `lib/roomOps.test.ts` · **novo** `pixi/drawRoomHandles.ts` · `pixi/drawEditHandles.ts` · **novo** `components/RoomControls.tsx` |
| B4 | **Medição efêmera + escala** | **novo** `lib/measurement.ts` · **novo** `lib/measurement.test.ts` · **novo** `pixi/drawMeasurementIndicator.ts` · **novo** `components/MapScaleControls.tsx` |
| I3 | **Integrador · store** | `stores/mapStore.ts` · `lib/mapFactory.ts` · `types/tools.ts` (`SelectionKind += 'stair'`) |
| I4 | **Integrador · canvas/UI** | `pixi/PixiCanvas.tsx` · `App.tsx` · `components/PropertiesPanel.tsx` · `components/labels.ts` (`TOOL_GROUPS`) · `client/src/main.css` · `stores/shapesSubscription.ts` |

**Colisões resolvidas:**
- `pixi/drawWalls.ts` volta a ser tocado, agora por **B1 sozinho** — a cor laranja de porta (`drawWalls.ts:10`) sai de lá e vira responsabilidade de `drawDoors.ts`. A6 (fase 1) já terminou; não há concorrência.
- `pixi/drawEditHandles.ts` é de **B3 sozinho** nesta fase (branch `region.room?.shape === 'rect'` → handles quadrados). É o arquivo de maior blast radius da F2: ele serve Wall/Region/Line hoje, e um guard errado quebra edição de região comum.
- `lib/selectionHitTest.ts` é de **B2 sozinho** (`findStairAt`, inserido **depois de `findWallAt` e antes de `findRegionAt`** em `findSelectableAt:184-208` — se vier antes de `wall`, escada encostada em parede rouba o clique).
- `pixi/drawDraft.ts` é de **B2 sozinho** (preview do arrasto de escada). B3 não precisa dele porque Dividir/Unir estão cortados (§4).
- `lib/measurement.ts` (B4) **lê** `pixelToAxialRaw` de `pixi/hexGrid.ts:42-46` sem escrever — reusar essa função é obrigatório: fórmula de distância hex escrita do zero diverge da malha que `drawHexGrid`/`snapToHexGrid` desenham e produz número que não bate com a tela.

**Contrato do I3** — todas com `withHistory` salvo onde marcado:

`addStair` · `removeStair` · `moveStair` · `updateStairPoint` · `setStairDirection` · `setWallDoorKind(wallId, kind)` · `setDoorLocked(wallId, locked)` · `setRoomName(id, name)` · `resizeRoomDimensions(id, wPx, hPx)` · `resizeRoomCornerLive(id, corner, x, y)` **(sem histórico, + `commitDragHistory`)** · `setMapScale(scale)` · `setMeasurementMode(mode)` · `doorKind`/`setDoorKind` **(sem histórico — config de ferramenta)**.

Mais três alterações obrigatórias em `mapStore.ts`/`mapFactory.ts` que caem no I3:
- `removers` (`mapStore.ts:156`) ganha `stair: get().removeStair` — o `tsc` exige.
- `DOOR_LENGTH` (`mapStore.ts:114`, hoje `32`) vira `DOOR_LENGTH_BY_KIND: Record<DoorKind, number> = { normal: 32, double: 64, gate: 96 }`, repassado a `addDoorOnWall` (`mapFactory.ts:313-355`).
- `setGridShape` (`mapStore.ts:236`) passa a resetar `measurementMode` para o default da nova forma — senão mapa quadrado que vira hex fica com `'manhattan'`, que não existe em hex.

---

## 4. CORTE HONESTO

### Entrega os 80% do valor percebido (F0 + F1 + F2)

1. **Token com imagem** — hoje todo token é um círculo com nome (`drawTokens.ts:10-18`). É a lacuna mais visível do app inteiro, e reusa 100% do pipeline já testado de `drawProps.ts`. Maior ROI da lista.
2. **Camadas com toggle** — 8 das 9 camadas funcionam de ponta a ponta sem uma ação manual do usuário, por derivação de tipo. Muda a sensação de "editor de verdade".
3. **Formas (`rect`/`ellipse`/`polygon`) + transparência** — cópia quase 1:1 do padrão `circle` que já existe; e o `fillAlpha` corrige um alpha hardcoded que o usuário nunca controlou.
4. **Grid: estilo + Alt + snap por alvo** — o item 3 é bug fix disfarçado de feature: hoje token, parede e peça compartilham o mesmo `snapToGrid` (`tokenInteraction.ts:4-10`), que gruda no **canto** da célula, nunca no centro.
5. **Luz colorida + raio arrastável** — schema já existe (`map.ts:37-44`), falta só UI. Custo P.
6. **Parede interna/externa** — P puro; e o resto do que o brief de parede pede (H/V/diagonal por Ctrl, snap, parede automática via `linkRegionWalls`) **já existe** — só falta ajustar o texto de `TOOL_HINTS.wall` (`labels.ts:41`) e talvez renomear "Criar parede na borda" para "Parede automática".
7. **Portas: 3 tipos + toggle "Trancada"** — `locked` está no schema desde sempre (`map.ts:34`) e **nunca teve UI nem leitor** (grep: só tipos e testes). Ganhar UI resolve um campo morto.
8. **Escada reta com direção** — cobre 3 dos 5 pedidos de escada ("pra cima", "pra baixo", "longa") com uma ferramenta só. Elevador/alçapão/buraco já funcionam de graça via `Prop` + `linkedMapPath` — **zero linha de código**.
9. **Sala: nome + resize por canto + largura/altura numérica** — resolve "sala sem identidade", que é a dor real; resize por canto e por campo numérico compartilham a mesma função de geometria.
10. **Medição efêmera + escala configurável** — 1 ferramenta, 1 função pura, reaproveita `drawAngleIndicator.ts` como molde inteiro.

### ADIAR — e por quê

| Item | Motivo do adiamento |
|---|---|
| **Raycast + névoa + cone de visão + prévia de jogador** | O único G genuíno do dossiê. `blocksLight` (`map.ts:12`) não tem nenhum consumidor hoje, então isso é construir um subsistema do zero (polígono de visibilidade, camada de máscara nova acima de `tokensContainer`, hit-test novo, casos degenerados). Pior: `FogShape` reescrito num app **sem modo jogador** entrega uma névoa que o único usuário da tela já vê por baixo. Escalone só depois que o resto estiver estável, e sozinho numa fase própria. |
| **Biblioteca de assets** | G, e antes dela é obrigatório consertar `mapExport.ts:19-34`, que hoje grava `src` absolutos apontando para `%APPDATA%` e "funciona por acidente". Com a biblioteca, `Prop` passa a referenciar arquivo **fora** da pasta do mapa e o export vira regressão visível (peça quebrada em outra máquina). Adiar a biblioteca até que "resolver-e-embutir no export" seja trabalho agendado. |
| **Corredores (entidade `Corridor`)** | G, e o valor incremental é baixo: sala fina + parede já produzem corredor. Ainda exigiria guards novos em `updateWallPoint` (`mapFactory.ts:59-69`), `moveWall` (`:71-82`) e `addDoorOnWall` (`:341-344`) — três pontos onde esquecer um produz dessincronização **silenciosa**. |
| **Sala: Dividir / Unir / Copiar-colar** | Dividir e Unir são G cada um (geometria de corte de parede, porta no corte, validação de adjacência exata); Unir ainda descarta portas silenciosamente por design. Copiar/colar exige um clipboard que **não existe** no repo (grep: zero ocorrências) — infraestrutura nova para um recurso que "redesenhar a sala" já resolve. |
| **Parede curva (`wallChainId`)** | M, e com um risco de UX não resolvido: os segmentos da cadeia não têm `regionId`, então `updateWallPoint` os deixa arrastáveis individualmente — arrastar um do meio desalinha a curva sem aviso. |
| **Grid triangular e isométrico** | Isométrico é o único G da área grid, com zero reuso de código existente. Triangular reusa `hexGrid.ts` quase de graça mas entrega estética que mesa de RPG não pede. |
| **Régua permanente** | Arrasta `SelectionKind`, hit-test, drag live/commit e undo junto — 3x o custo da efêmera para o mesmo "quanto dá daqui até ali". |
| **Rotação / lock / hidden em Token e Prop** | Cada um pede sua própria alça ou UI dentro de `PixiCanvas.tsx` (1250 linhas, state machine de `mode`), e `hidden` **não pode** significar "invisível pro jogador" num app sem segunda tela — entregaria um campo que não faz o que o nome promete. |
| **Portas `secret` / `automatic`** | Bloqueadas de verdade, não caras: `secret` precisa de modo jogador + rastreio de "descoberto" (nenhum dos dois existe); `automatic` precisa de trigger de proximidade contínuo (`collision.ts:31-40` só resolve movimento discreto). Implementar sem a base é entregar um `kind` mentiroso. |
| **Porta `portal`** | Não é bloqueada e é barata (reuso direto de `PortalControls.tsx`) — mas duplicaria o mecanismo de portal que `Prop.linkedMapPath` já oferece. Primeiro candidato de uma rodada 2 pequena. |
| **Balde, sombra, triângulo dedicado, trapézio** | Balde é o único M da área formas (hit-test novo + regra de prioridade Region vs. Drawing); sombra é cosmético puro; triângulo/trapézio saem de `polygon` com 3-4 cliques. |
| **Escada em L / dupla** | A máquina de estados de 3 cliques não existe em nenhuma ferramenta hoje. `StairShape` já contempla os dois no schema e no render — só a ferramenta de criação falta, então entram depois sem migração. |

---

## 5. RISCO DE REGRESSÃO

### O que tem mais chance de quebrar, em ordem

**1. `deserializeMap` ganhando campos obrigatórios — risco nº 1 do plano inteiro.**
`Token.image` e `DoorState.kind` viram obrigatórios; `drawings` e `walls` passam a ter `.map()`. Todo teste com `toEqual` de objeto inteiro quebra. Alvos confirmados no dossiê: `mapFile.test.ts:37,42-48`, `mapFactory.test.ts:62,103-110,159-226`, `mapFileIO.test.ts:74`, `mapExport.test.ts:52`, `roomLink.test.ts:80-88` (compara o objeto `door` inteiro — vira falso-negativo com o campo novo), `selectionHitTest.test.ts:143+`, `mapStore.test.ts:56+`.
**Teste a escrever ANTES de tocar em `map.ts`:** `client/src/lib/mapFile.legacy.test.ts` com uma fixture congelada (`__fixtures__/legacy-map.json`, copiada de um `map.json` real de `%APPDATA%/com.labirinto.app/maps/`) que assere campo a campo os defaults novos **e** que `serializeMap(deserializeMap(json))` seja idempotente na segunda passada. Sem essa fixture, "mapa antigo continua abrindo" é fé, não evidência.

**2. `fillAlpha` de `circle`.**
Se a linha de migração for esquecida, `alpha: undefined` no Pixi Graphics vira opaco (1) e **todo círculo preenchido de todo mapa salvo muda de aparência** — quebra a regra dura de compatibilidade do projeto e é invisível em teste de tipo.
**Teste antes:** unit em `drawDrawings` provando que um `circle` legado (sem `fillAlpha`) renderiza com `alpha 0.5` não selecionado; e que a lógica de seleção **multiplica** `fillAlpha` pelo fator de seleção em vez de substituí-lo (`drawDrawings.ts:50` hoje hardcoda `0.35`/`0.5`).

**3. `drawTokens.ts` deixando de ser função pura e virando fábrica com cache.**
É exatamente a armadilha que o comentário de `drawProps.ts:10-16` já documenta: cache de sprite sobrevivendo ao destroy/remount do StrictMode → sprite fantasma. Bug já resolvido uma vez no projeto; reintroduzi-lo é o erro mais provável do A2.
**Teste antes:** teste de ciclo de vida que instancia o renderer, desenha, destrói e reinstancia duas vezes, assertando que `tokensContainer.children.length` bate com `map.tokens.length` no fim. O renderer **tem** que nascer dentro do `setup()`, ao lado de `propsRenderer` (`PixiCanvas.tsx:183`), nunca em escopo de módulo.

**4. `applySnap` ganhando 2 parâmetros — 6 call sites.**
`PixiCanvas.tsx:643, 673, 852, 865, 1044, 1103`. Mecânico, mas esquecer um deixa uma ferramenta com snap errado sem erro de compilação (os parâmetros novos podem ter default). **Mitigação:** tornar os parâmetros **obrigatórios**, para que o `tsc --noEmit` liste os 6 sozinho.

**5. Correção do snap de token para o centro da célula.**
`snapToGrid` (`tokenInteraction.ts:4-10`) arredonda x/y independentemente — gruda no canto, nunca no centro. Corrigir é o certo, mas **token já posicionado em mapa salvo vai "pular" meio grid no próximo arrasto**. Não corrompe arquivo, mas é mudança de comportamento visível. Avisar o usuário explicitamente; não é regressão silenciosa se for anunciada.

**6. `drawWalls.ts:10` perdendo a cor laranja de porta para `drawDoors.ts`.**
Reposicionamento de responsabilidade entre dois arquivos com teste par. **Teste antes:** unit que assere que uma `Wall` com `door !== null` continua distinguível visualmente de uma sem, independentemente de qual arquivo desenha — escrito contra o comportamento observável, não contra o arquivo.

**7. `pixi/drawEditHandles.ts` na F2.**
Arquivo compartilhado por Wall/Region/Line. O guard `region.room?.shape === 'rect'` errado quebra edição de **região comum**, não só de sala. **Teste antes:** unit cobrindo os 3 casos — região sem `room`, região com `room.shape: 'polygon'`, região com `room.shape: 'rect'` — provando que os dois primeiros mantêm os handles redondos de hoje.

**8. `TOOL_GROUPS` crescendo de 15 para ~21 botões.**
`labels.ts:7-9` avisa que `TOOL_LABELS`/`SELECTION_LABELS` são lidos por e2e com `exact: true` — strings **novas** não colidem. O risco real é outro: teste e2e que localize botão por posição (`nth`, índice) em vez de nome. **Antes de qualquer append em `TOOL_GROUPS`:** `rg -n "nth\(|\.first\(\)|\.last\(\)" client/e2e` (ou onde vivem os specs playwright). Também vale checar se a barra estoura a largura em tela menor — `Toolbar.tsx:105-108` + `hintPlacement.ts`.

**9. `Record<SelectionKind, …>` na F2.**
`'stair'` quebra a compilação em `mapStore.ts:156`. Isso é **feature, não bug** — é o compilador varrendo todos os pontos que precisam da entrada nova. Antes de implementar, `rg "Record<SelectionKind"` para saber quantos são; o dossiê confirma um, não garante que seja o único.

**10. `snapEnabled` → `snapTargets` é rename, não extensão.**
Qualquer spec que segure o toggle "Travar na grade" (`GridControls.tsx:27`) por texto quebra. `rg "Travar na grade"` nos specs antes de renomear.

### Gate obrigatório ao fim de cada fase

```
rtk proxy npx tsc --noEmit          # nunca `npx tsc` puro nem `tsc` — ver §2e do CLAUDE.md
npx vitest run                       # 373 → só cresce
npx playwright test                  # 87 → só cresce
```

Nenhum integrador fecha uma fase sem os três verdes **e** sem a fixture de mapa legado passando. Suíte verde com fixture ausente não prova compatibilidade — prova só que os testes que existiam continuam existindo.
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  MapData, Wall, Light, Region, Token, Prop, Drawing, DoorState, LayerId, GridSettings,
  Stair, StairDirection, DoorKind, MapScale, MeasurementMode, DrawingCap, DrawingDash, FreehandTexture,
  FloorPiece, FloorStyle, MapLine, MapMarker, MapFrame, PinIcon, PinKind,
} from '../types/map'
import type { Camera, Point } from '../pixi/world'
import type { DoorMode, DrawingTool, Selection } from '../types/tools'
import type { SnapTargetKind, SnapTargets } from '../pixi/grid'
import type { RoomCorner } from '../lib/roomOps'
import type { Corner, ResizeModifiers } from '../lib/objectTransform'
import type { StairSizePreset } from '../lib/stairs'
import { FLOOR_LAYER, clampFloorPolygonSides, type FloorShapeKind } from '../lib/floorTool'
import { clampTamanhoDePincel, type Bloco, type TamanhoDePincel } from '../lib/floorBlocks'
import * as mapFactory from '../lib/mapFactory'
// Onda 3, item 13 (Frente A) — clonagem pura por tipo de entidade, usada por
// `duplicateSelected` (Ctrl+D) e `insertClonedEntityLive` (Alt+arrastar, ver
// pixi/PixiCanvas.tsx).
import { cloneEntity, cloneLinkedWalls, cloneRoomDescendants, type CloneableEntity, type Offset } from '../lib/entityClone'
import { ancestorsOf, descendantsOf, subtreeIds } from '../lib/roomNesting'
import { roomRotationOf, rotationDelta } from '../lib/roomRotation'
import { canInteract } from '../lib/itemTransform'

/** Ferramentas que criam Sala: mantêm o "Criar sala dentro" armado. */
const ROOM_TOOLS: ReadonlySet<string> = new Set(['room', 'roomCircle', 'roomPolygon', 'roomFree'])
// P10 ("não consigo entrar na casa"): `describeBlockedMove` no lugar de
// `resolveTokenMove` — as duas decidem passar/não passar pelo mesmo
// `findTokenPath`, mas esta diz QUEM barrou e se era porta, que é o que a
// tela precisa para explicar a recusa em vez de devolver o token em silêncio.
import { describeBlockedMove } from '../lib/moveValidation'
import { DEFAULT_PATH_WIDTH_CELLS, DEFAULT_TEXT_FONT_FAMILY, clampPathWidthCells, convertLineToCurve, convertCurveToLine } from '../lib/drawingFactory'
import { moveAreaSelection, areaSelectionBounds } from '../lib/areaSelection'
import { BLOCKED_MOVE_TEXT, DOOR_OPENED_BY_MOVE_TEXT, TOOL_CLUSTERS } from '../components/labels'
import { useToastStore } from './toastStore'
import { eraseFromDrawing } from '../lib/eraseGeometry'
import { wallLayer, regionLayer, lightLayer, tokenLayer, drawingLayer, propLayer, stairLayer } from '../lib/layers'
// Onda 4, item 24 (Frente C) — modelo canônico de seleção. `selection` do
// store deixa de ser `Selection | null` (um item) + `areaSelection` (campo
// paralelo) e vira UM `SelectionSet` só — ver CONTRATO no topo de
// selectionModel.ts.
import {
  EMPTY_SELECTION, selectionOfItem, selectionToAreaSelection, isSelectionEmpty,
  type SelectionSet, type SelectionItem,
} from '../lib/selectionModel'

/**
 * Quanto tempo o aviso de movimento barrado fica na tela. O dobro do `info`
 * padrão (4 s, toastStore.ts) de propósito: este texto não relata um fato
 * consumado, ENSINA um caminho ("escolha a ferramenta Porta e clique…") — 4 s
 * dá para ler ou para agir, não para os dois.
 */
const BLOCKED_MOVE_TOAST_MS = 8000

/**
 * Último aviso de movimento mostrado (motivo+parede, e quando). Um arrasto
 * barrado chama `moveTokenLive` a CADA pointermove: dezenas de recusas com o
 * mesmo motivo, e sem esta memória a pilha de avisos enche de cópias do mesmo
 * texto. Fora do state de propósito, igual aos timers de toastStore.ts: não é
 * dado de UI e não deve disparar render.
 */
let lastMoveNotice: { key: string; at: number } | null = null

/** Avisa uma vez por motivo: repete só depois do aviso anterior ter sumido. */
function noticeMoveOnce(key: string, text: string): void {
  const now = Date.now()
  if (lastMoveNotice !== null && lastMoveNotice.key === key && now - lastMoveNotice.at < BLOCKED_MOVE_TOAST_MS) return
  lastMoveNotice = { key, at: now }
  useToastStore.getState().push('info', text, BLOCKED_MOVE_TOAST_MS)
}

/**
 * Move o token e, quando alguma coisa barra, EXPLICA — em vez de devolver o
 * token para a origem em silêncio, que era a dor P10: o mestre arrastava para
 * dentro da casa, o token parava encostado e a tela não ganhava uma letra.
 *
 * Três saídas:
 *  - caminho livre: token no destino, nada dito;
 *  - porta fechada e destrancada que, aberta, libera o traço inteiro: a porta
 *    ABRE e o token passa. O gesto de arrastar para dentro do vão é o gesto de
 *    empurrar a porta; cabe no mesmo Ctrl+Z do arrasto (o snapshot do
 *    pointerdown em PixiCanvas cobre mapa inteiro) e o aviso diz que abriu.
 *    Trancada nunca abre assim — é a regra combinada, só o mestre destranca,
 *    e destrancar é decisão por botão, não por arrasto;
 *  - qualquer outra recusa: o token fica onde está e o aviso diz o motivo e o
 *    que fazer. Devolve o MESMO mapa (mesma referência), que é como o chamador
 *    sabe que não houve movimento.
 *
 * REALCE DA PAREDE QUE BARROU — POR QUE NÃO ESTÁ AQUI (medido em 17/09/2026):
 * a tentação é `set({ selection: parede })`, e funciona visualmente. Mas o
 * único realce por entidade do canvas é o do item ÚNICO selecionado
 * (`pixi/PixiCanvas.tsx`, `redrawShapes`: `selectionSingle(selection)`; com 2+
 * itens sai só o contorno do grupo), e selecionar uma parede de Sala repinta o
 * contorno da Sala INTEIRA (`pixi/drawRegions.ts`, `resolveHighlightedRegionId`).
 * Duas consequências medidas: o token perde o próprio realce e a borda oposta
 * da Sala (320 px à direita) passa a mudar de cor. Quem procura o token na
 * tela pelo que mudou passa a achá-lo 50 px à direita, DENTRO da Sala —
 * arrastar dali pega a Sala, não o token. Realçar sem esse efeito colateral
 * exige mexer nos renderers (`drawWalls.ts` e os outros), que não são desta
 * peça; enquanto isso o aviso explica, e a parede continua onde o mestre a vê.
 */
function moveTokenExplaining(map: MapData, token: Token, targetX: number, targetY: number): MapData {
  const from = { x: token.x, y: token.y }
  const to = { x: targetX, y: targetY }
  const blocked = describeBlockedMove(from, to, map.walls, map.grid)
  if (blocked === null) return mapFactory.setTokenPosition(map, token.id, targetX, targetY)

  const door = map.walls.find((w) => w.id === blocked.wallId)?.door ?? null
  if (blocked.reason === 'door_closed' && blocked.opensPath && door !== null) {
    noticeMoveOnce(`opened:${blocked.wallId}`, DOOR_OPENED_BY_MOVE_TEXT)
    const opened = mapFactory.setWallDoor(map, blocked.wallId, { ...door, open: true })
    return mapFactory.setTokenPosition(opened, token.id, targetX, targetY)
  }

  noticeMoveOnce(`${blocked.reason}:${blocked.wallId}`, BLOCKED_MOVE_TEXT[blocked.reason])
  return map
}

/**
 * Deriva a LayerId da entidade atualmente selecionada, usando as mesmas
 * funções `*Layer` de lib/layers.ts que render e hit-test já usam — nunca
 * reimplementar a derivação aqui. `null` quando não há seleção do tipo
 * coberto ou a entidade referenciada não existe mais no mapa. Usada só por
 * `toggleLayerVisibility`, pra saber se precisa limpar a seleção ao ocultar
 * a camada em que ela está.
 */
function layerForSelection(map: MapData, selection: Selection): LayerId | null {
  switch (selection.kind) {
    case 'wall': {
      const wall = map.walls.find((w) => w.id === selection.id)
      return wall ? wallLayer(wall) : null
    }
    case 'region': {
      const region = map.regions.find((r) => r.id === selection.id)
      return region ? regionLayer(region) : null
    }
    case 'light': {
      const light = map.lights.find((l) => l.id === selection.id)
      return light ? lightLayer(light) : null
    }
    case 'token': {
      const token = map.tokens.find((t) => t.id === selection.id)
      return token ? tokenLayer(token) : null
    }
    case 'prop': {
      const prop = map.props.find((p) => p.id === selection.id)
      return prop ? propLayer(prop) : null
    }
    case 'stair': {
      const stair = map.stairs.find((s) => s.id === selection.id)
      return stair ? stairLayer(stair) : null
    }
    case 'drawing': {
      const drawing = map.drawings.find((d) => d.id === selection.id)
      return drawing ? drawingLayer(drawing) : null
    }
    case 'floor':
      return map.floor.some((p) => p.id === selection.id) ? FLOOR_LAYER : null
    default:
      return null
  }
}

/**
 * Onda 3, item 13 — localiza a entidade hoje selecionada e devolve o CLONE
 * pronto (id novo, deslocado por `offset`), tipado de forma que `kind` e
 * `entity` sempre casam entre si. `Selection.id` que não existe mais no mapa
 * (janela de corrida) devolve `null`, sem clonar nada.
 *
 * Switch explícito sobre `selection.kind` (em vez de um `Record` genérico
 * indexado por `selection.kind`) de propósito: um `Record<SelectionKind,
 * () => Entity>` faz o TypeScript perder a correlação entre o `kind` e o tipo
 * do `entity` devolvido — a única saída sem `as`/`!` seria estreitar caso a
 * caso, que é exatamente o que este switch já faz.
 */
function cloneSelectedEntity(map: MapData, selection: Selection, offset: Offset): CloneableEntity | null {
  switch (selection.kind) {
    case 'wall': {
      const entity = map.walls.find((w) => w.id === selection.id)
      return entity ? cloneEntity({ kind: 'wall', entity }, offset) : null
    }
    case 'light': {
      const entity = map.lights.find((l) => l.id === selection.id)
      return entity ? cloneEntity({ kind: 'light', entity }, offset) : null
    }
    case 'region': {
      const entity = map.regions.find((r) => r.id === selection.id)
      return entity ? cloneEntity({ kind: 'region', entity }, offset) : null
    }
    case 'token': {
      const entity = map.tokens.find((t) => t.id === selection.id)
      return entity ? cloneEntity({ kind: 'token', entity }, offset) : null
    }
    case 'prop': {
      const entity = map.props.find((p) => p.id === selection.id)
      return entity ? cloneEntity({ kind: 'prop', entity }, offset) : null
    }
    case 'stair': {
      const entity = map.stairs.find((s) => s.id === selection.id)
      return entity ? cloneEntity({ kind: 'stair', entity }, offset) : null
    }
    case 'drawing': {
      const entity = map.drawings.find((d) => d.id === selection.id)
      return entity ? cloneEntity({ kind: 'drawing', entity }, offset) : null
    }
    case 'floor': {
      const entity = map.floor.find((p) => p.id === selection.id)
      return entity ? cloneEntity({ kind: 'floor', entity }, offset) : null
    }
  }
}

/**
 * Insere uma entidade já clonada (`cloneSelectedEntity`/`cloneEntity`) no
 * array certo do `map` — despacho puro por `cloned.kind`, reusando os
 * `mapFactory.addXxx` que já existem (mesmos usados por `addWall`/`addToken`/
 * etc. abaixo), então a entidade clonada passa pela MESMA função de inserção
 * que uma entidade nova desenhada na mão passaria.
 */
function addClonedEntity(map: MapData, cloned: CloneableEntity): MapData {
  switch (cloned.kind) {
    case 'wall': return mapFactory.addWall(map, cloned.entity)
    case 'light': return mapFactory.addLight(map, cloned.entity)
    case 'region': return mapFactory.addRegion(map, cloned.entity)
    case 'token': return mapFactory.addToken(map, cloned.entity)
    case 'prop': return mapFactory.addProp(map, cloned.entity)
    case 'stair': return mapFactory.addStair(map, cloned.entity)
    case 'drawing': return mapFactory.addDrawing(map, cloned.entity)
    case 'floor': return mapFactory.addFloorPiece(map, cloned.entity)
  }
}

interface MapStoreState {
  map: MapData
  past: MapData[]
  future: MapData[]
  camera: Camera
  /**
   * Onda 4, item 24 (migração do modelo de seleção) — conjunto CANÔNICO,
   * substitui os dois campos que existiam até aqui: `selection: Selection |
   * null` (um item, clique simples) e `areaSelection: AreaSelection | null`
   * (grupo, marquee — paralelo e independente do primeiro). `SelectionSet`
   * (lib/selectionModel.ts) representa os dois casos com a MESMA forma:
   * `[]` = nada selecionado (nunca `null`), 1 item = clique simples, N itens
   * = Shift+clique somando um a um OU marquee mesclado nela (ver
   * `pixi/PixiCanvas.tsx`, único consumidor do gesto). Consumidor que só
   * entende "um item" (drawEditHandles.ts, resolveHoverHit, drawRegions.ts —
   * todos fora da minha lista de arquivos) recebe `selectionSingle(selection)`
   * na borda, nunca o array cru.
   */
  selection: SelectionSet
  /** A5 — zona oculta aberta no painel. Fora de `selection` de propósito: a
   *  zona não participa de mover/duplicar/apagar em grupo. `null` = nenhuma. */
  selectedConcealZoneId: string | null
  /** Pino aberto no painel. Fora de `selection` pelo mesmo motivo da zona
   *  oculta: o pino não participa de mover/duplicar/apagar em grupo. */
  selectedPinId: string | null
  /** Tipo do PRÓXIMO pino a cravar (preferência de sessão, sem histórico). */
  pinKind: PinKind
  /** Ícone do PRÓXIMO pino a cravar. `null` = sem ícone, que é o pino de hoje. */
  pinIcon: PinIcon | null
  activeTool: DrawingTool
  /**
   * Substituído por `snapTargets` (Fase 1) — 3 toggles independentes por
   * tipo de entidade (token/wall/prop), no lugar de 1 booleano só. Ver
   * `setSnapEnabled` abaixo pro atalho de compatibilidade.
   */
  snapTargets: SnapTargets
  drawColor: string
  drawWidth: number
  drawFilled: boolean
  /** Opacidade de preenchimento (0–1) usada ao criar a PRÓXIMA forma
   *  preenchível (circle/rect/ellipse/polygon) — preferência de sessão,
   *  mesma classe de `drawFilled`. Não confundir com `setDrawingFillAlpha`,
   *  que edita uma forma já existente e selecionada. */
  drawFillAlpha: number
  drawFontSize: number
  drawFontFamily: string
  /**
   * Cor do PRÓXIMO caminho — a que o painel oferece com a ferramenta Caminho
   * na mão, ANTES do primeiro ponto. Preferência de sessão, mesma classe de
   * `drawColor`: o caminho já traçado guarda a própria cor em
   * `Drawing.color` e não muda quando esta aqui muda. É essa separação que faz
   * um caminho de terra e um de pedra conviverem no mesmo mapa.
   */
  pathColor: string
  /** Largura do PRÓXIMO caminho, em CÉLULAS da grade (ver `drawingFactory`). */
  pathWidthCells: number
  polygonSides: number
  /** Classificação (interior/exterior) da PRÓXIMA parede a desenhar —
   *  preferência de ferramenta, mesma classe de `polygonSides`. `undefined`
   *  === exterior (default, aparência idêntica à de antes desta fase). */
  wallKind: Wall['wallKind']
  /** Espessura (fina/média/grossa) da PRÓXIMA parede a desenhar — Fase 6,
   *  preferência de ferramenta, mesma classe de `wallKind`. EIXO SEPARADO:
   *  ver `Wall.thickness` (types/map.ts). `undefined` === 'medium'. */
  wallThickness: Wall['thickness']
  /** Ponta/canto (reto/arredondado) da PRÓXIMA parede a desenhar — Fase 6,
   *  preferência de ferramenta, mesma classe de `wallKind`. `undefined`
   *  === 'round'. Ver `Wall.lineStyle` (types/map.ts). */
  wallLineStyle: Wall['lineStyle']
  setWallThickness: (thickness: NonNullable<Wall['thickness']>) => void
  setWallLineStyle: (lineStyle: NonNullable<Wall['lineStyle']>) => void
  /** Troca `thickness`/`lineStyle` de uma Parede JÁ EXISTENTE e selecionada —
   *  espelho exato de `setWallKindForWall`. Com histórico. */
  setWallThicknessForWall: (id: string, thickness: Wall['thickness']) => void
  setWallLineStyleForWall: (id: string, lineStyle: Wall['lineStyle']) => void
  /** Tipo estrutural (`normal | double | gate`) da PRÓXIMA porta a nascer
   *  pela ferramenta "Porta" (`addDoorOnWall`) — preferência de ferramenta,
   *  mesma classe de `wallKind`/`polygonSides`. Não confundir com
   *  `setWallDoorKind`, que edita uma porta JÁ CRIADA e selecionada. */
  doorKind: DoorKind
  /** O que a ferramenta "Porta" abre na parede clicada: a porta de sempre
   *  (`'porta'`, o padrão — comportamento idêntico ao de antes deste campo)
   *  ou o VÃO ABERTO (`'vao'` → `mapFactory.addOpeningOnWall`). Preferência
   *  de ferramenta, sem histórico e fora do map.json, mesma classe de
   *  `doorKind`/`eraseMode`. */
  doorMode: DoorMode
  setDoorMode: (mode: DoorMode) => void
  /** Ponta do traço (N2/B2, "ponta da linha") da PRÓXIMA forma com traço
   *  (brush/line/curve) — preferência de ferramenta, mesma classe de
   *  `wallKind`/`doorKind`. Não confundir com `setDrawingCap`, que edita uma
   *  linha/pincel/curva JÁ CRIADA e selecionada. */
  drawCap: DrawingCap
  setDrawCap: (cap: DrawingCap) => void
  /** Estilo do traço ("Contínua | Tracejada | Pontilhada") da PRÓXIMA linha
   *  ou curva — preferência de ferramenta, mesma classe de `drawCap`. É o que
   *  separa passagem secreta / limite sugerido de parede. Não confundir com
   *  `setDrawingDash`, que edita uma linha/curva JÁ CRIADA e selecionada. */
  drawDash: DrawingDash
  setDrawDash: (dash: DrawingDash) => void
  /** Textura do PRÓXIMO traço livre (N1, "pincel: caneta/lápis/marcador",
   *  Fase 4) — preferência de ferramenta, mesma classe de `drawCap`. */
  drawTexture: FreehandTexture
  setDrawTexture: (texture: FreehandTexture) => void
  /** Última forma de desenho ativada (Pincel a Polígono) — o botão "Desenho"
   *  da barra mostra o ícone dela e a reativa no clique. Preferência de
   *  sessão, mesma classe de `drawTexture`: não vai para o mapa nem para o
   *  localStorage. Só `setActiveTool` escreve aqui. */
  lastDrawingTool: DrawingTool
  /** Edita a textura de um freehand JÁ CRIADO e selecionado. Guarda por
   *  `d.kind` (não `'texture' in d`), mesmo motivo de `setDrawingCap`: campo
   *  opcional pode não existir como chave ainda num Drawing recém-criado sem
   *  a preferência `drawTexture`. */
  setDrawingTexture: (id: string, texture: FreehandTexture) => void
  /** Preset nomeado (P/M/G) da PRÓXIMA escada (N1, Fase 4) — preferência de
   *  sessão, mesma classe de `polygonSides`. Guarda o PRESET, não o
   *  `stepWidth` absoluto: assim o valor em px se ajusta ao `map.grid` do
   *  mapa aberto no momento da criação, em vez de travar num número que só
   *  faria sentido no grid em que foi escolhido. */
  stairSizePreset: StairSizePreset
  setStairSizePreset: (preset: StairSizePreset) => void
  /** Troca `stepWidth` de uma escada JÁ CRIADA e selecionada. Com histórico —
   *  mesmo padrão de `setStairDirection`. */
  setStairStepWidthForStair: (id: string, stepWidth: number) => void
  /** Preferência de sessão da ferramenta Borracha (N1, "apagar parte ou
   *  objeto todo", Fase 4) — SEM histórico, mesma classe de `wallKind`.
   *  'objeto' (default) preserva o comportamento de hoje: `eraseAt`
   *  (PixiCanvas.tsx) remove a entidade inteira. */
  eraseMode: 'objeto' | 'parte'
  setEraseMode: (mode: 'objeto' | 'parte') => void
  /** Chão por peças — forma, operação e lados da PRÓXIMA peça que a
   *  ferramenta Chão cria. Preferência de sessão sem histórico, mesma classe
   *  de `polygonSides`/`eraseMode`. */
  floorShapeKind: FloorShapeKind
  setFloorShapeKind: (kind: FloorShapeKind) => void
  floorOp: FloorPiece['op']
  setFloorOp: (op: FloorPiece['op']) => void
  floorPolygonSides: number
  setFloorPolygonSides: (sides: number) => void
  /** Lado do pincel de blocos, em blocos (1, 2 ou 3) — mesma classe de
   *  preferência de sessão dos três acima. */
  floorBrushSize: TamanhoDePincel
  setFloorBrushSize: (tamanho: number) => void
  /** Recorta um Drawing freehand/curve/line pela parte dentro do círculo
   *  (center, radius) — COM histórico, 0 a N `Drawing` novos (ver
   *  `eraseFromDrawing`, lib/eraseGeometry.ts). Sem efeito (nenhuma entrada
   *  de histórico) quando o círculo não toca o traço — `eraseFromDrawing`
   *  devolve a MESMA referência nesse caso. Kinds sem recorte possível
   *  (formas fechadas/texto) são decididos por `eraseDecisionForX` direto em
   *  PixiCanvas.tsx, reusando os removers já existentes (removeWall etc.) —
   *  não há ação de store equivalente pra eles, decisão binária não precisa
   *  de uma. */
  erasePartOfDrawing: (drawingId: string, center: Point, radius: number) => void
  setDrawColor: (color: string) => void
  setDrawWidth: (width: number) => void
  setDrawFilled: (filled: boolean) => void
  setDrawFillAlpha: (fillAlpha: number) => void
  setDrawFontSize: (size: number) => void
  setDrawFontFamily: (fontFamily: string) => void
  setPathColor: (color: string) => void
  setPathWidthCells: (widthCells: number) => void
  setPolygonSides: (sides: number) => void
  setWallKind: (kind: NonNullable<Wall['wallKind']>) => void
  setDoorKind: (kind: DoorKind) => void
  addDrawing: (drawing: Drawing) => void
  removeDrawing: (id: string) => void
  setCamera: (camera: Camera) => void
  /** Substitui o conjunto inteiro — clique simples (`selectionOfItem`),
   *  Shift+clique (`toggleSelectionItem`) ou limpar (`EMPTY_SELECTION`),
   *  sempre decididos no CHAMADOR (pixi/PixiCanvas.tsx); o store só grava. */
  setSelection: (selection: SelectionSet) => void
  /** Onda 4, item 24 — apaga TODOS os itens do conjunto (não só um), numa
   *  única entrada de histórico. Sem efeito se a seleção estiver vazia. */
  removeSelected: () => void
  /**
   * Onda 3, item 13 (Ctrl+D) — clona TODOS os itens da seleção (Onda 4, item
   * 24: "operações passam a valer para o conjunto inteiro"), cada um
   * deslocado por `map.grid` em X e Y (um quadrado abaixo e à direita —
   * permite apertar Ctrl+D várias vezes seguidas e ver a fileira de cópias
   * se afastando, sem empilhar exatamente em cima do original), insere no
   * mapa e SELECIONA o conjunto de cópias. Com histórico (1 entrada —
   * inserção e deslocamento de todo o conjunto juntos). Sem efeito se não há
   * seleção; item cujo id não existe mais no mapa é pulado, sem quebrar os
   * outros.
   */
  duplicateSelected: () => void
  /**
   * Par de `duplicateSelected`, para o Alt+arrastar (`pixi/PixiCanvas.tsx`):
   * insere uma entidade JÁ CLONADA (offset {0,0} — nasce exatamente sobre o
   * original) e seleciona-a, SEM HISTÓRICO — o gesto de arrasto que já está
   * em andamento fecha com `commitDragHistory(snapshotDeAntesDoClone)` no
   * pointerup, então "clonar" + "arrastar até a posição final" viram UMA
   * entrada de undo só, não duas.
   */
  insertClonedEntityLive: (cloned: CloneableEntity, sourceRegionId?: string) => void
  setActiveTool: (tool: DrawingTool) => void
  /** "Criar sala dentro": a próxima Sala desenhada tenta virar filha desta.
   *  Estado de UI, sem histórico. Limpo ao criar a sala e ao trocar para
   *  ferramenta que não cria Sala. */
  pendingParentRoomId: string | null
  setPendingParentRoom: (regionId: string | null) => void
  setSnapTarget: (kind: SnapTargetKind, on: boolean) => void
  /**
   * Compat: aplica o mesmo booleano aos 3 `snapTargets` de uma vez. Mantida
   * só porque `client/e2e/task-ctrl-reto.spec.ts`, `task-vertex-magnet.spec.ts`
   * e `task4-drawing-tools.spec.ts` chamam esta action direto pela store —
   * nenhuma UI nova a usa (GridControls fala só `snapTargets`/`setSnapTarget`).
   */
  setSnapEnabled: (enabled: boolean) => void
  addWall: (wall: Wall) => void
  removeWall: (id: string) => void
  addLight: (light: Light) => void
  removeLight: (id: string) => void
  updateLight: (id: string, patch: Partial<Light>) => void
  /**
   * Variante "live" de updateLight, restrita ao raio: aplica no `map` SEM
   * empurrar pra `past` — pensada pro pointermove do arrasto da alça de raio
   * (drawEditHandles.ts). Par de commitDragHistory no pointerup, mesmo
   * padrão de updateCurvePointLive/moveCurveLive abaixo.
   */
  updateLightRadiusLive: (id: string, radius: number) => void
  addFloorPiece: (piece: FloorPiece) => void
  /** Várias peças numa entrada de histórico só ("Chão a partir da imagem de fundo"). */
  addFloorPieces: (pieces: FloorPiece[]) => void
  updateFloorPiece: (id: string, patch: Partial<Omit<FloorPiece, 'id'>>) => void
  /** Sem histórico — arrasto chama isto a cada pointermove e `commitDragHistory` no fim. */
  updateFloorPieceLive: (id: string, patch: Partial<Omit<FloorPiece, 'id'>>) => void
  removeFloorPiece: (id: string) => void
  reorderFloorPiece: (id: string, delta: number) => void
  moveFloorPiece: (id: string, dx: number, dy: number) => void
  moveFloorPieceLive: (id: string, dx: number, dy: number) => void
  /** Botão direito do pincel de blocos: apaga as células numa entrada de
   *  histórico só, e NENHUMA quando o gesto não achou chão para apagar. */
  eraseFloorBlocks: (blocos: Bloco[], cell: number) => void
  setFloorStyle: (patch: Partial<FloorStyle>) => void
  /** Traços e marcadores numa entrada de histórico só. */
  addMapDetails: (lines: MapLine[], markers: MapMarker[]) => void
  setMapFrame: (frame: MapFrame | null) => void
  /** Peças, linhas, marcadores e estilo da recriação de minimapa numa entrada de histórico só. */
  applyMinimapTrace: (pieces: FloorPiece[], lines: MapLine[], markers: MapMarker[], style: Partial<FloorStyle>) => void
  addRegion: (region: Region) => void
  removeRegion: (id: string) => void
  addRoom: (region: Region, walls: Wall[]) => void
  updateWallPoint: (wallId: string, endpoint: 0 | 1, x: number, y: number) => void
  moveWall: (wallId: string, dx: number, dy: number) => void
  updateRegionPoint: (regionId: string, index: number, x: number, y: number) => void
  insertRegionPoint: (regionId: string, afterEdgeIndex: number, x: number, y: number, newWallId: string) => void
  removeRegionPoint: (regionId: string, index: number) => void
  moveRegion: (regionId: string, dx: number, dy: number) => void
  /** Fim de arrasto ou redimensionamento de Sala: recalcula a sala de fora
   *  (`reparentRoom`) das Salas mexidas — `regionIds`, ou as da seleção — a
   *  partir de `before` (snapshot do início do gesto). `sources`: cópia →
   *  original no Alt+arrastar. SEM histórico: o `commitDragHistory` do gesto
   *  fecha a entrada. */
  reparentAfterMoveLive: (before: MapData, regionIds?: string[], sources?: Record<string, string>) => void
  linkRegionWalls: (regionId: string) => void
  smoothRegion: (regionId: string) => void
  regionFillColor: string
  setRegionFillColor: (color: string) => void
  /** Cor de piso da próxima Sala (Sala, Sala Circular, Polígono Regular); Região usa `regionFillColor`. */
  roomFillColor: string
  setRoomFillColor: (color: string) => void
  setRegionColor: (id: string, color: string) => void
  regionFillPattern: Region['fillPattern']
  setRegionFillPattern: (pattern: Region['fillPattern']) => void
  setRegionPattern: (id: string, pattern: Region['fillPattern']) => void
  /** Espessura do contorno (px de mundo) da PRÓXIMA região/sala — Fase 6,
   *  preferência de ferramenta, mesma classe de `regionFillPattern`. Ver
   *  `Region.strokeWidth` (types/map.ts, `undefined` === 2). Preferência
   *  sempre nasce com valor concreto (2), não `undefined`, mesma convenção
   *  de `regionFillPattern` acima. */
  regionStrokeWidth: number
  setRegionStrokeWidth: (strokeWidth: number) => void
  /** Troca `strokeWidth` de uma Região JÁ EXISTENTE e selecionada. Com
   *  histórico — mesmo padrão de `setRegionPattern`. */
  setRegionStrokeWidthForRegion: (id: string, strokeWidth: number) => void
  /** Junção do vértice do contorno da PRÓXIMA região/sala — Fase 6,
   *  mesma classe de `regionStrokeWidth`. Ver `Region.strokeJoin`
   *  (types/map.ts, `undefined` === 'miter'). */
  regionStrokeJoin: 'round' | 'miter'
  setRegionStrokeJoin: (strokeJoin: 'round' | 'miter') => void
  setRegionStrokeJoinForRegion: (id: string, strokeJoin: 'round' | 'miter') => void
  /** "Tirar o fundo" (N2) da PRÓXIMA região/sala — preferência de ferramenta,
   *  mesma classe de `regionFillPattern`. Não confundir com `setRegionFilled`,
   *  que edita uma região JÁ CRIADA e selecionada. `Region.filled` (types/map.ts)
   *  é `undefined === true`; esta preferência já nasce `true` pelo mesmo motivo. */
  regionFillEnabled: boolean
  setRegionFillEnabled: (enabled: boolean) => void
  setRegionFilled: (id: string, filled: boolean) => void
  /**
   * Trava/destrava uma Região/Sala JÁ CRIADA ("travar movimentação de item",
   * pedido de 18/09/2026: a ilha arrastada sem querer no meio da sessão).
   * Com histórico, mesmo motivo de `updateToken`/`updateProp`: travar muda
   * CONTEÚDO do mapa, não preferência de sessão — então Ctrl+Z desfaz.
   * Só `locked`, não `hidden`: `pixi/drawRegions.ts` ignora `Region.hidden`,
   * e ação sem efeito visível não ganha UI (ver ItemTransformControls.tsx).
   */
  setRegionLocked: (id: string, locked: boolean) => void
  addToken: (token: Token) => void
  removeToken: (id: string) => void
  setTokenPosition: (id: string, x: number, y: number) => void
  /**
   * Várias fichas assentadas de uma vez ("Reunir o grupo aqui"), num passo só
   * do desfazer. Sem validar trajeto: as casas já vêm escolhidas livres. Lista
   * vazia (ou só de ids que não existem) não empurra histórico.
   */
  setTokenPositions: (positions: readonly { id: string; x: number; y: number }[]) => void
  moveToken: (id: string, targetX: number, targetY: number) => void
  /** `imageData`: cópia auto-contida que viaja até o jogador (ver lib/tokenPhoto.ts). Omitido = sem cópia. */
  setTokenImage: (id: string, image: string | null, imageData?: string | null) => void
  /** Campo Nome do painel do token — com histórico, mesmo padrão de `setRoomName`. */
  renameToken: (id: string, name: string) => void
  /**
   * Patch de rotação/travar/ocultar/COR/TAMANHO de um Token JÁ EXISTENTE (F3,
   * contrato do agente C4 — `ItemTransformControls`; `color` entrou com a
   * escolha de cor da ficha, `size` com a escolha de tamanho em quadrados).
   * Mesmo padrão inline de `updateLight` acima: sem função em mapFactory.ts
   * porque o patch é reuso direto de `Partial<Pick<...>>`, sem lógica além do
   * merge. Com histórico — rotação/travar/ocultar/cor/tamanho mudam CONTEÚDO
   * do mapa, não preferência de sessão.
   *
   * `size` aqui é o número ESCOLHIDO no painel, em quadrados. O arrasto pela
   * alça de canto continua em `updateTokenLive` (sem histórico por frame, uma
   * entrada só no `pointerup`) — são dois gestos, não dois campos.
   */
  updateToken: (id: string, patch: Partial<Pick<Token, 'rotation' | 'locked' | 'hidden' | 'color' | 'size'>>) => void
  addProp: (prop: Prop) => void
  removeProp: (id: string) => void
  moveProp: (id: string, x: number, y: number) => void
  /** Mesmo contrato de `updateToken`, para Prop. */
  updateProp: (id: string, patch: Partial<Pick<Prop, 'rotation' | 'locked' | 'hidden'>>) => void
  setShowGrid: (show: boolean) => void
  setGridShape: (shape: MapData['gridShape']) => void
  setGridSettings: (patch: Partial<GridSettings>) => void
  /**
   * Substitui `MapData.gridOffset` inteiro (F3, contrato do agente C5 —
   * "alinhar grade à imagem de fundo", `lib/gridAlign.ts` +
   * `GridAlignControls.tsx`). Commitado a cada mudança do campo numérico de
   * deslocamento — sem variante "live", porque não é gesto de arrasto
   * contínuo (input numérico, não pointermove).
   */
  setGridOffset: (offset: Point) => void
  /** Substitui `MapData.grid` (tamanho de célula) — par de `setGridOffset`
   *  no botão "Aplicar" de `GridAlignControls` (as duas juntas, 2 entradas de
   *  undo). Ver `mapFactory.setGridCellSize`. */
  setGridCellSize: (cellSize: number) => void
  setBackground: (background: MapData['background']) => void
  /** Esconde/mostra uma camada inteira (LayerId, 9 valores — types/map.ts).
   *  Se o item hoje selecionado pertence à camada que está sendo OCULTADA
   *  (não ao mostrá-la de novo), a seleção é limpa junto — evita continuar
   *  "editando" algo que sumiu da tela. */
  toggleLayerVisibility: (id: LayerId) => void
  /** Onda 4, Frente D (camadas) — trava/destrava uma LayerId inteira. Mesmo
   *  cuidado de `toggleLayerVisibility`: se o item hoje selecionado pertence
   *  à camada que está sendo TRAVADA (não ao destravar), a seleção é limpa
   *  junto — evita continuar "editando" algo que a UI não deixa mais mover. */
  toggleLayerLock: (id: LayerId) => void
  setPropLayer: (id: string, layer: Prop['layer']) => void
  setWallDoor: (id: string, door: DoorState | null) => void
  setWallKindForWall: (id: string, kind: Wall['wallKind']) => void
  /** `kind` decide tanto `door.kind` da porta nova quanto o comprimento do
   *  vão (`DOOR_LENGTH_BY_KIND[kind]`, calculado aqui no store antes de
   *  chamar mapFactory) — o chamador (PixiCanvas) passa a preferência atual
   *  `doorKind`, não mais um `doorLength` literal. */
  addDoorOnWall: (wallId: string, point: { x: number; y: number }, kind: DoorKind) => void
  /** VÃO ABERTO na parede clicada: o trecho some e por ali se passa sempre
   *  (`mapFactory.addOpeningOnWall`). O comprimento do vão é UMA CÉLULA do
   *  mapa (`map.grid`) — a largura em que um token passa —, calculado aqui
   *  como `DOOR_LENGTH_BY_KIND` é para a porta: mapFactory recebe o número
   *  pronto. Com histórico (Ctrl+Z devolve a parede inteira). */
  addOpeningOnWall: (wallId: string, point: { x: number; y: number }) => void
  /** Troca o tipo estrutural de uma porta JÁ CRIADA e redimensiona o vão pra
   *  `DOOR_LENGTH_BY_KIND[kind]`, centrado no meio do vão atual (ver
   *  mapFactory.setWallDoorKind). Com histórico. */
  setWallDoorKind: (wallId: string, kind: DoorKind) => void
  /** Alterna `DoorState.locked` de uma porta já criada. Com histórico. */
  setDoorLocked: (wallId: string, locked: boolean) => void
  /** Botão "Virar porta" do painel: porta de `DOOR_LENGTH_BY_KIND[doorKind]`
   *  no MEIO da parede selecionada, partindo a parede como a ferramenta Porta
   *  (mantém o vínculo com a Sala). Antes o painel virava o LADO INTEIRO da
   *  sala em porta (bug P10). Deixa a porta nova selecionada, para o mestre
   *  seguir em Aberta/Trancada. Parede inexistente ou que já é porta: nada. */
  turnWallIntoDoor: (wallId: string) => void
  addStair: (stair: Stair) => void
  removeStair: (id: string) => void
  moveStair: (id: string, dx: number, dy: number) => void
  updateStairPoint: (stairId: string, segmentIndex: number, endpoint: 0 | 1, x: number, y: number) => void
  setStairDirection: (id: string, direction: StairDirection) => void
  setRoomName: (id: string, name: string) => void
  /** Arrasto do rótulo da Sala — SEM histórico, par de `commitDragHistory(before)`
   *  no pointerup, mesmo padrão de `resizeRoomCornerLive`. */
  setRoomLabelOffsetLive: (id: string, offset: { x: number; y: number }) => void
  /** A5 — "Jogadores veem o nome" (invertido: `true` esconde). Com histórico. */
  setRoomNameHiddenFromPlayers: (id: string, hidden: boolean) => void
  /** TETO DE CONSTRUÇÃO — liga/desliga `RoomMeta.roof` da Sala, com histórico. */
  setRoomRoof: (id: string, roof: boolean) => void
  /** A5 — "Oculto para jogadores" de Token/Região/Objeto/Escada/Desenho. Com histórico. */
  setItemSecret: (kind: mapFactory.SecretKind, id: string, secret: boolean) => void
  /** A5 — abre a zona no painel e limpa a seleção comum (`null` fecha). */
  /** Abre o pino no painel e limpa a seleção comum (`null` fecha). */
  setSelectedPin: (id: string | null) => void
  setPinKind: (kind: PinKind) => void
  setPinIcon: (icon: PinIcon | null) => void
  addPin: (pin: MapData['pins'][number]) => void
  /** Com histórico. `destino` só muda o lado DESTA cena: o par da outra cena é
   *  mantido em dia por `stores/adventureStore.ts`, fora deste desfazer. */
  updatePin: (
    id: string,
    patch: Partial<Pick<MapData['pins'][number], 'kind' | 'icon' | 'description' | 'image' | 'locked' | 'destino' | 'passagem' | 'rotulo' | 'saidas'>>,
  ) => void
  /** Arrasto do pino — SEM histórico, par de `commitDragHistory(before)` no
   *  pointerup, mesmo padrão de `moveTokenLive`/`movePropLive`. */
  movePinLive: (id: string, x: number, y: number) => void
  removePin: (id: string) => void
  setSelectedConcealZone: (id: string | null) => void
  addConcealZone: (zone: MapData['concealZones'][number]) => void
  updateConcealZone: (id: string, patch: Partial<Pick<MapData['concealZones'][number], 'name' | 'revealed'>>) => void
  removeConcealZone: (id: string) => void
  resizeRoomDimensions: (id: string, wPx: number, hPx: number) => void
  /** Variante "live" do resize por canto — SEM histórico, aplica direto no
   *  `map` a cada pointermove do arrasto. Par de `commitDragHistory(before)`
   *  no pointerup, mesmo padrão de `updateLightRadiusLive`. */
  resizeRoomCornerLive: (id: string, corner: RoomCorner, x: number, y: number) => void
  /**
   * GIRAR SALA — os botões −90°/+90° do painel. Gira a Sala e as sub-salas
   * `degrees` graus (positivo = horário) em torno do centro dela, COM
   * histórico: um Ctrl+Z desfaz. Recalcula a sala de fora e a ordem dos
   * cantos na mesma entrada. Giro nulo ou id que não é Sala: nada, nem
   * entrada de histórico.
   */
  rotateRoom: (id: string, degrees: number) => void
  /** O campo "Rotação": leva a Sala ao ângulo `degrees` girando pela diferença. */
  setRoomRotation: (id: string, degrees: number) => void
  /**
   * Arrasto da alça de girar — SEM histórico: gira a sala MAIS `degrees` graus
   * sobre o mapa de agora, como `resizeRoomCornerLive` e `moveRegionLive`.
   * Sobre o mapa de agora, e não refeito a partir do mapa do pointerdown: numa
   * sessão em rede a ficha que o jogador anda no meio do arrasto chega por
   * `setTokenPosition`, e refazer a partir do mapa velho a apagaria. O pivô
   * não anda (o centróide de área girado é o próprio centróide). Par de
   * `finishRoomRotationLive(before, id)` + `commitDragHistory(before)` no pointerup.
   */
  rotateRoomLive: (id: string, degrees: number) => void
  /** Fecha o arrasto de giro: sala de fora e ordem dos cantos, uma vez só. SEM histórico. */
  finishRoomRotationLive: (before: MapData, id: string) => void
  /**
   * Variantes "live" de resize por canto (B3, bug3 "mover e redimensionar"),
   * para os kinds que não tinham resize algum antes desta fase: Drawing
   * rect/ellipse/polygon e Prop — SEM histórico, par de `commitDragHistory`
   * no pointerup, mesmo padrão de `resizeRoomCornerLive` acima. Geometria em
   * `lib/objectTransform.ts` (agente B3); esta ação só aplica no `map`.
   */
  /** `modifiers` (Onda 3, item 17): Shift preserva a proporção original,
   *  Alt redimensiona a partir do centro — ver `lib/objectTransform.ts`. */
  resizeDrawingCornerLive: (drawingId: string, corner: Corner, x: number, y: number, modifiers: ResizeModifiers) => void
  resizePropCornerLive: (propId: string, corner: Corner, x: number, y: number, modifiers: ResizeModifiers) => void
  /**
   * Onda 3, item 18 — variante "live" do raio de um Drawing 'circle' (alça
   * de raio nova, `pixi/drawEditHandles.ts`), mesmo padrão SEM histórico de
   * `updateLightRadiusLive`. Par de `commitDragHistory` no pointerup.
   */
  resizeCircleDrawingRadiusLive: (drawingId: string, x: number, y: number) => void
  /**
   * Patch "live" (sem histórico) de Token, restrito a `size` — par do resize
   * por canto de Token (B3): Token é sempre círculo centrado em (x,y), então
   * redimensionar por canto só muda o multiplicador `size`, nunca posição.
   * Mesmo padrão inline de `updateLightRadiusLive`/`updateToken` acima: sem
   * função em mapFactory.ts porque é merge direto, sem lógica adicional.
   */
  updateTokenLive: (id: string, patch: Partial<Pick<Token, 'size'>>) => void
  setMapScale: (scale: MapScale) => void
  setMeasurementMode: (mode: MeasurementMode) => void
  setScenarioLink: (value: string | null) => void
  setPropLinkedPath: (id: string, path: string | null) => void
  updateCurvePoint: (drawingId: string, index: number, x: number, y: number) => void
  insertCurvePoint: (drawingId: string, afterIndex: number, x: number, y: number) => void
  removeCurvePoint: (drawingId: string, index: number) => void
  moveCurve: (drawingId: string, dx: number, dy: number) => void
  /**
   * Variantes "live" de updateCurvePoint/moveCurve: aplicam a mudança no
   * `map` SEM empurrar pra `past` — pensadas pro pointermove de um arrasto
   * de ponto/corpo de Curva, que dispara a cada micro-movimento do mouse.
   * Usar a versão com histórico aí faria cada pixel de arrasto virar uma
   * entrada de undo, exigindo dezenas de Ctrl+Z pra desfazer um gesto só.
   * Ver commitDragHistory abaixo pro outro lado do par.
   */
  updateCurvePointLive: (drawingId: string, index: number, x: number, y: number) => void
  moveCurveLive: (drawingId: string, dx: number, dy: number) => void
  /**
   * Fecha um gesto de arrasto (drag) num único snapshot de undo: `before` é
   * o `map` capturado ANTES do gesto começar (no pointerdown), guardado numa
   * variável local do PixiCanvas. Chamado uma vez no pointerup/pointerupoutside,
   * empurra esse snapshot pro topo de `past` — não o estado atual, que já é o
   * resultado final do arrasto. Não faz nada se `before` for igual (mesma
   * referência) ao `map` atual, ou seja, o gesto não mudou nada de verdade
   * (ex.: clique sem arrasto real).
   *
   * Se um jogador mudou o mapa durante o gesto (`applyPlayerChange`), essas
   * mudanças são reaplicadas em `before` antes de ir pra `past` — desfazer o
   * arrasto do mestre não pode devolver a ficha do jogador. Gesto em que só o
   * jogador mexeu não vira passo de desfazer.
   */
  commitDragHistory: (before: MapData) => void
  /**
   * Mudança feita por um JOGADOR na cena aberta (chega pela ponte do host,
   * `net/playerChanges.ts`, já validada). Não cria passo de desfazer: o Ctrl+Z
   * do mestre desfaz só o que o mestre fez. `transform` também é reaplicado em
   * cada snapshot de `past`/`future` — o snapshot é o mapa inteiro, e sem isso
   * desfazer uma parede do mestre devolveria a ficha do jogador para onde
   * estava antes. `transform` precisa ser pura, valer para qualquer versão do
   * mapa (ex.: "ficha t1 vai para (x, y)") e devolver o próprio mapa quando
   * não muda nada.
   */
  applyPlayerChange: (transform: (map: MapData) => MapData) => void
  updateLinePoint: (drawingId: string, endpoint: 0 | 1, x: number, y: number) => void
  moveDrawing: (drawingId: string, dx: number, dy: number) => void
  /**
   * Variantes "live" de mover corpo (onda 1, item 3 do PLANO-REFINAMENTO.md)
   * — mesma assinatura de moveToken/moveProp/moveWall/moveRegion/moveStair/
   * moveDrawing, SEM histórico, para o pointermove do arrasto em
   * pixi/PixiCanvas.tsx. Par de commitDragHistory no pointerup/
   * pointerupoutside, mesmo padrão de updateCurvePointLive/moveCurveLive.
   */
  moveTokenLive: (id: string, targetX: number, targetY: number) => void
  movePropLive: (id: string, x: number, y: number) => void
  moveWallLive: (wallId: string, dx: number, dy: number) => void
  moveRegionLive: (regionId: string, dx: number, dy: number) => void
  moveStairLive: (id: string, dx: number, dy: number) => void
  moveDrawingLive: (drawingId: string, dx: number, dy: number) => void
  /**
   * Variantes "live" dos 3 sliders de propriedade (onda 1, item 4) — par de
   * commitDragHistory no fim do gesto (pointerup do arrasto no canvas, ou
   * debounce de inatividade no slider de App.tsx — ver comentário no
   * respectivo call site em App.tsx sobre por que não é pointerup real ali).
   */
  updateLightIntensityLive: (id: string, intensity: number) => void
  setDrawingFillAlphaLive: (id: string, fillAlpha: number) => void
  setRegionStrokeWidthForRegionLive: (id: string, strokeWidth: number) => void
  /**
   * Variante "live" de mover o CONJUNTO inteiro: aplica `lib/areaSelection.ts`
   * → `moveAreaSelection` (via `selectionToAreaSelection(selection)`) no
   * `map` SEM empurrar pra `past` — pointermove do arrasto do grupo (`mode
   * === 'dragging-area-selection'`, disparado só quando `selection.length >
   * 1`, ver PixiCanvas.tsx). Par de `commitDragHistory(before)` no
   * pointerup, mesmo padrão de `moveCurveLive`/`resizeRoomCornerLive`. Sem
   * efeito (`{}`) se a seleção estiver vazia.
   */
  moveSelectionLive: (dx: number, dy: number) => void
  /**
   * Variante COM histórico de mover o conjunto inteiro por delta fixo — usada
   * pelo nudge por seta (Onda 1, item 7): cada tecla é UMA entrada de undo,
   * não um gesto contínuo, então não passa por `moveSelectionLive`. Reusa a
   * MESMA `moveAreaSelection` (7 kinds, já resolve o caso Região+Parede
   * vinculada sem somar o delta 2×) — sem efeito se a seleção estiver vazia,
   * ou se nada de fato mudar (todo item travado, por exemplo).
   */
  moveSelectionBy: (dx: number, dy: number) => void
  updateTextLabel: (id: string, patch: Partial<{ text: string; color: string; fontSize: number }>) => void
  setTextFontFamily: (id: string, fontFamily: string) => void
  /**
   * Edita fillAlpha/filled de uma forma JÁ CRIADA e selecionada (circle/rect/
   * ellipse/polygon). Sem efeito quando o id não existe ou é de um kind sem
   * esse campo (freehand/line/curve/text) — narrowing via `'fillAlpha' in d`
   * / `'filled' in d`, que o TypeScript resolve sobre a união `Drawing`.
   */
  setDrawingFillAlpha: (id: string, fillAlpha: number) => void
  setDrawingFilled: (id: string, filled: boolean) => void
  /**
   * Edita `cap` de um Drawing line/freehand/curve JÁ CRIADO e selecionado
   * (N2/B2, "ponta da linha"). Guarda por `d.kind` (não `'cap' in d`, ao
   * contrário de `setDrawingFilled`/`setDrawingFillAlpha` acima) porque `cap`
   * é campo OPCIONAL — pode não existir como chave ainda num Drawing recém-
   * criado sem a preferência `drawCap` — então `'cap' in d` daria falso
   * negativo bem antes de dar falso positivo. Sem efeito em rect/ellipse/
   * polygon/circle/text (kinds sem `cap` no schema).
   */
  setDrawingCap: (id: string, cap: DrawingCap) => void
  /**
   * Edita `dash` de uma linha/curva JÁ CRIADA e selecionada. Guarda por
   * `d.kind` pelo mesmo motivo de `setDrawingCap`: `dash` é campo OPCIONAL e
   * nem existe como chave num traço contínuo, então `'dash' in d` daria falso
   * negativo. Sem efeito nos outros kinds (sem `dash` no schema) — Pincel
   * fica de fora de propósito: a aparência do traço livre é `texture`
   * (caneta/lápis/marcador), e cruzar as duas não foi pedido.
   */
  setDrawingDash: (id: string, dash: DrawingDash) => void
  /** Cor de um desenho JÁ EXISTENTE (qualquer kind, texto incluso), com
   *  histórico. Auditoria 14/09: retângulo, linha e pincel desenhados não
   *  tinham como trocar de cor — só apagar e redesenhar. Não confundir com
   *  `setDrawColor`, a preferência do PRÓXIMO desenho. */
  setDrawingColor: (id: string, color: string) => void
  /** Variante sem histórico de `setDrawingColor`, para o seletor de cor que
   *  dispara a cada movimento — mesmo par de `setDrawingFillAlphaLive`. */
  setDrawingColorLive: (id: string, color: string) => void
  /** Espessura de um desenho JÁ EXISTENTE (texto não tem), com histórico.
   *  Valor não finito ou menor que 1 é ignorado. */
  setDrawingWidth: (id: string, width: number) => void
  /** Variante sem histórico de `setDrawingWidth`, para o arrasto do slider. */
  setDrawingWidthLive: (id: string, width: number) => void
  /**
   * Leitura B do pedido do usuário (B2, "dobrar a linha"): converte um
   * Drawing `kind:'line'` selecionado em `kind:'curve'`, preservando
   * id/cor/espessura/cap (`lib/drawingFactory.ts` → `convertLineToCurve`).
   * A partir daí, todo o mecanismo de edição de Curva já existente (midpoint
   * vazado, inserir/arrastar ponto de controle) passa a servir a entidade
   * convertida, sem código extra. No-op (mesma referência) se o id não
   * existir ou não for `line` — a função pura já garante isso, aqui só
   * decide se entra no histórico.
   */
  convertDrawingToCurve: (id: string) => void
  /**
   * Sentido inverso (F4, contrato do Agente B — "trecho pra colar item 2"):
   * converte um Drawing `kind:'curve'` de EXATAMENTE 2 pontos de controle de
   * volta para `kind:'line'`, preservando id/cor/espessura/cap
   * (`lib/drawingFactory.ts` → `convertCurveToLine`). No-op (mesma
   * referência) se a curve tiver 3+ pontos (perderia os pontos
   * intermediários — `convertCurveToLine` recusa) ou o id não for curve.
   */
  convertDrawingToLine: (id: string) => void
  loadMap: (map: MapData) => void
  undo: () => void
  redo: () => void
}

const initialMap = mapFactory.createEmptyMap('map_local', 'Mapa sem título', 30, 20, 64)

/**
 * Comprimento padrão (px de mundo) do vão que a ferramenta "Porta" abre ao
 * clicar em cima de uma parede, por `DoorKind` — antes desta fase era um
 * único literal (`DOOR_LENGTH = 32`, hoje só o caso `normal`). `double`/`gate`
 * pedem vão mais largo pra ler como porta dupla/portão na escala usual do
 * grid (64px, ver createEmptyMap acima). Usado tanto por `addDoorOnWall`
 * (porta nova) quanto por `setWallDoorKind` (porta existente trocando de
 * tipo) — ambos calculam o comprimento aqui e passam o número pronto pra
 * mapFactory, que não conhece esta tabela (mesma separação de
 * responsabilidade de `wallKind`/`buildWallFromDraft`).
 */
export const DOOR_LENGTH_BY_KIND: Record<DoorKind, number> = { normal: 32, double: 64, gate: 96 }

/**
 * Onda 3, item 20 (Frente D) — cap do histórico de undo/redo. `past` guarda a
 * REFERÊNCIA do `map` anterior a cada ação (nunca `structuredClone`), sem
 * limite algum antes desta mudança: numa sessão longa (app desktop Tauri,
 * fica aberto por horas) isso é vazamento de memória de verdade, não
 * estética. Justificativa completa do número 50 (medição sobre
 * `lib/__fixtures__/legacy-map.json`, um mapa real, e projeção pra "mapa
 * grande") em `stores/historyCap.test.ts:1-38` — não repetida aqui pra não
 * ter duas fontes de verdade sobre a mesma conta.
 */
const HISTORY_CAP = 50

/**
 * Empurra `entry` no topo de `past`, descartando a entrada MAIS ANTIGA
 * quando o cap estoura — nunca a mais recente. Compartilhada pelos dois
 * pontos de push (`withHistory` e `commitDragHistory`) pra não divergir —
 * `stores/historyCap.test.ts` cobre os dois.
 */
function pushPast(past: MapData[], entry: MapData): MapData[] {
  const next = [...past, entry]
  return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next
}

/** Salas movidas por uma seleção: as selecionadas e as donas das paredes selecionadas. */
function movedRoomIds(map: MapData, selection: readonly SelectionItem[]): string[] {
  const ids = new Set<string>()
  for (const item of selection) {
    if (item.kind === 'region') ids.add(item.id)
    if (item.kind === 'wall') {
      const regionId = map.walls.find((w) => w.id === item.id)?.regionId
      if (regionId !== undefined) ids.add(regionId)
    }
  }
  return [...ids]
}

/**
 * Recalcula a mãe (e as arestas que saíram de cima da parede da mãe) de cada
 * Sala movida, redimensionada ou duplicada. `before` é o mapa de antes do
 * gesto; `sources` liga cópia → sala original (Ctrl+D, Alt+arrastar). Sub-sala
 * que andou junto com a mãe da mesma lista fica como está; filhas diretas
 * também passam, porque a mãe redimensionada pode ter se afastado delas.
 */
function reparentRooms(map: MapData, regionIds: readonly string[], before?: MapData, sources: Readonly<Record<string, string>> = {}): MapData {
  const ids = new Set(regionIds)
  let next = map
  for (const id of ids) {
    if (ancestorsOf(next.regions, id).some((a) => ids.has(a.id))) continue
    next = mapFactory.reparentRoom(next, id, before, sources[id] ?? id)
  }
  for (const child of next.regions.filter((r) => r.parentId !== undefined && ids.has(r.parentId) && !ids.has(r.id))) {
    next = mapFactory.reparentRoom(next, child.id, before)
  }
  return next
}

/**
 * Fecha um giro de Sala. Primeiro a sala de fora — a girada pode ter saído da
 * mãe, ou tirado uma aresta de cima da parede dela, e essa aresta ganha
 * parede. Depois a ordem dos cantos das salas retangulares que ficaram retas:
 * nesta ordem, porque `reparentRoom` compara as arestas de antes e de depois
 * pelo índice, e a reordenação muda o índice. `before` é o mapa de antes do gesto.
 */
function settleRoomRotation(map: MapData, id: string, before: MapData): MapData {
  const reparented = reparentRooms(map, [id], before)
  return mapFactory.normalizeRectRoomOrder(reparented, subtreeIds(before.regions, id))
}

/** Espessura mínima de desenho — mesmo `min` do slider de DrawingStyleControls. */
const MIN_DRAWING_WIDTH = 1

function isValidDrawingWidth(width: number): boolean {
  return Number.isFinite(width) && width >= MIN_DRAWING_WIDTH
}

type MapTransform = (map: MapData) => MapData

/**
 * Mudanças do jogador em ordem de chegada (`applyPlayerChange`), numeradas —
 * `commitDragHistory` reaplica em `before` as que chegaram depois do começo do
 * gesto. O cap só limita memória: um gesto do mestre não dura 200 movimentos.
 */
const PLAYER_LOG_CAP = 200
let playerSeq = 0
let playerLog: { seq: number; transform: MapTransform }[] = []
/** Quantas mudanças do jogador já estavam no mapa da última vez que ele virou o `map` atual. */
const playerSeqOfMap = new WeakMap<MapData, number>()
/**
 * Mapa que nasceu só de mudanças do jogador → o último mapa do MESTRE de onde
 * ele veio. Guarda a base, não o pai imediato: uma cadeia pai→pai prenderia na
 * memória todo movimento de jogador de uma sessão em que o mestre fica parado.
 */
const masterBaseOfMap = new WeakMap<MapData, MapData>()

/** `before` com as mudanças do jogador que chegaram depois dele. */
function withLaterPlayerChanges(before: MapData): MapData {
  const since = playerSeqOfMap.get(before) ?? playerSeq
  return playerLog.reduce((map, entry) => (entry.seq > since ? entry.transform(map) : map), before)
}

/** `map` saiu de `before` só por mudanças do jogador (ou é o próprio `before`)? */
function changedOnlyByPlayer(map: MapData, before: MapData): boolean {
  if (map === before) return true
  const base = masterBaseOfMap.get(map)
  return base !== undefined && base === (masterBaseOfMap.get(before) ?? before)
}

/**
 * Edição contínua no mesmo campo de texto (rótulo, nome de sala, nome de
 * ficha) vira UM passo de desfazer: a chave diz qual campo, e `map` é o mapa
 * que a última letra produziu. Qualquer outra mudança do mestre no meio troca
 * o `map` atual e encerra a edição; trocar a seleção, desfazer e refazer também.
 */
interface TypingEdit {
  key: string
  map: MapData
}

export const useMapStore = create<MapStoreState>()(subscribeWithSelector((set, get) => {
  /**
   * Toda action que muda conteúdo do mapa (não estado de UI/ferramenta como
   * activeTool/camera/selection/snapTargets) passa por aqui: empurra o `map`
   * atual pro topo de `past` antes de aplicar `updater`, e zera `future` —
   * qualquer redo pendente é descartado assim que uma ação nova acontece.
   * Os mapas nunca são mutados in-place (sempre spread novo), então guardar a
   * referência antiga em `past` já basta como snapshot, sem precisar de
   * `structuredClone`. `pushPast` (acima) poda a entrada mais antiga quando
   * `past` estoura `HISTORY_CAP`.
   *
   * `typingKey` (só campos de texto): letra seguinte no mesmo campo, sem outra
   * mudança do mestre no meio, atualiza o mapa sem empurrar passo novo — ver
   * `TypingEdit`.
   */
  let typingEdit: TypingEdit | null = null
  const withHistory = (updater: (map: MapData) => MapData, typingKey?: string) => {
    const prevMap = get().map
    const nextMap = updater(prevMap)
    const continuesTyping = typingKey !== undefined && typingEdit !== null && typingEdit.key === typingKey && typingEdit.map === prevMap
    typingEdit = typingKey === undefined ? null : { key: typingKey, map: nextMap }
    if (continuesTyping) {
      set({ map: nextMap, future: [] })
      return
    }
    set((state) => ({
      map: nextMap,
      past: pushPast(state.past, prevMap),
      future: [],
    }))
  }

  return {
    map: initialMap,
    past: [],
    future: [],
    camera: { x: 0, y: 0, scale: 1 },
    selection: EMPTY_SELECTION,
    selectedConcealZoneId: null,
    selectedPinId: null,
    pinKind: 'exclamacao',
    pinIcon: null,
    activeTool: 'select',
    snapTargets: { token: false, wall: false, prop: false },
    drawColor: '#ffffff',
    drawWidth: 4,
    drawFilled: false,
    drawFillAlpha: 0.5,
    drawFontSize: 16,
    drawFontFamily: DEFAULT_TEXT_FONT_FAMILY,
    // Terra batida: o primeiro caminho já nasce parecendo trilha, e não um
    // risco branco por cima da planta (que é o default do Desenho).
    pathColor: '#8a6a45',
    pathWidthCells: DEFAULT_PATH_WIDTH_CELLS,
    polygonSides: 6,
    wallKind: undefined,
    wallThickness: undefined,
    wallLineStyle: undefined,
    doorKind: 'normal',
    doorMode: 'porta',
    drawCap: 'round',
    drawDash: 'solid',
    drawTexture: 'pen',
    lastDrawingTool: 'brush',
    stairSizePreset: 'medium',
    eraseMode: 'objeto',
    floorShapeKind: 'rect',
    floorOp: 'add',
    floorPolygonSides: 6,
    floorBrushSize: 1,
    regionFillColor: '#3a7ad0',
    // Marrom, igual ao chão do mapa novo (minimapa do RE4): Sala nova não nasce azul.
    roomFillColor: '#a8776a',
    pendingParentRoomId: null,
    setPendingParentRoom: (regionId) => set({ pendingParentRoomId: regionId }),
    regionFillPattern: 'solid',
    regionFillEnabled: true,
    regionStrokeWidth: 2,
    regionStrokeJoin: 'miter',
    setCamera: (camera) => set({ camera }),
    // Selecionar algo no mapa fecha a zona oculta do painel; limpar a seleção não.
    setSelection: (selection) => {
      // Outro alvo selecionado: a próxima letra já é outra edição, outro passo.
      typingEdit = null
      set(isSelectionEmpty(selection) ? { selection } : { selection, selectedConcealZoneId: null, selectedPinId: null })
    },
    removeSelected: () => {
      const { selection } = get()
      if (isSelectionEmpty(selection)) return
      // Um `withHistory` só para o conjunto inteiro (1 entrada de undo pro
      // Delete todo, não N) — despacho por `item.kind` reusa mapFactory
      // direto (mesmas funções que os removers de 1 item já chamam por
      // baixo), sem passar pelas actions com histórico próprio.
      withHistory((map) => {
        let next = map
        for (const item of selection) {
          switch (item.kind) {
            case 'token': next = mapFactory.removeToken(next, item.id); break
            case 'wall': next = mapFactory.removeWall(next, item.id); break
            case 'light': next = mapFactory.removeLight(next, item.id); break
            case 'region': next = mapFactory.removeRegion(next, item.id); break
            case 'stair': next = mapFactory.removeStair(next, item.id); break
            case 'prop': next = mapFactory.removeProp(next, item.id); break
            case 'drawing': next = mapFactory.removeDrawing(next, item.id); break
            case 'floor': next = mapFactory.removeFloorPiece(next, item.id); break
          }
        }
        return next
      })
      set({ selection: EMPTY_SELECTION })
    },
    duplicateSelected: () => {
      const { map, selection } = get()
      if (isSelectionEmpty(selection)) return
      // Com Sala na seleção, a cópia nasce ao lado (largura do conjunto + 1
      // célula), sem cobrir o original nem sobrepor os nomes.
      const hasRoom = selection.some((item) => item.kind === 'region' && map.regions.find((r) => r.id === item.id)?.room !== undefined)
      const bounds = hasRoom ? areaSelectionBounds(map, selectionToAreaSelection(selection)) : null
      const offset = bounds ? { dx: bounds.maxX - bounds.minX + map.grid, dy: 0 } : { dx: map.grid, dy: map.grid }
      const clonedItems: SelectionItem[] = []
      // Cópia de Sala → Sala original, para a cópia herdar as arestas que estavam sobre a mãe.
      const sources: Record<string, string> = {}
      const selectedRegionIds = new Set(selection.filter((item) => item.kind === 'region').map((item) => item.id))
      // Sala selecionada leva as sub-salas: elas e as paredes delas não se copiam de novo.
      const coveredRegionIds = new Set<string>()
      for (const id of selectedRegionIds) {
        for (const d of descendantsOf(map.regions, id)) coveredRegionIds.add(d.id)
      }
      withHistory((m) => {
        let next = m
        for (const item of selection) {
          if (item.kind === 'region' && coveredRegionIds.has(item.id)) continue
          // Parede de uma Sala que também está selecionada já vem junto com a Sala.
          const wallRegionId = item.kind === 'wall' ? m.walls.find((w) => w.id === item.id)?.regionId ?? '' : ''
          if (item.kind === 'wall' && (selectedRegionIds.has(wallRegionId) || coveredRegionIds.has(wallRegionId))) continue
          const cloned = cloneSelectedEntity(next, item, offset)
          if (!cloned) continue
          next = addClonedEntity(next, cloned)
          if (cloned.kind === 'region') {
            sources[cloned.entity.id] = item.id
            const inner = cloneRoomDescendants(m.regions, m.walls, item.id, cloned.entity.id, offset)
            next = {
              ...next,
              regions: [...next.regions, ...inner.regions],
              walls: [...next.walls, ...cloneLinkedWalls(m.walls, item.id, cloned.entity.id, offset), ...inner.walls],
            }
          }
          clonedItems.push({ kind: cloned.kind, id: cloned.entity.id })
        }
        // Cópia de sub-sala que caiu fora da mãe vira sala de topo (ou filha de onde caiu).
        return reparentRooms(next, movedRoomIds(next, clonedItems), m, sources)
      })
      // Nenhum item existia mais no mapa (janela de corrida): mantém a
      // seleção antiga em vez de trocar por um conjunto vazio.
      if (clonedItems.length > 0) set({ selection: clonedItems })
    },
    insertClonedEntityLive: (cloned, sourceRegionId) => set((state) => {
      const withEntity = addClonedEntity(state.map, cloned)
      const zero = { dx: 0, dy: 0 }
      const inner = cloned.kind === 'region' && sourceRegionId !== undefined
        ? cloneRoomDescendants(state.map.regions, state.map.walls, sourceRegionId, cloned.entity.id, zero)
        : null
      const map = cloned.kind === 'region' && sourceRegionId !== undefined && inner
        ? {
            ...withEntity,
            regions: [...withEntity.regions, ...inner.regions],
            walls: [...withEntity.walls, ...cloneLinkedWalls(state.map.walls, sourceRegionId, cloned.entity.id, zero), ...inner.walls],
          }
        : withEntity
      return { map, selection: selectionOfItem({ kind: cloned.kind, id: cloned.entity.id }) }
    }),
    setActiveTool: (tool) => set((state) => {
      // Forma de desenho vira a "última forma" do botão Desenho, também quando
      // é reescolhida (a setinha escolhe a mesma forma que já está ativa).
      const lastDrawing = TOOL_CLUSTERS.drawing.tools.includes(tool) ? { lastDrawingTool: tool } : {}
      // Reescolher a mesma ferramenta (setinha de variantes) não é troca: a
      // sala recém-criada continua selecionada com o Nome no painel.
      if (tool === state.activeTool) return lastDrawing
      // "Criar sala dentro" só vale enquanto a ferramenta cria Sala.
      const pending = ROOM_TOOLS.has(tool) ? {} : { pendingParentRoomId: null }
      // Auditoria 14/09: com a Luz ativa o painel ainda mostrava a Escada
      // selecionada antes, e o Preenchimento aparecia com a Linha por causa de
      // um retângulo que ficou selecionado. Ferramenta que cria limpa a
      // seleção; Selecionar mantém.
      if (tool === 'select' || isSelectionEmpty(state.selection)) return { activeTool: tool, ...lastDrawing, ...pending }
      return { activeTool: tool, selection: EMPTY_SELECTION, ...lastDrawing, ...pending }
    }),
    setSnapTarget: (kind, on) => set((state) => ({ snapTargets: { ...state.snapTargets, [kind]: on } })),
    setSnapEnabled: (enabled) => set({ snapTargets: { token: enabled, wall: enabled, prop: enabled } }),
    setDrawColor: (color) => set({ drawColor: color }),
    setDrawWidth: (width) => set({ drawWidth: width }),
    setDrawFilled: (filled) => set({ drawFilled: filled }),
    setDrawFillAlpha: (fillAlpha) => set({ drawFillAlpha: fillAlpha }),
    setDrawFontSize: (size) => set({ drawFontSize: size }),
    setDrawFontFamily: (fontFamily) => set({ drawFontFamily: fontFamily }),
    setPathColor: (color) => set({ pathColor: color }),
    setPathWidthCells: (widthCells) => set({ pathWidthCells: clampPathWidthCells(widthCells) }),
    setPolygonSides: (sides) => set({ polygonSides: sides }),
    setWallKind: (kind) => set({ wallKind: kind }),
    setWallThickness: (thickness) => set({ wallThickness: thickness }),
    setWallLineStyle: (lineStyle) => set({ wallLineStyle: lineStyle }),
    setDoorKind: (kind) => set({ doorKind: kind }),
    setDoorMode: (mode) => set({ doorMode: mode }),
    setDrawCap: (cap) => set({ drawCap: cap }),
    setDrawDash: (dash) => set({ drawDash: dash }),
    setDrawTexture: (texture) => set({ drawTexture: texture }),
    setDrawingTexture: (id, texture) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) => (d.id === id && d.kind === 'freehand' ? { ...d, texture } : d)),
    })),
    setStairSizePreset: (preset) => set({ stairSizePreset: preset }),
    setStairStepWidthForStair: (id, stepWidth) => withHistory((map) => mapFactory.setStairStepWidth(map, id, stepWidth)),
    setEraseMode: (mode) => set({ eraseMode: mode }),
    setFloorShapeKind: (kind) => set({ floorShapeKind: kind }),
    setFloorOp: (op) => set({ floorOp: op }),
    setFloorPolygonSides: (sides) => set({ floorPolygonSides: clampFloorPolygonSides(sides) }),
    setFloorBrushSize: (tamanho) => set({ floorBrushSize: clampTamanhoDePincel(tamanho) }),
    erasePartOfDrawing: (drawingId, center, radius) => {
      const { map } = get()
      const drawing = map.drawings.find((d) => d.id === drawingId)
      if (!drawing) return
      const replacements = eraseFromDrawing(drawing, center, radius)
      // Círculo não tocou o traço — eraseFromDrawing devolve a MESMA
      // referência nesse caso (ver eraseGeometry.ts) — não gera entrada de
      // histórico à toa.
      if (replacements.length === 1 && replacements[0] === drawing) return
      withHistory((m) => mapFactory.replaceDrawingWithMany(m, drawingId, replacements))
    },
    addWall: (wall) => withHistory((map) => mapFactory.addWall(map, wall)),
    removeWall: (id) => withHistory((map) => mapFactory.removeWall(map, id)),
    addLight: (light) => withHistory((map) => mapFactory.addLight(map, light)),
    removeLight: (id) => withHistory((map) => mapFactory.removeLight(map, id)),
    updateLight: (id, patch) => withHistory((map) => ({
      ...map,
      lights: map.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    })),
    updateLightRadiusLive: (id, radius) => set((state) => ({
      map: {
        ...state.map,
        lights: state.map.lights.map((l) => (l.id === id ? { ...l, radius } : l)),
      },
    })),
    addFloorPiece: (piece) => withHistory((map) => mapFactory.addFloorPiece(map, piece)),
    addFloorPieces: (pieces) => {
      // Lista vazia não gasta entrada de undo que não desfaz nada.
      if (pieces.length === 0) return
      withHistory((map) => mapFactory.addFloorPieces(map, pieces))
    },
    updateFloorPiece: (id, patch) => withHistory((map) => mapFactory.updateFloorPiece(map, id, patch)),
    updateFloorPieceLive: (id, patch) => set((state) => ({ map: mapFactory.updateFloorPiece(state.map, id, patch) })),
    removeFloorPiece: (id) => withHistory((map) => mapFactory.removeFloorPiece(map, id)),
    reorderFloorPiece: (id, delta) => withHistory((map) => mapFactory.reorderFloorPiece(map, id, delta)),
    moveFloorPiece: (id, dx, dy) => withHistory((map) => mapFactory.moveFloorPiece(map, id, dx, dy)),
    moveFloorPieceLive: (id, dx, dy) => set((state) => ({ map: mapFactory.moveFloorPiece(state.map, id, dx, dy) })),
    eraseFloorBlocks: (blocos, cell) => {
      const atual = get().map
      const proximo = mapFactory.eraseFloorBlocks(atual, blocos, cell, () => crypto.randomUUID())
      // Arrastar a borracha por onde nao havia chao nao e mudanca: nao gasta Ctrl+Z.
      if (proximo !== atual) withHistory(() => proximo)
    },
    setFloorStyle: (patch) => withHistory((map) => mapFactory.setFloorStyle(map, patch)),
    addMapDetails: (lines, markers) => {
      if (lines.length === 0 && markers.length === 0) return
      withHistory((map) => mapFactory.addMapDetails(map, lines, markers))
    },
    setMapFrame: (frame) => withHistory((map) => mapFactory.setMapFrame(map, frame)),
    applyMinimapTrace: (pieces, lines, markers, style) =>
      withHistory((map) => mapFactory.applyMinimapTrace(map, pieces, lines, markers, style)),
    addRegion: (region) => withHistory((map) => mapFactory.addRegion(map, region)),
    removeRegion: (id) => withHistory((map) => mapFactory.removeRegion(map, id)),
    addRoom: (region, walls) => withHistory((map) => mapFactory.addRoom(map, region, walls)),
    updateWallPoint: (wallId, endpoint, x, y) => {
      const before = get().map
      const after = mapFactory.updateWallPoint(before, wallId, endpoint, x, y)
      if (after === before) return
      withHistory(() => after)
    },
    moveWall: (wallId, dx, dy) => withHistory((map) => mapFactory.moveWall(map, wallId, dx, dy)),
    updateRegionPoint: (regionId, index, x, y) => withHistory((map) => mapFactory.updateRegionPoint(map, regionId, index, x, y)),
    insertRegionPoint: (regionId, afterEdgeIndex, x, y, newWallId) => withHistory((map) => mapFactory.insertRegionPoint(map, regionId, afterEdgeIndex, x, y, newWallId)),
    removeRegionPoint: (regionId, index) => {
      const before = get().map
      const after = mapFactory.removeRegionPoint(before, regionId, index)
      if (after === before) return
      withHistory(() => after)
    },
    moveRegion: (regionId, dx, dy) => withHistory((map) => reparentRooms(mapFactory.moveRegion(map, regionId, dx, dy), [regionId], map)),
    reparentAfterMoveLive: (before, regionIds, sources) => set((state) => {
      const ids = regionIds ?? movedRoomIds(state.map, state.selection)
      const map = reparentRooms(state.map, ids, before, sources)
      return map === state.map ? {} : { map }
    }),
    linkRegionWalls: (regionId) => {
      const before = get().map
      const after = mapFactory.linkRegionWalls(before, regionId)
      if (after === before) return
      withHistory(() => after)
    },
    smoothRegion: (regionId) => {
      const before = get().map
      const after = mapFactory.smoothRegion(before, regionId)
      if (after === before) return
      withHistory(() => after)
    },
    setRegionFillColor: (color) => set({ regionFillColor: color }),
    setRoomFillColor: (color) => set({ roomFillColor: color }),
    setRegionColor: (id, color) => withHistory((map) => ({
      ...map,
      regions: map.regions.map((r) => (r.id === id ? { ...r, fillColor: color } : r)),
    })),
    setRegionFillPattern: (pattern) => set({ regionFillPattern: pattern }),
    setRegionPattern: (id, pattern) => withHistory((map) => ({
      ...map,
      regions: map.regions.map((r) => (r.id === id ? { ...r, fillPattern: pattern } : r)),
    })),
    setRegionStrokeWidth: (strokeWidth) => set({ regionStrokeWidth: strokeWidth }),
    setRegionStrokeWidthForRegion: (id, strokeWidth) => withHistory((map) => ({
      ...map,
      regions: map.regions.map((r) => (r.id === id ? { ...r, strokeWidth } : r)),
    })),
    setRegionStrokeJoin: (strokeJoin) => set({ regionStrokeJoin: strokeJoin }),
    setRegionStrokeJoinForRegion: (id, strokeJoin) => withHistory((map) => ({
      ...map,
      regions: map.regions.map((r) => (r.id === id ? { ...r, strokeJoin } : r)),
    })),
    setRegionFillEnabled: (enabled) => set({ regionFillEnabled: enabled }),
    setRegionFilled: (id, filled) => withHistory((map) => ({
      ...map,
      regions: map.regions.map((r) => (r.id === id ? { ...r, filled } : r)),
    })),
    setRegionLocked: (id, locked) => withHistory((map) => ({
      ...map,
      regions: map.regions.map((r) => (r.id === id ? { ...r, locked } : r)),
    })),
    addToken: (token) => withHistory((map) => mapFactory.addToken(map, token)),
    removeToken: (id) => withHistory((map) => mapFactory.removeToken(map, id)),
    setTokenPosition: (id, x, y) => withHistory((map) => mapFactory.setTokenPosition(map, id, x, y)),
    setTokenPositions: (positions) => {
      const { map } = get()
      const present = positions.filter((p) => map.tokens.some((t) => t.id === p.id))
      if (present.length === 0) return
      withHistory((m) => present.reduce((acc, p) => mapFactory.setTokenPosition(acc, p.id, p.x, p.y), m))
    },
    moveToken: (id, targetX, targetY) => {
      const { map } = get()
      const token = map.tokens.find((t) => t.id === id)
      if (!token) return
      // Mesma explicação de moveTokenLive (abaixo). Recusa não mexe no mapa,
      // então também não empurra histórico: Ctrl+Z não ganha um passo que não
      // mudou nada (antes, `withHistory` rodava mesmo com o token parado).
      const next = moveTokenExplaining(map, token, targetX, targetY)
      if (next !== map) withHistory(() => next)
    },
    setTokenImage: (id, image, imageData = null) => withHistory((map) => mapFactory.setTokenImage(map, id, image, imageData)),
    renameToken: (id, name) => withHistory((map) => mapFactory.renameToken(map, id, name), `token-name:${id}`),
    updateToken: (id, patch) => withHistory((map) => ({
      ...map,
      tokens: map.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
    addProp: (prop) => withHistory((map) => mapFactory.addProp(map, prop)),
    removeProp: (id) => withHistory((map) => mapFactory.removeProp(map, id)),
    moveProp: (id, x, y) => withHistory((map) => mapFactory.setPropPosition(map, id, x, y)),
    updateProp: (id, patch) => withHistory((map) => ({
      ...map,
      props: map.props.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
    addDrawing: (drawing) => withHistory((map) => mapFactory.addDrawing(map, drawing)),
    removeDrawing: (id) => withHistory((map) => mapFactory.removeDrawing(map, id)),
    setShowGrid: (show) => withHistory((map) => mapFactory.setShowGrid(map, show)),
    setGridShape: (shape) => withHistory((map) => mapFactory.setGridShape(map, shape)),
    setGridSettings: (patch) => withHistory((map) => mapFactory.setGridSettings(map, patch)),
    setGridOffset: (offset) => withHistory((map) => mapFactory.setGridOffset(map, offset)),
    setGridCellSize: (cellSize) => withHistory((map) => mapFactory.setGridCellSize(map, cellSize)),
    setBackground: (background) => withHistory((map) => mapFactory.setBackground(map, background)),
    toggleLayerVisibility: (id) => {
      const { map, selection } = get()
      const isHiding = !map.hiddenLayers.includes(id)
      withHistory((m) => mapFactory.toggleLayerVisibility(m, id))
      // Onda 4, item 24 — `selection` agora é um CONJUNTO: só tira do
      // conjunto os itens da camada que está sendo ocultada, preserva o
      // resto (antes, com um item só, "tirar esse" e "limpar tudo" eram a
      // mesma operação; com N itens não são mais).
      if (isHiding) {
        const remaining = selection.filter((item) => layerForSelection(map, item) !== id)
        if (remaining.length !== selection.length) set({ selection: remaining })
      }
    },
    toggleLayerLock: (id) => {
      const { map, selection } = get()
      const isLocking = !map.lockedLayers.includes(id)
      withHistory((m) => mapFactory.toggleLayerLock(m, id))
      if (isLocking) {
        const remaining = selection.filter((item) => layerForSelection(map, item) !== id)
        if (remaining.length !== selection.length) set({ selection: remaining })
      }
    },
    setPropLayer: (id, layer) => withHistory((map) => mapFactory.setPropLayer(map, id, layer)),
    setWallDoor: (id, door) => withHistory((map) => mapFactory.setWallDoor(map, id, door)),
    setWallKindForWall: (id, kind) => withHistory((map) => mapFactory.setWallKindForWall(map, id, kind)),
    setWallThicknessForWall: (id, thickness) => withHistory((map) => mapFactory.setWallThicknessForWall(map, id, thickness)),
    setWallLineStyleForWall: (id, lineStyle) => withHistory((map) => mapFactory.setWallLineStyleForWall(map, id, lineStyle)),
    addDoorOnWall: (wallId, point, kind) => withHistory((map) =>
      mapFactory.addDoorOnWall(map, wallId, point, DOOR_LENGTH_BY_KIND[kind], kind),
    ),
    addOpeningOnWall: (wallId, point) => withHistory((map) =>
      mapFactory.addOpeningOnWall(map, wallId, point, map.grid),
    ),
    setWallDoorKind: (wallId, kind) => withHistory((map) =>
      mapFactory.setWallDoorKind(map, wallId, kind, DOOR_LENGTH_BY_KIND[kind]),
    ),
    setDoorLocked: (wallId, locked) => withHistory((map) => mapFactory.setDoorLocked(map, wallId, locked)),
    turnWallIntoDoor: (wallId) => {
      const { map, doorKind } = get()
      const wall = map.walls.find((w) => w.id === wallId)
      if (!wall || wall.door !== null) return
      const before = new Set(map.walls.map((w) => w.id))
      const middle = { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 }
      withHistory((m) => mapFactory.addDoorOnWall(m, wallId, middle, DOOR_LENGTH_BY_KIND[doorKind], doorKind))
      // A parede virou de 1 a 3 pedaços novos: seleciona o pedaço que é a porta.
      const door = get().map.walls.find((w) => w.door !== null && !before.has(w.id))
      if (door !== undefined) set({ selection: selectionOfItem({ kind: 'wall', id: door.id }) })
    },
    addStair: (stair) => withHistory((map) => mapFactory.addStair(map, stair)),
    removeStair: (id) => withHistory((map) => mapFactory.removeStair(map, id)),
    moveStair: (id, dx, dy) => withHistory((map) => mapFactory.moveStair(map, id, dx, dy)),
    updateStairPoint: (stairId, segmentIndex, endpoint, x, y) => withHistory((map) =>
      mapFactory.updateStairPoint(map, stairId, segmentIndex, endpoint, x, y),
    ),
    setStairDirection: (id, direction) => withHistory((map) => mapFactory.setStairDirection(map, id, direction)),
    setRoomName: (id, name) => withHistory((map) => mapFactory.setRoomName(map, id, name), `room-name:${id}`),
    setRoomLabelOffsetLive: (id, offset) => set((state) => ({ map: mapFactory.setRoomLabelOffset(state.map, id, offset) })),
    // As fábricas abaixo devolvem o mesmo `map` quando nada muda: sem entrada de histórico vazia.
    setRoomNameHiddenFromPlayers: (id, hidden) => {
      if (mapFactory.setRoomNameHiddenFromPlayers(get().map, id, hidden) === get().map) return
      withHistory((map) => mapFactory.setRoomNameHiddenFromPlayers(map, id, hidden))
    },
    setRoomRoof: (id, roof) => {
      if (mapFactory.setRoomRoof(get().map, id, roof) === get().map) return
      withHistory((map) => mapFactory.setRoomRoof(map, id, roof))
    },
    setItemSecret: (kind, id, secret) => {
      if (mapFactory.setItemSecret(get().map, kind, id, secret) === get().map) return
      withHistory((map) => mapFactory.setItemSecret(map, kind, id, secret))
    },
    setSelectedPin: (id) =>
      set(id === null ? { selectedPinId: null } : { selectedPinId: id, selection: EMPTY_SELECTION, selectedConcealZoneId: null }),
    setPinKind: (kind) => set({ pinKind: kind }),
    setPinIcon: (icon) => set({ pinIcon: icon }),
    addPin: (pin) => withHistory((map) => mapFactory.addPin(map, pin)),
    updatePin: (id, patch) => {
      if (mapFactory.updatePin(get().map, id, patch) === get().map) return
      withHistory((map) => mapFactory.updatePin(map, id, patch))
    },
    movePinLive: (id, x, y) => set((state) => ({ map: mapFactory.setPinPosition(state.map, id, x, y) })),
    removePin: (id) => {
      if (mapFactory.removePin(get().map, id) === get().map) return
      withHistory((map) => mapFactory.removePin(map, id))
      if (get().selectedPinId === id) set({ selectedPinId: null })
    },
    setSelectedConcealZone: (id) =>
      set(id === null ? { selectedConcealZoneId: null } : { selectedConcealZoneId: id, selection: EMPTY_SELECTION, selectedPinId: null }),
    addConcealZone: (zone) => withHistory((map) => mapFactory.addConcealZone(map, zone)),
    updateConcealZone: (id, patch) => {
      if (mapFactory.updateConcealZone(get().map, id, patch) === get().map) return
      withHistory((map) => mapFactory.updateConcealZone(map, id, patch))
    },
    removeConcealZone: (id) => {
      if (mapFactory.removeConcealZone(get().map, id) === get().map) return
      withHistory((map) => mapFactory.removeConcealZone(map, id))
      if (get().selectedConcealZoneId === id) set({ selectedConcealZoneId: null })
    },
    resizeRoomDimensions: (id, wPx, hPx) => withHistory((map) => reparentRooms(mapFactory.resizeRoomDimensions(map, id, wPx, hPx), [id], map)),
    resizeRoomCornerLive: (id, corner, x, y) => set((state) => ({
      map: mapFactory.resizeRoomCornerLive(state.map, id, corner, x, y),
    })),
    rotateRoom: (id, degrees) => {
      const before = get().map
      // Travada não gira, nem por um caminho que esqueça de conferir: o painel
      // desabilita o campo e o canvas não desenha a alça, isto é a última rede.
      const region = before.regions.find((r) => r.id === id)
      if (!region?.room || !canInteract(region)) return
      const rotated = mapFactory.rotateRegion(before, id, degrees)
      if (rotated === before) return
      withHistory(() => settleRoomRotation(rotated, id, before))
    },
    setRoomRotation: (id, degrees) => {
      const region = get().map.regions.find((r) => r.id === id)
      if (!region?.room || !Number.isFinite(degrees)) return
      get().rotateRoom(id, rotationDelta(roomRotationOf(region.room), degrees))
    },
    // Cada quadro em volta do centro: o Esc gira de volta e o soltar põe na grade contando com isso.
    rotateRoomLive: (id, degrees) => set((state) => ({ map: mapFactory.rotateRegion(state.map, id, degrees, 'centro') })),
    finishRoomRotationLive: (before, id) => set((state) => {
      // Na grade antes da sala de fora: `reparentRooms` precisa ver a sala onde ela fica.
      const map = settleRoomRotation(mapFactory.alignQuarterTurnToGrid(state.map, id, before), id, before)
      return map === state.map ? {} : { map }
    }),
    resizeDrawingCornerLive: (drawingId, corner, x, y, modifiers) => set((state) => ({
      map: mapFactory.resizeDrawingCornerLive(state.map, drawingId, corner, x, y, modifiers),
    })),
    resizePropCornerLive: (propId, corner, x, y, modifiers) => set((state) => ({
      map: mapFactory.resizePropCornerLive(state.map, propId, corner, x, y, modifiers),
    })),
    resizeCircleDrawingRadiusLive: (drawingId, x, y) => set((state) => ({
      map: mapFactory.resizeCircleDrawingRadiusLive(state.map, drawingId, x, y),
    })),
    updateTokenLive: (id, patch) => set((state) => ({
      map: { ...state.map, tokens: state.map.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) },
    })),
    setMapScale: (scale) => withHistory((map) => mapFactory.setMapScale(map, scale)),
    setMeasurementMode: (mode) => withHistory((map) => mapFactory.setMeasurementMode(map, mode)),
    setScenarioLink: (value) => withHistory((map) => mapFactory.setScenarioLink(map, value)),
    setPropLinkedPath: (id, path) => withHistory((map) => ({
      ...map,
      props: map.props.map((p) => (p.id === id ? { ...p, linkedMapPath: path } : p)),
    })),
    updateCurvePoint: (drawingId, index, x, y) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) =>
        d.id === drawingId && d.kind === 'curve' ? { ...d, points: d.points.map((p, i) => i === index ? { x, y } : p) } : d,
      ),
    })),
    insertCurvePoint: (drawingId, afterIndex, x, y) => withHistory((map) => mapFactory.insertCurvePoint(map, drawingId, afterIndex, x, y)),
    removeCurvePoint: (drawingId, index) => {
      const before = get().map
      const after = mapFactory.removeCurvePoint(before, drawingId, index)
      if (after === before) return
      withHistory(() => after)
    },
    moveCurve: (drawingId, dx, dy) => withHistory((map) => mapFactory.moveCurve(map, drawingId, dx, dy)),
    updateCurvePointLive: (drawingId, index, x, y) => set((state) => ({
      map: {
        ...state.map,
        drawings: state.map.drawings.map((d) =>
          d.id === drawingId && d.kind === 'curve' ? { ...d, points: d.points.map((p, i) => i === index ? { x, y } : p) } : d,
        ),
      },
    })),
    moveCurveLive: (drawingId, dx, dy) => set((state) => ({ map: mapFactory.moveCurve(state.map, drawingId, dx, dy) })),
    commitDragHistory: (before) => set((state) =>
      changedOnlyByPlayer(state.map, before) ? {} : { past: pushPast(state.past, withLaterPlayerChanges(before)), future: [] },
    ),
    applyPlayerChange: (transform) => {
      const prevMap = get().map
      const nextMap = transform(prevMap)
      if (nextMap === prevMap) return
      playerSeq += 1
      playerLog.push({ seq: playerSeq, transform })
      if (playerLog.length > PLAYER_LOG_CAP) playerLog = playerLog.slice(playerLog.length - PLAYER_LOG_CAP)
      playerSeqOfMap.set(nextMap, playerSeq)
      masterBaseOfMap.set(nextMap, masterBaseOfMap.get(prevMap) ?? prevMap)
      // A letra seguinte do mestre continua o mesmo passo, agora sobre o mapa com a mudança do jogador.
      if (typingEdit !== null && typingEdit.map === prevMap) typingEdit = { key: typingEdit.key, map: nextMap }
      set((state) => ({ map: nextMap, past: state.past.map(transform), future: state.future.map(transform) }))
    },
    updateLinePoint: (drawingId, endpoint, x, y) => {
      const before = get().map
      const after = mapFactory.updateLinePoint(before, drawingId, endpoint, x, y)
      if (after === before) return
      withHistory(() => after)
    },
    moveDrawing: (drawingId, dx, dy) => withHistory((map) => mapFactory.moveDrawing(map, drawingId, dx, dy)),
    moveTokenLive: (id, targetX, targetY) => {
      const { map } = get()
      const token = map.tokens.find((t) => t.id === id)
      if (!token) return
      // Mesma colisão de antes — sem isto o token atravessaria parede durante
      // o arrasto e só "corrigiria" ao soltar. A diferença é que a recusa
      // agora FALA (ver moveTokenExplaining). Barrado, `next` volta pela
      // MESMA referência: o `set` nem acontece e nenhum render acorda.
      const next = moveTokenExplaining(map, token, targetX, targetY)
      if (next !== map) set({ map: next })
    },
    movePropLive: (id, x, y) => set((state) => ({ map: mapFactory.setPropPosition(state.map, id, x, y) })),
    moveWallLive: (wallId, dx, dy) => set((state) => ({ map: mapFactory.moveWall(state.map, wallId, dx, dy) })),
    moveRegionLive: (regionId, dx, dy) => set((state) => ({ map: mapFactory.moveRegion(state.map, regionId, dx, dy) })),
    moveStairLive: (id, dx, dy) => set((state) => ({ map: mapFactory.moveStair(state.map, id, dx, dy) })),
    moveDrawingLive: (drawingId, dx, dy) => set((state) => ({ map: mapFactory.moveDrawing(state.map, drawingId, dx, dy) })),
    updateLightIntensityLive: (id, intensity) => set((state) => ({
      map: { ...state.map, lights: state.map.lights.map((l) => (l.id === id ? { ...l, intensity } : l)) },
    })),
    setDrawingFillAlphaLive: (id, fillAlpha) => set((state) => ({
      map: { ...state.map, drawings: state.map.drawings.map((d) => (d.id === id && 'fillAlpha' in d ? { ...d, fillAlpha } : d)) },
    })),
    setRegionStrokeWidthForRegionLive: (id, strokeWidth) => set((state) => ({
      map: { ...state.map, regions: state.map.regions.map((r) => (r.id === id ? { ...r, strokeWidth } : r)) },
    })),
    moveSelectionLive: (dx, dy) => set((state) =>
      isSelectionEmpty(state.selection)
        ? {}
        : { map: moveAreaSelection(state.map, selectionToAreaSelection(state.selection), dx, dy) },
    ),
    moveSelectionBy: (dx, dy) => {
      const { map, selection } = get()
      if (isSelectionEmpty(selection)) return
      const moved = moveAreaSelection(map, selectionToAreaSelection(selection), dx, dy)
      if (moved === map) return
      const after = reparentRooms(moved, movedRoomIds(moved, selection), map)
      withHistory(() => after)
    },
    updateTextLabel: (id, patch) => withHistory(
      (map) => ({
        ...map,
        drawings: map.drawings.map((d) =>
          d.id === id && d.kind === 'text' ? { ...d, ...patch } : d,
        ),
      }),
      // Só digitar agrupa; cor e tamanho continuam um passo por mudança.
      patch.text !== undefined && patch.color === undefined && patch.fontSize === undefined ? `text:${id}` : undefined,
    ),
    setTextFontFamily: (id, fontFamily) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) =>
        d.id === id && d.kind === 'text' ? { ...d, fontFamily } : d,
      ),
    })),
    setDrawingFillAlpha: (id, fillAlpha) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) => (d.id === id && 'fillAlpha' in d ? { ...d, fillAlpha } : d)),
    })),
    setDrawingColor: (id, color) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) => (d.id === id ? { ...d, color } : d)),
    })),
    setDrawingColorLive: (id, color) => set((state) => ({
      map: { ...state.map, drawings: state.map.drawings.map((d) => (d.id === id ? { ...d, color } : d)) },
    })),
    setDrawingWidth: (id, width) => {
      if (!isValidDrawingWidth(width)) return
      withHistory((map) => ({
        ...map,
        drawings: map.drawings.map((d) => (d.id === id && d.kind !== 'text' ? { ...d, width } : d)),
      }))
    },
    setDrawingWidthLive: (id, width) => {
      if (!isValidDrawingWidth(width)) return
      set((state) => ({
        map: { ...state.map, drawings: state.map.drawings.map((d) => (d.id === id && d.kind !== 'text' ? { ...d, width } : d)) },
      }))
    },
    setDrawingFilled: (id, filled) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) => (d.id === id && 'filled' in d ? { ...d, filled } : d)),
    })),
    setDrawingCap: (id, cap) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) =>
        d.id === id && (d.kind === 'line' || d.kind === 'freehand' || d.kind === 'curve') ? { ...d, cap } : d,
      ),
    })),
    setDrawingDash: (id, dash) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) => (d.id === id && (d.kind === 'line' || d.kind === 'curve') ? { ...d, dash } : d)),
    })),
    convertDrawingToCurve: (id) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) => (d.id === id ? convertLineToCurve(d) : d)),
    })),
    convertDrawingToLine: (id) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) => (d.id === id ? convertCurveToLine(d) : d)),
    })),
    loadMap: (map) => {
      typingEdit = null
      set({ map, selection: EMPTY_SELECTION, selectedConcealZoneId: null, selectedPinId: null, past: [], future: [] })
    },
    undo: () => {
      const { past, map } = get()
      if (past.length === 0) return
      typingEdit = null
      const previous = past[past.length - 1]
      set((state) => ({
        map: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, map],
      }))
    },
    redo: () => {
      const { future, map } = get()
      if (future.length === 0) return
      typingEdit = null
      const next = future[future.length - 1]
      set((state) => ({
        map: next,
        future: state.future.slice(0, -1),
        past: [...state.past, map],
      }))
    },
  }
}))

// Todo mapa que vira o atual guarda quantas mudanças do jogador ele já tem — é
// o ponto de partida de `withLaterPlayerChanges` quando ele for o `before` de
// um gesto. Sempre sobrescreve: um snapshot que volta pelo Ctrl+Z, ou uma cena
// que volta ao editor, já traz tudo o que o jogador fez até agora (as mudanças
// dele passaram por `past`/`future`), e o número antigo faria o gesto seguinte
// reaplicar mudanças velhas — até de outra cena.
playerSeqOfMap.set(useMapStore.getState().map, playerSeq)
useMapStore.subscribe((state) => state.map, (map) => {
  playerSeqOfMap.set(map, playerSeq)
})

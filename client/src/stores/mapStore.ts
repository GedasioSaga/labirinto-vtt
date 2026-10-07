import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  MapData, Wall, Light, Region, Token, Prop, Drawing, DoorState, DoorSide, LayerId, GridSettings,
  Stair, StairDirection, StairShape, DoorKind, MapScale, MeasurementMode, DrawingCap, DrawingDash, FreehandTexture,
  FloorPiece, FloorStyle, MapLine, MapMarker, MapFrame, PinIcon, PinKind, RoomMeta, TokenCondition, MovementRules, HazardKind, AreaTriggerKind, SceneFloor, NivelAlerta,
  TipoDePerigo, RotinaDoNpc, TipoMobilia, VistaMobilia, PassoDaPatrulha,
} from '../types/map'
import * as perigo from '../lib/perigo'
import type { Camera, Point } from '../pixi/world'
import type { DoorMode, DrawingTool, RoomFreeKind, Selection } from '../types/tools'
import type { SnapTargetKind, SnapTargets } from '../pixi/grid'
import type { RoomCorner } from '../lib/roomOps'
import type { Corner, ResizeModifiers } from '../lib/objectTransform'
import type { StairSizePreset } from '../lib/stairs'
import type { TransicaoEscolhida } from '../transicoes/catalogo'
import { FLOOR_LAYER, clampFloorPolygonSides, type FloorShapeKind } from '../lib/floorTool'
import { clampTamanhoDePincel, type Bloco, type TamanhoDePincel } from '../lib/floorBlocks'
import { corDaCamada, type CamadaDoChao } from '../lib/camadasDoChao'
import type { RoomLabelStylePatch } from '../lib/roomLabelStyle'
import type { AparenciaDoMovelPatch } from '../lib/mobilia'
import { paintRevealBrush as paintRevealBrushOnMap, type RevealBrushMode, type RevealBrushWidth } from '../lib/concealBrush'
import * as mapFactory from '../lib/mapFactory'
import { inserirPinturaDeBalde, type BrushMode } from '../lib/baldeDeTinta'
import { abrirVaoDosDoisLados, desabarParede as desabarParedeNoMapa, type CorteNaParede } from '../lib/abrirVao'
import { abrirSalaParaCorredores as abrirSalaParaCorredoresNoMapa, bloqueioDaSala, corredoresDaSala, motivoSemCorredor, type MotivoSemCorredor } from '../lib/abrirCorredor'
import { comEscadaNosPisos, comFichaNoPiso, comSelecaoNoPiso, ehPiso, mapaDoPiso, nascemNoPiso, pisoDe } from '../lib/pisos'
import { pinoNoPiso, selecaoNoPiso } from '../lib/pisoEmEdicao'
import { apagarNaCamada, avisoDaRecusa, encherNaCamada, pintarNaCamada, type ResultadoNaCamada } from '../lib/camadasDoPincel'
import { linkDrawnWallToRoom } from '../lib/roomLink'
import { amarrarAoEstado as amarrarNoMapa, type AmarraDeEstado } from '../lib/estadoDoMundo'
import { comRotina } from '../lib/rotinaDoNpc'
import { chaveDeArrastoDeCor } from '../lib/historicoDeCor'
// Onda 3, item 13 (Frente A) — clonagem pura por tipo de entidade, usada por
// `duplicateSelected` (Ctrl+D) e `insertClonedEntityLive` (Alt+arrastar, ver
// pixi/PixiCanvas.tsx).
import { cloneEntity, cloneLinkedWalls, cloneRoomDescendants, type CloneableEntity, type Offset } from '../lib/entityClone'
import { ancestorsOf, descendantsOf, subtreeIds } from '../lib/roomNesting'
import { roomRotationOf, rotationDelta } from '../lib/roomRotation'
import { canInteract } from '../lib/itemTransform'
import { pullLever } from '../lib/lever'
import { setOutdoor as setOutdoorOnMap } from '../lib/campaignClock'
import { applyPatrolOp, setPassosDoPonto, setPatrolConfig, type ConfigDaPatrulha, type PatrolOp } from '../lib/npcPatrol'
import { toggleTokenCondition as toggleConditionOnMap } from '../lib/tokenConditions'
import { attachCarried, carrierIdOf, releaseCarried } from '../lib/carry'
import { boardVehicle, leaveVehicle, setVehicleSeats as setVehicleSeatsOnMap, vehicleCarrying } from '../lib/vehicle'
import { advanceHazard as advanceHazardOnMap, setRoomHazard as setRoomHazardOnMap } from '../lib/hazards'
import { setSelectionSecret as setSelectionSecretOnMap } from '../lib/batchSecret'
import { setRegionTrigger as setRegionTriggerOnMap, setRegionTriggerRevealed as setRegionTriggerRevealedOnMap } from '../lib/areaTriggers'
import { setArrivalText as setArrivalTextOnMap } from '../lib/arrivalText'
import { advanceConveyors as advanceConveyorsOnMap, setRoomConveyor as setRoomConveyorOnMap, type ConveyorSetting } from '../lib/conveyors'
import type { OwnerVisionRadii } from '../lib/imposedOccupancy'
import { setPinCabin as setPinCabinOnMap } from '../lib/cabins'

/** Ferramentas que criam Sala: mantêm o "Criar sala dentro" armado. */
const ROOM_TOOLS: ReadonlySet<string> = new Set(['room', 'roomCircle', 'roomPolygon', 'roomFree'])
// P10 ("não consigo entrar na casa"): `describeBlockedMove` no lugar de
// `resolveTokenMove` — as duas decidem passar/não passar pelo mesmo
// `findTokenPath`, mas esta diz QUEM barrou e se era porta, que é o que a
// tela precisa para explicar a recusa em vez de devolver o token em silêncio.
import { describeBlockedMove } from '../lib/moveValidation'
import { DEFAULT_PATH_WIDTH_CELLS, DEFAULT_TEXT_FONT_FAMILY, clampPathWidthCells, convertLineToCurve, convertCurveToLine } from '../lib/drawingFactory'
import { moveAreaSelection, areaSelectionBounds, type AreaBounds } from '../lib/areaSelection'
import { pieceBounds } from '../lib/floorSdf'
import { groupItems, NO_GROUPS, ungroupItems, type ItemGroups } from '../lib/itemGroups'
import { alignableUnitCount, alignSelectionItems, distributeSelectionItems, type AlignEdge, type DistributeAxis } from '../lib/alignDistribute'
import {
  BLOCKED_MOVE_TEXT, DOOR_OPENED_BY_MOVE_TEXT, PAREDE_TRAVADA_SEGURA_O_VAO_TEXT, SALA_SECRETA_SEGURA_O_VAO_TEXT, TOOL_CLUSTERS,
  avisoDaSalaQueNaoAbriu, avisoDoCorredorAberto, avisoDoEndireitar,
} from '../components/labels'
import { endireitarMudariaAlgo, endireitarNoMapa, type IgnoradosNoEndireitar } from '../lib/endireitar'
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
  // PISOS NA MESMA CENA: só a parede do piso da ficha barra — a do piso de cima não existe aqui.
  const blocked = describeBlockedMove(from, to, mapaDoPiso(map, pisoDe(token)).walls, map.grid)
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
  /** Liga/desliga 'Janela' numa parede sem porta (`Wall.janela`). Com histórico. */
  setWallJanela: (id: string, janela: boolean) => void
  /** "Deixa passar" / "Deixa ver" de uma parede (`blocksMove`/`blocksLight`). Com histórico. */
  setWallPassagem: (id: string, patch: { blocksMove?: boolean; blocksLight?: boolean }) => void
  /** Cor de uma parede; `null` volta à padrão. Com histórico. */
  setWallColor: (id: string, color: string | null) => void
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
  /** O que o traçado da ferramenta "Sala livre" cria: a sala de sempre
   *  (`'sala'`, o padrão — comportamento idêntico ao de antes deste campo) ou
   *  só as paredes do traçado (`'parede'` → `addWalls`), com a linha podendo
   *  ficar aberta. Preferência de ferramenta, sem histórico e fora do
   *  map.json, mesma classe de `doorMode`/`polygonSides`. */
  roomFreeKind: RoomFreeKind
  setRoomFreeKind: (kind: RoomFreeKind) => void
  /** Liga o arredondar da Sala livre (sala ou parede): cada canto do traçado
   *  vira uma curva suave de trechos retos curtos (`lib/arredondarTracado`).
   *  Mesma classe de preferência de `roomFreeKind`; desligado (o padrão)
   *  mantém os cantos vivos de hoje. */
  roomFreeRounded: boolean
  setRoomFreeRounded: (rounded: boolean) => void
  /** Pincel de revelar: o que o PRÓXIMO arrasto faz (Alt inverte) e a largura
   *  do traço em quadrados. Preferência de ferramenta, sem histórico e fora do
   *  map.json, mesma classe de `doorMode`. */
  revealBrushMode: RevealBrushMode
  setRevealBrushMode: (mode: RevealBrushMode) => void
  revealBrushWidth: RevealBrushWidth
  setRevealBrushWidth: (width: RevealBrushWidth) => void
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
  /** Modo do Pincel: 'traco' desenha traço livre, 'balde' enche de uma vez a
   *  área fechada clicada (`lib/baldeDeTinta.ts`). Preferência de sessão, mesma
   *  classe de `drawTexture`. */
  brushMode: BrushMode
  setBrushMode: (mode: BrushMode) => void
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
  /** Camada da próxima peça de chão (Chão, Mar, Grama...) — vira a cor da
   *  peça ao criar (`lib/camadasDoChao.ts`). Preferência de sessão. */
  floorCamada: CamadaDoChao
  setFloorCamada: (camada: CamadaDoChao) => void
  /** CAMADAS DO PINCEL — a camada em que o pincel e o balde do Chão pintam
   *  (id de `FloorPiece`, ou `NOVA_CAMADA` = a próxima pincelada abre uma).
   *  `null` = a de cima do piso (`alvoDoPincel`). Preferência de sessão: fora
   *  do mapa e do desfazer, como `floorCamada`. */
  camadaDoPincelId: string | null
  setCamadaDoPincel: (id: string | null) => void
  /** Objetos (mobília): o móvel que o próximo clique da ferramenta põe no mapa
   *  (`stores/mobiliaNoPonto.ts`). Preferência de sessão, fora do mapa e do
   *  desfazer — mesma classe de `floorCamada`. */
  mobiliaTipo: TipoMobilia
  setMobiliaTipo: (tipo: TipoMobilia) => void
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
  /** Tinta do balde do Pincel: entra por baixo dos traços, logo depois da
   *  última tinta (`inserirPinturaDeBalde`). */
  pintarComBalde: (pintura: Drawing) => void
  removeDrawing: (id: string) => void
  setCamera: (camera: Camera) => void
  /** Substitui o conjunto inteiro — clique simples (`selectionOfItem`),
   *  Shift+clique (`toggleSelectionItem`) ou limpar (`EMPTY_SELECTION`),
   *  sempre decididos no CHAMADOR (pixi/PixiCanvas.tsx); o store só grava. */
  setSelection: (selection: SelectionSet) => void
  /**
   * Grupos do editor (Ctrl+G), por id de mapa — cada cena guarda os seus.
   * Fora de `MapData` de propósito: grupo é gesto do mestre, não conteúdo do
   * mapa, então não vai para o jogador, não entra no arquivo e não ocupa
   * Ctrl+Z. Mapa sem grupo não tem chave (ausência = nenhum grupo).
   */
  itemGroups: Readonly<Record<string, ItemGroups>>
  /** Junta a seleção atual num grupo do mapa aberto. `false` = menos de 2
   *  itens, nada mudou. */
  groupSelected: () => boolean
  /** Desfaz o grupo de quem está selecionado. `false` = nenhum grupo tocado. */
  ungroupSelected: () => boolean
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
   * Área de transferência do editor (Ctrl+C/Ctrl+X/Ctrl+V). Guarda o MAPA de
   * origem inteiro (referência imutável, custo zero) e os itens copiados: a
   * colagem clona dali, então ela sobrevive à troca de cena e de mapa —
   * `loadMap` e a troca de cena de `adventureStore` não tocam neste campo.
   */
  clipboard: MapClipboard | null
  /** Ctrl+C — guarda a seleção sem mudar o mapa. `false` (e a área de
   *  transferência intacta) sem nada selecionado. */
  copySelected: () => boolean
  /** Ctrl+X — guarda a seleção e a tira do mapa (1 entrada de histórico).
   *  `false`, sem efeito, sem nada selecionado. */
  cutSelected: () => boolean
  /**
   * Ctrl+V — cola a área de transferência com o CENTRO do conjunto no ponto
   * dado (px de mundo), ajustado à grade do mapa aberto, e seleciona as
   * cópias. 1 entrada de histórico. `false`, sem efeito, se não há nada
   * copiado ou se nada do que foi copiado existia no mapa de origem.
   */
  pasteClipboardAt: (point: Point) => boolean
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
  /** Várias paredes num passo só de histórico: o traçado da Parede livre
   *  (Sala livre no modo "Parede") é UM desenho, e um Ctrl+Z tira todos os
   *  trechos de uma vez. Lista vazia não mexe no mapa. */
  addWalls: (walls: Wall[]) => void
  removeWall: (id: string) => void
  addLight: (light: Light) => void
  removeLight: (id: string) => void
  updateLight: (id: string, patch: Partial<Light>) => void
  /** Tocha presa na ficha: prende a luz em `tokenId` ou solta (`null`). Com histórico. */
  setLightAttachment: (id: string, tokenId: string | null) => void
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
  /** Botão direito do pincel de blocos: apaga as células SÓ da camada ativa
   *  (`apagarNaCamada`) numa entrada de histórico só, e NENHUMA quando o
   *  gesto não achou chão para apagar. */
  eraseFloorBlocks: (blocos: Bloco[], cell: number) => void
  /** Pincelada do pincel de blocos: soma as células na camada ativa (ou abre
   *  a camada nova), numa entrada de histórico só. */
  paintFloorBlocks: (blocos: Bloco[], cell: number) => void
  /** Balde do Chão na camada ativa. `'vazio'` = não havia o que encher;
   *  `'recusado'` = camada travada ou escondida (o aviso já saiu). */
  fillFloorArea: (point: { x: number; y: number }) => 'ok' | 'vazio' | 'recusado'
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
  /**
   * CARAVANA: as fichas que acompanham a caravana, SEM histórico. São
   * consequência da edição que as moveu (o arrasto já tem o seu passo), e o
   * Ctrl+Z desta volta ao retrato de antes com o grupo inteiro junto. Lista
   * vazia (ou só de ids que não existem) não mexe no mapa.
   */
  setTokenPositionsLive: (positions: readonly { id: string; x: number; y: number }[]) => void
  moveToken: (id: string, targetX: number, targetY: number) => void
  /**
   * LEVAR FICHA JUNTO: prende `carriedId` a `carrierId` (`lib/carry.ts`), com
   * histórico. Recusado pelas regras (a si mesma, cadeia): nada muda e o
   * desfazer não ganha passo.
   */
  carryToken: (carriedId: string, carrierId: string) => void
  /** Solta `carriedId` de quem o leva, com histórico. Sem vínculo: nada muda. */
  releaseCarriedToken: (carriedId: string) => void
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
   *
   * `health` (barra de vida) entra pelo mesmo caminho: cada número confirmado
   * no painel é um Ctrl+Z, e `null` tira a barra da ficha. `vigia` (olhos do
   * guarda), `npc` (marca de NPC) e `publicName` ("Nome para os jogadores")
   * também: são conteúdo do mapa, Ctrl+Z desfaz. `congelado` (CONGELAR FICHA,
   * o interruptor ao lado do "Travado") desfaz como a trava; o "Congelar
   * todos" do Grupo é mudança de mesa (`adventureStore.congelarFichas`).
   */
  updateToken: (
    id: string,
    patch: Partial<Pick<Token, 'rotation' | 'locked' | 'congelado' | 'hidden' | 'color' | 'size' | 'health' | 'vigia' | 'npc' | 'publicName' | 'playerCharacter'>>,
  ) => void
  /**
   * CONDIÇÃO NA FICHA: marca a condição se ela não está na ficha, desmarca se
   * está (`lib/tokenConditions.ts`) — o clique do painel. Com histórico, mesmo
   * motivo da cor: é conteúdo do mapa, Ctrl+Z desfaz. Ficha que não existe não
   * gasta entrada de histórico. É ação própria, e não um `updateToken` com a
   * lista montada no componente, para dois cliques seguidos alternarem sobre o
   * estado ATUAL da ficha, nunca sobre uma cópia velha da renderização.
   */
  toggleTokenCondition: (id: string, condition: TokenCondition) => void
  /**
   * ROTINA DO NPC gravada pelo painel da ficha (`components/RotinaDaFichaControls.tsx`).
   * Edição do mestre: com histórico, o Ctrl+Z desfaz. `undefined` tira a chave
   * (a ficha grava como a de antes do campo existir).
   */
  setTokenRotina: (id: string, rotina: RotinaDoNpc | undefined) => void
  /**
   * ROTA DE PATRULHA: marcar ponto, tirar o último, apagar a rota ou avançar o
   * NPC um passo (`lib/npcPatrol.ts`). Mesmo contrato de `toggleTokenCondition`:
   * opera sobre a ficha ATUAL do store (o "marcar" grava onde ela está agora),
   * cada clique que muda o mapa é um Ctrl+Z, e o que não muda nada não gasta
   * entrada de histórico.
   */
  patrolAction: (id: string, op: PatrolOp) => void
  /** Velocidade e modo da patrulha automática (`setPatrolConfig`). Mudança do mestre: Ctrl+Z desfaz. */
  setPatrolConfig: (id: string, config: ConfigDaPatrulha) => void
  /** A macro do ponto `indice` da patrulha (`setPassosDoPonto`). Edição do mestre: Ctrl+Z desfaz. */
  setPatrolPassos: (id: string, indice: number, passos: readonly PassoDaPatrulha[]) => void
  /**
   * VEÍCULO: faz da ficha um veículo com `lugares`, troca os lugares, ou
   * desliga (`null`) — `lib/vehicle.ts`. Com histórico: Ctrl+Z desfaz.
   */
  setVehicleSeats: (id: string, lugares: number | null) => void
  /**
   * VEÍCULO: embarca (`aBordo`) ou desce a ficha `tokenId` do veículo
   * `vehicleId`, sobre o estado ATUAL do mapa. `false` = recusado (cheio,
   * não é veículo, a ficha não embarca) e nada mudou. Com histórico.
   */
  setVehiclePassenger: (vehicleId: string, tokenId: string, aBordo: boolean) => boolean
  addProp: (prop: Prop) => void
  removeProp: (id: string) => void
  moveProp: (id: string, x: number, y: number) => void
  /** Mesmo contrato de `updateToken`, para Prop. `playerLabel`/`playerImage`
   *  com `undefined` apagam o rótulo/a imagem do jogador (`stores/propPlayerLook.ts`). */
  updateProp: (id: string, patch: Partial<Pick<Prop, 'rotation' | 'locked' | 'hidden' | 'playerLabel' | 'playerImage'>>) => void
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
  /** Tamanho do mapa em quadros ("Configurações do mapa > Tamanho do mapa").
   *  1 entrada de undo; tamanho igual ou inválido não grava nada. Ver
   *  `mapFactory.setMapSize`. */
  setMapSize: (width: number, height: number) => void
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
  /** PROPRIEDADES DO MÓVEL — "Tipo" do painel: troca o tipo no lugar, tamanho
   *  padrão do tipo novo. Um passo no desfazer; o que não muda nada não entra. */
  trocarTipoDoMovel: (id: string, tipo: TipoMobilia) => void
  /** PROPRIEDADES DO MÓVEL — "Preencher", "Cor" e "Cor da linha". Arrastar no
   *  seletor de uma cor emenda num passo só (como a cor do título da Sala);
   *  "Preencher" e "Padrão" são um passo cada; o que não muda nada não entra. */
  setAparenciaDoMovel: (id: string, patch: AparenciaDoMovelPatch) => void
  /** PROPRIEDADES DO MÓVEL — "Vista" (Frente | Lado) da cadeira e do baú: troca
   *  a vista no lugar, tamanho padrão da vista nova. Um passo no desfazer; a
   *  mesma vista ou um tipo sem vista não entram. */
  trocarVistaDoMovel: (id: string, vista: VistaMobilia) => void
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
  /** "Abrir vão aqui", o gesto sobre a parede no meio da sessão
   *  (`lib/abrirVao.abrirVaoDosDoisLados`): o vão de uma célula sai na parede
   *  clicada E na do prédio encostado, para a ficha passar de verdade. Com
   *  histórico (Ctrl+Z fecha o vão dos dois lados de uma vez). */
  abrirVaoAqui: (wallId: string, point: { x: number; y: number }) => void
  /** "Desabar": a parede clicada cai inteira, e o mesmo trecho da parede do
   *  outro lado junto (`lib/abrirVao.desabarParede`). Com histórico. */
  desabarParede: (wallId: string) => void
  /** "Abrir para o corredor" do painel da Sala (pedido 4 de 30/09/2026,
   *  `lib/abrirCorredor.abrirSalaParaCorredores`): a parede da Sala abre entre
   *  as duas linhas de cada corredor que encosta nela, e as linhas param na
   *  borda. Um Ctrl+Z desfaz tudo. Recusa (porta, trava, Sala secreta) e
   *  "nada a abrir" — inclusive o segundo clique, com tudo já aberto — não
   *  entram no histórico; a recusa diz o porquê num aviso. */
  abrirSalaParaCorredores: (salaId: string) => void
  /** Troca o tipo estrutural de uma porta JÁ CRIADA e redimensiona o vão pra
   *  `DOOR_LENGTH_BY_KIND[kind]`, centrado no meio do vão atual (ver
   *  mapFactory.setWallDoorKind). Com histórico. */
  setWallDoorKind: (wallId: string, kind: DoorKind) => void
  /** Alterna `DoorState.locked` de uma porta já criada. Com histórico. */
  setDoorLocked: (wallId: string, locked: boolean) => void
  /** Liga/desliga `DoorState.secret` (porta secreta; ligar fecha). Com histórico. */
  setDoorSecret: (wallId: string, secret: boolean) => void
  /** Porta de um lado: 'left'/'right' só abre de lá, `null` dos dois (mapFactory.setDoorOpensFrom). Com histórico. */
  setDoorOpensFrom: (wallId: string, side: DoorSide | null) => void
  /** Liga/desliga `DoorState.semEspiar` (`true` = o jogador não espia por esta porta; mapFactory.setDoorSemEspiar). Com histórico. */
  setDoorSemEspiar: (wallId: string, semEspiar: boolean) => void
  /** "Revelar passagem": tira o segredo da porta e o oculto da sala ligada
   *  (mapFactory.revealSecretPassage). Um passo de histórico só. */
  revealSecretPassage: (wallId: string) => void
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
  /** "Reta" / "Espiral" da escada selecionada, com desfazer. */
  setStairShape: (id: string, shape: StairShape) => void
  /** PISOS NA MESMA CENA: o mestre põe a ficha em outro piso. Com histórico; nada muda, nenhuma entrada. */
  setTokenPiso: (id: string, piso: number) => void
  /** PISOS NA MESMA CENA: o piso da escada e/ou o piso a que ela leva (`null` = enfeite). Com histórico. */
  setStairPisos: (id: string, mudanca: { piso?: number; levaAoPiso?: number | null }) => void
  /** TRANSIÇÃO ESPECIAL da escada (`undefined` = nenhuma). Com histórico. */
  setStairTransicao: (id: string, transicao: TransicaoEscolhida | undefined) => void
  /**
   * PISOS NA MESMA CENA — o piso que o EDITOR mostra e em que ele constrói
   * (0 = térreo). Vista do mestre: não vai ao arquivo, não entra no desfazer,
   * não vai ao jogador. Tudo que um passo com histórico cria nasce neste piso
   * (`nascemNoPiso`); o canvas desenha e mira só nele (`mapaDoPiso`).
   */
  pisoAtivo: number
  /** Troca o piso em edição. A seleção sai: item de outro piso fica invisível, e Delete não apaga o que não se vê. */
  setPisoAtivo: (piso: number) => void
  /** "Levar ao piso" da seleção inteira (sala com paredes e sub-salas, ficha com a luz presa). Com histórico; o editor vai junto, com a seleção. */
  moverSelecaoAoPiso: (piso: number) => void
  setRoomName: (id: string, name: string) => void
  /** Arrasto do rótulo da Sala — SEM histórico, par de `commitDragHistory(before)`
   *  no pointerup, mesmo padrão de `resizeRoomCornerLive`. */
  setRoomLabelOffsetLive: (id: string, offset: { x: number; y: number }) => void
  /** A5 — "Jogadores veem o nome" (invertido: `true` esconde). Com histórico. */
  setRoomNameHiddenFromPlayers: (id: string, hidden: boolean) => void
  /** ESTILO DO TÍTULO — plaquinha, tamanho, cor e orientação do nome. Com
   *  histórico; arrastar o tamanho ou a cor vira um passo só de Ctrl+Z. */
  setRoomLabelStyle: (id: string, patch: RoomLabelStylePatch) => void
  /** TETO DE CONSTRUÇÃO — liga/desliga `RoomMeta.roof` da Sala, com histórico. */
  setRoomRoof: (id: string, roof: boolean) => void
  /** CÔMODO LEMBRADO — liga/desliga `RoomMeta.comodo` da Sala, com histórico (ligar desliga o teto). */
  setRoomComodo: (id: string, comodo: boolean) => void
  /** TEXTO DA SALA — "Ao entrar, o jogador lê" / "Nota do mestre". Com histórico, como `setRoomName`. */
  setRoomTexts: (id: string, patch: Partial<Pick<RoomMeta, 'textoAoEntrar' | 'notaDoMestre'>>) => void
  /** FACÇÃO — quem manda na Sala ou distrito (texto em branco tira). Com histórico, como `setRoomName`. */
  setRoomFaccao: (id: string, faccao: string) => void
  /** NÍVEL DE ALERTA da cena (calmo, atento, caçada). Com histórico; o mesmo nível não grava. */
  setSceneAlerta: (nivel: NivelAlerta) => void
  /** ZONA DE PERIGO — pinta a Sala com um perigo, troca ou limpa (`null`). Com histórico. */
  setRoomHazard: (roomId: string, kind: HazardKind | null) => void
  /** ZONA DE PERIGO — "Avançar um passo" pelas portas abertas. Com histórico; nada muda = nada grava. */
  advanceHazard: (hazardId: string) => void
  /** PERIGO QUE SE ALASTRA — fogo ou água novos presos à Sala (`lib/perigo.ts`). Com histórico. */
  porPerigoNaSala: (salaId: string, tipo: TipoDePerigo) => void
  /** Um passo do perigo pelas portas abertas. Com histórico: apertou sem querer, Ctrl+Z desfaz. */
  avancarPerigo: (perigoId: string) => void
  apagarPerigo: (perigoId: string) => void
  /** GATILHO DE ÁREA — marca a Região/Sala como armadilha/alarme, troca ou limpa (`null`). Com histórico. */
  setRegionTrigger: (regionId: string, kind: AreaTriggerKind | null) => void
  /** GATILHO DE ÁREA — "Mostrar aos jogadores". Com histórico; nada muda = nada grava. */
  setRegionTriggerRevealed: (regionId: string, revealed: boolean) => void
  /** SALA ESCURA — liga/desliga `RoomMeta.dark` da Sala, com histórico. */
  setRoomDark: (id: string, dark: boolean) => void
  /** "Raio de visão aqui" da Sala; `null` volta ao raio do jogador. Com histórico. */
  setRoomVisionRadius: (id: string, raio: number | null) => void
  /** ESTEIRA — liga a esteira da Sala (direção e passo), troca ou desliga (`null`). Com histórico. */
  setRoomConveyor: (roomId: string, setting: ConveyorSetting | null) => void
  /**
   * ESTEIRA — "Avançar esteiras": todas as esteiras da cena empurram as fichas. Com histórico; ninguém anda = nada grava.
   * `radii`: o raio que o host aplica a cada ficha com dono na sala aberta (`HostSession.tokenVisionRadii`); sem sala, omitir.
   */
  advanceConveyors: (radii?: OwnerVisionRadii) => void
  /** CABINE CONTÍNUA — liga o pino à próxima parada da cena, troca ou desliga (`null`). Com histórico. */
  setPinCabin: (pinId: string, targetId: string | null) => void
  /** A5 — "Oculto para jogadores" de Token/Região/Objeto/Escada/Desenho. Com histórico. */
  setItemSecret: (kind: mapFactory.SecretKind, id: string, secret: boolean) => void
  /** "Oculto para jogadores" EM LOTE: todos os itens da seleção que aceitam
   *  (`lib/batchSecret.ts`), num passo só do desfazer. Nada mudando, não
   *  gasta entrada de histórico. */
  setSelectionSecret: (secret: boolean) => void
  /** A5 — abre a zona no painel e limpa a seleção comum (`null` fecha). */
  /** Abre o pino no painel e limpa a seleção comum (`null` fecha). */
  setSelectedPin: (id: string | null) => void
  setPinKind: (kind: PinKind) => void
  setPinIcon: (icon: PinIcon | null) => void
  addPin: (pin: MapData['pins'][number]) => void
  /**
   * Troca a lista de pinos inteira num passo só do desfazer. É a ligação do
   * ATALHO NA MESMA CENA (`lib/pinTravel.ts`, `linkWithinScene`): os dois
   * lados da mão dupla moram neste mapa e entram e saem juntos no Ctrl+Z.
   * A mesma lista (mesma referência) não empilha nada.
   */
  replacePins: (pins: MapData['pins']) => void
  /**
   * Troca a lista de pinos SEM passo novo do desfazer: o acerto entra no passo
   * que acabou de ser empilhado. É o guardião da mão dupla
   * (`stores/adventureStore.ts`, `syncTravelLinks`) acertando o par de um
   * ATALHO NA MESMA CENA quando a origem é apagada, deixa de ser de viagem ou
   * é religada a outra cena: o Ctrl+Z desse gesto devolve os dois pinos
   * juntos, ligados como estavam. A mesma lista não muda nada.
   */
  settlePins: (pins: MapData['pins']) => void
  /** Com histórico. `destino` só muda o lado DESTA cena: o par da outra cena é
   *  mantido em dia por `stores/adventureStore.ts`, fora deste desfazer. */
  updatePin: (
    id: string,
    patch: Partial<Pick<MapData['pins'][number], 'kind' | 'icon' | 'semHaste' | 'description' | 'nome' | 'notaDoMestre' | 'image' | 'locked' | 'destino' | 'passagem' | 'passe' | 'mudo' | 'motivo' | 'rotulo' | 'saidas' | 'item' | 'abreCom' | 'presoA' | 'portaLigada' | 'marco' | 'lerDePerto' | 'segredo' | 'colecao' | 'loja' | 'daVista' | 'transicao' | 'cenario'>>,
  ) => void
  /**
   * ALAVANCA: o mestre aciona pelo painel — a porta ligada abre ou fecha, com
   * histórico. Porta trancada ou alavanca solta: nada, nem entrada no desfazer.
   */
  pullLever: (pinId: string) => void
  /** Arrasto do pino — SEM histórico, par de `commitDragHistory(before)` no
   *  pointerup, mesmo padrão de `moveTokenLive`/`movePropLive`. */
  movePinLive: (id: string, x: number, y: number) => void
  removePin: (id: string) => void
  setSelectedConcealZone: (id: string | null) => void
  addConcealZone: (zone: MapData['concealZones'][number]) => void
  updateConcealZone: (id: string, patch: Partial<Pick<MapData['concealZones'][number], 'name' | 'revealed'>>) => void
  removeConcealZone: (id: string) => void
  /**
   * ESTADO DO MUNDO — "Depende do estado" do painel: grava a regra na porta,
   * no pino, na zona ou na luz e já põe o elemento no efeito de `valorAtual`
   * (`null` = estado sem valor conhecido, só grava a regra). Com histórico:
   * amarrar é edição do mestre, desfaz com Ctrl+Z. Quem sabe o valor atual é
   * `useAdventureStore.amarrarAoEstado`, que chama esta.
   */
  amarrarAoEstado: (amarra: AmarraDeEstado, valorAtual: string | null) => void
  /**
   * Um traço inteiro do Pincel de revelar, num Ctrl+Z só. Devolve se o traço
   * passou por alguma zona oculta ativa (o chamador avisa quando não passou).
   * Traço que não muda nada não gasta entrada de histórico.
   */
  paintRevealBrush: (stroke: Point[], radius: number, mode: RevealBrushMode) => boolean
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
  /** Passo máximo e ocupação das fichas dos jogadores na cena aberta; `undefined` = livre. */
  setMovementRules: (movement: MovementRules | undefined) => void
  /** MAPA-MUNDI: o grupo anda como uma caravana só, que o mestre move (`lib/caravan.ts`). Com desfazer. */
  setWorldMap: (worldMap: boolean) => void
  /** TEXTO DE CHEGADA da cena aberta (`lib/arrivalText.ts`); vazio tira. Com desfazer; o mesmo texto não vira passo. */
  setArrivalText: (text: string) => void
  /** RELÓGIO DA CAMPANHA: a cena aberta é externa e escurece à noite (`lib/campaignClock.ts`). Com desfazer. */
  setOutdoor: (outdoor: boolean) => void
  /** MAPA POR ANDARES: de que prédio a cena é andar, e o rótulo da aba do jogador. `undefined` = cena comum. Com desfazer. */
  setSceneFloor: (andar: SceneFloor | undefined) => void
  /** "Visão nesta cena" em quadrados; `undefined` = sem valor. Com histórico. */
  setSceneVisionCells: (cells: number | undefined) => void
  /** "Cena escura" (`MapData.dark`). Com histórico. */
  setSceneDark: (dark: boolean) => void
  /** "Rostos só de perto: N casas" da cena; `null` desliga. Ver `mapFactory.setFaceRangeCells`. */
  setFaceRangeCells: (cells: number | null) => void
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
  /**
   * Alinhar e distribuir os itens selecionados (`lib/alignDistribute.ts`):
   * UMA entrada de histórico por clique — um Ctrl+Z devolve o conjunto
   * inteiro. Sem efeito (nem histórico) quando nada precisa andar: menos de 2
   * itens para alinhar, menos de 3 para distribuir, ou já no lugar.
   */
  alignSelection: (edge: AlignEdge) => void
  distributeSelection: (axis: DistributeAxis) => void
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
  /**
   * Pedido 5 (30/09/2026): "apertando alt, para ela ficar em angulos retos".
   * Deixa deitada ou em pé cada Linha, Caminho e Parede solta da seleção
   * (`lib/endireitar.ts`), num passo SÓ de desfazer para a seleção inteira.
   * Nada mudou (tudo reto, nada aceito, tudo preso ou travado): nada entra no
   * histórico — um Ctrl+Z vazio desfaria outra coisa sem o mestre perceber.
   * Avisa só do que ficou de fora por estar preso ou travado.
   */
  endireitarSelecionados: () => { alterados: number; ignorados: IgnoradosNoEndireitar }
  loadMap: (map: MapData) => void
  undo: () => void
  redo: () => void
}

const initialMap = mapFactory.createEmptyMap('map_local', 'Mapa sem título', 30, 20, 64)

export const GROUP_CREATED_TEXT = 'Grupo criado: um clique em qualquer parte pega tudo. Ctrl+Shift+G desfaz'
export const GROUP_NEEDS_TWO_TEXT = 'Selecione 2 ou mais itens para agrupar'
export const GROUP_UNDONE_TEXT = 'Grupo desfeito'
export const UNGROUP_NOTHING_TEXT = 'Nada do que está selecionado faz parte de um grupo'

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

/** O que Ctrl+C/Ctrl+X guardou (campo `clipboard` do estado). */
export interface MapClipboard {
  /** Mapa de onde os itens vieram, como estava no Ctrl+C/Ctrl+X. */
  readonly source: MapData
  readonly items: SelectionSet
  /** Centro do conjunto, em px de mundo do mapa de origem. */
  readonly center: Point
  /** Veio de Ctrl+X e ainda não foi colado: a primeira colagem devolve o
   *  próprio item, então a Sala mantém o nome sem "(cópia)". */
  readonly cut: boolean
}

/** Retângulo que envolve os itens da seleção — o chão entra pela própria
 *  caixa (`pieceBounds`), que `areaSelectionBounds` não cobre. */
function selectionBounds(map: MapData, selection: SelectionSet): AreaBounds | null {
  const boxes: AreaBounds[] = []
  const rest = areaSelectionBounds(map, selectionToAreaSelection(selection))
  if (rest !== null) boxes.push(rest)
  for (const item of selection) {
    if (item.kind !== 'floor') continue
    const piece = map.floor.find((p) => p.id === item.id)
    if (piece) boxes.push(pieceBounds(piece))
  }
  if (boxes.length === 0) return null
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  }
}

/** Deslocamento em múltiplos da grade: a cópia colada fica alinhada como o original. */
function snapOffsetToGrid(delta: number, grid: number): number {
  return grid > 0 ? Math.round(delta / grid) * grid : delta
}

/**
 * Clona os itens `selection` de `source` para dentro de `target`, deslocados
 * por `offset`. Mesma regra do Ctrl+D: Sala leva paredes e sub-salas; parede
 * de Sala também selecionada e sub-sala de Sala selecionada não se copiam de
 * novo; cópia que caiu dentro de outra Sala vira filha dela. `source` e
 * `target` são o MESMO mapa no Ctrl+D e podem ser mapas diferentes no Ctrl+V
 * (outra cena, outro mapa). `keepRoomNames`: a Sala clonada mantém o nome do
 * original (colar o que foi recortado não é cópia).
 */
function cloneSelectionInto(
  target: MapData,
  source: MapData,
  selection: SelectionSet,
  offset: Offset,
  keepRoomNames: boolean,
): { map: MapData; items: SelectionItem[] } {
  const items: SelectionItem[] = []
  // Cópia de Sala → Sala original, para a cópia herdar as arestas que estavam sobre a mãe.
  const sources: Record<string, string> = {}
  const selectedRegionIds = new Set(selection.filter((item) => item.kind === 'region').map((item) => item.id))
  // Sala selecionada leva as sub-salas: elas e as paredes delas não se copiam de novo.
  const coveredRegionIds = new Set<string>()
  for (const id of selectedRegionIds) {
    for (const d of descendantsOf(source.regions, id)) coveredRegionIds.add(d.id)
  }
  let next = target
  for (const item of selection) {
    if (item.kind === 'region' && coveredRegionIds.has(item.id)) continue
    // Parede de uma Sala que também está selecionada já vem junto com a Sala.
    const wallRegionId = item.kind === 'wall' ? source.walls.find((w) => w.id === item.id)?.regionId ?? '' : ''
    if (item.kind === 'wall' && (selectedRegionIds.has(wallRegionId) || coveredRegionIds.has(wallRegionId))) continue
    const cloned = cloneSelectedEntity(source, item, offset)
    if (!cloned) continue
    const named = keepRoomNames ? withSourceRoomName(cloned, source, item.id) : cloned
    next = addClonedEntity(next, withoutMissingParent(withSourceFloorColor(named, source, next), next))
    if (cloned.kind === 'region') {
      sources[cloned.entity.id] = item.id
      const inner = cloneRoomDescendants(source.regions, source.walls, item.id, cloned.entity.id, offset)
      next = {
        ...next,
        regions: [...next.regions, ...inner.regions],
        walls: [...next.walls, ...cloneLinkedWalls(source.walls, item.id, cloned.entity.id, offset), ...inner.walls],
      }
    }
    items.push({ kind: cloned.kind, id: cloned.entity.id })
  }
  // Cópia de sub-sala que caiu fora da mãe vira sala de topo (ou filha de onde caiu).
  return { map: reparentRooms(next, movedRoomIds(next, items), source, sources), items }
}

/** A Sala clonada volta ao nome do original (sem o "(cópia)" de `cloneRegion`). */
function withSourceRoomName(cloned: CloneableEntity, source: MapData, sourceId: string): CloneableEntity {
  if (cloned.kind !== 'region' || cloned.entity.room === undefined) return cloned
  const original = source.regions.find((r) => r.id === sourceId)?.room
  if (original === undefined) return cloned
  return { kind: 'region', entity: { ...cloned.entity, room: { ...cloned.entity.room, name: original.name } } }
}

/**
 * Pedaço de chão sem cor própria pinta com a cor do chão do MAPA
 * (`floorStyle.fillColor`, ver drawFloor). Colado numa cena de chão de outra
 * cor, ele trocaria de cor sozinho — então leva a cor de onde veio. Buraco
 * (`subtract`) não pinta nada e fica como está. No MESMO mapa não fixa nada:
 * `source` é o mapa da hora do Ctrl+C, e a cor do chão trocada depois vale
 * para o pedaço colado como vale para o resto do chão.
 */
function withSourceFloorColor(cloned: CloneableEntity, source: MapData, target: MapData): CloneableEntity {
  if (source.id === target.id) return cloned
  if (cloned.kind !== 'floor' || cloned.entity.op !== 'add' || cloned.entity.fillColor !== undefined) return cloned
  const color = source.floorStyle.fillColor
  if (color === target.floorStyle.fillColor) return cloned
  return { kind: 'floor', entity: { ...cloned.entity, fillColor: color } }
}

/**
 * Sub-sala colada em outro mapa: a mãe ficou no mapa de origem, e o
 * `parentId` apontaria para um id que não existe aqui (`reparentRoom` só
 * troca a mãe quando acha outra; sem mãe nova, o id órfão ficava).
 */
function withoutMissingParent(cloned: CloneableEntity, target: MapData): CloneableEntity {
  if (cloned.kind !== 'region' || cloned.entity.parentId === undefined) return cloned
  const parentId = cloned.entity.parentId
  if (target.regions.some((r) => r.id === parentId)) return cloned
  const { parentId: _orphan, ...entity } = cloned.entity
  return { kind: 'region', entity }
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
   *
   * `pisoDoQueNasce`: o piso de quem nasce no passo, quando não é o da tela —
   * o passo que só parte uma coisa que já existe, num piso que pode não ser o
   * em edição (ver `abrirSalaParaCorredores`). Ausente = o piso em edição.
   */
  let typingEdit: TypingEdit | null = null
  const withHistory = (updater: (map: MapData) => MapData, typingKey?: string, pisoDoQueNasce?: number) => {
    const prevMap = get().map
    // PISOS NA MESMA CENA: o que o passo criou nasce no piso em edição (ou no `pisoDoQueNasce`).
    const nextMap = nascemNoPiso(prevMap, updater(prevMap), pisoDoQueNasce ?? get().pisoAtivo)
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

  /** Resultado de "Abrir vão aqui"/"Desabar parede" (`lib/abrirVao`). Parede
   *  travada no trecho recusa o gesto: nada muda, nada entra no histórico (um
   *  Ctrl+Z vazio desfaria "nada"), e o mestre ouve o porquê. */
  const aplicarCorteNaParede = (corte: CorteNaParede) => {
    if (corte.travadaNoCaminho) {
      useToastStore.getState().push('info', PAREDE_TRAVADA_SEGURA_O_VAO_TEXT)
      return
    }
    withHistory(() => corte.map)
    if (corte.salaSecretaPoupada) useToastStore.getState().push('info', SALA_SECRETA_SEGURA_O_VAO_TEXT)
  }

  /** Gesto do pincel/balde numa camada: recusa vira aviso; o que não mudou o
   *  mapa não gasta Ctrl+Z (arrastar a borracha por onde não havia chão). */
  const aplicarNaCamada = (resultado: ResultadoNaCamada) => {
    if (resultado.recusa) {
      useToastStore.getState().push('info', avisoDaRecusa(resultado.recusa, resultado.nome ?? 'A camada'))
      return
    }
    const atual = get().map
    if (resultado.map !== atual) withHistory(() => resultado.map)
    if (resultado.ativaId !== get().camadaDoPincelId) set({ camadaDoPincelId: resultado.ativaId })
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
    roomFreeKind: 'sala',
    roomFreeRounded: false,
    revealBrushMode: 'revelar',
    // Um quadrado de largura: o corredor recém-andado, que é o pedido.
    revealBrushWidth: 1,
    drawCap: 'round',
    drawDash: 'solid',
    drawTexture: 'pen',
    brushMode: 'traco',
    lastDrawingTool: 'brush',
    stairSizePreset: 'medium',
    eraseMode: 'objeto',
    floorShapeKind: 'rect',
    floorOp: 'add',
    floorPolygonSides: 6,
    floorBrushSize: 1,
    floorCamada: 'chao',
    camadaDoPincelId: null,
    mobiliaTipo: 'mesa',
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
    itemGroups: {},
    groupSelected: () => {
      const { map, selection, itemGroups } = get()
      const antes = itemGroups[map.id] ?? NO_GROUPS
      const depois = groupItems(antes, selection, `grupo_${crypto.randomUUID()}`)
      // Os avisos não dizem "N itens": o painel já conta, e repetir a contagem
      // num aviso que fica 4 s na tela a faria sobreviver à seleção que descreve.
      if (depois === antes) {
        useToastStore.getState().push('info', GROUP_NEEDS_TWO_TEXT)
        return false
      }
      set({ itemGroups: { ...itemGroups, [map.id]: depois } })
      useToastStore.getState().push('info', GROUP_CREATED_TEXT)
      return true
    },
    ungroupSelected: () => {
      const { map, selection, itemGroups } = get()
      const antes = itemGroups[map.id] ?? NO_GROUPS
      const depois = ungroupItems(antes, selection)
      if (depois === antes) {
        useToastStore.getState().push('info', UNGROUP_NOTHING_TEXT)
        return false
      }
      set({ itemGroups: { ...itemGroups, [map.id]: depois } })
      useToastStore.getState().push('info', GROUP_UNDONE_TEXT)
      return true
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
      let clonedItems: SelectionItem[] = []
      withHistory((m) => {
        const result = cloneSelectionInto(m, m, selection, offset, false)
        clonedItems = result.items
        return result.map
      })
      // Nenhum item existia mais no mapa (janela de corrida): mantém a
      // seleção antiga em vez de trocar por um conjunto vazio.
      if (clonedItems.length > 0) set({ selection: clonedItems })
    },
    clipboard: null,
    copySelected: () => {
      const { map, selection } = get()
      const bounds = selectionBounds(map, selection)
      if (bounds === null) return false
      const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
      set({ clipboard: { source: map, items: selection, center, cut: false } })
      return true
    },
    cutSelected: () => {
      if (!get().copySelected()) return false
      const { clipboard } = get()
      if (clipboard !== null) set({ clipboard: { ...clipboard, cut: true } })
      get().removeSelected()
      return true
    },
    pasteClipboardAt: (point) => {
      const { clipboard, map } = get()
      if (clipboard === null) return false
      const offset = {
        dx: snapOffsetToGrid(point.x - clipboard.center.x, map.grid),
        dy: snapOffsetToGrid(point.y - clipboard.center.y, map.grid),
      }
      const result = cloneSelectionInto(map, clipboard.source, clipboard.items, offset, clipboard.cut)
      if (result.items.length === 0) return false
      withHistory(() => result.map)
      // Depois da primeira colagem, o que foi recortado já voltou: as próximas são cópias.
      set({ selection: result.items, ...(clipboard.cut ? { clipboard: { ...clipboard, cut: false } } : {}) })
      return true
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
    setRoomFreeKind: (kind) => set({ roomFreeKind: kind }),
    setRoomFreeRounded: (rounded) => set({ roomFreeRounded: rounded }),
    setRevealBrushMode: (mode) => set({ revealBrushMode: mode }),
    setRevealBrushWidth: (width) => set({ revealBrushWidth: width }),
    setDrawCap: (cap) => set({ drawCap: cap }),
    setDrawDash: (dash) => set({ drawDash: dash }),
    setDrawTexture: (texture) => set({ drawTexture: texture }),
    setBrushMode: (mode) => set({ brushMode: mode }),
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
    setFloorCamada: (camada) => set({ floorCamada: camada }),
    setCamadaDoPincel: (id) => set({ camadaDoPincelId: id }),
    setMobiliaTipo: (tipo) => set({ mobiliaTipo: tipo }),
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
    // Trecho desenhado sobre o lado de uma Sala do piso em edição vira parede
    // dela (parede parcial); a Sala de outro piso, ali embaixo, não conta.
    addWall: (wall) => withHistory((map) => mapFactory.addWall(map, linkDrawnWallToRoom(mapaDoPiso(map, get().pisoAtivo).regions, wall))),
    addWalls: (walls) => {
      // Traçado vazio não gasta entrada de undo que não desfaz nada.
      if (walls.length === 0) return
      withHistory((map) => {
        // Mesma regra do `addWall`, trecho a trecho: o que cair sobre o lado
        // de uma Sala do piso em edição vira parede dela.
        const regions = mapaDoPiso(map, get().pisoAtivo).regions
        return walls.reduce((next, wall) => mapFactory.addWall(next, linkDrawnWallToRoom(regions, wall)), map)
      })
    },
    removeWall: (id) => withHistory((map) => mapFactory.removeWall(map, id)),
    addLight: (light) => withHistory((map) => mapFactory.addLight(map, light)),
    removeLight: (id) => withHistory((map) => mapFactory.removeLight(map, id)),
    updateLight: (id, patch) => withHistory((map) => ({
      ...map,
      lights: map.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    })),
    setLightAttachment: (id, tokenId) => withHistory((map) => mapFactory.setLightAttachment(map, id, tokenId)),
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
    // A cor da peça emenda os quadros do seletor num passo só (`chaveDeArrastoDeCor`).
    updateFloorPiece: (id, patch) =>
      withHistory((map) => mapFactory.updateFloorPiece(map, id, patch), chaveDeArrastoDeCor(`floor-piece:${id}`, patch, ['fillColor'])),
    updateFloorPieceLive: (id, patch) => set((state) => ({ map: mapFactory.updateFloorPiece(state.map, id, patch) })),
    removeFloorPiece: (id) => withHistory((map) => mapFactory.removeFloorPiece(map, id)),
    reorderFloorPiece: (id, delta) => withHistory((map) => mapFactory.reorderFloorPiece(map, id, delta)),
    moveFloorPiece: (id, dx, dy) => withHistory((map) => mapFactory.moveFloorPiece(map, id, dx, dy)),
    moveFloorPieceLive: (id, dx, dy) => set((state) => ({ map: mapFactory.moveFloorPiece(state.map, id, dx, dy) })),
    // PISOS NA MESMA CENA: pincel, borracha e balde agem só no piso em edição.
    eraseFloorBlocks: (blocos, cell) => {
      const { map, pisoAtivo, camadaDoPincelId } = get()
      aplicarNaCamada(apagarNaCamada(map, pisoAtivo, camadaDoPincelId, blocos, cell, () => crypto.randomUUID()))
    },
    paintFloorBlocks: (blocos, cell) => {
      const { map, pisoAtivo, camadaDoPincelId, floorCamada } = get()
      aplicarNaCamada(pintarNaCamada(map, pisoAtivo, camadaDoPincelId, blocos, cell, { novoId: () => crypto.randomUUID(), cor: corDaCamada(floorCamada) }))
    },
    fillFloorArea: (point) => {
      const { map, pisoAtivo, camadaDoPincelId, floorCamada } = get()
      const resultado = encherNaCamada(map, pisoAtivo, camadaDoPincelId, point, { novoId: () => crypto.randomUUID(), cor: corDaCamada(floorCamada) })
      aplicarNaCamada(resultado)
      if (resultado.recusa) return 'recusado'
      return resultado.vazio ? 'vazio' : 'ok'
    },
    setFloorStyle: (patch) =>
      withHistory((map) => mapFactory.setFloorStyle(map, patch), chaveDeArrastoDeCor('floor-style', patch, ['fillColor', 'strokeColor'])),
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
      // LEVAR FICHA JUNTO: quem leva anda primeiro (e arrasta quem vai junto);
      // ficha levada que TEM casa na lista assenta depois, na casa dela — senão
      // o arrasto de quem leva a tiraria do lugar escolhido.
      const isCarried = (id: string): boolean => {
        const token = map.tokens.find((t) => t.id === id)
        return token !== undefined && carrierIdOf(token) !== null
      }
      const ordered = [...present.filter((p) => !isCarried(p.id)), ...present.filter((p) => isCarried(p.id))]
      withHistory((m) => ordered.reduce((acc, p) => mapFactory.setTokenPosition(acc, p.id, p.x, p.y), m))
    },
    carryToken: (carriedId, carrierId) => {
      const { map } = get()
      const next = attachCarried(map, carriedId, carrierId)
      if (next !== map) withHistory(() => next)
    },
    releaseCarriedToken: (carriedId) => {
      const { map } = get()
      const next = releaseCarried(map, carriedId)
      if (next !== map) withHistory(() => next)
    },
    setTokenPositionsLive: (positions) => {
      const { map } = get()
      const present = positions.filter((p) => map.tokens.some((t) => t.id === p.id))
      if (present.length === 0) return
      set({ map: present.reduce((acc, p) => mapFactory.setTokenPosition(acc, p.id, p.x, p.y), map) })
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
    toggleTokenCondition: (id, condition) => {
      const next = toggleConditionOnMap(get().map, id, condition)
      if (next !== get().map) withHistory(() => next)
    },
    setTokenRotina: (id, rotina) => withHistory((map) => ({
      ...map,
      tokens: map.tokens.map((t) => (t.id === id ? comRotina(t, rotina) : t)),
    })),
    patrolAction: (id, op) => {
      const next = applyPatrolOp(get().map, id, op)
      if (next !== get().map) withHistory(() => next)
    },
    setPatrolConfig: (id, config) => {
      const next = setPatrolConfig(get().map, id, config)
      if (next !== get().map) withHistory(() => next)
    },
    setPatrolPassos: (id, indice, passos) => {
      const next = setPassosDoPonto(get().map, id, indice, passos)
      if (next !== get().map) withHistory(() => next)
    },
    setVehicleSeats: (id, lugares) => {
      const next = setVehicleSeatsOnMap(get().map, id, lugares)
      if (next !== get().map) withHistory(() => next)
    },
    setVehiclePassenger: (vehicleId, tokenId, aBordo) => {
      const { map } = get()
      if (!aBordo) {
        const next = vehicleCarrying(map, tokenId)?.id === vehicleId ? leaveVehicle(map, tokenId) : map
        if (next !== map) withHistory(() => next)
        return true
      }
      const result = boardVehicle(map, vehicleId, tokenId)
      if (!result.ok) return false
      if (result.map !== map) withHistory(() => result.map)
      return true
    },
    addProp: (prop) => withHistory((map) => mapFactory.addProp(map, prop)),
    removeProp: (id) => withHistory((map) => mapFactory.removeProp(map, id)),
    moveProp: (id, x, y) => withHistory((map) => mapFactory.setPropPosition(map, id, x, y)),
    updateProp: (id, patch) => withHistory((map) => ({
      ...map,
      props: map.props.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
    addDrawing: (drawing) => withHistory((map) => mapFactory.addDrawing(map, drawing)),
    pintarComBalde: (pintura) => withHistory((map) => ({ ...map, drawings: inserirPinturaDeBalde(map.drawings, pintura) })),
    removeDrawing: (id) => withHistory((map) => mapFactory.removeDrawing(map, id)),
    setShowGrid: (show) => withHistory((map) => mapFactory.setShowGrid(map, show)),
    setGridShape: (shape) => withHistory((map) => mapFactory.setGridShape(map, shape)),
    setGridSettings: (patch) => withHistory((map) => mapFactory.setGridSettings(map, patch)),
    setGridOffset: (offset) => withHistory((map) => mapFactory.setGridOffset(map, offset)),
    setGridCellSize: (cellSize) => withHistory((map) => mapFactory.setGridCellSize(map, cellSize)),
    setMapSize: (width, height) => {
      const next = mapFactory.setMapSize(get().map, width, height)
      if (next === get().map) return
      withHistory(() => next)
    },
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
    trocarTipoDoMovel: (id, tipo) => {
      if (mapFactory.trocarTipoDoMovel(get().map, id, tipo) === get().map) return
      withHistory((map) => mapFactory.trocarTipoDoMovel(map, id, tipo))
    },
    setAparenciaDoMovel: (id, patch) => {
      if (mapFactory.setAparenciaDoMovel(get().map, id, patch) === get().map) return
      // Só o seletor de UMA cor emenda (o arrasto manda uma cor por quadro, como o
      // da cor do título da Sala); "Preencher" e "Padrão" (null) são um passo cada.
      const chaves = Object.keys(patch)
      const arrastoDeCor = chaves.length === 1 && (typeof patch.cor === 'string' || typeof patch.corDaLinha === 'string')
      const typingKey = arrastoDeCor ? `prop-mobilia:${id}:${chaves[0]}` : undefined
      withHistory((map) => mapFactory.setAparenciaDoMovel(map, id, patch), typingKey)
    },
    trocarVistaDoMovel: (id, vista) => {
      if (mapFactory.trocarVistaDoMovel(get().map, id, vista) === get().map) return
      withHistory((map) => mapFactory.trocarVistaDoMovel(map, id, vista))
    },
    setWallDoor: (id, door) => withHistory((map) => mapFactory.setWallDoor(map, id, door)),
    setWallKindForWall: (id, kind) => withHistory((map) => mapFactory.setWallKindForWall(map, id, kind)),
    setWallThicknessForWall: (id, thickness) => withHistory((map) => mapFactory.setWallThicknessForWall(map, id, thickness)),
    setWallLineStyleForWall: (id, lineStyle) => withHistory((map) => mapFactory.setWallLineStyleForWall(map, id, lineStyle)),
    setWallJanela: (id, janela) => withHistory((map) => mapFactory.setWallJanela(map, id, janela)),
    setWallPassagem: (id, patch) => withHistory((map) => mapFactory.setWallPassagem(map, id, patch)),
    setWallColor: (id, color) => withHistory((map) => mapFactory.setWallColor(map, id, color)),
    addDoorOnWall: (wallId, point, kind) => withHistory((map) =>
      mapFactory.addDoorOnWall(map, wallId, point, DOOR_LENGTH_BY_KIND[kind], kind),
    ),
    addOpeningOnWall: (wallId, point) => withHistory((map) =>
      mapFactory.addOpeningOnWall(map, wallId, point, map.grid),
    ),
    abrirVaoAqui: (wallId, point) => {
      const map = get().map
      aplicarCorteNaParede(abrirVaoDosDoisLados(map, wallId, point, map.grid))
    },
    desabarParede: (wallId) => aplicarCorteNaParede(desabarParedeNoMapa(get().map, wallId)),
    abrirSalaParaCorredores: (salaId) => {
      const map = get().map
      const sala = map.regions.find((r) => r.id === salaId)
      if (sala === undefined) return
      const abertura = abrirSalaParaCorredoresNoMapa(map, salaId)
      const avisos = useToastStore.getState()
      if (abertura.motivo !== 'ok') {
        const aviso = avisoDaSalaQueNaoAbriu(abertura.motivo, bloqueioDaSala(map, sala) === 'travada')
        if (aviso !== null) avisos.push('info', aviso)
        return
      }
      // Os pedaços da parede cortada são da Sala e ficam no piso DELA. A Sala
      // selecionada pode não estar no piso da tela: o Ctrl+Z depois de "Levar
      // ao piso" devolve a Sala e deixa a tela no piso para onde ela tinha ido.
      withHistory(() => abertura.map, undefined, pisoDe(sala))
      avisos.push('info', avisoDoCorredorAberto(sala.room?.name ?? '', abertura.corredores))
      if (abertura.salaSecretaPoupada) avisos.push('info', SALA_SECRETA_SEGURA_O_VAO_TEXT)
    },
    setWallDoorKind: (wallId, kind) => withHistory((map) =>
      mapFactory.setWallDoorKind(map, wallId, kind, DOOR_LENGTH_BY_KIND[kind]),
    ),
    setDoorLocked: (wallId, locked) => withHistory((map) => mapFactory.setDoorLocked(map, wallId, locked)),
    setDoorSecret: (wallId, secret) => withHistory((map) => mapFactory.setDoorSecret(map, wallId, secret)),
    setDoorOpensFrom: (wallId, side) => withHistory((map) => mapFactory.setDoorOpensFrom(map, wallId, side)),
    setDoorSemEspiar: (wallId, semEspiar) => withHistory((map) => mapFactory.setDoorSemEspiar(map, wallId, semEspiar)),
    revealSecretPassage: (wallId) => withHistory((map) => mapFactory.revealSecretPassage(map, wallId)),
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
    setStairShape: (id, shape) => withHistory((map) => mapFactory.setStairShape(map, id, shape)),
    // O editor vai junto com a ficha ou a escada que saiu do piso em edição:
    // sem isso ela sumia da tela e continuava selecionada, no painel.
    setTokenPiso: (id, piso) => {
      if (comFichaNoPiso(get().map, id, piso) === get().map) return
      withHistory((map) => comFichaNoPiso(map, id, piso))
      set({ pisoAtivo: piso })
    },
    setStairPisos: (id, mudanca) => {
      if (comEscadaNosPisos(get().map, id, mudanca) === get().map) return
      withHistory((map) => comEscadaNosPisos(map, id, mudanca))
      const { map, pisoAtivo } = get()
      if (!mapaDoPiso(map, pisoAtivo).stairs.some((s) => s.id === id)) {
        const stair = map.stairs.find((s) => s.id === id)
        if (stair !== undefined) set({ pisoAtivo: pisoDe(stair) })
      }
    },
    setStairTransicao: (id, transicao) => {
      if (mapFactory.updateStairTransicao(get().map, id, transicao) === get().map) return
      withHistory((map) => mapFactory.updateStairTransicao(map, id, transicao))
    },
    pisoAtivo: 0,
    setPisoAtivo: (piso) => {
      if (!ehPiso(piso) || piso === get().pisoAtivo) return
      set({ pisoAtivo: piso, selection: EMPTY_SELECTION, selectedPinId: null, selectedConcealZoneId: null, pendingParentRoomId: null })
    },
    moverSelecaoAoPiso: (piso) => {
      const { map, selection } = get()
      if (!ehPiso(piso) || comSelecaoNoPiso(map, selection, piso) === map) return
      withHistory((current) => comSelecaoNoPiso(current, selection, piso))
      set({ pisoAtivo: piso, pendingParentRoomId: null })
    },
    setRoomName: (id, name) => withHistory((map) => mapFactory.setRoomName(map, id, name), `room-name:${id}`),
    setRoomLabelOffsetLive: (id, offset) => set((state) => ({ map: mapFactory.setRoomLabelOffset(state.map, id, offset) })),
    // As fábricas abaixo devolvem o mesmo `map` quando nada muda: sem entrada de histórico vazia.
    setRoomNameHiddenFromPlayers: (id, hidden) => {
      if (mapFactory.setRoomNameHiddenFromPlayers(get().map, id, hidden) === get().map) return
      withHistory((map) => mapFactory.setRoomNameHiddenFromPlayers(map, id, hidden))
    },
    setRoomLabelStyle: (id, patch) => {
      if (mapFactory.setRoomLabelStyle(get().map, id, patch) === get().map) return
      // Só o slider e o seletor de cor emendam: liga/desliga é um passo cada.
      const continuous = patch.plate === undefined && patch.vertical === undefined
      const typingKey = continuous ? `room-label-style:${id}:${Object.keys(patch).sort().join(',')}` : undefined
      withHistory((map) => mapFactory.setRoomLabelStyle(map, id, patch), typingKey)
    },
    setRoomRoof: (id, roof) => {
      if (mapFactory.setRoomRoof(get().map, id, roof) === get().map) return
      withHistory((map) => mapFactory.setRoomRoof(map, id, roof))
    },
    setRoomComodo: (id, comodo) => {
      if (mapFactory.setRoomComodo(get().map, id, comodo) === get().map) return
      withHistory((map) => mapFactory.setRoomComodo(map, id, comodo))
    },
    setRoomTexts: (id, patch) => {
      if (mapFactory.setRoomTexts(get().map, id, patch) === get().map) return
      withHistory((map) => mapFactory.setRoomTexts(map, id, patch))
    },
    setRoomFaccao: (id, faccao) => {
      if (mapFactory.setRoomFaccao(get().map, id, faccao) === get().map) return
      withHistory((map) => mapFactory.setRoomFaccao(map, id, faccao), `room-faccao:${id}`)
    },
    setSceneAlerta: (nivel) => {
      if (mapFactory.setSceneAlerta(get().map, nivel) === get().map) return
      withHistory((map) => mapFactory.setSceneAlerta(map, nivel))
    },
    setRoomHazard: (roomId, kind) => {
      // Um id só para as duas chamadas: a conferência e a gravação criam a MESMA zona.
      const id = crypto.randomUUID()
      if (setRoomHazardOnMap(get().map, roomId, kind, () => id) === get().map) return
      withHistory((map) => setRoomHazardOnMap(map, roomId, kind, () => id))
    },
    advanceHazard: (hazardId) => {
      if (advanceHazardOnMap(get().map, hazardId) === get().map) return
      withHistory((map) => advanceHazardOnMap(map, hazardId))
    },
    porPerigoNaSala: (salaId, tipo) => {
      const id = `perigo_${crypto.randomUUID()}`
      if (perigo.porPerigoNaSala(get().map, salaId, tipo, id) === get().map) return
      withHistory((map) => perigo.porPerigoNaSala(map, salaId, tipo, id))
    },
    avancarPerigo: (perigoId) => {
      if (perigo.avancarPerigo(get().map, perigoId) === get().map) return
      withHistory((map) => perigo.avancarPerigo(map, perigoId))
    },
    apagarPerigo: (perigoId) => {
      if (perigo.apagarPerigo(get().map, perigoId) === get().map) return
      withHistory((map) => perigo.apagarPerigo(map, perigoId))
    },
    setRegionTrigger: (regionId, kind) => {
      // Um id só para as duas chamadas: a conferência e a gravação criam o MESMO gatilho.
      const id = crypto.randomUUID()
      if (setRegionTriggerOnMap(get().map, regionId, kind, () => id) === get().map) return
      withHistory((map) => setRegionTriggerOnMap(map, regionId, kind, () => id))
    },
    setRegionTriggerRevealed: (regionId, revealed) => {
      if (setRegionTriggerRevealedOnMap(get().map, regionId, revealed) === get().map) return
      withHistory((map) => setRegionTriggerRevealedOnMap(map, regionId, revealed))
    },
    setRoomDark: (id, dark) => {
      if (mapFactory.setRoomDark(get().map, id, dark) === get().map) return
      withHistory((map) => mapFactory.setRoomDark(map, id, dark))
    },
    setRoomVisionRadius: (id, raio) => {
      if (mapFactory.setRoomVisionRadius(get().map, id, raio) === get().map) return
      withHistory((map) => mapFactory.setRoomVisionRadius(map, id, raio))
    },
    setRoomConveyor: (roomId, setting) => {
      // Um id só para as duas chamadas: a conferência e a gravação criam a MESMA esteira.
      const id = crypto.randomUUID()
      if (setRoomConveyorOnMap(get().map, roomId, setting, () => id) === get().map) return
      withHistory((map) => setRoomConveyorOnMap(map, roomId, setting, () => id))
    },
    advanceConveyors: (radii) => {
      if (advanceConveyorsOnMap(get().map, radii) === get().map) return
      withHistory((map) => advanceConveyorsOnMap(map, radii))
    },
    setPinCabin: (pinId, targetId) => {
      if (setPinCabinOnMap(get().map, pinId, targetId) === get().map) return
      withHistory((map) => setPinCabinOnMap(map, pinId, targetId))
    },
    setItemSecret: (kind, id, secret) => {
      if (mapFactory.setItemSecret(get().map, kind, id, secret) === get().map) return
      withHistory((map) => mapFactory.setItemSecret(map, kind, id, secret))
    },
    setSelectionSecret: (secret) => {
      const { map, selection } = get()
      if (setSelectionSecretOnMap(map, selection, secret) === map) return
      withHistory((current) => setSelectionSecretOnMap(current, selection, secret))
    },
    setSelectedPin: (id) =>
      set(id === null ? { selectedPinId: null } : { selectedPinId: id, selection: EMPTY_SELECTION, selectedConcealZoneId: null }),
    setPinKind: (kind) => set({ pinKind: kind }),
    setPinIcon: (icon) => set({ pinIcon: icon }),
    addPin: (pin) => withHistory((map) => mapFactory.addPin(map, pin)),
    replacePins: (pins) => {
      if (get().map.pins === pins) return
      withHistory((map) => ({ ...map, pins }))
    },
    settlePins: (pins) => {
      if (get().map.pins === pins) return
      set((state) => ({ map: { ...state.map, pins } }))
    },
    updatePin: (id, patch) => {
      if (mapFactory.updatePin(get().map, id, patch) === get().map) return
      withHistory((map) => mapFactory.updatePin(map, id, patch))
    },
    pullLever: (pinId) => {
      if (pullLever(get().map, pinId) === get().map) return
      withHistory((map) => pullLever(map, pinId))
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
    amarrarAoEstado: (amarra, valorAtual) => {
      if (amarrarNoMapa(get().map, amarra, valorAtual) === get().map) return
      withHistory((map) => amarrarNoMapa(map, amarra, valorAtual))
    },
    paintRevealBrush: (stroke, radius, mode) => {
      const { map, pisoAtivo } = get()
      const result = paintRevealBrushOnMap(map, stroke, radius, mode, pisoAtivo)
      if (result.map !== map) withHistory(() => result.map)
      return result.hitZone
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
    setMovementRules: (movement) => withHistory((map) => mapFactory.setMovementRules(map, movement)),
    setWorldMap: (worldMap) => withHistory((map) => mapFactory.setWorldMap(map, worldMap)),
    setArrivalText: (text) => {
      // O mesmo texto devolve o mesmo mapa: sem passo vazio no desfazer.
      if (setArrivalTextOnMap(get().map, text) === get().map) return
      withHistory((map) => setArrivalTextOnMap(map, text))
    },
    setOutdoor: (outdoor) => withHistory((map) => setOutdoorOnMap(map, outdoor)),
    setSceneFloor: (andar) => withHistory((map) => mapFactory.setSceneFloor(map, andar)),
    setSceneVisionCells: (cells) => withHistory((map) => mapFactory.setSceneVisionCells(map, cells)),
    setSceneDark: (dark) => {
      if (mapFactory.setSceneDark(get().map, dark) === get().map) return
      withHistory((map) => mapFactory.setSceneDark(map, dark))
    },
    setFaceRangeCells: (cells) => withHistory((map) => mapFactory.setFaceRangeCells(map, cells)),
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
      // PISOS NA MESMA CENA: o jogador levou a ficha a outro piso pela escada.
      // O editor fica onde o mestre está; a ficha, agora invisível aqui, sai
      // da seleção — senão o Delete dele apagaria o que ele não vê. O pino
      // preso a ela (`presoA`) sobe junto, e o selecionado mora fora de `selection`.
      const { selection, selectedPinId, pisoAtivo } = get()
      const naTela = selecaoNoPiso(nextMap, pisoAtivo, selection)
      const pinoNaTela = pinoNoPiso(nextMap, pisoAtivo, selectedPinId)
      set((state) => ({
        map: nextMap,
        past: state.past.map(transform),
        future: state.future.map(transform),
        ...(naTela === selection ? {} : { selection: naTela }),
        ...(pinoNaTela === selectedPinId ? {} : { selectedPinId: pinoNaTela }),
      }))
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
    alignSelection: (edge) => {
      const { map, selection } = get()
      const aligned = alignSelectionItems(map, selection, edge)
      if (aligned === map) return
      const after = reparentRooms(aligned, movedRoomIds(aligned, selection), map)
      withHistory(() => after)
    },
    distributeSelection: (axis) => {
      const { map, selection } = get()
      const distributed = distributeSelectionItems(map, selection, axis)
      if (distributed === map) return
      const after = reparentRooms(distributed, movedRoomIds(distributed, selection), map)
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
    endireitarSelecionados: () => {
      const { map, selection } = get()
      const resultado = endireitarNoMapa(map, selection)
      if (resultado.map !== map) withHistory(() => resultado.map)
      const aviso = avisoDoEndireitar(resultado.ignorados)
      if (aviso !== null) useToastStore.getState().push('info', aviso)
      return { alterados: resultado.alterados, ignorados: resultado.ignorados }
    },
    loadMap: (map) => {
      typingEdit = null
      // Outro mapa começa no térreo: o piso em edição do anterior pode nem existir nele.
      set({ map, selection: EMPTY_SELECTION, selectedConcealZoneId: null, selectedPinId: null, past: [], future: [], pisoAtivo: 0, camadaDoPincelId: null })
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

/** Última contagem de `selectAlignableUnitCount` e as referências de onde ela saiu. */
let lastAlignableCount: { map: MapData; selection: SelectionSet; count: number } | null = null

/**
 * Quantos blocos o painel "Alinhar e distribuir" deve contar: blocos que andam
 * inteiros, não entradas da seleção. O laço numa Sala sozinha põe 5 entradas
 * (a região e as 4 paredes), mas é 1 bloco — com `selection.length` o painel
 * mostraria botões clicáveis que não fazem nada. Seletor de número: o
 * componente só re-renderiza quando a contagem muda.
 *
 * O zustand reavalia o seletor a cada `set()` da store, inclusive o
 * `setCamera` de cada pointermove de pan e de cada evento de roda, e a conta
 * custa ~3 a 11 ms com 40 Salas selecionadas num mapa grande (a09-blocos).
 * Ela só depende de `map` e `selection`, que nunca mudam no lugar (toda ação
 * monta um objeto novo), então com as duas referências iguais vale a última.
 */
export function selectAlignableUnitCount(state: Pick<MapStoreState, 'map' | 'selection'>): number {
  const last = lastAlignableCount
  if (last !== null && last.map === state.map && last.selection === state.selection) return last.count
  const count = alignableUnitCount(state.map, state.selection)
  lastAlignableCount = { map: state.map, selection: state.selection, count }
  return count
}

/** Última resposta de `selectEndireitarMudaria` e as referências de onde ela saiu. */
let ultimoEndireitarMudaria: { map: MapData; selection: SelectionSet; mudaria: boolean } | null = null

/**
 * O botão "Endireitar" do painel aparece (`components/EndireitarControl.tsx`):
 * o clique mudaria alguma coisa na seleção (`lib/endireitar.ts` →
 * `endireitarMudariaAlgo`). Mesmo cuidado de `selectAlignableUnitCount`: o
 * zustand reavalia o seletor a cada `set()`, o `setCamera` do pan inclusive, e
 * a conta procura encostos no piso inteiro (~3,7 ms com uma linha torta num
 * mapa de 14 mil paredes). Ela só depende de `map` e `selection`, então com
 * as duas referências iguais vale a última resposta.
 */
export function selectEndireitarMudaria(state: Pick<MapStoreState, 'map' | 'selection'>): boolean {
  const ultimo = ultimoEndireitarMudaria
  if (ultimo !== null && ultimo.map === state.map && ultimo.selection === state.selection) return ultimo.mudaria
  const mudaria = endireitarMudariaAlgo(state.map, state.selection)
  ultimoEndireitarMudaria = { map: state.map, selection: state.selection, mudaria }
  return mudaria
}

/** O que a linha "Abrir para o corredor" do painel da Sala mostra, e de qual mapa e Sala saiu. */
interface AberturaNoPainel {
  map: MapData
  salaId: string
  corredores: number
  bloqueio: ReturnType<typeof bloqueioDaSala>
  /** Sem corredor nenhum e com parede encostando: o que acertar no desenho. */
  semCorredor: MotivoSemCorredor | null
}

/** Última resposta de `selectCorredoresParaAbrir` / `selectBloqueioParaAbrir` / `selectMotivoSemCorredor`. */
let ultimaAberturaNoPainel: AberturaNoPainel | null = null

/**
 * A conta e o motivo da linha "Abrir para o corredor" numa passada só, com a
 * última resposta guardada. Mesmo cuidado de `selectEndireitarMudaria`: o
 * zustand reavalia o seletor a cada `set()`, o `setCamera` do pan inclusive,
 * e a conta passa por toda parede do piso (`lib/abrirCorredor.ts`). Ela só
 * depende do mapa e da Sala, então com os dois iguais vale a última resposta;
 * quando o mapa muda a cada quadro (a Sala arrastada), o que segura o custo é
 * a lib medir contra a borda só as paredes perto dela.
 */
function aberturaNoPainel(map: MapData, salaId: string): AberturaNoPainel {
  const ultima = ultimaAberturaNoPainel
  if (ultima !== null && ultima.map === map && ultima.salaId === salaId) return ultima
  const sala = map.regions.find((r) => r.id === salaId)
  const corredores = corredoresDaSala(map, salaId).length
  const nova: AberturaNoPainel = {
    map,
    salaId,
    corredores,
    bloqueio: sala === undefined ? null : bloqueioDaSala(map, sala),
    // Com corredor a abrir o motivo seria `null` de qualquer jeito: a segunda
    // leitura da borda só acontece na Sala sem nada a abrir.
    semCorredor: corredores > 0 ? null : motivoSemCorredor(map, salaId),
  }
  ultimaAberturaNoPainel = nova
  return nova
}

/**
 * Quantos corredores o "Abrir para o corredor" ainda abre na Sala
 * (`components/RoomControls.tsx`): CORREDORES, par de linhas, e não paredes, e
 * só os que têm o que fazer — 0 faz a linha sumir. Conta também os que a Sala
 * travada ou secreta recusaria: aí a linha aparece desabilitada, com o motivo
 * (`selectBloqueioParaAbrir`). Seletor de número: o painel só re-renderiza
 * quando a conta muda.
 */
export function selectCorredoresParaAbrir(state: Pick<MapStoreState, 'map'>, salaId: string): number {
  return aberturaNoPainel(state.map, salaId).corredores
}

/** Por que a Sala não abriria para o corredor ('secreta' ou 'travada', `lib/abrirCorredor.bloqueioDaSala`), ou `null`. */
export function selectBloqueioParaAbrir(state: Pick<MapStoreState, 'map'>, salaId: string): ReturnType<typeof bloqueioDaSala> {
  return aberturaNoPainel(state.map, salaId).bloqueio
}

/**
 * Por que a Sala, com parede solta encostando, não tem corredor nenhum
 * (`lib/abrirCorredor.motivoSemCorredor`), ou `null`: com motivo, a linha
 * "Abrir para o corredor" aparece desabilitada e diz o que acertar no desenho;
 * sem motivo e sem conta, some.
 */
export function selectMotivoSemCorredor(state: Pick<MapStoreState, 'map'>, salaId: string): MotivoSemCorredor | null {
  return aberturaNoPainel(state.map, salaId).semCorredor
}

/** O pedaço da store que diz de onde veio o `map` atual. */
interface MapHistoryView {
  map: MapData
  past: readonly MapData[]
  future: readonly MapData[]
}

/**
 * Por que o `map` mudou entre `previous` e `state`: `'history'` quando ele é
 * o retrato do topo do desfazer (`undo`) ou do refazer (`redo`) de antes, e
 * `'edit'` para toda outra mudança (as ações nunca reaproveitam um retrato
 * guardado: sempre montam um mapa novo). `null` = o mapa não mudou.
 */
export function mapChangeCause(state: MapHistoryView, previous: MapHistoryView): 'edit' | 'history' | null {
  if (state.map === previous.map) return null
  const undone = previous.past[previous.past.length - 1]
  const redone = previous.future[previous.future.length - 1]
  return state.map === undone || state.map === redone ? 'history' : 'edit'
}

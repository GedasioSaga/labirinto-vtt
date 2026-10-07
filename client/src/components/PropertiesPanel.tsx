import type { DrawingTool } from '../types/tools'
import type { Drawing, FloorPiece, Light, Prop, Region, Stair, Token, Wall } from '../types/map'
import { LabyrinthMark } from './icons'
import { DrawingStyleControls, type DrawingStyleControlsProps } from './DrawingStyleControls'
import { PathStyleControls, type PathStyleControlsProps } from './PathStyleControls'
import { GridQuickToggles, type GridControlsProps } from './GridControls'
import { MapSettingsButton } from './MapSettingsDialog'
import { CollapsibleSection } from './CollapsibleSection'
import { PropLayerControls, type PropLayerControlsProps } from './PropLayerControls'
import { PropPlayerControls, type PropPlayerControlsProps } from './PropPlayerControls'
import { SelectionControls, type SelectionControlsProps } from './SelectionControls'
import { SelectionHeader, deleteLabelFor, floorActions, selectionIdentity } from './SelectionHeader'
import { NadaSelecionado } from './NadaSelecionado'
import { ADICIONAR_TOKEN, ADICIONAR_TOKEN_DICA, NOVO_TOKEN_CAMPO_ID, NovoTokenForm } from './NovoTokenForm'
import { BotaoMais } from './BotaoMais'
import { EndireitarControl } from './EndireitarControl'
import { WallDoorControls, type WallDoorControlsProps } from './WallDoorControls'
import { DoorKindControls, type DoorKindControlsProps } from './DoorKindControls'
import { DoorModeControls, type DoorModeControlsProps } from './DoorModeControls'
import type { ScenarioLinkControlsProps } from './ScenarioLinkControls'
import type { MovementControlsProps } from './MovementControls'
import type { ArrivalTextControlsProps } from './ArrivalTextControls'
import type { SceneFloorControlsProps } from './SceneFloorControls'
import type { SceneVisionControlsProps } from './SceneVisionControls'
import { TextLabelControls, type TextLabelControlsProps } from './TextLabelControls'
import { RegionJoinField, RegionSmoothButton, RegionStyleControls, type RegionStyleControlsProps } from './RegionStyleControls'
import { AdvancedField, AdvancedSection } from './AdvancedSection'
import { PolygonSidesControls, type PolygonSidesControlsProps } from './PolygonSidesControls'
import { LayersPanel, type LayersPanelProps } from './LayersPanel'
import { TerritorioControls, type TerritorioControlsProps } from './TerritorioControls'
import { TokenImageControls, type TokenImageControlsProps } from './TokenImageControls'
import { tokenPhotoRef } from '../lib/tokenPhoto'
import { selectedTokenColor } from '../lib/tokenColor'
import { TokenNameControls, type TokenNameControlsProps } from './TokenNameControls'
import { TokenColorControls, type TokenColorControlsProps } from './TokenColorControls'
import { TokenPlayerCharacterControls, type TokenPlayerCharacterControlsProps } from './TokenPlayerCharacterControls'
import { TokenSizeControls, type TokenSizeControlsProps } from './TokenSizeControls'
import { TokenNpcControls, type TokenNpcControlsProps } from './TokenNpcControls'
import { TokenSceneCarryControls } from './TokenSceneCarryControls'
import type { TokenCarryWiring } from '../lib/party'
import { TokenHealthControls, type TokenHealthControlsProps } from './TokenHealthControls'
import { selectedTokenSize } from '../lib/tokenSize'
import { readTokenHealth } from '../lib/tokenHealth'
import { TokenConditionControls, type TokenConditionControlsProps } from './TokenConditionControls'
import { tokenConditionsOf } from '../lib/tokenConditions'
import { TokenWatchControls, type TokenWatchControlsProps } from './TokenWatchControls'
import { readTokenWatch } from '../lib/npcWatch'
import { TokenPatrolControls, type TokenPatrolControlsProps } from './TokenPatrolControls'
import { readTokenPatrol } from '../lib/npcPatrol'
import { TokenCarryControls, type TokenCarryControlsProps } from './TokenCarryControls'
import { TokenVehicleControls, type TokenVehicleControlsProps } from './TokenVehicleControls'
import { vehicleOf } from '../lib/vehicle'
import { LightControls, type LightControlsProps } from './LightControls'
import { TokenLightsControls, type TokenLightsControlsProps } from './TokenLightsControls'
import { TokenSeenBy, type TokenSeenByProps } from './TokenSeenBy'
import { WallLineStyleField, WallStyleControls, type WallStyleControlsProps } from './WallStyleControls'
import { StairControls, type StairControlsProps } from './StairControls'
import { LEVAR_AO_PISO_HINT, PisoControls } from './PisoControls'
import { TransicaoSection } from '../transicoes/TransicaoSection'
import type { TransicaoEscolhida } from '../transicoes/catalogo'
import { pisoDe } from '../lib/pisos'
import { RoomControls, type RoomControlsProps } from './RoomControls'
import type { MapScaleControlsProps } from './MapScaleControls'
import type { FaceRangeControlsProps } from './FaceRangeControls'
import type { GridAlignControlsProps } from './GridAlignControls'
import type { MapSizeControlsProps } from './MapSizeControls'
import { ItemTransformControls, type ItemTransformControlsProps } from './ItemTransformControls'
import { MobiliaControls, type MobiliaControlsProps } from './MobiliaControls'
import { ToolPropertiesSection } from './ToolPropertiesSection'
import { LineCapControls, type LineCapControlsProps } from './LineCapControls'
import { LineShapeControls, type LineShapeControlsProps } from './LineShapeControls'
import { FillControls, type FillControlsProps } from './FillControls'
import { AreaSelectionControls, type AreaSelectionControlsProps } from './AreaSelectionControls'
import { AlignDistributeControls, type AlignDistributeControlsProps } from './AlignDistributeControls'
import { FloorPieceControls, type FloorPieceControlsProps } from './FloorPieceControls'
import { FloorStyleControls, type FloorStyleControlsProps } from './FloorStyleControls'
import { FloorLayersList, type FloorLayersListProps } from './FloorLayersList'
import { PlayerSecretControls, type PlayerSecretControlsProps } from './PlayerSecretControls'
import { AreaTriggerControls, type AreaTriggerControlsProps } from './AreaTriggerControls'
import { ConcealZoneControls, type ConcealZoneControlsProps } from './ConcealZoneControls'
import { ConcealBrushControls, type ConcealBrushControlsProps } from './ConcealBrushControls'
import { PinControls, type PinControlsProps } from './PinControls'
import type { PinIconControlsProps } from './PinIconControls'
import { TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'
import { isAxisAlignedRect, roomDimensions } from '../lib/roomOps'
import { roomRotationOf } from '../lib/roomRotation'
import { roomLabelStyleOf } from '../lib/roomLabelStyle'
import { pinKindShowsIcon } from '../lib/pins'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import { panelHeadingTool, type PropertyGroupId } from '../lib/toolProperties'
import { TOOL_LABELS } from './labels'
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import './PropertiesPanel.css'

interface PropertiesPanelProps {
  /** Seção "Cenas" da aventura, montada por quem sabe da aventura (App). */
  scenes?: ReactNode
  /** Seção "Estado do mundo" da aventura (Maré, Giro…), logo abaixo das Cenas. Ausente no mapa solto. */
  worldState?: ReactNode
  /**
   * ESTADO DO MUNDO — "Depende do estado" da porta, do pino de viagem, da zona
   * oculta e da luz selecionados, cada um dentro da seção do seu elemento.
   * Montados pelo App (`DependeDoEstadoControls.tsx`), que sabe da aventura;
   * ausentes no mapa solto.
   */
  estadoDaPorta?: ReactNode
  estadoDoPino?: ReactNode
  estadoDaZona?: ReactNode
  estadoDaLuz?: ReactNode
  /** PERIGO QUE SE ALASTRA — bloco "Perigo" da Sala selecionada (`PerigoDaSalaControls.tsx`), montado pelo App. */
  perigoDaSala?: ReactNode
  /** ROTINA DO NPC da ficha selecionada (`RotinaDaFichaControls.tsx`), montada pelo App; ausente no mapa solto. */
  rotinaDaFicha?: ReactNode
  /** Seção "Objetos do mapa" (busca e "Ir até lá"), montada pelo App, que sabe da câmera e da seleção. */
  objects?: ReactNode
  /**
   * Esconde as categorias de navegação (Cenas, Pinos, Estado do mundo,
   * Objetos do mapa, Marcas, Locais). O App liga com ferramenta na mão ou
   * objeto selecionado, se o mestre deixou a opção ligada
   * (`stores/painelCategoriasStore.ts`).
   */
  esconderCategorias?: boolean
  mapName: string
  mapWidth: number
  mapHeight: number
  mapGrid: number
  /** Troca o tamanho do mapa em quadros ("Configurações do mapa > Tamanho do mapa"). */
  onMapSizeApply: MapSizeControlsProps['onApply']
  activeTool: DrawingTool
  /** F4 (integrador I8) — N2 "painel contextual": saída de
   *  `relevantPropertyGroups` (lib/toolProperties.ts), computada em App.tsx a
   *  partir de `activeTool` + o que está selecionado. Cada seção abaixo
   *  decide visibilidade checando `groups.has('...')` via `ToolPropertiesSection`,
   *  em vez do `show*` booleano disperso que existia antes desta fase. */
  groups: ReadonlySet<PropertyGroupId>
  /** F4 — N2/B2 "ponta da linha". `null` = nenhuma fonte aplicável agora
   *  (nem ferramenta brush/line/curve ativa, nem freehand/line/curve
   *  selecionado) — `ToolPropertiesSection` já esconderia a seção pelo grupo,
   *  mas sem um valor concreto não haveria o que passar pro controle. */
  lineCap: LineCapControlsProps | null
  /** Fase 5 — B2 "dobrar a linha": converte `line` ⇄ `curve` (segmented
   *  control "Reta | Curva", `LineShapeControls.tsx`). `null` = nada
   *  selecionado é `line` nem `curve` (seção não aparece). */
  lineShape: LineShapeControlsProps | null
  /** F4 — N2 "tirar o fundo" (Região/Sala e forma preenchível selecionada). */
  fill: FillControlsProps
  /** F4 — N3 "ferramenta de seleção de área". */
  areaSelection: AreaSelectionControlsProps
  /** Alinhar e distribuir os itens selecionados (aparece com 2+ itens). */
  alignDistribute: AlignDistributeControlsProps
  drawingStyle: DrawingStyleControlsProps
  /** Cor e largura do PRÓXIMO caminho (ferramenta "Caminho"). */
  pathStyle: PathStyleControlsProps
  grid: GridControlsProps
  mapScale: MapScaleControlsProps
  /** "Visão nesta cena", na janela Configurações do mapa. */
  sceneVision: SceneVisionControlsProps
  /** "Rostos só de perto" da cena, na janela Configurações do mapa. */
  faceRange: FaceRangeControlsProps
  gridAlign: GridAlignControlsProps
  layers: LayersPanelProps
  selection: SelectionControlsProps
  scenarioLink: ScenarioLinkControlsProps
  /** "Movimento dos jogadores" na janela Configurações do mapa; ausente, a seção não aparece. */
  movement?: MovementControlsProps
  /** "Texto de chegada" na janela Configurações do mapa; ausente, a seção não aparece. */
  arrivalText?: ArrivalTextControlsProps
  /** MAPA POR ANDARES: "Andar do prédio" na janela Configurações do mapa; ausente, a seção não aparece. */
  sceneFloor?: SceneFloorControlsProps
  selectedWall: Wall | null
  wallDoor: Omit<WallDoorControlsProps, 'door'>
  doorKind: DoorKindControlsProps
  /** "Porta | Vão aberto": o que o clique da ferramenta Porta abre na parede. */
  doorMode: DoorModeControlsProps
  wallStyle: WallStyleControlsProps
  selectedProp: Prop | null
  /** "Objetos | Decoração" do Prop selecionado — mora na seção do objeto. */
  onSetPropLayer: PropLayerControlsProps['onSetPropLayer']
  /** F3, contrato do agente C4 — rotação/travar/ocultar do Objeto selecionado. */
  propTransform: Omit<ItemTransformControlsProps, 'title' | 'rotation' | 'locked' | 'hidden' | 'secret'>
  /** "Rótulo para jogadores" e "Mostrar imagem ao jogador" do Objeto selecionado. */
  propPlayer: Omit<PropPlayerControlsProps, 'label' | 'showImage'>
  /** Seção "Móvel" (tipo e aparência) — só aparece quando o Objeto selecionado é um móvel desenhado. */
  propMobilia: Omit<MobiliaControlsProps, 'prop'>
  selectedToken: Token | null
  tokenName: Omit<TokenNameControlsProps, 'name' | 'publicName'>
  tokenImage: Omit<TokenImageControlsProps, 'image'>
  /** Cor da ficha selecionada — separa aliado de inimigo no meio da luta. */
  tokenColor: Omit<TokenColorControlsProps, 'color'>
  /** Tamanho da ficha em QUADRADOS da grade — para o dragão não ficar do
   *  tamanho do rato. */
  tokenSize: Omit<TokenSizeControlsProps, 'size'>
  /** Marca de NPC — tira a ficha dos botões "Atribuir" de um clique do painel da sala. */
  tokenNpc: Omit<TokenNpcControlsProps, 'npc'>
  /**
   * "Levar para…" da ficha sem dono (NPC, monstro) para outra cena. Ausente =
   * sem o controle (quem monta o painel sem aventura).
   */
  tokenSceneCarry?: TokenCarryWiring
  /** Tocha presa (ou luz solta sob a ficha): o clique no mapa pega a ficha,
   *  então o caminho para a luz é pelo painel da ficha. */
  tokenLights: TokenLightsControlsProps
  /** Vida da ficha selecionada — a barra fina sob ela no mapa. */
  tokenHealth: Omit<TokenHealthControlsProps, 'health'>
  /** Condições da ficha selecionada (envenenado, caído...) — marcadas no meio da luta. */
  tokenCondition: Omit<TokenConditionControlsProps, 'conditions'>
  /** OLHOS DO GUARDA: liga a vigia da ficha de NPC e diz como ela olha. */
  tokenWatch: Omit<TokenWatchControlsProps, 'watch'>
  /** ROTA DE PATRULHA: marca a ronda do NPC e o faz andar um passo. */
  tokenPatrol: Omit<TokenPatrolControlsProps, 'patrol'>
  /** LEVAR FICHA JUNTO: quem leva a ficha selecionada, quem ela leva, a quem pode ser presa, e as ações. */
  tokenCarry: Omit<TokenCarryControlsProps, 'tokenId'>
  /** "Visto por" da ficha sem dono (`HostBridge.tokenSeenBy`). Ausente = sala fechada. */
  tokenSeenBy?: Omit<TokenSeenByProps, 'tokenId'>
  /**
   * VEÍCULO COM LUGARES: faz da ficha um cesto/bote e marca quem está a
   * bordo. Ausente = sem o controle (quem monta o painel sem essa ligação).
   */
  tokenVehicle?: Omit<TokenVehicleControlsProps, 'vehicle'>
  /** F3, contrato do agente C4 — rotação/travar/ocultar do Token selecionado. `onCongeladoChange`: o "Congelado" (CONGELAR FICHA). */
  tokenTransform: Omit<ItemTransformControlsProps, 'title' | 'rotation' | 'locked' | 'congelado' | 'hidden' | 'secret'>
  /** "Ficha de jogador" do Token selecionado: entra na lista de quem chega sem personagem. */
  tokenPlayerCharacter: Omit<TokenPlayerCharacterControlsProps, 'playerCharacter'>
  selectedTextLabel: Extract<Drawing, { kind: 'text' }> | null
  textLabel: Omit<TextLabelControlsProps, 'text' | 'color' | 'fontSize' | 'fontFamily'>
  /** "Travar movimentação" da Região/Sala selecionada (pedido de 18/09/2026:
   *  a ilha arrastada sem querer no meio da sessão). Só `onLockedChange`:
   *  Região não tem `rotation` no schema, o render ignora `hidden`, e
   *  "Oculto para jogadores" já mora no grupo `playerVisibility`. */
  regionTransform: Pick<ItemTransformControlsProps, 'onLockedChange'>
  selectedRegion: Region | null
  regionStyle: RegionStyleControlsProps
  room: Omit<
    RoomControlsProps,
    | 'name'
    | 'shape'
    | 'axisAligned'
    | 'width'
    | 'height'
    | 'rotation'
    | 'locked'
    | 'nameHiddenFromPlayers'
    | 'labelStyle'
    | 'roof'
    | 'comodo'
    | 'textoAoEntrar'
    | 'notaDoMestre'
    | 'dark'
    | 'faccao'
    | 'raioDeVisao'
    // O painel passa o id da Sala selecionada; o resto do "Abrir para o corredor" vem da store.
    | 'salaId'
  > &
    // Obrigatória aqui (opcional no RoomControls): sem ela o campo "Raio de
    // visão aqui" some do painel, e esquecê-la no App tem de quebrar o tipo.
    Required<Pick<RoomControlsProps, 'onRaioDeVisaoChange'>>
  selectedLight: Light | null
  /** `onVistaDeLongeChange` obrigatória pelo mesmo motivo de `room.onRaioDeVisaoChange`. */
  lightControls: Omit<LightControlsProps, 'color' | 'intensity' | 'attachedTokenId' | 'vistaDeLonge'> &
    Required<Pick<LightControlsProps, 'onVistaDeLongeChange'>>
  selectedStair: Stair | null
  stairControls: Omit<StairControlsProps, 'direction' | 'shape'>
  /**
   * PISOS NA MESMA CENA: "Piso" da ficha e da escada, e "Leva ao piso" da
   * escada. Ausente = sem os campos (quem monta o painel sem essa ligação).
   */
  pisos?: PisosWiring
  polygonSides: PolygonSidesControlsProps
  /** Chão por peças — peça selecionada (`null` = nenhuma) e seus controles. */
  selectedFloorPiece: FloorPiece | null
  floorPieceControls: Omit<FloorPieceControlsProps, 'piece' | 'floorFillColor'>
  /** Chão por peças — estilo do chão do mapa (a conversão da imagem fica no menu da ActionBar). */
  floorStyle: FloorStyleControlsProps
  /** "Camadas do chão": peças do chão com cor, trava e ordem. Ausente = sem a seção. */
  floorLayers?: FloorLayersListProps
  /** A5 — "Oculto para jogadores" da Região/Escada/Desenho selecionado; `null` = nenhum. */
  playerSecret: PlayerSecretControlsProps | null
  /** GATILHO DE ÁREA da Região/Sala selecionada; `null` = nenhuma região selecionada. */
  areaTrigger: AreaTriggerControlsProps | null
  /** A5 — zona oculta aberta no painel; `null` = nenhuma. */
  concealZone: ConcealZoneControlsProps | null
  /** Pincel de revelar: "Revelar | Esconder" e a largura do próximo traço. */
  concealBrush: ConcealBrushControlsProps
  /** Ponto de interesse: tipo do próximo pino, ou o pino aberto no painel. */
  pin: Omit<PinControlsProps, 'iconChoice'>
  /** Ícone do ponto de interesse — mesmo par de estados de `pin`. */
  pinIcon: Omit<PinIconControlsProps, 'pinSelected'>
  /** Há um pino aberto no painel — conta como seleção para o título do topo. */
  pinSelected: boolean
  /** Estante de NPCs prontos, global do app (pedido de 18/09/2026). */
  tokenLibrary: TokenLibraryPanelProps
  /** FACÇÃO E ALERTA do mapa inteiro ("Território"). Ausente = sem a seção. */
  territorio?: TerritorioControlsProps
}

/** PISOS NA MESMA CENA — as gravações do painel, por id (a seleção quem sabe é o painel). */
export interface PisosWiring {
  onTokenPisoChange: (tokenId: string, piso: number) => void
  onStairPisosChange: (stairId: string, mudanca: { piso?: number; levaAoPiso?: number | null }) => void
  /** TRANSIÇÃO ESPECIAL da escada que leva a outro piso (`undefined` = nenhuma). */
  onStairTransicaoChange?: (stairId: string, transicao: TransicaoEscolhida | undefined) => void
  /** O piso em edição no editor (o que o canvas mostra e onde o mestre constrói). */
  pisoAtivo: number
  /** "Editar o 1º piso" da escada: leva o editor ao outro lado dela. */
  onEditarPiso: (piso: number) => void
  /** "Levar ao piso" da seleção inteira; o editor vai junto. */
  onLevarSelecaoAoPiso: (piso: number) => void
}

/** Há o que mostrar: o App passa `undefined` quando a seção não existe (mapa solto, sem aventura). */
function presente(no: ReactNode): boolean {
  return no !== undefined && no !== null && typeof no !== 'boolean'
}

/**
 * Inspetor da coluna esquerda: identidade do mapa aberto e as seções de
 * propriedade. Só compõe — cada seção é responsável pelos próprios controles.
 */
export function PropertiesPanel({
  scenes,
  worldState,
  estadoDaPorta,
  estadoDoPino,
  estadoDaZona,
  estadoDaLuz,
  perigoDaSala,
  rotinaDaFicha,
  objects: objetosDaCena,
  esconderCategorias = false,
  mapName,
  mapWidth,
  mapHeight,
  mapGrid,
  onMapSizeApply,
  activeTool,
  groups,
  lineCap,
  lineShape,
  fill,
  areaSelection,
  alignDistribute,
  drawingStyle,
  pathStyle,
  grid,
  mapScale,
  sceneVision,
  faceRange,
  gridAlign,
  layers,
  selection,
  scenarioLink,
  movement,
  arrivalText,
  sceneFloor,
  selectedWall,
  wallDoor,
  doorKind,
  doorMode,
  wallStyle,
  selectedProp,
  onSetPropLayer,
  propTransform,
  propPlayer,
  propMobilia,
  selectedToken,
  tokenName,
  tokenImage,
  tokenColor,
  tokenSize,
  tokenNpc,
  tokenSceneCarry,
  tokenLights,
  tokenHealth,
  tokenCondition,
  tokenWatch,
  tokenPatrol,
  tokenCarry,
  tokenSeenBy,
  tokenVehicle,
  tokenTransform,
  tokenPlayerCharacter,
  selectedTextLabel,
  textLabel,
  regionTransform,
  selectedRegion,
  regionStyle,
  room,
  selectedLight,
  lightControls,
  selectedStair,
  stairControls,
  pisos,
  polygonSides,
  selectedFloorPiece,
  floorPieceControls,
  floorStyle,
  floorLayers,
  playerSecret,
  areaTrigger,
  concealZone,
  concealBrush,
  pin,
  pinIcon,
  pinSelected,
  tokenLibrary,
  territorio,
}: PropertiesPanelProps) {
  // "Só o que importa agora": as seções de mapa inteiro só abrem sozinhas
  // quando o usuário não está mexendo em nada (Selecionar, sem seleção).
  // Depois do primeiro clique no cabeçalho vale o estado lembrado.
  const mapSectionsOpenByDefault = activeTool === 'select' && selection.selection === null
  // "Que ferramenta está na minha mão?": com uma ferramenta armada e nada
  // selecionado, as seções abaixo são as da ferramenta — mas várias delas são
  // compartilhadas (Sala/Sala Circular/Polígono Regular usam a seção "Região")
  // ou nem existem (Escada/Peça abrem em "Seleção de área"), e o primeiro
  // título do painel acabava dizendo o nome de OUTRA ferramenta da barra.
  // `panelHeadingTool` decide QUEM nomear (e quando calar); o rótulo visível é
  // o mesmo `TOOL_LABELS` do botão da barra, para o painel repetir letra por
  // letra o que o usuário acabou de apertar. Zona oculta aberta conta como
  // seleção: `ConcealZoneControls` já é o título "Zona oculta".
  // Pino e zona oculta não entram no resumo `selection.selection`, mas estão
  // selecionados: a faixa do topo não pode dizer "Nada selecionado" em cima
  // do cartão deles.
  const algoSelecionado = selection.selection !== null || concealZone !== null || pinSelected
  const headingTool = panelHeadingTool(activeTool, algoSelecionado)
  const toolHeading = headingTool === null ? undefined : TOOL_LABELS[headingTool]
  // Campos da região que moram no Avançado (fatia 3), em consts para o TS estreitar dentro do render prop.
  const { strokeJoin, onStrokeJoinChange, onSmoothRegion } = regionStyle
  // A faixa da seleção remonta quando o item muda (o menu aberto não passa de um item para o outro).
  const selectedItem = selectedRegion ?? selectedToken ?? selectedWall ?? selectedProp ?? selectedLight ?? selectedStair ?? selectedTextLabel ?? selectedFloorPiece
  const selectionKey = selection.selection === null ? '' : `${selection.selection.kind}:${selection.selection.count}:${selectedItem?.id ?? ''}`
  // "Oculto para jogadores" da região selecionada: vai para o bloco do Travado.
  const regionSecret = selectedRegion !== null && groups.has('playerVisibility') ? playerSecret : null
  // A seção "Parede" muda de lugar conforme o item (ordem por tarefa): montada uma vez só.
  const doorSelected = selectedWall !== null && selectedWall.door !== null
  // "+ TOKEN" NO CABEÇALHO: um lugar só (ver `ADICIONAR_TOKEN`), o mesmo com e
  // sem seleção, fora do corpo que rola. Ele já morou na faixa vazia (que some
  // quando algo é selecionado) e no título do Acervo (a 1500 px do topo com
  // uma ficha aberta). O campo do nome nasce no topo do corpo, logo abaixo da
  // faixa, e não depende da seleção: trocar o item selecionado não apaga o
  // nome digitado.
  const [novoTokenAberto, setNovoTokenAberto] = useState(false)
  const corpoRef = useRef<HTMLDivElement>(null)
  const maisTokenRef = useRef<HTMLButtonElement>(null)
  // Pendências do commit seguinte: o que só dá para fazer depois que o React
  // tirou o campo da tela e trouxe a ficha do token novo.
  const revelarFichaNovaRef = useRef(false)
  const devolverFocoAoMaisTokenRef = useRef(false)
  useLayoutEffect(() => {
    // A ficha do token novo nasce selecionada no TOPO do corpo: com a coluna
    // rolada, quem criou não veria nada mudar. Sem animação: o gesto costuma
    // ser o Enter.
    if (revelarFichaNovaRef.current) {
      revelarFichaNovaRef.current = false
      if (corpoRef.current !== null) corpoRef.current.scrollTop = 0
    }
    // O foco volta a quem abriu o campo (criou ou desistiu), e não cai no
    // body quando o campo sai: o Enter seguinte já abre o próximo token. O
    // botão é o mesmo antes e depois da seleção nova — o cabeçalho não troca.
    if (devolverFocoAoMaisTokenRef.current) {
      devolverFocoAoMaisTokenRef.current = false
      maisTokenRef.current?.focus()
    }
  })
  const abrirNovoToken = () => {
    if (!novoTokenAberto) {
      setNovoTokenAberto(true)
      return
    }
    // Já aberto: o "+ Token" leva de volta ao campo, com o que já foi escrito
    // (o foco no campo seleciona o nome — digitar troca).
    document.getElementById(NOVO_TOKEN_CAMPO_ID)?.focus()
  }
  const confirmarNovoToken = (nome: string) => {
    revelarFichaNovaRef.current = true
    devolverFocoAoMaisTokenRef.current = true
    if (corpoRef.current !== null) corpoRef.current.scrollTop = 0
    setNovoTokenAberto(false)
    selection.onAddToken(nome)
  }
  const desistirDoNovoToken = () => {
    devolverFocoAoMaisTokenRef.current = true
    setNovoTokenAberto(false)
  }
  // GRUPOS DA COLUNA (pedido painel-acervo, fatia 3): abaixo do que está na
  // mão, o que é da AVENTURA e o que é DESTA CENA, cada um com a sua legenda.
  // A ordem já era essa; faltava dizer. Grupo sem linha não monta: legenda
  // solta seria um título de nada. "Esta cena" tem linha quando há os objetos
  // ou o momento de mapa (Chão do mapa e Camadas; Território vai com Camadas).
  const legendaId = useId()
  const legendaAventuraId = `${legendaId}-aventura`
  const legendaCenaId = `${legendaId}-cena`
  const objects = esconderCategorias ? undefined : objetosDaCena
  const temAventura = !esconderCategorias && (presente(scenes) || presente(worldState))
  // Com o pincel/balde na mão a lista aparece mesmo sem chão: é nela que se
  // vê onde a primeira pincelada vai cair ("Camada 1 · pinte para criar").
  const temCamadasDoChao =
    floorLayers !== undefined &&
    (floorLayers.floor.length > 0 || floorLayers.pincel !== undefined) &&
    (groups.has('floorStyle') || groups.has('floorPiece'))
  const temCena = presente(objects) || groups.has('floorStyle') || groups.has('layers') || temCamadasDoChao

  const wallStyleSection = (
    <ToolPropertiesSection group="wallStyle" groups={groups}>
      <WallStyleControls
        {...wallStyle}
        // A última linha do bloco Parede, sem fio (fatia 3): "Ponta e canto" é
        // da parede. `key` pelo id: outra parede selecionada faz o Avançado
        // nascer fechado.
        avancado={
          <AdvancedSection key={selectedWall?.id ?? 'wall-tool'}>
            <AdvancedField hint="Arredondada suaviza a ponta solta e a quina entre paredes; Reta deixa a quina viva.">
              {(hintId) => <WallLineStyleField lineStyle={wallStyle.lineStyle} onLineStyleChange={wallStyle.onLineStyleChange} describedBy={hintId} />}
            </AdvancedField>
          </AdvancedSection>
        }
      />
    </ToolPropertiesSection>
  )
  const linhaDoMapa = `${mapName} · ${mapWidth}×${mapHeight} · ${mapGrid}px`

  return (
    <div className="lb-panel lb-inspector">
      <header className="lb-inspector__head">
        <span className="lb-inspector__mark" aria-hidden="true">
          <LabyrinthMark size={16} />
        </span>
        <span className="lb-inspector__id">
          <h1 className="lb-inspector__wordmark">Labirinto</h1>
          {/* Com o "+ Token" ao lado, a linha corta antes das medidas: o
              `title` traz a linha inteira para o ponteiro. */}
          <span className="lb-inspector__mapname" title={linhaDoMapa}>
            {linhaDoMapa}
          </span>
        </span>
        {/* Criar no cabeçalho, ao lado da engrenagem, como o "novo" da barra
            lateral do Linear e do Notion: à vista com qualquer seleção e em
            qualquer altura da coluna. Fica à mostra com o campo aberto — o
            cabeçalho não muda de desenho, e o clique leva de volta ao campo. */}
        <BotaoMais ref={maisTokenRef} nome={ADICIONAR_TOKEN} texto="Token" dica={ADICIONAR_TOKEN_DICA} onClick={abrirNovoToken} />
        <MapSettingsButton
          grid={grid}
          gridAlign={gridAlign}
          mapScale={mapScale}
          sceneVision={sceneVision}
          faceRange={faceRange}
          scenarioLink={scenarioLink}
          movement={movement}
          mapSize={{ width: mapWidth, height: mapHeight, onApply: onMapSizeApply }}
          sceneFloor={sceneFloor}
          arrivalText={arrivalText}
        />
      </header>

      <div className="lb-inspector__body lb-scroll" ref={corpoRef}>
        {/* Sem nada selecionado, a faixa vazia no mesmo lugar, só com o
            "Nada selecionado". Sem título, como a outra: o primeiro `h2`
            continua sendo o da ferramenta. */}
        {!algoSelecionado && <NadaSelecionado />}
        {/* A faixa da seleção, fixa no topo do corpo: o que está selecionado,
            Apagar e "Mais ações" à vista em qualquer altura da coluna. Sem
            título, então o primeiro `h2` continua sendo o do item. `key`: outro
            item selecionado reabre a faixa com o menu fechado. */}
        {selection.selection !== null && (
          <SelectionHeader
            key={selectionKey}
            identity={selectionIdentity(selection.selection, {
              region: selectedRegion,
              token: selectedToken,
              wall: selectedWall,
              prop: selectedProp,
              light: selectedLight,
              stair: selectedStair,
              textLabel: selectedTextLabel,
              floorPiece: selectedFloorPiece,
            })}
            deleteLabel={deleteLabelFor(selection.selection)}
            onDelete={selection.onRemoveSelected}
            // PISOS NA MESMA CENA: parede, sala, chão, luz, objeto, desenho —
            // tudo sobe ou desce um piso pelo menu, sem ocupar a coluna.
            actions={pisos === undefined ? [] : floorActions(pisos.pisoAtivo, pisos.onLevarSelecaoAoPiso)}
            actionsHint={pisos === undefined ? null : LEVAR_AO_PISO_HINT}
          />
        )}
        {/* O campo do "+ Token" do cabeçalho: logo abaixo da faixa, o mais
            perto do botão que o abriu e acima do que estiver selecionado. Sem
            título, para o primeiro `h2` continuar sendo o do item. */}
        {novoTokenAberto && (
          <NovoTokenForm
            className="lb-section"
            defaultTokenName={selection.defaultTokenName}
            onConfirm={confirmarNovoToken}
            onCancel={desistirDoNovoToken}
          />
        )}
        {/* Endireitar (pedido 5): aparece sozinho quando há Linha, Parede solta
            ou Caminho torto na seleção. Logo depois da faixa e fora das seções
            de ferramenta, porque vale para os três; sem título, para o primeiro
            `h2` continuar sendo o do item. */}
        <EndireitarControl />
        {/* Cabeçalho de contexto: a primeira coisa lida na coluna é o nome da
            ferramenta ativa. O prefixo "Ferramenta ·" separa este título dos
            títulos de bloco que vêm abaixo ("Região", "Preenchimento"), que
            são propriedades e não o nome do que está na mão — mesmo padrão de
            `FloorPieceControls` ("Peça de chão · Retângulo"). */}
        {toolHeading && (
          <section className="lb-section">
            <h2 className="lb-eyebrow">Ferramenta · {toolHeading}</h2>
          </section>
        )}
        {/* Sala no topo: o nome é o que o usuário quer mexer logo depois de
            desenhar, e no fim do painel ele precisava rolar para achar. */}
        {selectedRegion?.room && (
          <ToolPropertiesSection group="room" groups={groups}>
            <RoomControls
              // Um painel por sala: número digitado e não confirmado no campo
              // Rotação vai para a sala DELE, não para a que o clique no mapa
              // acabou de escolher (ver `RoomRotationField`).
              key={selectedRegion.id}
              salaId={selectedRegion.id}
              name={selectedRegion.room.name}
              shape={selectedRegion.room.shape}
              axisAligned={isAxisAlignedRect(selectedRegion.points)}
              width={roomDimensions(selectedRegion.points).width}
              height={roomDimensions(selectedRegion.points).height}
              rotation={roomRotationOf(selectedRegion.room)}
              locked={!!selectedRegion.locked}
              nameHiddenFromPlayers={!!selectedRegion.room.nameHiddenFromPlayers}
              labelStyle={roomLabelStyleOf(selectedRegion.room)}
              roof={!!selectedRegion.room.roof}
              comodo={selectedRegion.room.comodo === true}
              textoAoEntrar={selectedRegion.room.textoAoEntrar ?? ''}
              notaDoMestre={selectedRegion.room.notaDoMestre ?? ''}
              dark={selectedRegion.room.dark === true}
              faccao={selectedRegion.room.faccao ?? ''}
              raioDeVisao={selectedRegion.room.raioDeVisao ?? null}
              {...room}
            />
          </ToolPropertiesSection>
        )}
        {/* Sala e Região, em ordem de tarefa: travar e esconder dos jogadores
            logo depois do bloco do item (eram a 20ª e a 14ª rolagem), num bloco
            só, como na ficha; depois a aparência (Região + Preenchimento), o
            Gatilho, o Perigo que se alastra e, por último, o Avançado. */}
        {selectedRegion && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            <ItemTransformControls
              // Rótulo segue o que o usuário chama a coisa: desenhada pela
              // ferramenta Sala é "Sala", pela ferramenta Região é "Região".
              title={selectedRegion.room ? 'Sala' : 'Região'}
              locked={!!selectedRegion.locked}
              // O "Oculto para jogadores" da região (grupo `playerVisibility`)
              // mora aqui, ao lado do Travado, e não num bloco "Jogadores" à
              // parte: na região ele não traz mais nada (a lista "Quem vê" é
              // só do pino, e o "Revelar para…", só da escada).
              secret={regionSecret?.secret}
              onSecretChange={regionSecret?.onSecretChange}
              {...regionTransform}
            />
          </ToolPropertiesSection>
        )}
        {concealZone && (
          <ToolPropertiesSection group="concealZone" groups={groups}>
            <ConcealZoneControls {...concealZone} />
            {estadoDaZona}
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="revealBrush" groups={groups}>
          <ConcealBrushControls {...concealBrush} />
        </ToolPropertiesSection>
        {/* Perto do topo pelo mesmo motivo da Sala: descrição e imagem são o
            que o mestre quer mexer logo depois de cravar o pino. */}
        <ToolPropertiesSection group="pin" groups={groups}>
          {/* Tipo e ícone num bloco só: o ícone mora logo abaixo do tipo, dentro
              de `PinControls`. Viagem e alavanca têm símbolo próprio (a
              passagem, a alavanca): a grade de ícones não faria nada nelas,
              então `iconChoice` fica nulo para as duas. */}
          <PinControls {...pin} iconChoice={pinKindShowsIcon(pin.kind) ? { ...pinIcon, pinSelected } : null} />
          {estadoDoPino}
        </ToolPropertiesSection>
        {/* Escada, desenho, texto e pino: "Jogadores" logo depois do bloco do
            item, onde sempre esteve. A região o tem lá em cima, junto do Travado. */}
        {!selectedRegion && playerSecret && (
          <ToolPropertiesSection group="playerVisibility" groups={groups}>
            <PlayerSecretControls {...playerSecret} />
          </ToolPropertiesSection>
        )}
        {/* ANTES do Estilo de desenho: com a ferramenta Caminho na mão esta é
            a seção da ferramenta, e a cor tem de ser a primeira coisa lida —
            ela é escolhida antes do primeiro ponto. */}
        <ToolPropertiesSection group="pathStyle" groups={groups}>
          <PathStyleControls {...pathStyle} />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="drawingStyle" groups={groups}>
          <DrawingStyleControls {...drawingStyle} />
        </ToolPropertiesSection>
        {lineCap && (
          <ToolPropertiesSection group="lineCap" groups={groups}>
            <LineCapControls {...lineCap} />
            {lineShape && <LineShapeControls {...lineShape} />}
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="regionStyle" groups={groups}>
          <RegionStyleControls {...regionStyle} />
        </ToolPropertiesSection>
        {/* Preenchimento junto da Região: as duas dizem como a área aparece. */}
        <ToolPropertiesSection group="fill" groups={groups}>
          <FillControls {...fill} />
        </ToolPropertiesSection>
        {/* GATILHO DE ÁREA: decide o que o jogador recebe ao entrar. Região e
            Sala, não só Sala. */}
        {selectedRegion && areaTrigger && (
          <ToolPropertiesSection group="playerVisibility" groups={groups}>
            <section className="lb-section">
              <AreaTriggerControls key={selectedRegion.id} {...areaTrigger} />
            </section>
          </ToolPropertiesSection>
        )}
        {/* PERIGO QUE SE ALASTRA: gesto de mesa (pôr fogo, avançar), não de
            construir a sala — depois do que a sala é. */}
        {selectedRegion?.room && (
          <ToolPropertiesSection group="room" groups={groups}>
            {perigoDaSala}
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="regionStyle" groups={groups}>
          {/* Por último no bloco da região. `key` pelo id: outra região
              selecionada faz o Avançado nascer fechado. */}
          <AdvancedSection key={selectedRegion?.id ?? 'region-tool'}>
            {strokeJoin !== undefined && onStrokeJoinChange && (
              <AdvancedField hint="Define se os vértices do contorno ficam arredondados ou em quina.">
                {(hintId) => <RegionJoinField strokeJoin={strokeJoin} onStrokeJoinChange={onStrokeJoinChange} describedBy={hintId} />}
              </AdvancedField>
            )}
            {onSmoothRegion && (
              <AdvancedField hint="Simplifica e arredonda o contorno inteiro de uma vez; Ctrl+Z desfaz.">
                {(hintId) => <RegionSmoothButton onSmoothRegion={onSmoothRegion} describedBy={hintId} />}
              </AdvancedField>
            )}
          </AdvancedSection>
        </ToolPropertiesSection>
        <ToolPropertiesSection group="polygonSides" groups={groups}>
          <PolygonSidesControls {...polygonSides} />
        </ToolPropertiesSection>
        {selectedTextLabel && (
          <ToolPropertiesSection group="textLabel" groups={groups}>
            <TextLabelControls
              text={selectedTextLabel.text}
              color={selectedTextLabel.color}
              fontSize={selectedTextLabel.fontSize}
              fontFamily={selectedTextLabel.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY}
              {...textLabel}
            />
          </ToolPropertiesSection>
        )}
        {selectedFloorPiece && (
          <ToolPropertiesSection group="floorPiece" groups={groups}>
            {/* A cor do chão do mapa vem de `floorStyle`, que este painel já
                recebe: o swatch da peça sem cor própria mostra ela. */}
            <FloorPieceControls piece={selectedFloorPiece} floorFillColor={floorStyle.style.fillColor} {...floorPieceControls} />
          </ToolPropertiesSection>
        )}
        {/* Parede lisa: "Parede" primeiro, "Virar porta" depois. Porta
            selecionada: o que se mexe na porta (aberta, trancada, tipo) vem
            antes da espessura da parede em que ela mora. */}
        {!doorSelected && wallStyleSection}
        {selectedWall && (
          <ToolPropertiesSection group="wallDoor" groups={groups}>
            <WallDoorControls door={selectedWall.door} {...wallDoor} />
            {selectedWall.door !== null && estadoDaPorta}
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="doorKind" groups={groups}>
          {/* Só com a ferramenta Porta na mão: escolher "Porta ou vão" é
              preferência do PRÓXIMO clique, não propriedade de uma porta já
              selecionada (aí o grupo abre pela outra metade da condição de
              `relevantPropertyGroups`). */}
          {activeTool === 'door' && <DoorModeControls {...doorMode} />}
          {/* Não existe porta normal/dupla/portão de um buraco: com o vão
              escolhido a seção "Tipo de porta" sairia oferecendo uma escolha
              que o clique seguinte ignoraria. */}
          {(activeTool !== 'door' || doorMode.mode === 'porta') && <DoorKindControls {...doorKind} />}
        </ToolPropertiesSection>
        {doorSelected && wallStyleSection}
        {selectedProp && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            <MobiliaControls prop={selectedProp} {...propMobilia} />
            <ItemTransformControls
              title="Objeto"
              rotation={selectedProp.rotation ?? 0}
              locked={!!selectedProp.locked}
              hidden={!!selectedProp.hidden}
              secret={!!selectedProp.secret}
              {...propTransform}
            />
            <PropLayerControls prop={selectedProp} onSetPropLayer={onSetPropLayer} />
            <PropPlayerControls label={selectedProp.playerLabel ?? ''} showImage={selectedProp.playerImage !== undefined} {...propPlayer} />
          </ToolPropertiesSection>
        )}
        {/* A FICHA NA ORDEM DO FIGMA UI3 (peça ficha-em-ordem-de-tarefa):
            primeiro os fixos, o que toda ficha tem e o mestre mexe (quem é,
            vida, tamanho, condições, travar e esconder, cor, foto, de quem é);
            depois os opcionais de comportamento, uma linha cada enquanto
            vazios (vigia, patrulha, levar junto, veículo, rotina, luzes); por
            último onde ela está (piso) e para onde vai (levar para…). O que a
            ficha já tem nasce aberto no lugar dele. */}
        {selectedToken && (
          <ToolPropertiesSection group="tokenImage" groups={groups}>
            {/* Primeiro: é a pergunta que o mestre faz em voz alta no meio da cena. */}
            {tokenSeenBy && <TokenSeenBy tokenId={selectedToken.id} {...tokenSeenBy} />}
            <TokenNameControls key={selectedToken.id} name={selectedToken.name} publicName={selectedToken.publicName} {...tokenName} />
            {/* Vida logo abaixo do nome: é o campo que o mestre mexe a cada
                golpe no meio da luta, e não pode morar embaixo da dobra.
                `key` pela ficha: número digitado e não confirmado vai para a
                ficha DO CAMPO, não para a que o clique no mapa acabou de
                escolher (ver `HealthField`). Prefixada: o nome acima já usa o
                id puro, e chave repetida entre irmãos deixa o campo anterior. */}
            <TokenHealthControls key={`vida-${selectedToken.id}`} health={readTokenHealth(selectedToken.health)} {...tokenHealth} />
            {/* Logo depois do nome e da vida: quem acabou de criar "Dragão"
                quer dizer em seguida que ele é grande — e o tamanho manda no
                que a peça cobre na grade, então vem antes da aparência (cor, foto). */}
            <TokenSizeControls size={selectedTokenSize(selectedToken)} {...tokenSize} />
            {/* O controle de MESA, mexido a cada rodada: uma linha "+" enquanto
                a ficha não tem marca, à vista sem rolar. */}
            <TokenConditionControls conditions={tokenConditionsOf(selectedToken)} {...tokenCondition} />
          </ToolPropertiesSection>
        )}
        {/* Travar e esconder dos jogadores logo depois das condições: também são
            gestos de mesa. Rotação e "Oculto no editor", raros numa ficha
            redonda, ficam no Avançado recolhido da própria seção. `key`: outra
            ficha selecionada faz o Avançado nascer de novo, fechado — ou aberto,
            se ELA estiver girada ou oculta no editor. O título diz o que as
            duas linhas à vista fazem: "Token" já abre a ficha, no Nome, e um
            título repetido não diz onde o mestre está (peça ux-ficha-grupos). */}
        {selectedToken && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            <ItemTransformControls
              key={`transformacao-${selectedToken.id}`}
              title="Trava e visibilidade"
              rotation={selectedToken.rotation ?? 0}
              locked={!!selectedToken.locked}
              congelado={selectedToken.congelado === true}
              hidden={!!selectedToken.hidden}
              secret={!!selectedToken.secret}
              {...tokenTransform}
              rarosNoAvancado
            />
          </ToolPropertiesSection>
        )}
        {selectedToken && (
          <ToolPropertiesSection group="tokenImage" groups={groups}>
            {/* Antes da imagem: a cor é o caminho de um clique, a foto é o de
                abrir o disco. Quem só quer separar aliado de inimigo não
                precisa passar pelo controle caro para chegar no barato. */}
            <TokenColorControls color={selectedTokenColor(selectedToken)} {...tokenColor} />
            {/* `tokenPhotoRef`: foto escolhida pelo JOGADOR vive em `imageData` — sem isto o painel ofereceria "Escolher imagem..." num token que já tem foto. */}
            <TokenImageControls image={tokenPhotoRef(selectedToken)} {...tokenImage} />
            {/* COMPORTAMENTO (peça ux-ficha-grupos): o que a ficha faz na mesa
                mora junto, sob UM título, como cada grupo do painel Design do
                Figma UI3 — e não mais em linhas soltas entre a foto e o piso.
                Primeiro de quem é a ficha ("Ficha de NPC" e "Ficha de
                jogador"), depois os opcionais, uma linha cada enquanto vazios:
                o que o NPC faz na cena (vigia, patrulha), quem vai com quem
                (levar junto, veículo), o que muda com o mundo (rotina) e a luz
                que a ficha carrega. O grupo não se recolhe: cada linha continua
                à vista e a um clique, como antes (TokenControls.css). */}
            <section className="lb-section lb-token-grupo">
              <h2 className="lb-eyebrow">Comportamento</h2>
              <TokenNpcControls npc={selectedToken.npc === true} {...tokenNpc} />
              <TokenPlayerCharacterControls playerCharacter={selectedToken.playerCharacter === true} {...tokenPlayerCharacter} />
              <TokenWatchControls watch={readTokenWatch(selectedToken.vigia)} {...tokenWatch} />
              <TokenPatrolControls patrol={readTokenPatrol(selectedToken.patrulha)} {...tokenPatrol} />
              <TokenCarryControls tokenId={selectedToken.id} {...tokenCarry} />
              {tokenVehicle !== undefined && <TokenVehicleControls vehicle={vehicleOf(selectedToken)} {...tokenVehicle} />}
              {rotinaDaFicha}
              <TokenLightsControls {...tokenLights} />
            </section>
            {/* Onde a ficha está e para onde vai, por último. */}
            {pisos !== undefined && (
              <PisoControls key={`piso-${selectedToken.id}`} piso={pisoDe(selectedToken)} onPisoChange={(piso) => pisos.onTokenPisoChange(selectedToken.id, piso)} />
            )}
            {/* `key`: outra ficha selecionada reabre fechado, sem a escolha da anterior.
                Prefixada: o nome acima já usa o id puro, e chave repetida entre
                irmãos deixa o campo Nome da ficha anterior no painel. */}
            {tokenSceneCarry !== undefined && (
              <TokenSceneCarryControls
                key={`levar-${selectedToken.id}`}
                tokenName={selectedToken.name}
                destinations={tokenSceneCarry.destinations}
                owned={tokenSceneCarry.ownedTokenIds.has(selectedToken.id)}
                onCarry={(sceneId, pinId) => tokenSceneCarry.onCarry(selectedToken.id, sceneId, pinId)}
              />
            )}
          </ToolPropertiesSection>
        )}
        {selectedLight && (
          <ToolPropertiesSection group="lightControls" groups={groups}>
            <LightControls
              color={selectedLight.color}
              intensity={selectedLight.intensity}
              attachedTokenId={selectedLight.attachedTokenId ?? null}
              vistaDeLonge={selectedLight.vistaDeLonge === true}
              {...lightControls}
            />
            {estadoDaLuz}
          </ToolPropertiesSection>
        )}
        {selectedStair && (
          <ToolPropertiesSection group="stairControls" groups={groups}>
            <StairControls direction={selectedStair.direction} shape={selectedStair.shape} {...stairControls} />
            {pisos !== undefined && (
              <PisoControls
                key={`piso-${selectedStair.id}`}
                piso={pisoDe(selectedStair)}
                onPisoChange={(piso) => pisos.onStairPisosChange(selectedStair.id, { piso })}
                levaAoPiso={selectedStair.levaAoPiso ?? null}
                onLevaAoPisoChange={(levaAoPiso) => pisos.onStairPisosChange(selectedStair.id, { levaAoPiso })}
                pisoAtivo={pisos.pisoAtivo}
                onEditarPiso={pisos.onEditarPiso}
              />
            )}
            {/* TRANSIÇÃO ESPECIAL em toda escada: vale para a que leva a outro
                piso desta cena e para a que leva a outra cena (o pino invisível
                dela lê a da escada). A de enfeite mostra a galeria com o aviso. */}
            {pisos?.onStairTransicaoChange !== undefined && (
              <TransicaoSection
                key={`transicao-${selectedStair.id}`}
                transicao={selectedStair.transicao}
                onChange={(transicao) => pisos.onStairTransicaoChange?.(selectedStair.id, transicao)}
                origem="escada"
                semDestino={selectedStair.levaAoPiso === undefined && !stairControls.travel?.linkedSceneId}
              />
            )}
          </ToolPropertiesSection>
        )}
        {/* "Levar ao piso" e Apagar moram na faixa do topo, e o "Nada
            selecionado" também; o "Adicionar token" é o "+ Token" do
            cabeçalho. Aqui fica só o que é de vários itens: seleção de área,
            alinhar e o "Oculto para jogadores" em lote. */}
        <ToolPropertiesSection group="selection" groups={groups}>
          <AreaSelectionControls {...areaSelection} />
          <AlignDistributeControls {...alignDistribute} />
          <SelectionControls secret={selection.secret} />
        </ToolPropertiesSection>
        {/* AVENTURA: Cenas, Pinos, Agenda e Estado do mundo, a aventura
            inteira. Depois do bloco da ferramenta e do objeto: no topo ela
            roubava o primeiro título da coluna, que é o nome do que está na mão
            ou do que acabou de ser desenhado (task-jornada-sala-livre.spec.ts,
            teste 3). A legenda é `<p>`, não `h2`, pelo mesmo motivo — o molde é
            o `MoreSection` do RoomPanel: `role=group` nomeado pela legenda. */}
        {temAventura && (
          <div className="lb-zona" role="group" aria-labelledby={legendaAventuraId}>
            <p id={legendaAventuraId} className="lb-eyebrow lb-zona__rotulo">
              Aventura
            </p>
            {scenes}
            {worldState}
          </div>
        )}
        {/* ESTA CENA: o que é da cena aberta, do que há nela (Objetos do mapa,
            Marcas, Locais) ao jeito dela (Território, Chão do mapa, Camadas). */}
        {temCena && (
          <div className="lb-zona" role="group" aria-labelledby={legendaCenaId}>
            <p id={legendaCenaId} className="lb-eyebrow lb-zona__rotulo">
              Esta cena
            </p>
            {/* Os objetos DA cena aberta. Sem grupo de ferramenta: é navegação,
                como as Cenas, e nasce recolhida — com uma ferramenta de desenho
                na mão ela é só uma linha. */}
            {objects}
            {/* FACÇÃO E ALERTA do mapa inteiro. Mesmo grupo das Camadas (é
                filtro de vista e estado da cena, não ferramenta), antes de
                "Chão do mapa". Nasce fechada mesmo sem seleção (peça
                mapa-inteiro-enxuto): o mestre mexe nela durante o jogo, não na
                primeira tela do mapa; a escolha dele fica lembrada
                (`lb-section:territorio`). */}
            {territorio !== undefined && (
              <ToolPropertiesSection group="layers" groups={groups}>
                <CollapsibleSection id="territorio" title="Território" defaultOpen={false}>
                  <TerritorioControls {...territorio} />
                </CollapsibleSection>
              </ToolPropertiesSection>
            )}
            <ToolPropertiesSection group="floorStyle" groups={groups}>
              {/* "Chão do mapa", não "Chão": o botão da ferramenta na barra já se
                  chama "Chão" e dois botões com o mesmo nome confundem leitor de
                  tela (e o getByRole dos specs). */}
              <CollapsibleSection id="floor" title="Chão do mapa" defaultOpen={mapSectionsOpenByDefault}>
                <FloorStyleControls {...floorStyle} />
              </CollapsibleSection>
            </ToolPropertiesSection>
            {/* "Camadas do chão" é das PEÇAS (ordem, trava, trocar de peça):
                fica também com uma peça selecionada, quando o "Chão do mapa"
                acima já saiu. */}
            {temCamadasDoChao && floorLayers !== undefined && (
              <CollapsibleSection id="floor-layers" title="Camadas do chão" defaultOpen>
                <FloorLayersList {...floorLayers} />
              </CollapsibleSection>
            )}
            <ToolPropertiesSection group="layers" groups={groups}>
              <CollapsibleSection id="layers" title="Camadas" defaultOpen={mapSectionsOpenByDefault}>
                <LayersPanel {...layers} quickToggles={<GridQuickToggles {...grid} />} />
              </CollapsibleSection>
            </ToolPropertiesSection>
          </div>
        )}
        {/* O Acervo, por último e fora dos grupos: a estante de NPCs é do app,
            não da aventura nem da cena. Sem `ToolPropertiesSection` e sem
            `CollapsibleSection`: não pertence a ferramenta nem a seleção
            nenhuma, e é para estar à mão justamente quando nada está
            selecionado. */}
        <TokenLibraryPanel {...tokenLibrary} />
      </div>
    </div>
  )
}

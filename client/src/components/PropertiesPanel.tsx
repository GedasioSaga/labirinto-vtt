import type { DrawingTool } from '../types/tools'
import type { Drawing, FloorPiece, Light, Prop, Region, Stair, Token, Wall } from '../types/map'
import { LabyrinthMark } from './icons'
import { DrawingStyleControls, type DrawingStyleControlsProps } from './DrawingStyleControls'
import { GridControls, type GridControlsProps } from './GridControls'
import { SelectionControls, type SelectionControlsProps } from './SelectionControls'
import { WallDoorControls, type WallDoorControlsProps } from './WallDoorControls'
import { DoorKindControls, type DoorKindControlsProps } from './DoorKindControls'
import { ScenarioLinkControls, type ScenarioLinkControlsProps } from './ScenarioLinkControls'
import { PortalControls, type PortalControlsProps } from './PortalControls'
import { TextLabelControls, type TextLabelControlsProps } from './TextLabelControls'
import { RegionStyleControls, type RegionStyleControlsProps } from './RegionStyleControls'
import { PolygonSidesControls, type PolygonSidesControlsProps } from './PolygonSidesControls'
import { LayersPanel, type LayersPanelProps } from './LayersPanel'
import { TokenImageControls, type TokenImageControlsProps } from './TokenImageControls'
import { TokenNameControls, type TokenNameControlsProps } from './TokenNameControls'
import { LightControls, type LightControlsProps } from './LightControls'
import { WallStyleControls, type WallStyleControlsProps } from './WallStyleControls'
import { StairControls, type StairControlsProps } from './StairControls'
import { RoomControls, type RoomControlsProps } from './RoomControls'
import { MapScaleControls, type MapScaleControlsProps } from './MapScaleControls'
import { GridAlignControls, type GridAlignControlsProps } from './GridAlignControls'
import { ItemTransformControls, type ItemTransformControlsProps } from './ItemTransformControls'
import { ToolPropertiesSection } from './ToolPropertiesSection'
import { LineCapControls, type LineCapControlsProps } from './LineCapControls'
import { LineShapeControls, type LineShapeControlsProps } from './LineShapeControls'
import { FillControls, type FillControlsProps } from './FillControls'
import { AreaSelectionControls } from './AreaSelectionControls'
import { FloorPieceControls, type FloorPieceControlsProps } from './FloorPieceControls'
import { FloorStyleControls, type FloorStyleControlsProps } from './FloorStyleControls'
import { PlayerSecretControls, type PlayerSecretControlsProps } from './PlayerSecretControls'
import { ConcealZoneControls, type ConcealZoneControlsProps } from './ConcealZoneControls'
import { roomDimensions } from '../lib/roomOps'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import type { PropertyGroupId } from '../lib/toolProperties'
import type { AreaSelection } from '../lib/areaSelection'

interface PropertiesPanelProps {
  mapName: string
  mapWidth: number
  mapHeight: number
  mapGrid: number
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
  areaSelection: { selection: AreaSelection | null; onClear: () => void }
  drawingStyle: DrawingStyleControlsProps
  grid: GridControlsProps
  mapScale: MapScaleControlsProps
  gridAlign: GridAlignControlsProps
  layers: LayersPanelProps
  selection: SelectionControlsProps
  scenarioLink: ScenarioLinkControlsProps
  selectedWall: Wall | null
  wallDoor: Omit<WallDoorControlsProps, 'door'>
  doorKind: DoorKindControlsProps
  wallStyle: WallStyleControlsProps
  selectedProp: Prop | null
  portal: Omit<PortalControlsProps, 'linkedMapPath'>
  /** F3, contrato do agente C4 — rotação/travar/ocultar do Objeto selecionado. */
  propTransform: Omit<ItemTransformControlsProps, 'title' | 'rotation' | 'locked' | 'hidden' | 'secret'>
  selectedToken: Token | null
  tokenName: Omit<TokenNameControlsProps, 'name'>
  tokenImage: Omit<TokenImageControlsProps, 'image'>
  /** F3, contrato do agente C4 — rotação/travar/ocultar do Token selecionado. */
  tokenTransform: Omit<ItemTransformControlsProps, 'title' | 'rotation' | 'locked' | 'hidden' | 'secret'>
  selectedTextLabel: Extract<Drawing, { kind: 'text' }> | null
  textLabel: Omit<TextLabelControlsProps, 'text' | 'color' | 'fontSize' | 'fontFamily'>
  selectedRegion: Region | null
  regionStyle: RegionStyleControlsProps
  room: Omit<RoomControlsProps, 'name' | 'shape' | 'width' | 'height' | 'nameHiddenFromPlayers'>
  selectedLight: Light | null
  lightControls: Omit<LightControlsProps, 'color' | 'intensity'>
  selectedStair: Stair | null
  stairControls: Omit<StairControlsProps, 'direction'>
  polygonSides: PolygonSidesControlsProps
  /** Chão por peças — peça selecionada (`null` = nenhuma) e seus controles. */
  selectedFloorPiece: FloorPiece | null
  floorPieceControls: Omit<FloorPieceControlsProps, 'piece'>
  /** Chão por peças — estilo do chão do mapa e "Chão a partir da imagem de fundo". */
  floorStyle: FloorStyleControlsProps
  /** A5 — "Oculto para jogadores" da Região/Escada/Desenho selecionado; `null` = nenhum. */
  playerSecret: PlayerSecretControlsProps | null
  /** A5 — zona oculta aberta no painel; `null` = nenhuma. */
  concealZone: ConcealZoneControlsProps | null
}

/**
 * Inspetor da coluna esquerda: identidade do mapa aberto e as seções de
 * propriedade. Só compõe — cada seção é responsável pelos próprios controles.
 */
export function PropertiesPanel({
  mapName,
  mapWidth,
  mapHeight,
  mapGrid,
  groups,
  lineCap,
  lineShape,
  fill,
  areaSelection,
  drawingStyle,
  grid,
  mapScale,
  gridAlign,
  layers,
  selection,
  scenarioLink,
  selectedWall,
  wallDoor,
  doorKind,
  wallStyle,
  selectedProp,
  portal,
  propTransform,
  selectedToken,
  tokenName,
  tokenImage,
  tokenTransform,
  selectedTextLabel,
  textLabel,
  selectedRegion,
  regionStyle,
  room,
  selectedLight,
  lightControls,
  selectedStair,
  stairControls,
  polygonSides,
  selectedFloorPiece,
  floorPieceControls,
  floorStyle,
  playerSecret,
  concealZone,
}: PropertiesPanelProps) {
  return (
    <div className="lb-panel lb-inspector">
      <header className="lb-inspector__head">
        <span className="lb-inspector__mark" aria-hidden="true">
          <LabyrinthMark size={20} />
        </span>
        <span className="lb-inspector__id">
          <h1 className="lb-inspector__wordmark">Labirinto</h1>
          <span className="lb-inspector__mapname" title={mapName}>
            {mapName} · {mapWidth}×{mapHeight} · {mapGrid}px
          </span>
        </span>
      </header>

      <div className="lb-inspector__body lb-scroll">
        {/* Sala no topo: o nome é o que o usuário quer mexer logo depois de
            desenhar, e no fim do painel ele precisava rolar para achar. */}
        {selectedRegion?.room && (
          <ToolPropertiesSection group="room" groups={groups}>
            <RoomControls
              name={selectedRegion.room.name}
              shape={selectedRegion.room.shape}
              width={roomDimensions(selectedRegion.points).width}
              height={roomDimensions(selectedRegion.points).height}
              nameHiddenFromPlayers={!!selectedRegion.room.nameHiddenFromPlayers}
              {...room}
            />
          </ToolPropertiesSection>
        )}
        {concealZone && (
          <ToolPropertiesSection group="concealZone" groups={groups}>
            <ConcealZoneControls {...concealZone} />
          </ToolPropertiesSection>
        )}
        {playerSecret && (
          <ToolPropertiesSection group="playerVisibility" groups={groups}>
            <PlayerSecretControls {...playerSecret} />
          </ToolPropertiesSection>
        )}
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
        <ToolPropertiesSection group="fill" groups={groups}>
          <FillControls {...fill} />
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
            <FloorPieceControls piece={selectedFloorPiece} {...floorPieceControls} />
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="floorStyle" groups={groups}>
          <FloorStyleControls {...floorStyle} />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="grid" groups={groups}>
          <GridControls {...grid} />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="mapScale" groups={groups}>
          <MapScaleControls {...mapScale} />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="gridAlign" groups={groups}>
          <GridAlignControls {...gridAlign} />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="layers" groups={groups}>
          <LayersPanel {...layers} />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="scenarioLink" groups={groups}>
          <ScenarioLinkControls {...scenarioLink} />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="wallStyle" groups={groups}>
          <WallStyleControls {...wallStyle} />
        </ToolPropertiesSection>
        {selectedWall && (
          <ToolPropertiesSection group="wallDoor" groups={groups}>
            <WallDoorControls door={selectedWall.door} {...wallDoor} />
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="doorKind" groups={groups}>
          <DoorKindControls {...doorKind} />
        </ToolPropertiesSection>
        {selectedProp && (
          <ToolPropertiesSection group="portal" groups={groups}>
            <PortalControls linkedMapPath={selectedProp.linkedMapPath} {...portal} />
          </ToolPropertiesSection>
        )}
        {selectedProp && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            <ItemTransformControls
              title="Objeto"
              rotation={selectedProp.rotation ?? 0}
              locked={!!selectedProp.locked}
              hidden={!!selectedProp.hidden}
              secret={!!selectedProp.secret}
              {...propTransform}
            />
          </ToolPropertiesSection>
        )}
        {selectedToken && (
          <ToolPropertiesSection group="tokenImage" groups={groups}>
            <TokenNameControls name={selectedToken.name} {...tokenName} />
            <TokenImageControls image={selectedToken.image} {...tokenImage} />
          </ToolPropertiesSection>
        )}
        {selectedToken && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            <ItemTransformControls
              title="Token"
              rotation={selectedToken.rotation ?? 0}
              locked={!!selectedToken.locked}
              hidden={!!selectedToken.hidden}
              secret={!!selectedToken.secret}
              {...tokenTransform}
            />
          </ToolPropertiesSection>
        )}
        {selectedLight && (
          <ToolPropertiesSection group="lightControls" groups={groups}>
            <LightControls color={selectedLight.color} intensity={selectedLight.intensity} {...lightControls} />
          </ToolPropertiesSection>
        )}
        {selectedStair && (
          <ToolPropertiesSection group="stairControls" groups={groups}>
            <StairControls direction={selectedStair.direction} {...stairControls} />
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="selection" groups={groups}>
          <AreaSelectionControls selection={areaSelection.selection} onClear={areaSelection.onClear} />
          <SelectionControls {...selection} />
        </ToolPropertiesSection>
      </div>
    </div>
  )
}

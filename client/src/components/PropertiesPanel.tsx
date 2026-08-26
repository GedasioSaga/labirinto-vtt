import type { DrawingTool } from '../types/tools'
import type { Drawing, Prop, Wall } from '../types/map'
import { DRAWING_TOOLS } from './labels'
import { LabyrinthMark } from './icons'
import { DrawingStyleControls, type DrawingStyleControlsProps } from './DrawingStyleControls'
import { GridControls, type GridControlsProps } from './GridControls'
import { SelectionControls, type SelectionControlsProps } from './SelectionControls'
import { WallDoorControls, type WallDoorControlsProps } from './WallDoorControls'
import { ScenarioLinkControls, type ScenarioLinkControlsProps } from './ScenarioLinkControls'
import { PortalControls, type PortalControlsProps } from './PortalControls'
import { TextLabelControls, type TextLabelControlsProps } from './TextLabelControls'

interface PropertiesPanelProps {
  mapName: string
  mapWidth: number
  mapHeight: number
  mapGrid: number
  activeTool: DrawingTool
  drawingStyle: DrawingStyleControlsProps
  grid: GridControlsProps
  selection: SelectionControlsProps
  scenarioLink: ScenarioLinkControlsProps
  selectedWall: Wall | null
  wallDoor: Omit<WallDoorControlsProps, 'door'>
  selectedProp: Prop | null
  portal: Omit<PortalControlsProps, 'linkedMapPath'>
  selectedTextLabel: Extract<Drawing, { kind: 'text' }> | null
  textLabel: Omit<TextLabelControlsProps, 'text' | 'color' | 'fontSize'>
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
  activeTool,
  drawingStyle,
  grid,
  selection,
  scenarioLink,
  selectedWall,
  wallDoor,
  selectedProp,
  portal,
  selectedTextLabel,
  textLabel,
}: PropertiesPanelProps) {
  // Com a ferramenta Texto ativa, um rótulo recém-colocado já fica selecionado
  // (Task 4). Nesse instante o controle relevante é o do rótulo selecionado
  // (TextLabelControls, mais abaixo) — mostrar também "Estilo de desenho" aqui
  // duplicaria Cor/Tamanho da fonte com efeitos diferentes (um define o padrão
  // do PRÓXIMO rótulo, o outro edita o selecionado) e confunde. Só mostra o
  // estilo de desenho para texto quando ainda não há rótulo selecionado.
  const showDrawingStyle =
    DRAWING_TOOLS.includes(activeTool) || (activeTool === 'text' && !selectedTextLabel)

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
        {showDrawingStyle && <DrawingStyleControls {...drawingStyle} />}
        {selectedTextLabel && (
          <TextLabelControls
            text={selectedTextLabel.text}
            color={selectedTextLabel.color}
            fontSize={selectedTextLabel.fontSize}
            {...textLabel}
          />
        )}
        <GridControls {...grid} />
        <ScenarioLinkControls {...scenarioLink} />
        {selectedWall && <WallDoorControls door={selectedWall.door} {...wallDoor} />}
        {selectedProp && <PortalControls linkedMapPath={selectedProp.linkedMapPath} {...portal} />}
        <SelectionControls {...selection} />
      </div>
    </div>
  )
}

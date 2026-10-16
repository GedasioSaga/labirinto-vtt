import type { ReactNode } from 'react'
import { CollapsibleSection } from '../CollapsibleSection'
import { FloorLayersList, type FloorLayersListProps } from '../FloorLayersList'
import { FloorStyleControls, type FloorStyleControlsProps } from '../FloorStyleControls'
import { GridQuickToggles, type GridControlsProps } from '../GridControls'
import { LayersPanel, type LayersPanelProps } from '../LayersPanel'
import { TerritorioControls, type TerritorioControlsProps } from '../TerritorioControls'
import { TituloDaPagina } from './FolhaDoLivro'

export interface PaginaCenaProps {
  mapName: string
  mapWidth: number
  mapHeight: number
  mapGrid: number
  /** Objetos do mapa (com a busca do Ctrl+K), Marcas e Locais. */
  objetos?: ReactNode
  territorio?: TerritorioControlsProps
  floorStyle: FloorStyleControlsProps
  floorLayers?: FloorLayersListProps
  layers: LayersPanelProps
  grid: GridControlsProps
}

/**
 * Página Cena do livro do mestre: o que é da cena aberta, do que há nela
 * (Objetos do mapa, Marcas, Locais) ao jeito dela (Território, Chão do mapa,
 * Camadas do chão, Camadas). Os componentes de antes, sem restilo (fatia 2);
 * a página mostra tudo sempre, sem o "momento de mapa" que escondia seções
 * conforme a ferramenta: quem abriu o marcador Cena veio ver a cena.
 */
export function PaginaCena({ mapName, mapWidth, mapHeight, mapGrid, objetos, territorio, floorStyle, floorLayers, layers, grid }: PaginaCenaProps) {
  // Com o pincel do chão na mão a lista aparece mesmo sem peça: é nela que se vê onde a primeira pincelada cai.
  const temCamadasDoChao = floorLayers !== undefined && (floorLayers.floor.length > 0 || floorLayers.pincel !== undefined)
  return (
    <>
      <TituloDaPagina titulo="Esta cena" sub={`${mapName}, ${mapWidth} × ${mapHeight} casas de ${mapGrid} px`} />
      <div className="lb-zona">
        {objetos}
        {/* Nasce fechado: o mestre mexe nele durante o jogo; a escolha fica lembrada (`lb-section:territorio`). */}
        {territorio !== undefined && (
          <CollapsibleSection id="territorio" title="Território" defaultOpen={false}>
            <TerritorioControls {...territorio} />
          </CollapsibleSection>
        )}
        {/* "Chão do mapa", não "Chão": o botão da ferramenta na barra já se chama "Chão". */}
        <CollapsibleSection id="floor" title="Chão do mapa" defaultOpen>
          <FloorStyleControls {...floorStyle} />
        </CollapsibleSection>
        {temCamadasDoChao && (
          <CollapsibleSection id="floor-layers" title="Camadas do chão" defaultOpen>
            <FloorLayersList {...floorLayers} />
          </CollapsibleSection>
        )}
        <CollapsibleSection id="layers" title="Camadas" defaultOpen>
          <LayersPanel {...layers} quickToggles={<GridQuickToggles {...grid} />} />
        </CollapsibleSection>
      </div>
    </>
  )
}

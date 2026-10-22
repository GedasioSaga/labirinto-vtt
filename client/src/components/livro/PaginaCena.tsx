import type { ReactNode } from 'react'
import { ROTULO_ALERTA } from '../../lib/faccoes'
import { FloorLayersList, type FloorLayersListProps } from '../FloorLayersList'
import { FloorStyleControls, type FloorStyleControlsProps } from '../FloorStyleControls'
import { GridQuickToggles, TelhadosQuickToggles, type GridControlsProps } from '../GridControls'
import { LayersPanel, type LayersPanelProps } from '../LayersPanel'
import { TerritorioControls, type TerritorioControlsProps } from '../TerritorioControls'
import { Fichas } from '../grimorio/Ficha'
import { FichaDaPagina } from './FichaDaPagina'
import { TituloDaPagina } from './FolhaDoLivro'

export interface PaginaCenaProps {
  mapName: string
  mapWidth: number
  mapHeight: number
  mapGrid: number
  /** Objetos do mapa (com a busca do Ctrl+K), Locais e Marcas: cada um já é a ficha dele. */
  objetos?: ReactNode
  territorio?: TerritorioControlsProps
  floorStyle: FloorStyleControlsProps
  floorLayers?: FloorLayersListProps
  layers: LayersPanelProps
  grid: GridControlsProps
}

const contarPecas = (n: number): string => (n === 1 ? '1 peça' : `${n} peças`)

/** "9 de 9 visíveis": quantas das camadas fixas o mestre não ocultou. */
function resumoDasCamadas(layers: LayersPanelProps): string {
  const total = Object.keys(layers.counts).length
  return `${total - layers.hiddenLayers.length} de ${total} visíveis`
}

/**
 * Página Cena do livro do mestre (fatia 18): o que é da cena aberta, do que há
 * nela (Objetos do mapa, Locais, Marcas) ao jeito dela (Território, Chão do
 * mapa, Camadas do chão, Camadas), cada parte numa ficha recolhível do Grimório
 * com o resumo à vista. As fichas lembram aberta/fechada nas chaves de antes
 * (`lb-section:<id>`), nascem como nasciam e ficam na ordem de antes; dentro
 * delas, os mesmos controles. A página mostra tudo sempre, sem o "momento de mapa" que escondia
 * seções conforme a ferramenta: quem abriu o marcador Cena veio ver a cena.
 */
export function PaginaCena({ mapName, mapWidth, mapHeight, mapGrid, objetos, territorio, floorStyle, floorLayers, layers, grid }: PaginaCenaProps) {
  // Com o pincel do chão na mão a lista aparece mesmo sem peça: é nela que se vê onde a primeira pincelada cai.
  const temCamadasDoChao = floorLayers !== undefined && (floorLayers.floor.length > 0 || floorLayers.pincel !== undefined)
  return (
    <>
      <TituloDaPagina titulo="Esta cena" sub={`${mapName}, ${mapWidth} × ${mapHeight} casas de ${mapGrid} px`} />
      <div className="lb-zona gr-paginas">
        <Fichas>
          {objetos}
          {/* Nasce fechada (o mestre mexe nela durante o jogo) e antes do Chão do mapa, como antes; o resumo já diz o alerta. */}
          {territorio !== undefined && (
            <FichaDaPagina id="territorio" titulo="Território" icone="bandeira" padrao={false} resumo={`Alerta ${ROTULO_ALERTA[territorio.alerta].toLowerCase()}`}>
              <TerritorioControls {...territorio} />
            </FichaDaPagina>
          )}
          {/* "Chão do mapa", não "Chão": o botão da ferramenta na barra já se chama "Chão". */}
          <FichaDaPagina id="floor" titulo="Chão do mapa" icone="chao" padrao resumo={floorStyle.style.strokeColor === null ? 'Sem contorno' : 'Com contorno'}>
            <FloorStyleControls {...floorStyle} />
          </FichaDaPagina>
          {temCamadasDoChao && (
            <FichaDaPagina id="floor-layers" titulo="Camadas do chão" icone="peca" padrao resumo={floorLayers.floor.length === 0 ? undefined : contarPecas(floorLayers.floor.length)}>
              <FloorLayersList {...floorLayers} />
            </FichaDaPagina>
          )}
          <FichaDaPagina id="layers" titulo="Camadas" icone="cenas" padrao resumo={resumoDasCamadas(layers)}>
            <LayersPanel
              {...layers}
              quickToggles={
                <>
                  <GridQuickToggles {...grid} />
                  <TelhadosQuickToggles />
                </>
              }
            />
          </FichaDaPagina>
        </Fichas>
      </div>
    </>
  )
}

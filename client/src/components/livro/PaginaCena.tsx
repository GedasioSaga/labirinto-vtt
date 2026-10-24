import type { ReactNode } from 'react'
import { contextoDeCamadas } from '../../lib/camadas/consulta'
import { ROTULO_ALERTA } from '../../lib/faccoes'
import { FloorLayersList, type FloorLayersListProps } from '../FloorLayersList'
import { FloorStyleControls, type FloorStyleControlsProps } from '../FloorStyleControls'
import { GridQuickToggles, TransparenteDosTelhados, type GridControlsProps } from '../GridControls'
import { LayersPanel, type LayersPanelProps } from '../LayersPanel'
import { TerritorioControls, type TerritorioControlsProps } from '../TerritorioControls'
import { Fichas } from '../grimorio/Ficha'
import { Nota } from '../grimorio/Nota'
import { ChaveCliqueParaAndar } from './ChaveCliqueParaAndar'
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
  /** Leitura do "Mapa vivo" da cena e quem abre o "Configurar cena" nessa seção; ausente, a linha não aparece. */
  mapaVivo?: MapaVivoDaCena
}

export interface MapaVivoDaCena {
  /** Alguma chave do Mapa vivo (Relevo, Nomes dos lugares, Nuvens) está ligada. */
  ligado: boolean
  onAbrir: () => void
}

/** "13 de 13 visíveis": quantas camadas da lista o mestre vê (conta pelo modelo, pelo ponto único). */
function resumoDasCamadas(layers: LayersPanelProps): string {
  const camadas = contextoDeCamadas(layers.camadas)
  const total = camadas.ordem.length
  return `${camadas.ordem.filter((id) => camadas.mestreVe(id)).length} de ${total} visíveis`
}

/**
 * Página Cena do livro do mestre (fatia 18): o que é da cena aberta, do que há
 * nela (Objetos do mapa, Locais, Marcas) ao jeito dela (Território, Chão do
 * mapa, Camadas), cada parte numa ficha recolhível do Grimório
 * com o resumo à vista. As fichas lembram aberta/fechada nas chaves de antes
 * (`lb-section:<id>`), nascem como nasciam e ficam na ordem de antes; dentro
 * delas, os mesmos controles. A página mostra tudo sempre, sem o "momento de mapa" que escondia
 * seções conforme a ferramenta: quem abriu o marcador Cena veio ver a cena.
 */
export function PaginaCena({ mapName, mapWidth, mapHeight, mapGrid, objetos, territorio, floorStyle, floorLayers, layers, grid, mapaVivo }: PaginaCenaProps) {
  // Com o pincel do chão na mão a lista aparece mesmo sem peça: é nela que se vê onde a primeira pincelada cai.
  const temCamadasDoChao = floorLayers !== undefined && (floorLayers.floor.length > 0 || floorLayers.pincel !== undefined)
  return (
    <>
      <TituloDaPagina titulo="Esta cena" sub={`${mapName}, ${mapWidth} × ${mapHeight} casas de ${mapGrid} px`} />
      {/* Só leitura: as chaves moram no "Configurar cena", seção Mapa vivo, que o link abre. */}
      {mapaVivo !== undefined && (
        <div className="gr-paginas__mapa-vivo">
          <Nota ir={{ rotulo: 'Configurar', onClick: mapaVivo.onAbrir }}>Mapa vivo: {mapaVivo.ligado ? 'ligado' : 'desligado'}.</Nota>
        </div>
      )}
      {/* CLICAR PARA ANDAR: a chave é desta cena e o mestre a mexe durante o jogo, então fica à vista, fora das fichas. */}
      <ChaveCliqueParaAndar />
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
          <FichaDaPagina id="layers" titulo="Camadas" icone="cenas" padrao resumo={resumoDasCamadas(layers)}>
            <LayersPanel
              {...layers}
              quickToggles={<GridQuickToggles {...grid} />}
              chao={
                temCamadasDoChao ? (
                  <>
                    <h3 className="lb-camadas__titulo-aninhado">Camadas do chão</h3>
                    <FloorLayersList {...floorLayers} />
                  </>
                ) : undefined
              }
              telhados={<TransparenteDosTelhados />}
            />
          </FichaDaPagina>
        </Fichas>
      </div>
    </>
  )
}

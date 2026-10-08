import { ehPinturaDeBalde } from '../lib/baldeDeTinta'
import { LAYER_LABELS, drawingLayer, isLayerLocked } from '../lib/layers'
import { aceitaParedesAoRedor } from '../lib/paredesDoDesenho'
import { quantasParedesPresas } from '../lib/paredesPresas'
import type { Drawing, LayerId, MapData, ParedesDoDesenho, Wall } from '../types/map'
import type { AvisoParedePresaProps, ParedesAoRedorControlsProps } from './ParedesAoRedorControls'

/**
 * A costura de "Paredes ao redor" com o painel de propriedades: o que o App
 * passa a `ParedesAoRedorControls` (desenho selecionado) e a
 * `AvisoParedePresa` (parede presa selecionada). Fora do App para ser testada
 * com a store de verdade, sem montar o editor inteiro.
 */

export interface AcoesDasParedesAoRedor {
  setParedesDoDesenho: (id: string, patch: Partial<ParedesDoDesenho>) => void
  soltarParedesDoDesenho: (id: string) => void
}

/** A camada das paredes presas: parede sem porta. */
const CAMADA_DAS_PAREDES: LayerId = 'paredes'

/**
 * Os controles das paredes do desenho selecionado; `null` sem desenho ou com
 * um que não aceita paredes (Texto, Caminho). Camada das paredes ou do
 * desenho travada desliga tudo, dizendo qual destravar.
 */
export function paredesAoRedorDoPainel(
  map: Pick<MapData, 'walls' | 'lockedLayers'>,
  desenho: Drawing | null,
  acoes: AcoesDasParedesAoRedor,
): ParedesAoRedorControlsProps | null {
  if (desenho === null || !aceitaParedesAoRedor(desenho)) return null
  const travada = [CAMADA_DAS_PAREDES, drawingLayer(desenho)].find((camada) => isLayerLocked(map.lockedLayers, camada))
  return {
    valor: desenho.paredes,
    quantidade: quantasParedesPresas(map, desenho.id),
    onChange: (patch) => acoes.setParedesDoDesenho(desenho.id, patch),
    onSoltar: () => acoes.soltarParedesDoDesenho(desenho.id),
    disabled: travada !== undefined,
    motivoDesabilitado: travada === undefined ? undefined : `A camada ${LAYER_LABELS[travada]} está travada: destrave em Camadas para mexer nas paredes.`,
  }
}

/**
 * O aviso no lugar dos controles de parede quando a parede selecionada é
 * presa a um desenho; `null` para parede comum (ou dono que já não existe).
 */
export function avisoDaParedePresa(
  map: Pick<MapData, 'drawings'>,
  parede: Wall | null,
  acoes: Pick<AcoesDasParedesAoRedor, 'soltarParedesDoDesenho'> & { selecionarDesenho: (id: string) => void },
): AvisoParedePresaProps | null {
  const donoId = parede?.desenhoId
  if (donoId === undefined) return null
  const dono = map.drawings.find((d) => d.id === donoId)
  if (dono === undefined) return null
  return {
    nomeDoDesenho: nomeDoDesenho(dono),
    onSelecionarDesenho: () => acoes.selecionarDesenho(donoId),
    onSoltar: () => acoes.soltarParedesDoDesenho(donoId),
  }
}

/** Como o mestre chama o desenho: o nome da ferramenta que o fez. */
function nomeDoDesenho(desenho: Drawing): string {
  switch (desenho.kind) {
    case 'freehand':
      return 'Pincel'
    case 'polygon':
      return ehPinturaDeBalde(desenho) ? 'Pintura de balde' : 'Polígono'
    case 'line':
      return 'Linha'
    case 'curve':
      return 'Curva'
    case 'circle':
      return 'Círculo'
    case 'ellipse':
      return 'Elipse'
    case 'rect':
      return 'Retângulo'
    case 'text':
      return 'Texto'
    case 'path':
      return 'Caminho'
  }
}

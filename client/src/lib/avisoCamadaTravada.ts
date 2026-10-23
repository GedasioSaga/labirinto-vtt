import { LAYER_IDS, type CamadaId, type LayerId } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { ehCamadaPadrao, ROTULOS_DAS_CAMADAS } from './camadas/padrao'

/**
 * O gesto bateu num item de camada travada (`PixiCanvas`, clique de seleção e
 * borracha; as ferramentas de criar na store). Um aviso só por camada, por
 * mais cliques que venham, e o "Destravar" no próprio aviso: o cadeado mora
 * na lista de Camadas, longe do clique, e quem travou sem querer não sabia
 * onde desfazer.
 */
export function avisarCamadaTravada(camada: CamadaId): void {
  useToastStore.getState().push('info', `A camada ${rotuloDaCamada(camada)} está travada`, undefined, {
    chave: `camada-travada:${camada}`,
    actions: [{ label: 'Destravar', run: () => destravar(camada) }],
  })
}

/** O nome que o mestre lê: um dos 13 rótulos, ou o nome da camada livre no modelo. */
function rotuloDaCamada(camada: CamadaId): string {
  if (ehCamadaPadrao(camada)) return ROTULOS_DAS_CAMADAS[camada]
  const nome = useMapStore.getState().map.modeloCamadas?.ordem.find((def) => def.id === camada)?.nome?.trim()
  return nome === undefined || nome === '' ? 'sem nome' : nome
}

/** A camada que o cadeado e o olho de hoje guardam (`MapData.lockedLayers`/`hiddenLayers` ainda são das 9). */
function camadaGuardada(camada: CamadaId): LayerId | undefined {
  return LAYER_IDS.find((id) => id === camada)
}

/** Só destrava: o botão velho de um aviso não pode travar de novo o que já foi liberado. */
function destravar(camada: CamadaId): void {
  const { map, toggleLayerLock } = useMapStore.getState()
  const layer = camadaGuardada(camada)
  if (layer !== undefined && map.lockedLayers.includes(layer)) toggleLayerLock(layer)
}

/**
 * O gesto ia criar um item numa camada oculta (ferramenta Objetos,
 * `stores/mobiliaNoPonto.ts`): o item nasceria invisível e o clique pareceria
 * não ter pegado. Mesmo formato do aviso de camada travada — um aviso só por
 * camada e o "Mostrar" ali mesmo, sem ir atrás do olho na lista de Camadas.
 */
export function avisarCamadaOculta(camada: CamadaId): void {
  useToastStore.getState().push('info', `A camada ${rotuloDaCamada(camada)} está oculta`, undefined, {
    chave: `camada-oculta:${camada}`,
    actions: [{ label: 'Mostrar', run: () => mostrar(camada) }],
  })
}

/** Só mostra: o botão velho de um aviso não pode ocultar de novo o que já voltou a aparecer. */
function mostrar(camada: CamadaId): void {
  const { map, toggleLayerVisibility } = useMapStore.getState()
  const layer = camadaGuardada(camada)
  if (layer !== undefined && map.hiddenLayers.includes(layer)) toggleLayerVisibility(layer)
}

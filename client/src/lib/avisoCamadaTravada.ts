import type { LayerId } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { LAYER_LABELS } from './layers'

/**
 * O gesto bateu num item de camada travada (`PixiCanvas`, clique de seleção).
 * Um aviso só por camada, por mais cliques que venham, e o "Destravar" no
 * próprio aviso: o cadeado mora na lista de Camadas, longe do clique, e quem
 * travou sem querer não sabia onde desfazer.
 */
export function avisarCamadaTravada(layer: LayerId): void {
  useToastStore.getState().push('info', `A camada ${LAYER_LABELS[layer]} está travada`, undefined, {
    chave: `camada-travada:${layer}`,
    actions: [{ label: 'Destravar', run: () => destravar(layer) }],
  })
}

/** Só destrava: o botão velho de um aviso não pode travar de novo o que já foi liberado. */
function destravar(layer: LayerId): void {
  const { map, toggleLayerLock } = useMapStore.getState()
  if (map.lockedLayers.includes(layer)) toggleLayerLock(layer)
}

/**
 * O gesto ia criar um item numa camada oculta (ferramenta Objetos,
 * `stores/mobiliaNoPonto.ts`): o item nasceria invisível e o clique pareceria
 * não ter pegado. Mesmo formato do aviso de camada travada — um aviso só por
 * camada e o "Mostrar" ali mesmo, sem ir atrás do olho na lista de Camadas.
 */
export function avisarCamadaOculta(layer: LayerId): void {
  useToastStore.getState().push('info', `A camada ${LAYER_LABELS[layer]} está oculta`, undefined, {
    chave: `camada-oculta:${layer}`,
    actions: [{ label: 'Mostrar', run: () => mostrar(layer) }],
  })
}

/** Só mostra: o botão velho de um aviso não pode ocultar de novo o que já voltou a aparecer. */
function mostrar(layer: LayerId): void {
  const { map, toggleLayerVisibility } = useMapStore.getState()
  if (map.hiddenLayers.includes(layer)) toggleLayerVisibility(layer)
}

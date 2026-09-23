import { mapObjectOf, type MapObjectEntry } from '../lib/mapObjects'
import { EMPTY_SELECTION, selectionOfItem, type SelectionItem } from '../lib/selectionModel'
import { useAdventureStore } from './adventureStore'
import { useFollowStore } from './followStore'
import { useMapStore } from './mapStore'

/** O que o clique na linha seleciona: o item da seleção, ou o pino (que abre no painel). */
function selectionTarget(entry: MapObjectEntry): SelectionItem | { pinId: string } {
  switch (entry.kind) {
    case 'room':
      return { kind: 'region', id: entry.id }
    case 'door':
      return { kind: 'wall', id: entry.id }
    case 'token':
      return { kind: 'token', id: entry.id }
    case 'text':
      return { kind: 'drawing', id: entry.id }
    case 'pin':
      return { pinId: entry.id }
  }
}

/**
 * "Ir até lá" da lista Objetos do mapa: seleciona o objeto como o clique da
 * ferramenta Selecionar (o painel passa a mostrar o Nome dele) e leva a câmera
 * do EDITOR até ele, no meio da área que os painéis deixam livre.
 *
 * Tudo é vista e seleção do mestre: o mapa não muda (nada para desfazer) e a
 * rede não manda nada — a câmera do jogador fica onde ele deixou.
 *
 * Lê o mapa de AGORA (`mapObjectOf`), não a linha desenhada: o token pode ter
 * andado desde então, e objeto que saiu do mapa não faz nada.
 */
export function goToMapObject(entry: MapObjectEntry): void {
  const store = useMapStore.getState()
  const fresh = mapObjectOf(store.map, entry.key)
  if (fresh === null) return

  // Escolher para onde olhar desliga o Seguir, como o "Ir lá" do Grupo em outro jogador.
  useFollowStore.getState().stop()

  if (fresh.blockedReason !== null) {
    // Camada travada/oculta: o clique do mapa também não pegaria. A seleção de
    // antes sai, para o painel não continuar mostrando outro objeto.
    store.setSelection(EMPTY_SELECTION)
    store.setSelectedPin(null)
    store.setSelectedConcealZone(null)
  } else {
    // Seleção é da Selecionar: ferramenta de criar na mão apagaria a seleção
    // no próximo passo (`setActiveTool`), e o clique seguinte criaria em vez de mover.
    if (store.activeTool !== 'select') store.setActiveTool('select')
    const target = selectionTarget(fresh)
    if ('pinId' in target) store.setSelectedPin(target.pinId)
    else store.setSelection(selectionOfItem(target))
  }

  useAdventureStore.getState().goToPoint(null, fresh.focus, fresh.bounds)
}

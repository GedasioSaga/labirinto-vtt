import { mapObjectKey, mapObjectOf, type MapObjectEntry } from '../lib/mapObjects'
import { pisoDe } from '../lib/pisos'
import { placeBounds } from '../lib/placeTree'
import type { Bounds, Point } from '../pixi/world'
import type { MapData, NoPiso } from '../types/map'
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

/** O piso do objeto da lista; objeto que não está mais no mapa: `null`. */
function pisoDoObjeto(map: MapData, entry: MapObjectEntry): number | null {
  const lista: readonly (NoPiso & { id: string })[] =
    entry.kind === 'room' ? map.regions : entry.kind === 'door' ? map.walls : entry.kind === 'token' ? map.tokens : entry.kind === 'text' ? map.drawings : map.pins
  const item = lista.find((candidato) => candidato.id === entry.id)
  return item === undefined ? null : pisoDe(item)
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
  const fresh = mapObjectOf(useMapStore.getState().map, entry.key)
  if (fresh === null) return
  goToFreshObject(fresh, fresh.focus, fresh.bounds)
}

/**
 * "Enquadrar" da árvore de Locais: seleciona o local (como o clique numa sala)
 * e leva a câmera do EDITOR até ele com a caixa do local E de tudo que há
 * dentro — enquadrar o prédio põe o prédio inteiro na tela, com os pisos e
 * cômodos que passam da parede. Mesmas regras do "Ir até lá" acima: desliga
 * o Seguir, não muda o mapa e não manda nada ao jogador.
 */
export function framePlace(regionId: string): void {
  const map = useMapStore.getState().map
  const fresh = mapObjectOf(map, mapObjectKey('room', regionId))
  if (fresh === null) return
  const bounds = placeBounds(map.regions, regionId) ?? fresh.bounds
  goToFreshObject(fresh, { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, bounds)
}

/** Seleciona o objeto lido do mapa de agora e pede a câmera do editor em `focus`, com `bounds` cabendo. */
function goToFreshObject(fresh: MapObjectEntry, focus: Point, bounds: Bounds): void {
  const store = useMapStore.getState()

  // Escolher para onde olhar desliga o Seguir, como o "Ir lá" do Grupo em outro jogador.
  useFollowStore.getState().stop()
  // PISOS NA MESMA CENA: o editor mostra um piso só; o objeto de outro piso
  // estaria selecionado e invisível. Vai ao piso dele ANTES de selecionar
  // (trocar de piso limpa a seleção).
  const piso = pisoDoObjeto(store.map, fresh)
  if (piso !== null) store.setPisoAtivo(piso)

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

  useAdventureStore.getState().goToPoint(null, focus, bounds)
}

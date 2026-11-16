import type { Carimbo, CarimboImportado, MapData } from '../../types/map'
import { carimboPorId } from '../../lib/carimbos'
import { selectionSingle, type SelectionSet } from '../../lib/selectionModel'
import { carimboDoCatalogo } from '../../carimbos/catalogo'
import { useMapStore } from '../../stores/mapStore'

/**
 * A FICHA DO CARIMBO (Fase 2, 15/11/2026: "o carimbo porque não consigo
 * editar?"). O carimbo selecionado sozinho abre aqui, no livro do mestre.
 */

/** O carimbo quando ele é a seleção inteira (um item só), ou `null`. */
export function carimboSelecionadoDe(map: MapData, selection: SelectionSet): Carimbo | null {
  const item = selectionSingle(selection)
  if (item === null || item.kind !== 'carimbo') return null
  return carimboPorId(map.carimbos, item.id) ?? null
}

/** O carimbo selecionado sozinho na cena aberta. A mesma referência enquanto ele não muda (sem render à toa). */
export function useCarimboSelecionado(): Carimbo | null {
  return useMapStore((state) => carimboSelecionadoDe(state.map, state.selection))
}

/** O nome do tipo: o da biblioteca ("Pinheiro") ou o que o mestre deu ao importado; `null` quando o tipo não está neste aparelho. */
export function nomeDoTipoDeCarimbo(tipo: string, importados: readonly CarimboImportado[] | undefined): string | null {
  const daBiblioteca = carimboDoCatalogo(tipo)
  if (daBiblioteca !== null) return daBiblioteca.nome
  return importados?.find((c) => c.id === tipo)?.nome ?? null
}

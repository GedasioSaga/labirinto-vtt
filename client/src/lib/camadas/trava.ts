/**
 * O CADEADO das camadas, para as ferramentas que criam, mexem e apagam
 * (`docs/planos/camadas-fase3-2026-10-22.md`, fatia 5). Responde pelo ponto
 * único (`consulta.ts`): a camada de cada item é `camadaDe`, a trava é
 * `travada`, e a camada devolvida é a que guarda o cadeado (`camadaQueManda`:
 * no mapa de antes, Salas responde por Chão e Anotações por Desenhos) — a que
 * o aviso nomeia e o "Destravar" solta.
 *
 * Trava POR ITEM (`locked`) não entra aqui: é outro eixo, com outra regra (o
 * item travado continua editável no painel para poder ser destravado).
 */
import type { CamadaId } from '../../types/map'
import { contextoDeCamadas, type CamposDeCamadas } from './consulta'
import type { ItemPorTipo, TipoDeObjeto } from './padrao'

/** A camada `id` está travada? Devolve a que guarda o cadeado, ou `null` quando está livre. */
export function camadaTravada(map: CamposDeCamadas, id: CamadaId): CamadaId | null {
  const camadas = contextoDeCamadas(map)
  return camadas.travada(id) ? camadas.camadaQueManda(id) : null
}

/** A camada travada que barra mexer neste item, ou `null`. */
export function camadaTravadaDoItem<K extends TipoDeObjeto>(map: CamposDeCamadas, tipo: K, item: ItemPorTipo[K]): CamadaId | null {
  return camadaTravada(map, contextoDeCamadas(map).camadaDe(tipo, item))
}

/** As camadas travadas que barram algum destes itens, sem repetir, na ordem em que aparecem. Vazio = livre. */
export function camadasTravadasDosItens<K extends TipoDeObjeto>(map: CamposDeCamadas, tipo: K, itens: readonly ItemPorTipo[K][]): CamadaId[] {
  if (map.lockedLayers.length === 0) return []
  const barram = new Set<CamadaId>()
  for (const item of itens) {
    const camada = camadaTravadaDoItem(map, tipo, item)
    if (camada !== null) barram.add(camada)
  }
  return [...barram]
}

/** A camada `id` está escondida do mestre (olho "Mestre vê" desligado)? Devolve a que guarda o olho, ou `null`. */
export function camadaOcultaDoMestre(map: CamposDeCamadas, id: CamadaId): CamadaId | null {
  const camadas = contextoDeCamadas(map)
  return camadas.mestreVe(id) ? null : camadas.camadaQueManda(id)
}

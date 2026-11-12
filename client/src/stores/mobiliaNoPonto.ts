import { useMapStore } from './mapStore'
import { avisarCamadaOculta, avisarCamadaTravada } from '../lib/avisoCamadaTravada'
import { isLayerLocked, isLayerVisible } from '../lib/layers'
import { criarMovel } from '../lib/mobilia'
import { mapaDoPiso } from '../lib/pisos'
import { findContainingRoom } from '../lib/roomNesting'
import { roomRotationOf } from '../lib/roomRotation'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import type { LayerId, TipoMobilia } from '../types/map'
import { lembrarObjetoUsado } from './objetosUsados'

/** `criarMovel` não grava `layer`, e objeto sem `layer` mora em Objetos (`propLayer`). */
const CAMADA_DO_MOVEL: LayerId = 'objetos'

/** O que o clique da ferramenta Objetos fez — o móvel posto ou por que não pôs. */
export type ResultadoDoMovel = { kind: 'posto'; id: string } | { kind: 'camada-travada' } | { kind: 'camada-oculta' }

/**
 * MOBÍLIA NA BARRA — o clique da ferramenta Objetos no mapa (`PixiCanvas`).
 * O móvel do tipo escolhido na setinha nasce centrado em `ponto` (já com o
 * encaixe da Peça aplicado por quem chama). Dentro de uma Sala girada ele
 * deita no giro dela; fora de sala, ou em sala nunca girada, nasce sem giro,
 * igual a objeto comum. A ferramenta segue na mão para pôr o próximo. Um passo
 * só no desfazer (`addProp`).
 *
 * Pôr NÃO seleciona (pedido de 12/11/2026): o painel fica em "Colocar", com a
 * busca e a rolagem da lista, para pôr vários em seguida. Quem abre a ficha do
 * objeto é o clique nele (o hit-test do `PixiCanvas`). A seleção de antes
 * (objeto, pino ou zona) é largada, senão a ficha dela seguiria no painel.
 *
 * Só as Salas do piso em edição doam giro: a de outro piso não está na tela.
 *
 * Camada Objetos travada ou oculta não recebe móvel: travada, o item nasceria
 * fora do alcance do Selecionar; oculta, nasceria invisível e o clique
 * pareceria não ter pegado. Em vez disso, o aviso da camada, com o botão que a
 * libera ali mesmo.
 */
export function porMovelNoPonto(
  tipo: TipoMobilia,
  ponto: { x: number; y: number },
  novoId: () => string = () => crypto.randomUUID(),
): ResultadoDoMovel {
  const store = useMapStore.getState()
  const { map, pisoAtivo } = store
  if (isLayerLocked(map.lockedLayers, CAMADA_DO_MOVEL)) {
    avisarCamadaTravada(CAMADA_DO_MOVEL)
    return { kind: 'camada-travada' }
  }
  if (!isLayerVisible(map.hiddenLayers, CAMADA_DO_MOVEL)) {
    avisarCamadaOculta(CAMADA_DO_MOVEL)
    return { kind: 'camada-oculta' }
  }
  const movel = criarMovel(tipo, ponto, map.grid, novoId())
  const sala = findContainingRoom(mapaDoPiso(map, pisoAtivo).regions, [ponto])
  // Fora de qualquer sala `sala` é null: o `?.` é o caso "sem giro", não um remendo.
  const giro = roomRotationOf(sala?.room)
  store.addProp(giro === 0 ? movel : { ...movel, rotation: giro })
  store.setSelection(EMPTY_SELECTION)
  store.setSelectedPin(null)
  store.setSelectedConcealZone(null)
  // "Usados há pouco" da ficha da ferramenta: conta o móvel posto, não a escolha.
  lembrarObjetoUsado(tipo)
  return { kind: 'posto', id: movel.id }
}

import { avisarCamadaTravada } from '../lib/avisoCamadaTravada'
import { camadaTravadaDoItem } from '../lib/camadas/trava'
import type { Pin } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * O PINO QUE O MESTRE CRAVA OU APAGA COM A MÃO (ferramenta Pino, item do
 * acervo solto como pino, Delete e "Excluir" do painel) pergunta ao cadeado da
 * camada antes de mexer (fase 3, fatia 5). As ações da store (`addPin`,
 * `removePin`) ficam sem cadeado de propósito: escada, viagem e "Passar para
 * pede" passam por elas, e o pino deles não é gesto do mestre na camada.
 *
 * Recusado: nada muda, nada entra no Ctrl+Z, nada fica selecionado, e o aviso
 * diz qual camada segurou (um por camada, com "Destravar").
 */

/** Crava `pin` e o seleciona. `false` quando a camada dele está travada. */
export function cravarPinoPeloGesto(pin: Pin): boolean {
  const store = useMapStore.getState()
  const travada = camadaTravadaDoItem(store.map, 'pino', pin)
  if (travada !== null) {
    avisarCamadaTravada(travada)
    return false
  }
  store.addPin(pin)
  useMapStore.getState().setSelectedPin(pin.id)
  return true
}

/** Apaga o pino `id`. `false` quando ele não existe ou a camada dele está travada. */
export function apagarPinoPeloGesto(id: string): boolean {
  const store = useMapStore.getState()
  const pin = store.map.pins.find((p) => p.id === id)
  if (pin === undefined) return false
  const travada = camadaTravadaDoItem(store.map, 'pino', pin)
  if (travada !== null) {
    avisarCamadaTravada(travada)
    return false
  }
  store.removePin(id)
  return true
}

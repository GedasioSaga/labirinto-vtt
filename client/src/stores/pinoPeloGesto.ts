import { avisarCamadaTravada } from '../lib/avisoCamadaTravada'
import { camadaTravadaDoItem } from '../lib/camadas/trava'
import type { Pin, Prop } from '../types/map'
import { estrelaDaColocacao, porTokenDaColocacao } from './colocacaoDoPreludio'
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

/**
 * Crava `pin`. `false` quando a camada dele está travada. Não o seleciona
 * (caça de 12/11/2026, E7, decisão 15: nenhuma ferramenta pula para a ficha ao
 * pôr); clicar no pino depois abre a ficha.
 */
export function cravarPinoPeloGesto(pin: Pin): boolean {
  // "Pôr no mapa" do Prelúdio com um TOKEN esperando (E3): o clique da ferramenta Pino põe o token, e não um pino.
  if (porTokenDaColocacao(pin)) return true
  // ...e com um ITEM SEM IMAGEM (17/11/2026): a estrela brilhando no chão, e não o pino de item.
  const estrela = estrelaDaColocacao(pin)
  if (estrela !== null) return porObjetoPeloGesto(estrela)
  const store = useMapStore.getState()
  const travada = camadaTravadaDoItem(store.map, 'pino', pin)
  if (travada !== null) {
    avisarCamadaTravada(travada)
    return false
  }
  store.addPin(pin)
  return true
}

/** O objeto que o clique da ferramenta Pino pôs no lugar do pino (a estrela do item): o mesmo cadeado, pela camada do objeto. */
function porObjetoPeloGesto(prop: Prop): boolean {
  const store = useMapStore.getState()
  const travada = camadaTravadaDoItem(store.map, 'objeto', prop)
  if (travada !== null) {
    avisarCamadaTravada(travada)
    return false
  }
  store.addProp(prop)
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

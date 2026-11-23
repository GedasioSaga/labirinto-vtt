import { atenderBalanceador } from './atendimentoDoBalanceador'

/**
 * O WEB WORKER DO BALANCEADOR ("Comparar e balancear"): o "Testar" e o "Achar
 * os números" rodam aqui, fora da thread da página. Um worker por pedido,
 * fechado no fim ou no Cancelar (`balanceadorNoWorker.ts`). Como o
 * `lutas.worker.ts`: `self` e `postMessage` têm a mesma forma na lib DOM.
 */
self.addEventListener('message', (evento) => {
  atenderBalanceador(evento.data, (resposta) => self.postMessage(resposta), () => performance.now())
})

import { atenderPedido } from './atendimentoDasLutas'

/**
 * O WEB WORKER DAS LUTAS DO TREINO (LOBBY v2, fatia T4 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): as 100 lutas e o comparar
 * build rodam aqui, fora da thread da página, que segue respondendo e mostra
 * o progresso. A página abre um worker por pedido (`lutasNoWorker.ts`) e o
 * fecha no fim ou no "cancelar".
 *
 * `self`, `postMessage` e `performance` são os do worker (o tsconfig do client
 * só traz a lib DOM, onde `self` é a janela; as chamadas usadas aqui têm a
 * mesma forma nos dois).
 */
self.addEventListener('message', (evento) => {
  atenderPedido(evento.data, (resposta) => self.postMessage(resposta), () => performance.now())
})

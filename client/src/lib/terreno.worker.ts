import { ehPedidoDoTerreno, materiaisContados, type MaterialContado, type RespostaDoTerreno } from './contornoDoTerreno'

/**
 * O WEB WORKER DO CONTORNO DO TERRENO (FX-CAMINHO2-062): conta as formas dos
 * materiais com a mesma conta da página (`formasDoTerreno` e `pontosDosAneis`,
 * por `materiaisContados`) e devolve os pontos por transferência. Os contornos
 * de cada material ficam guardados aqui (`aneisDoMaterial`): mexer numa trilha
 * de terra não reconta o calçamento. `terrenoDoChao.ts`, `floorContour.ts` e
 * `floorSdf.ts` são contas puras, sem DOM.
 *
 * `self` e `postMessage` são os do worker (o tsconfig do client só traz a lib
 * DOM, onde `self` é a janela; as chamadas usadas aqui têm a mesma forma nos
 * dois), como em `texturas/ladrilhos.worker.ts`.
 */

function responder(resposta: RespostaDoTerreno, transferir: ArrayBuffer[] = []): void {
  if (transferir.length === 0) self.postMessage(resposta)
  else self.postMessage(resposta, { transfer: transferir })
}

/** Os buffers dos pontos, para a transferência (o `Float64Array` novo sempre tem o seu `ArrayBuffer`). */
function buffers(materiais: readonly MaterialContado[]): ArrayBuffer[] {
  const lista: ArrayBuffer[] = []
  for (const m of materiais) {
    const buffer = m.pontos.buffer
    if (buffer instanceof ArrayBuffer) lista.push(buffer)
  }
  return lista
}

self.addEventListener('message', (evento) => {
  const pedido: unknown = evento.data
  if (!ehPedidoDoTerreno(pedido)) return
  let materiais: MaterialContado[]
  try {
    materiais = materiaisContados(pedido.pecas, pedido.grid, pedido.clip)
  } catch {
    responder({ tipo: 'erro', pedido: pedido.pedido })
    return
  }
  responder({ tipo: 'terreno', pedido: pedido.pedido, materiais }, buffers(materiais))
})

// Carregou: a página para de contar o tempo de espera.
responder({ tipo: 'pronto' })

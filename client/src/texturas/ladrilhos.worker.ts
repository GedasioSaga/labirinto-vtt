import { texturaDoCatalogo } from './catalogo'
import { pixelsDoLadrilho } from './ladrilhos'
import type { PedidoDeLadrilho, RespostaDoLadrilho } from './ladrilhosNoWorker'

/**
 * O WEB WORKER DOS LADRILHOS (caça 12/11/2026, achado O3): pinta o ladrilho de
 * uma textura EMBUTIDA com a mesma conta da página (`pixelsDoLadrilho`) e
 * devolve os bytes por transferência. Aqui o catálogo só tem as embutidas (o
 * pacote do GitHub é registrado na página): `embutidas.ts`, `ruido.ts`,
 * `espalhar.ts` e `chaoDeMetal.ts` são contas puras, sem DOM.
 *
 * `self` e `postMessage` são os do worker (o tsconfig do client só traz a lib
 * DOM, onde `self` é a janela; as chamadas usadas aqui têm a mesma forma nos
 * dois), como em `lib/treino/lutas.worker.ts`.
 */

function responder(resposta: RespostaDoLadrilho, transferir?: ArrayBuffer): void {
  if (transferir === undefined) self.postMessage(resposta)
  else self.postMessage(resposta, { transfer: [transferir] })
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function ehPedido(valor: unknown): valor is PedidoDeLadrilho {
  if (!ehRegistro(valor)) return false
  const { pedido, id, lado, amostras } = valor
  return (
    typeof pedido === 'number' &&
    Number.isSafeInteger(pedido) &&
    typeof id === 'string' &&
    typeof lado === 'number' &&
    Number.isSafeInteger(lado) &&
    lado > 0 &&
    lado <= 4096 &&
    typeof amostras === 'number' &&
    Number.isSafeInteger(amostras) &&
    amostras >= 1 &&
    amostras <= 4
  )
}

self.addEventListener('message', (evento) => {
  const pedido: unknown = evento.data
  if (!ehPedido(pedido)) return
  const textura = texturaDoCatalogo(pedido.id)
  if (textura === null || textura.origem !== 'embutida') {
    responder({ tipo: 'erro', pedido: pedido.pedido })
    return
  }
  let pixels: Uint8ClampedArray
  try {
    pixels = pixelsDoLadrilho(textura.cor, pedido.lado, pedido.amostras)
  } catch {
    responder({ tipo: 'erro', pedido: pedido.pedido })
    return
  }
  const buffer = pixels.buffer
  responder({ tipo: 'ladrilho', pedido: pedido.pedido, pixels }, buffer instanceof ArrayBuffer ? buffer : undefined)
})

// Carregou: a página para de contar o tempo de espera.
responder({ tipo: 'pronto' })

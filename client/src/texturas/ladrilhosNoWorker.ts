import { texturaDoCatalogo } from './catalogo'

/**
 * O LADO DA PÁGINA DO WORKER DOS LADRILHOS (caça 12/11/2026, achado O3): o
 * ladrilho de uma textura EMBUTIDA (o calçamento custava ~880 ms, o convés
 * ~336 ms ao abrir o Reino de Goa) é pintado em `ladrilhos.worker.ts`, fora da
 * thread da página, com a MESMA conta (`pixelsDoLadrilho`), byte a byte.
 *
 * Um worker só, aberto no primeiro pedido e mantido aberto: os pedidos vão em
 * fila, com número. A textura do PACOTE não vai (a função de cor dela não
 * atravessa para o worker): a resposta é `null` e quem pediu pinta em fatias
 * aqui mesmo (`ladrilhos.ts`). O mesmo vale para worker que não abre (sem
 * `Worker`, como no jsdom dos testes), que quebra, ou que não diz "pronto" em
 * `ESPERA_DO_WORKER_MS`: dali em diante tudo volta às fatias.
 */

/** O pedido que vai ao worker. */
export interface PedidoDeLadrilho {
  readonly pedido: number
  readonly id: string
  readonly lado: number
  readonly amostras: number
}

/** O que o worker manda de volta: o aviso de que abriu, ou a resposta de um pedido. */
export type RespostaDoLadrilho =
  | { readonly tipo: 'pronto' }
  | { readonly tipo: 'ladrilho'; readonly pedido: number; readonly pixels: Uint8ClampedArray }
  | { readonly tipo: 'erro'; readonly pedido: number }

/** O que este arquivo usa do `Worker` do navegador. */
interface CanalDosLadrilhos {
  postMessage(pedido: PedidoDeLadrilho): void
  terminate(): void
  onmessage: ((evento: MessageEvent) => void) | null
  onerror: ((evento: ErrorEvent) => void) | null
}

/** Tempo para o worker carregar e dizer "pronto"; passou, ele é dado como quebrado (as fatias assumem). */
const ESPERA_DO_WORKER_MS = 8000

interface Espera {
  readonly bytes: number
  readonly resolver: (pixels: Uint8ClampedArray | null) => void
}

let canal: CanalDosLadrilhos | null = null
let quebrado = false
let proximoPedido = 1
let relogioDaEspera: ReturnType<typeof setTimeout> | null = null
const esperando = new Map<number, Espera>()

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Lê a mensagem do worker; forma estranha = `null` (ignorada). */
export function respostaDoLadrilho(valor: unknown): RespostaDoLadrilho | null {
  if (!ehRegistro(valor)) return null
  if (valor.tipo === 'pronto') return { tipo: 'pronto' }
  const { pedido } = valor
  if (typeof pedido !== 'number' || !Number.isSafeInteger(pedido)) return null
  if (valor.tipo === 'erro') return { tipo: 'erro', pedido }
  if (valor.tipo === 'ladrilho' && valor.pixels instanceof Uint8ClampedArray) return { tipo: 'ladrilho', pedido, pixels: valor.pixels }
  return null
}

function abrirWorkerDosLadrilhos(): CanalDosLadrilhos {
  // O `new URL(..., import.meta.url)` é o que o Vite reconhece para empacotar o worker à parte (o molde de `lutasNoWorker.ts`).
  return new Worker(new URL('./ladrilhos.worker.ts', import.meta.url), { type: 'module' })
}

/** O worker não serve: fecha, e todo pedido em espera recebe `null` (vai para as fatias). */
function desistir(): void {
  quebrado = true
  if (relogioDaEspera !== null) clearTimeout(relogioDaEspera)
  relogioDaEspera = null
  if (canal !== null) {
    canal.onmessage = null
    canal.onerror = null
    canal.terminate()
  }
  canal = null
  const pendentes = [...esperando.values()]
  esperando.clear()
  for (const espera of pendentes) espera.resolver(null)
}

function receber(evento: MessageEvent): void {
  const resposta = respostaDoLadrilho(evento.data)
  if (resposta === null) return
  if (resposta.tipo === 'pronto') {
    if (relogioDaEspera !== null) clearTimeout(relogioDaEspera)
    relogioDaEspera = null
    return
  }
  const espera = esperando.get(resposta.pedido)
  if (espera === undefined) return
  esperando.delete(resposta.pedido)
  // Tamanho errado não entra no cache: as fatias refazem.
  espera.resolver(resposta.tipo === 'ladrilho' && resposta.pixels.length === espera.bytes ? resposta.pixels : null)
}

function canalAberto(): CanalDosLadrilhos | null {
  if (quebrado) return null
  if (canal !== null) return canal
  if (typeof Worker === 'undefined') {
    quebrado = true
    return null
  }
  let novo: CanalDosLadrilhos
  try {
    novo = abrirWorkerDosLadrilhos()
  } catch {
    // Ex.: o navegador recusa o worker (CSP, arquivo que não carrega).
    quebrado = true
    return null
  }
  novo.onmessage = receber
  novo.onerror = (evento) => {
    // O erro vira a volta às fatias: sem isto o navegador o repete no console como erro não tratado.
    evento.preventDefault()
    desistir()
  }
  canal = novo
  relogioDaEspera = setTimeout(desistir, ESPERA_DO_WORKER_MS)
  return novo
}

/**
 * Os pixels do ladrilho da textura embutida `id`, pintados no worker. `null` =
 * não deu (textura de pacote, sem worker, worker quebrado): quem pediu pinta
 * em fatias na thread da página.
 */
export function ladrilhoNoWorker(id: string, lado: number, amostras = 1): Promise<Uint8ClampedArray | null> {
  if (texturaDoCatalogo(id)?.origem !== 'embutida') return Promise.resolve(null)
  const aberto = canalAberto()
  if (aberto === null) return Promise.resolve(null)
  const pedido = proximoPedido
  proximoPedido += 1
  return new Promise((resolver) => {
    esperando.set(pedido, { bytes: lado * lado * 4, resolver })
    try {
      aberto.postMessage({ pedido, id, lado, amostras })
    } catch {
      esperando.delete(pedido)
      resolver(null)
    }
  })
}

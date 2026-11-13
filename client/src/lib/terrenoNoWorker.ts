import type { FloorPiece, PinceladaDeTextura } from '../types/map'
import { passosDosMateriais, respostaDoTerreno, type MaterialContado, type PedidoDoTerreno } from './contornoDoTerreno'
import type { FloorClip } from './floorContour'
import { chaveDaGradeDoTerreno, chaveDoTerreno, passosDoTerreno, pecasDoContorno } from './terrenoDoChao'

/**
 * O CONTORNO DO TERRENO FORA DA THREAD DA PÁGINA (FX-CAMINHO2-062): pôr um
 * caminho de calçamento no Goa contava ~0,4 s de contorno numa tarefa só (o
 * segundo caminho do mesmo material, ~1 s), e abrir o Goa com dois caminhos
 * somava isso à tarefa da cena. A conta vai para `terreno.worker.ts`, a MESMA
 * (`contornoDoTerreno.ts`): os passos saem iguais, byte a byte.
 *
 * O molde é o de `texturas/ladrilhosNoWorker.ts`: um worker só, aberto no
 * primeiro pedido e mantido aberto; os pedidos vão em fila, com número, e a
 * resposta de pedido que ninguém espera é ignorada. O worker recebe só as
 * peças que já iam para o contorno (`pecasDoContorno`): no jogador, as do
 * recorte dele. Sem `Worker` (o jsdom dos testes) a conta é a de sempre, na
 * hora; worker que não abre, quebra ou não diz "pronto" em
 * `ESPERA_DO_WORKER_MS`: o pedido em espera e os seguintes contam na página.
 *
 * Quem pede (`pedirTerreno`) recebe os passos na hora quando já estão
 * contados (guardados pela lista e pelo desenho das peças) e uma promessa
 * quando não; o mesmo desenho pedido de novo enquanto conta espera a mesma
 * conta. A resposta que chega fora de ordem quem descarta é quem pediu (o
 * pintor do terreno, pela versão do pedido dele).
 */

/** O que este arquivo usa do `Worker` do navegador. */
interface CanalDoTerreno {
  postMessage(pedido: PedidoDoTerreno): void
  terminate(): void
  onmessage: ((evento: MessageEvent) => void) | null
  onerror: ((evento: ErrorEvent) => void) | null
}

/** Tempo para o worker carregar e dizer "pronto"; passou, ele é dado como quebrado (a página conta). */
const ESPERA_DO_WORKER_MS = 8000
/** Quantos terrenos contados ficam guardados pelo desenho (o editor e o recorte do jogador voltam aos mesmos). */
const TERRENOS_GUARDADOS = 8

let canal: CanalDoTerreno | null = null
let quebrado = false
let proximoPedido = 1
let relogioDaEspera: ReturnType<typeof setTimeout> | null = null
/** Os pedidos no worker, pelo número; `null` = conte na página. */
const esperando = new Map<number, (materiais: readonly MaterialContado[] | null) => void>()
/** O desenho que está sendo contado agora: o mesmo pedido de novo espera a mesma conta. */
const contando = new Map<string, Promise<PinceladaDeTextura[]>>()
/** Os últimos terrenos contados, pelo desenho (o mais recente no fim). */
const guardados: Array<{ chave: string; passos: PinceladaDeTextura[] }> = []
/** O terreno de cada lista já vista (a store é imutável: a mesma lista é o mesmo terreno), com a grade e o recorte. */
const porLista = new WeakMap<readonly FloorPiece[], { daGrade: string; passos: PinceladaDeTextura[] }>()

function abrirWorkerDoTerreno(): CanalDoTerreno {
  // O `new URL(..., import.meta.url)` é o que o Vite reconhece para empacotar o worker à parte (o molde de `ladrilhosNoWorker.ts`).
  return new Worker(new URL('./terreno.worker.ts', import.meta.url), { type: 'module' })
}

/** O worker não serve: fecha, e todo pedido em espera conta na página. */
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
  for (const resolver of pendentes) resolver(null)
}

function receber(evento: MessageEvent): void {
  const resposta = respostaDoTerreno(evento.data)
  if (resposta === null) return
  if (resposta.tipo === 'pronto') {
    if (relogioDaEspera !== null) clearTimeout(relogioDaEspera)
    relogioDaEspera = null
    return
  }
  const resolver = esperando.get(resposta.pedido)
  if (resolver === undefined) return
  esperando.delete(resposta.pedido)
  resolver(resposta.tipo === 'terreno' ? resposta.materiais : null)
}

function canalAberto(): CanalDoTerreno | null {
  if (quebrado) return null
  if (canal !== null) return canal
  if (typeof Worker === 'undefined') {
    quebrado = true
    return null
  }
  let novo: CanalDoTerreno
  try {
    novo = abrirWorkerDoTerreno()
  } catch {
    // Ex.: o navegador recusa o worker (CSP, arquivo que não carrega).
    quebrado = true
    return null
  }
  novo.onmessage = receber
  novo.onerror = (evento) => {
    // O erro vira a conta na página: sem isto o navegador o repete no console como erro não tratado.
    evento.preventDefault()
    desistir()
  }
  canal = novo
  relogioDaEspera = setTimeout(desistir, ESPERA_DO_WORKER_MS)
  return novo
}

function lembrar(chave: string, passos: PinceladaDeTextura[]): void {
  const k = guardados.findIndex((g) => g.chave === chave)
  if (k >= 0) guardados.splice(k, 1)
  guardados.push({ chave, passos })
  if (guardados.length > TERRENOS_GUARDADOS) guardados.shift()
}

/** O pedido no worker; `null` (worker quebrado no caminho, ou erro na conta dele) = conte na página. */
function contarNoWorker(aberto: CanalDoTerreno, pecas: readonly FloorPiece[], grid: number, clip: FloorClip | null): Promise<readonly MaterialContado[] | null> {
  const pedido = proximoPedido
  proximoPedido += 1
  return new Promise((resolver) => {
    esperando.set(pedido, resolver)
    try {
      aberto.postMessage({ pedido, pecas, grid, clip })
    } catch {
      esperando.delete(pedido)
      resolver(null)
    }
  })
}

/**
 * Os passos de balde do terreno destas peças (os de `passosDoTerreno`). Já
 * contados, ou sem worker: o array, na hora. Contando no worker: a promessa
 * dele (que, se o worker falhar, conta na página).
 */
export function pedirTerreno(floor: readonly FloorPiece[], grid: number, clip?: FloorClip): PinceladaDeTextura[] | Promise<PinceladaDeTextura[]> {
  const daGrade = chaveDaGradeDoTerreno(grid, clip)
  const naLista = porLista.get(floor)
  if (naLista !== undefined && naLista.daGrade === daGrade) return naLista.passos
  const contam = pecasDoContorno(floor)
  const chave = chaveDoTerreno(contam, grid, clip)
  const guardar = (passos: PinceladaDeTextura[]): PinceladaDeTextura[] => {
    porLista.set(floor, { daGrade, passos })
    lembrar(chave, passos)
    return passos
  }
  const achado = guardados.find((g) => g.chave === chave)
  if (achado !== undefined) return guardar(achado.passos)
  const aberto = contam.length === 0 ? null : canalAberto()
  // Sem peça que conte, ou sem worker: a conta de sempre, na hora.
  if (aberto === null) return guardar(passosDoTerreno(floor, grid, clip))
  const emCurso = contando.get(chave)
  if (emCurso !== undefined) return emCurso.then(guardar)
  const conta = contarNoWorker(aberto, contam, grid, clip ?? null)
    .then((materiais) => guardar(materiais === null ? passosDoTerreno(contam, grid, clip) : passosDosMateriais(materiais)))
    .finally(() => contando.delete(chave))
  contando.set(chave, conta)
  return conta
}

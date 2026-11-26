import type { MapData } from '../types/map'
import { assinaturaDaMiniatura, type FabricanteDeMiniatura } from '../lib/miniaturaDaCena'
import { useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
import { useSessionStore } from './sessionStore'

/**
 * MINIATURAS DAS CENAS (pedido de 25/11/2026): a imagem de cada cena na lista,
 * pintada pelo canvas do editor (`gerarMiniatura`, `pixi/PixiCanvas.tsx`) e
 * guardada.
 *
 * - Na MEMÓRIA, por cena (o id da lista): a linha mostra a última que ficou
 *   pronta, também enquanto a próxima é feita, e não pisca.
 * - No BANCO do navegador (IndexedDB), pela assinatura do mapa
 *   (`assinaturaDaMiniatura`): reabrir o app não pinta de novo o que não mudou.
 * - UMA POR VEZ, no tempo livre: a fila espera o navegador ficar ocioso antes
 *   de cada passo caro (a assinatura e a pintura).
 *
 * A cena ABERTA muda a cada gesto do mestre: a miniatura dela só é refeita
 * quando ele SALVA, com uma espera curta (`ESPERA_DEPOIS_DE_SALVAR_MS`). As de
 * fundo, quando a linha aparece com um mapa diferente do da imagem.
 */

/** O que a linha mostra: a imagem (`url` de objeto) ou, com `url` nula, o ícone de cena vazia. */
export interface MiniaturaPronta {
  readonly url: string | null
}

interface Feita {
  pronta: MiniaturaPronta
  /** O mapa que a linha conferiu por último: o mesmo de novo não refaz nada. */
  mapa: MapData
  /** A assinatura de onde a imagem saiu; `null` quando a pintura falhou (fica a imagem anterior). */
  assinatura: string | null
}

interface Pedido {
  mapa: MapData
  /** Pedido da linha à vista: sai da fila quando ela some. O do Salvar fica. */
  daLista: boolean
}

/** Depois do Salvar: o mestre que salva e segue mexendo não paga uma pintura a cada Ctrl+S seguido. */
const ESPERA_DEPOIS_DE_SALVAR_MS = 1500
/** O navegador que nunca fica ocioso (arrasto sem parar) não segura a fila mais que isto. */
const ESPERA_MAXIMA_PELO_OCIOSO_MS = 2000

const feitas = new Map<string, Feita>()
const fila = new Map<string, Pedido>()
/**
 * Quantas caixas à vista querem a cena agora (a linha da lista de Cenas e o
 * cartão da Visão geral): fechar a Visão geral não tira da fila o pedido da
 * linha que continua à vista.
 */
const interessados = new Map<string, number>()
const ouvintes = new Set<() => void>()
let fabricante: FabricanteDeMiniatura | null = null
let trabalhando = false
let desligarDoSalvar: (() => void) | null = null
let esperaDoSalvar: number | null = null

function avisar(): void {
  for (const ouvir of ouvintes) ouvir()
}

/** Para o `useSyncExternalStore` da linha. */
export function assinarMiniaturas(ouvir: () => void): () => void {
  ouvintes.add(ouvir)
  return () => {
    ouvintes.delete(ouvir)
  }
}

/** A miniatura de agora da cena `chave` (o mesmo objeto até ela mudar); `undefined` = ainda nenhuma. */
export function miniaturaDaCena(chave: string): MiniaturaPronta | undefined {
  return feitas.get(chave)?.pronta
}

/**
 * O canvas do editor montou (ou desmontou, com `null`). Sem ele a fila espera:
 * só ele sabe pintar a cena como o mapa mostra.
 */
export function registrarFabricanteDeMiniatura(novo: FabricanteDeMiniatura | null): void {
  fabricante = novo
  if (novo === null) {
    desligarDoSalvar?.()
    desligarDoSalvar = null
    if (esperaDoSalvar !== null) window.clearTimeout(esperaDoSalvar)
    esperaDoSalvar = null
    return
  }
  desligarDoSalvar ??= useSessionStore.subscribe((agora, antes) => {
    // `isDirty` que cai = o mapa aberto acabou de ir para o disco (ou de chegar dele).
    if (antes.isDirty && !agora.isDirty) depoisDeSalvar()
  })
  void trabalhar()
}

/** A chave da cena aberta na lista: o id dela na aventura, ou '' no mapa solto (`sceneList`). */
function chaveDaAberta(): string {
  const { adventure, activeSceneId } = useAdventureStore.getState()
  return adventure === null ? '' : (activeSceneId ?? '')
}

function depoisDeSalvar(): void {
  if (esperaDoSalvar !== null) window.clearTimeout(esperaDoSalvar)
  esperaDoSalvar = window.setTimeout(() => {
    esperaDoSalvar = null
    fila.set(chaveDaAberta(), { mapa: useMapStore.getState().map, daLista: false })
    void trabalhar()
  }, ESPERA_DEPOIS_DE_SALVAR_MS)
}

/**
 * A linha da cena `chave` está à vista com `mapa`. A de fundo com mapa novo
 * entra na fila; a ABERTA só na primeira vez (ou quando outra cena com o mesmo
 * id entrou no lugar): depois, só o Salvar a refaz.
 */
export function pedirMiniatura(chave: string, mapa: MapData, aberta: boolean): void {
  interessados.set(chave, (interessados.get(chave) ?? 0) + 1)
  const feita = feitas.get(chave)
  if (feita !== undefined && (feita.mapa === mapa || (aberta && feita.mapa.id === mapa.id))) return
  const pedido = fila.get(chave)
  fila.set(chave, { mapa, daLista: pedido === undefined ? true : pedido.daLista })
  void trabalhar()
}

/**
 * A caixa saiu da vista: quando era a última que queria a cena, o pedido (se
 * ainda não começou) sai da fila. O do Salvar fica. Cada `esquecerPedido` fecha
 * um `pedirMiniatura` (o efeito da caixa faz os dois em par).
 */
export function esquecerPedido(chave: string): void {
  const restam = (interessados.get(chave) ?? 1) - 1
  if (restam > 0) {
    interessados.set(chave, restam)
    return
  }
  interessados.delete(chave)
  if (fila.get(chave)?.daLista === true) fila.delete(chave)
}

/** Espera o navegador ficar livre (ou a espera máxima). */
function vezOciosa(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: ESPERA_MAXIMA_PELO_OCIOSO_MS })
    else window.setTimeout(resolve, 50)
  })
}

async function trabalhar(): Promise<void> {
  if (trabalhando) return
  trabalhando = true
  try {
    for (;;) {
      if (fabricante === null) return
      const proximo = fila.entries().next()
      if (proximo.done === true) return
      const [chave, pedido] = proximo.value
      fila.delete(chave)
      await fazer(chave, pedido.mapa)
    }
  } finally {
    trabalhando = false
  }
}

/**
 * A cena apagada, e todas as da aventura que fechou ou trocou, soltam a imagem
 * (`revokeObjectURL`) e o mapa guardados aqui. Sem isto a memória crescia a
 * cada aventura aberta numa sessão longa. A chave '' é a do mapa solto.
 */
function soltarCenasQueSairam(): void {
  if (feitas.size === 0 && fila.size === 0) return
  const { adventure } = useAdventureStore.getState()
  const vivas = new Set(adventure === null ? [''] : adventure.scenes.map((cena) => cena.id))
  let mudou = false
  for (const [chave, feita] of feitas) {
    if (vivas.has(chave)) continue
    if (typeof feita.pronta.url === 'string') URL.revokeObjectURL(feita.pronta.url)
    feitas.delete(chave)
    mudou = true
  }
  for (const chave of fila.keys()) {
    if (!vivas.has(chave)) fila.delete(chave)
  }
  if (mudou) avisar()
}

useAdventureStore.subscribe((agora, antes) => {
  if (agora.adventure !== antes.adventure) soltarCenasQueSairam()
})

function por(chave: string, mapa: MapData, assinatura: string, imagem: Blob | null): void {
  const urlAntiga = feitas.get(chave)?.pronta.url
  if (typeof urlAntiga === 'string') URL.revokeObjectURL(urlAntiga)
  feitas.set(chave, { pronta: { url: imagem === null ? null : URL.createObjectURL(imagem) }, mapa, assinatura })
  avisar()
}

async function fazer(chave: string, mapa: MapData): Promise<void> {
  await vezOciosa()
  const assinatura = assinaturaDaMiniatura(mapa)
  const feita = feitas.get(chave)
  if (feita !== undefined && feita.assinatura === assinatura) {
    feitas.set(chave, { ...feita, mapa })
    return
  }
  const guardada = await lerGuardada(assinatura)
  if (guardada !== undefined) {
    por(chave, mapa, assinatura, guardada)
    return
  }
  const pintar = fabricante
  if (pintar === null) {
    // O canvas desmontou no meio: volta para a fila e espera o próximo.
    if (!fila.has(chave)) fila.set(chave, { mapa, daLista: false })
    return
  }
  await vezOciosa()
  let imagem: Blob | null
  try {
    imagem = await pintar(mapa)
  } catch (erro: unknown) {
    console.warn('[miniaturas] a pintura da cena falhou', erro)
    // Fica a imagem anterior, e o mesmo mapa não tenta de novo (só o próximo, ou o Salvar). Sem anterior,
    // nada entra: o quadro fica vazio (e não com o ícone de cena vazia, que mentiria) e a linha pede de novo depois.
    if (feita !== undefined) feitas.set(chave, { ...feita, mapa, assinatura: null })
    return
  }
  void guardar(assinatura, imagem)
  por(chave, mapa, assinatura, imagem)
}

/* ------------------------------------------------------- o banco (IndexedDB) */

const NOME_DO_BANCO = 'lb-miniaturas-das-cenas'
const VERSAO_DO_BANCO = 1
const LOJA = 'miniaturas'
/**
 * A guardada feita há mais que isto sai do banco: quase sempre é de uma cena
 * que mudou depois (a nova tem outra assinatura) ou que não existe mais. A que
 * ainda valia é pintada de novo uma vez, quando a linha aparecer.
 */
const VALIDADE_MS = 60 * 24 * 60 * 60 * 1000

interface Guardada {
  assinatura: string
  /** `null` = cena vazia (o ícone). */
  imagem: Blob | null
  feitaEm: number
}

function ehGuardada(valor: unknown): valor is Guardada {
  if (typeof valor !== 'object' || valor === null) return false
  if (!('assinatura' in valor) || !('imagem' in valor) || !('feitaEm' in valor)) return false
  return typeof valor.assinatura === 'string' && typeof valor.feitaEm === 'number' && (valor.imagem === null || valor.imagem instanceof Blob)
}

let banco: Promise<IDBDatabase | null> | null = null

/** O banco, aberto uma vez. Sem IndexedDB (ou recusado), `null`: as miniaturas valem só enquanto o app está aberto. */
function abrirBanco(): Promise<IDBDatabase | null> {
  banco ??= new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    let pedido: IDBOpenDBRequest
    try {
      pedido = indexedDB.open(NOME_DO_BANCO, VERSAO_DO_BANCO)
    } catch {
      resolve(null)
      return
    }
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(LOJA)) pedido.result.createObjectStore(LOJA, { keyPath: 'assinatura' })
    }
    pedido.onsuccess = () => {
      resolve(pedido.result)
      podarVencidas(pedido.result)
    }
    pedido.onerror = () => resolve(null)
    pedido.onblocked = () => resolve(null)
  })
  return banco
}

/** A guardada com esta assinatura: a imagem, `null` (cena vazia) ou `undefined` (não há). Erro no banco = não há. */
async function lerGuardada(assinatura: string): Promise<Blob | null | undefined> {
  const db = await abrirBanco()
  if (db === null) return undefined
  return new Promise((resolve) => {
    try {
      const pedido = db.transaction(LOJA, 'readonly').objectStore(LOJA).get(assinatura)
      pedido.onsuccess = () => {
        const valor: unknown = pedido.result
        resolve(ehGuardada(valor) ? valor.imagem : undefined)
      }
      pedido.onerror = () => resolve(undefined)
    } catch {
      resolve(undefined)
    }
  })
}

/** Guarda sem esperar e sem lançar: o banco que recusa só faz a imagem valer até fechar o app. */
async function guardar(assinatura: string, imagem: Blob | null): Promise<void> {
  const db = await abrirBanco()
  if (db === null) return
  try {
    const valor: Guardada = { assinatura, imagem, feitaEm: Date.now() }
    db.transaction(LOJA, 'readwrite').objectStore(LOJA).put(valor)
  } catch (erro: unknown) {
    console.warn('[miniaturas] não deu para guardar a miniatura', erro)
  }
}

/** Uma vez por abertura do app: tira as guardadas vencidas (cena que mudou depois, ou que não existe mais). */
function podarVencidas(db: IDBDatabase): void {
  const limite = Date.now() - VALIDADE_MS
  try {
    const cursor = db.transaction(LOJA, 'readwrite').objectStore(LOJA).openCursor()
    cursor.onsuccess = () => {
      const atual = cursor.result
      if (atual === null) return
      const valor: unknown = atual.value
      if (!ehGuardada(valor) || valor.feitaEm < limite) atual.delete()
      atual.continue()
    }
  } catch (erro: unknown) {
    console.warn('[miniaturas] não deu para limpar as miniaturas antigas', erro)
  }
}

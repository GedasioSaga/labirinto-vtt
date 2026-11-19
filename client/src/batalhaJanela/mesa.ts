import { equipesAtivas, mochilaMoraNaFicha, personagensAtivos, sistemaAtivo, useAdventureStore } from '../stores/adventureStore'
import { useBatalhaDBTStore } from '../stores/batalhaDBTStore'
import { useBatalhaStore } from '../stores/batalhaStore'
import { useMapStore } from '../stores/mapStore'
import { useRpgStore } from '../stores/rpgStore'
import { aplicarPedidoDBT, espelhoDBT } from './espelhoDBT'
import { aplicarPedidoOP, espelhoOP } from './espelhoOP'
import { abrirOLivroDaBatalha, useTelaDaMesa } from './telaDaMesa'
import type { EspelhoDaBatalha, PedidoDaMesa, RespostaDaMesa } from './tipos'

/**
 * A MESA DA BATALHA lida da janela principal: o espelho da cena aberta e o
 * único lugar que aplica um pedido (o diálogo do app chama direto; a janela
 * da batalha chega pelo fio, `janelaDaBatalha.ts`).
 */

/** A chave da cena aberta: a mesma do App (`activeSceneId ?? map.id`, o `tableSceneKey`). */
export function cenaAberta(): string {
  return useAdventureStore.getState().activeSceneId ?? useMapStore.getState().map.id
}

/**
 * O espelho da cena aberta. A batalha que a cena JÁ tem manda (a mesma regra da
 * página Batalha do livro): One Piece se ela está no One Piece, senão Dragon Ball.
 * `null` = sem batalha na cena aberta.
 */
export function espelhoAgora(): EspelhoDaBatalha | null {
  const sceneKey = cenaAberta()
  if (Object.hasOwn(useBatalhaStore.getState().cenas, sceneKey)) return espelhoOP(sceneKey)
  if (Object.hasOwn(useBatalhaDBTStore.getState().cenas, sceneKey)) return espelhoDBT(sceneKey)
  return null
}

/**
 * Aplica o pedido na batalha da cena que ele diz. A cena tem de ser a aberta:
 * a tela mostrava a cena aberta, e um pedido que chega depois de o mestre
 * trocar de cena não vale para a outra.
 */
export function aplicarPedido(pedido: PedidoDaMesa): RespostaDaMesa {
  if (pedido.sceneKey !== cenaAberta()) return { ok: false, motivo: 'A cena aberta mudou: a mesa já mostra a nova.' }
  if (pedido.acao === 'abrirLivro') {
    // Não é da batalha: o App abre o livro da mesa na página Batalha (dano, selos, extras, regras, formas).
    abrirOLivroDaBatalha()
    return { ok: true, motivo: null }
  }
  if (Object.hasOwn(useBatalhaStore.getState().cenas, pedido.sceneKey)) return aplicarPedidoOP(pedido)
  if (Object.hasOwn(useBatalhaDBTStore.getState().cenas, pedido.sceneKey)) return aplicarPedidoDBT(pedido)
  return { ok: false, motivo: 'A batalha desta cena já acabou.' }
}

/** O espelho sai no máximo a cada tanto: um golpe mexe em várias lojas de uma vez. */
const ESPELHO_A_CADA_MS = 80

/** O que, mudando, pode mudar o espelho. Arrastar a câmera mexe no mapStore e não troca nada disto. */
function referencias(): readonly unknown[] {
  const { map } = useMapStore.getState()
  const aventura = useAdventureStore.getState()
  return [
    useBatalhaStore.getState().cenas,
    useBatalhaDBTStore.getState().cenas,
    map.id,
    map.tokens,
    map.grid,
    aventura.activeSceneId,
    personagensAtivos(aventura),
    equipesAtivas(aventura),
    sistemaAtivo(aventura),
    mochilaMoraNaFicha(aventura),
    useRpgStore.getState().biblioteca,
    useTelaDaMesa.getState().menuDoMapa,
  ]
}

/**
 * Chama `aoMudar` com o espelho de agora e de novo a cada mudança que importa
 * (no máximo a cada `ESPELHO_A_CADA_MS`). Devolve o desligar.
 */
export function assinarEspelho(aoMudar: (espelho: EspelhoDaBatalha | null) => void): () => void {
  let antes: readonly unknown[] = []
  let agendado: ReturnType<typeof setTimeout> | null = null
  let vivo = true
  const mandar = () => {
    agendado = null
    if (vivo) aoMudar(espelhoAgora())
  }
  const conferir = () => {
    const agora = referencias()
    if (agora.length === antes.length && agora.every((valor, indice) => valor === antes[indice])) return
    antes = agora
    agendado ??= setTimeout(mandar, ESPELHO_A_CADA_MS)
  }
  const desligar = [
    useBatalhaStore.subscribe(conferir),
    useBatalhaDBTStore.subscribe(conferir),
    useMapStore.subscribe(conferir),
    useAdventureStore.subscribe(conferir),
    useRpgStore.subscribe(conferir),
    useTelaDaMesa.subscribe(conferir),
  ]
  antes = referencias()
  aoMudar(espelhoAgora())
  return () => {
    vivo = false
    if (agendado !== null) clearTimeout(agendado)
    for (const parar of desligar) parar()
  }
}

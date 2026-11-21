import type { Desafio, MapData } from '../types/map'
import type { Corner } from '../lib/objectTransform'
import type { Point } from './world'
import { anguloDoSelo, desafiosDo, patchDoAnguloDoSelo, patchDoSeloMovido, patchDoTamanhoDoSelo, pinoDoDesafio, tamanhoDoSeloNaFaixa, type PatchDoDesafio } from '../lib/desafios'
import { findBoxCornerHandleAt } from '../lib/handleHitArea'
import { angleAroundPivot, formatRotationLabel, isOnPropRotateHandle } from '../lib/roomRotation'
import { useMapStore } from '../stores/mapStore'
import { caixaDoSelo, seloParaGirar, tamanhoPeloCantoDoSelo } from './drawPins'

/**
 * Gesto do SELO DO DESAFIO no editor do mestre (pedido de 21/11/2026: "uma vez
 * que coloco o minigame no chão não consigo mudar de lugar, faça eu conseguir
 * mudar, aumentar e diminuir de tamanho, mesma coisa para o puzzle"), no molde
 * do papel no chão (`papelNoMapaGesture.ts`), sem Pixi: o PixiCanvas repassa os
 * eventos do stage.
 *
 * - CORPO: o pointerdown só segura. Soltar dentro da folga é o TOQUE, que abre
 *   a ficha na página Jogos (quem chama abre); passar da folga é ARRASTO, que
 *   leva o selo e não abre nada. Só o selo posto num PONTO se arrasta: o posto
 *   num objeto anda com o objeto. Cada quadro grava sem histórico
 *   (`mudarDesafioLive`) e o arrasto inteiro vira UM Ctrl+Z (`commitDragHistory(antes)`).
 * - CANTO: o chip do selo aberto na página Jogos muda o `tamanho` do desafio.
 * - GIRO: a alça de girar (a mesma do objeto) muda o `angulo`, em volta da cabeça;
 *   Shift encaixa de 15 em 15°.
 *
 * Esc no meio (`cancelar`) devolve o selo como estava e não grava nada.
 */

type SeloStore = Pick<typeof useMapStore, 'getState'>

interface Aperto {
  id: string
  inicial: Desafio
  /** Do ponto pego ao ponto marcado do selo: ele não salta para debaixo do ponteiro. */
  pegada: Point
  /** Onde o botão desceu, em px de TELA: a folga do toque se mede aqui. */
  tela: Point
  moveu: boolean
  /** O mapa do pointerdown — o que o Ctrl+Z devolve. */
  antes: MapData
}

interface Alca {
  id: string
  inicial: Desafio
  /** O ponto marcado do selo: o tamanho cresce a partir dele. */
  ancora: Point
  canto: Corner
  /** O fator de tela dos pinos no pointerdown (`pinSizeScale`): o canto segue o selo como ele aparece. */
  sizeScale: number
  antes: MapData
}

interface Giro {
  id: string
  inicial: Desafio
  /** A cabeça do selo: em volta dela tudo gira. */
  pivo: Point
  /** A direção do ponteiro no pointerdown: o giro é a diferença até a de agora. */
  ponteiroInicial: number
  antes: MapData
}

/** Shift no giro: de 15 em 15°, como a sala. */
const PASSO_DO_GIRO_COM_SHIFT = 15

export type SoltarDoSelo = { tipo: 'toque'; id: string } | { tipo: 'arrasto' }

function desafioPorId(map: MapData, id: string): Desafio | undefined {
  return desafiosDo(map).find((desafio) => desafio.id === id)
}

/** Foi e voltou ao mesmo lugar e tamanho: um Ctrl+Z que "não faz nada" é pior que nenhum. */
function mudou(antes: Desafio, depois: Desafio | undefined): boolean {
  return depois !== undefined && JSON.stringify(antes) !== JSON.stringify(depois)
}

/** O que o Esc devolve: o lugar, o piso e o tamanho do começo do gesto. */
function patchDoComeco(desafio: Desafio): PatchDoDesafio {
  return { lugar: desafio.lugar, piso: desafio.piso, tamanho: desafio.tamanho, angulo: desafio.angulo }
}

export function createSeloNoMapaGesture(folgaDoToquePx: number, store: SeloStore = useMapStore) {
  let aperto: Aperto | null = null
  let alca: Alca | null = null
  let giro: Giro | null = null

  const fechar = (antes: MapData, id: string, inicial: Desafio) => {
    if (mudou(inicial, desafioPorId(store.getState().map, id))) store.getState().commitDragHistory(antes)
  }

  return {
    /** Pointerdown no corpo do selo `id`: segura, e ainda não move (pode ser o toque que abre a ficha). Só o selo num ponto; senão `false`. */
    apertar(id: string, ponto: Point, tela: Point): boolean {
      const map = store.getState().map
      const desafio = desafioPorId(map, id)
      if (desafio === undefined || desafio.lugar.tipo !== 'ponto') return false
      aperto = { id, inicial: desafio, pegada: { x: desafio.lugar.x - ponto.x, y: desafio.lugar.y - ponto.y }, tela, moveu: false, antes: map }
      return true
    },

    /** Pointermove com o selo seguro: dentro da folga ainda é toque; passou dela, o selo segue o ponteiro no piso `piso`. */
    mover(ponto: Point, tela: Point, piso: number): boolean {
      if (aperto === null) return false
      if (!aperto.moveu) {
        if (Math.hypot(tela.x - aperto.tela.x, tela.y - aperto.tela.y) < folgaDoToquePx) return true
        aperto.moveu = true
      }
      const { id, pegada } = aperto
      store.getState().mudarDesafioLive(id, patchDoSeloMovido(ponto.x + pegada.x, ponto.y + pegada.y, piso))
      return true
    },

    /** Pointerup: o toque devolve o desafio (quem chama abre a ficha); o arrasto vira um Ctrl+Z só. */
    soltar(): SoltarDoSelo | null {
      if (aperto === null) return null
      const { id, inicial, moveu, antes } = aperto
      aperto = null
      if (!moveu) return { tipo: 'toque', id }
      fechar(antes, id, inicial)
      return { tipo: 'arrasto' }
    },

    /** Pointerdown com o selo `id` escolhido: começa o arrasto do tamanho se o ponto cai num chip de canto. */
    comecarAlca(id: string, ponto: Point, sizeScale: number, sizeFloor: number, cameraScale: number): Corner | null {
      const map = store.getState().map
      const desafio = desafioPorId(map, id)
      const pino = desafio === undefined ? null : pinoDoDesafio(desafio, map.props, 'mestre')
      if (desafio === undefined || pino === null) return null
      const canto = findBoxCornerHandleAt(caixaDoSelo(pino, sizeScale, sizeFloor), ponto, cameraScale)
      if (canto === null) return null
      alca = { id, inicial: desafio, ancora: { x: pino.x, y: pino.y }, canto, sizeScale, antes: map }
      return canto
    },

    /** Pointermove do chip: o canto vai até o ponteiro. Devolve a etiqueta junto ao ponteiro ("150%", a régua do "Tamanho" da ficha). */
    moverAlca(ponto: Point): string | null {
      if (alca === null) return null
      const tamanho = tamanhoPeloCantoDoSelo(alca.ancora, alca.canto, ponto, alca.sizeScale)
      store.getState().mudarDesafioLive(alca.id, patchDoTamanhoDoSelo(alca.inicial, tamanho))
      return `${Math.round(tamanhoDoSeloNaFaixa(tamanho) * 100)}%`
    },

    /** Pointerup do chip: um Ctrl+Z só; clique no chip sem mudar nada não vira passo. */
    soltarAlca(): boolean {
      if (alca === null) return false
      const { id, inicial, antes } = alca
      alca = null
      fechar(antes, id, inicial)
      return true
    },

    /** Pointerdown com o selo `id` escolhido: começa o giro se o ponto cai na alça de girar. */
    comecarGiro(id: string, ponto: Point, sizeScale: number, sizeFloor: number, cameraScale: number): boolean {
      const map = store.getState().map
      const desafio = desafioPorId(map, id)
      const pino = desafio === undefined ? null : pinoDoDesafio(desafio, map.props, 'mestre')
      if (desafio === undefined || pino === null) return false
      const caixa = seloParaGirar(pino, sizeScale, sizeFloor)
      if (!isOnPropRotateHandle(caixa, ponto, cameraScale)) return false
      const pivo = { x: caixa.x, y: caixa.y }
      giro = { id, inicial: desafio, pivo, ponteiroInicial: angleAroundPivot(pivo, ponto), antes: map }
      return true
    },

    /** O giro está em curso: a alça de girar aparece acesa, "pega". */
    girando(): boolean {
      return giro !== null
    },

    /** Pointermove da alça de girar: devolve a etiqueta do ângulo junto ao ponteiro ("37°"). */
    moverGiro(ponto: Point, encaixar: boolean): string | null {
      if (giro === null) return null
      const bruto = anguloDoSelo(giro.inicial) + angleAroundPivot(giro.pivo, ponto) - giro.ponteiroInicial
      const graus = encaixar ? Math.round(bruto / PASSO_DO_GIRO_COM_SHIFT) * PASSO_DO_GIRO_COM_SHIFT : bruto
      const patch = patchDoAnguloDoSelo(graus)
      store.getState().mudarDesafioLive(giro.id, patch)
      return formatRotationLabel(patch.angulo ?? 0)
    },

    /** Pointerup da alça de girar: um Ctrl+Z só. */
    soltarGiro(): boolean {
      if (giro === null) return false
      const { id, inicial, antes } = giro
      giro = null
      fechar(antes, id, inicial)
      return true
    },

    /** Esc no meio do gesto: o selo volta como estava e nada vai para o histórico. */
    cancelar(): boolean {
      const emCurso = aperto ?? alca ?? giro
      aperto = null
      alca = null
      giro = null
      if (emCurso === null) return false
      store.getState().mudarDesafioLive(emCurso.id, patchDoComeco(emCurso.inicial))
      return true
    },
  }
}

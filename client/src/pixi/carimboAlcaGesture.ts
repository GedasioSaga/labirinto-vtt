import type { Carimbo, MapData } from '../types/map'
import type { Point } from './world'
import type { Corner } from '../lib/objectTransform'
import { useMapStore } from '../stores/mapStore'
import { caixaDoCarimbo, carimboPorId } from '../lib/carimbos'
import { carimboComAlcas, faixaDoTamanhoDoCarimbo, tamanhoPeloCanto, type FaixaDoTamanho } from '../lib/alcasDoCarimbo'
import { findBoxCornerHandleAt } from '../lib/handleHitArea'
import { unidadeDoRelevo } from '../lib/relevo'
import { tamanhoNaturalDoTipo } from '../carimbos/catalogo'

/**
 * Gesto do CANTO DO CARIMBO (alças de 16/11/2026), sem Pixi: o PixiCanvas
 * repassa os eventos do stage — mesmo molde de `doorEndGesture.ts` — e a conta
 * fica em `lib/alcasDoCarimbo.ts` (`tamanhoPeloCanto`).
 *
 * Cada quadro grava o tamanho no mapa sem histórico (`mudarCarimboLive`), e o
 * arrasto inteiro vira UM Ctrl+Z: `finish` fecha com `commitDragHistory(antes)`.
 * Esc no meio (`cancel`) devolve o tamanho do começo e não grava nada.
 */

type CarimboAlcaStore = Pick<typeof useMapStore, 'getState'>

interface Arrasto {
  inicial: Carimbo
  canto: Corner
  faixa: FaixaDoTamanho
  /** O natural do tipo (100%), para a etiqueta dizer o mesmo "%" da ficha. */
  natural: number
  /** O mapa do pointerdown — o que o Ctrl+Z devolve. */
  antes: MapData
}

export interface CarimboAlcaFeedback {
  tamanho: number
  /** A etiqueta junto ao ponteiro: "120%", a régua do controle "Tamanho" da ficha. */
  label: string
}

export function createCarimboAlcaGesture(store: CarimboAlcaStore = useMapStore) {
  let arrasto: Arrasto | null = null

  return {
    /**
     * Pointerdown com o carimbo `id` selecionado sozinho: começa o arrasto se
     * o ponto cai num chip de canto. Travado, ou na camada travada, não tem alça.
     */
    begin(id: string, ponto: Point, cameraScale: number): boolean {
      const map = store.getState().map
      const carimbo = carimboPorId(map.carimbos, id)
      if (carimbo === undefined || !carimboComAlcas(map, carimbo)) return false
      const canto = findBoxCornerHandleAt(caixaDoCarimbo(carimbo), ponto, cameraScale)
      if (canto === null) return false
      const natural = tamanhoNaturalDoTipo(carimbo.tipo, unidadeDoRelevo(map), map.grid)
      arrasto = { inicial: carimbo, canto, faixa: faixaDoTamanhoDoCarimbo(natural, carimbo.tamanho), natural, antes: map }
      return true
    },

    /** Pointermove: o canto vai até o ponteiro, e o carimbo cresce ou encolhe a partir do pé. */
    move(ponto: Point): CarimboAlcaFeedback | null {
      if (!arrasto) return null
      const tamanho = tamanhoPeloCanto(arrasto.inicial, arrasto.canto, ponto, arrasto.faixa)
      store.getState().mudarCarimboLive(arrasto.inicial.id, { tamanho })
      const pct = arrasto.natural > 0 ? Math.round((tamanho / arrasto.natural) * 100) : 100
      return { tamanho, label: `${pct}%` }
    },

    /** Pointerup (e pointerupoutside): o arrasto vira um Ctrl+Z só. Clique sem mudar nada não vira passo. */
    finish(): boolean {
      if (!arrasto) return false
      const { antes, inicial } = arrasto
      arrasto = null
      // Foi e voltou ao mesmo tamanho (ou só clicou no chip): um Ctrl+Z que "não faz nada" é pior que nenhum.
      if (carimboPorId(store.getState().map.carimbos, inicial.id)?.tamanho !== inicial.tamanho) store.getState().commitDragHistory(antes)
      return true
    },

    /** Esc no meio do arrasto: o carimbo volta ao tamanho do começo e nada vai para o histórico. */
    cancel(): boolean {
      if (!arrasto) return false
      const { inicial } = arrasto
      arrasto = null
      store.getState().mudarCarimboLive(inicial.id, { tamanho: inicial.tamanho })
      return true
    },

    isActive(): boolean {
      return arrasto !== null
    },
  }
}

export type CarimboAlcaGesture = ReturnType<typeof createCarimboAlcaGesture>

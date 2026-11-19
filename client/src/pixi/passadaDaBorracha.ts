import type { MapData } from '../types/map'
import type { Point } from './world'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { AVISO_BORRACHA_NAO_APAGA_CHAO } from '../lib/floorTool'

/**
 * A PASSADA DE BORRACHA no editor: uma passada = UM Ctrl+Z. Saiu do
 * `PixiCanvas.tsx` (máquina de gestos); o corte em si (`eraseAt`, o que a
 * borracha acerta no ponto) continua no canvas e entra como `apagar`.
 *
 * `abrir` guarda o mapa e as duas pilhas de histórico de ANTES do primeiro
 * corte; cada `cortar` apaga de verdade e devolve as pilhas a esse instante,
 * para os N cortes intermediários não virarem N entradas de undo; `fechar`
 * junta tudo numa entrada só. Mesmo par "snapshot no pointerdown +
 * commitDragHistory no pointerup" dos arrastos — a diferença é que as actions
 * de apagar da store (`removeWall`, `erasePartOfDrawing`, …) não têm variante
 * "live", então o desfazer é desfeito aqui em vez de nunca acontecer lá.
 */
export interface PassadaDaBorracha {
  /** Abre a passada (pointerdown da ferramenta, antes de qualquer corte). */
  abrir: () => void
  /** Um corte DENTRO da passada: apaga no ponto e devolve `past`/`future` ao estado de antes da passada. */
  cortar: (ponto: Point) => void
  /** Fecha a passada num Ctrl+Z só. */
  fechar: () => void
  /** A borracha não apaga chão: o aviso sai uma vez por passada. */
  avisarQueNaoApagaChao: () => void
}

export function criarPassadaDaBorracha(dep: { apagar: (ponto: Point) => void }): PassadaDaBorracha {
  let antes: MapData | null = null
  let pastDeAntes: MapData[] | null = null
  let futureDeAntes: MapData[] | null = null
  /**
   * A passada atual já avisou que a borracha não apaga chão? Um arrasto
   * sobre o piso chama `eraseAt` a cada pointermove; sem esta trava o
   * aviso reapareceria a cada micro-movimento depois de dispensado.
   */
  let avisouChao = false

  return {
    abrir() {
      const { map, past, future } = useMapStore.getState()
      antes = map
      pastDeAntes = past
      futureDeAntes = future
      avisouChao = false
    },
    /**
     * Por quê (passeio cego de 16/09/2026, "apaguei um risco e não consegui
     * desfazer"): cada action de apagar da store passa por `withHistory`, que
     * empurra uma entrada por chamada — e o pointermove chama `eraseAt` a
     * cada micro-movimento. Um arrasto curto sobre um traço freehand vira
     * dezenas de entradas, uma por pedacinho recortado: os três Ctrl+Z que a
     * pessoa deu desfizeram três pedacinhos (nada visível volta) e, com o
     * `HISTORY_CAP` de 50 da store estourado pela própria passada, as
     * entradas ANTERIORES ao gesto tinham sido descartadas — daí o botão
     * Desfazer esmaecido com o mapa ainda mutilado. Restaurar as pilhas a
     * cada corte resolve os dois: a passada não consome o histórico antigo, e
     * o `fechar` fecha tudo numa entrada só.
     *
     * Restaura a REFERÊNCIA dos arrays de antes (nunca cópia): `past`/`future`
     * só são substituídos, nunca mutados, na store inteira.
     */
    cortar(ponto) {
      dep.apagar(ponto)
      if (pastDeAntes === null || futureDeAntes === null) return
      useMapStore.setState({ past: pastDeAntes, future: futureDeAntes })
    },
    /**
     * `commitDragHistory` não faz nada quando o mapa é o MESMO objeto do
     * snapshot — passada que não apagou nada não gasta entrada de undo nem
     * descarta o redo pendente.
     */
    fechar() {
      if (antes !== null) useMapStore.getState().commitDragHistory(antes)
      antes = null
      pastDeAntes = null
      futureDeAntes = null
    },
    /**
     * A borracha não apaga chão: o aviso é do tipo que ensina e espera a
     * pessoa (`lib/erroQueEnsina.ts`); como esse tipo não some sozinho, o
     * mesmo texto já na fila não entra de novo.
     */
    avisarQueNaoApagaChao() {
      if (avisouChao) return
      avisouChao = true
      const toasts = useToastStore.getState()
      if (toasts.toasts.some((toast) => toast.text === AVISO_BORRACHA_NAO_APAGA_CHAO)) return
      toasts.push('instrucao', AVISO_BORRACHA_NAO_APAGA_CHAO)
    },
  }
}

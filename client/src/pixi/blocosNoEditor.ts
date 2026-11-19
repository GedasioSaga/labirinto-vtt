import type { Graphics } from 'pixi.js'
import type { Point } from './world'
import { blocosDoTraco, chaveDoBloco, type Bloco } from '../lib/floorBlocks'
import { corDaCamada } from '../lib/camadasDoChao'
import { corDoPincel } from '../lib/camadasDoPincel'
import { useMapStore } from '../stores/mapStore'
import { drawBlocosDraft } from './drawFloor'

/**
 * O PINCEL DE BLOCOS da ferramenta Chão no editor. Saiu do `PixiCanvas.tsx`
 * (máquina de gestos) no molde de `neblinaNoEditor.ts`: o canvas põe o modo
 * `painting-floor-blocks` e chama `comecar`, `mover`, `soltar` e `descartar`.
 *
 * As células já tocadas no arrasto ficam aqui, por chave de coluna/linha. O
 * gesto NÃO escreve na store enquanto anda — ele só acumula e desenha a
 * prévia, e o mapa muda uma vez só ao soltar. É o que dá 1 Ctrl+Z por traço
 * (e não um por célula) e o que mantém o arrasto fluido: o contorno do chão
 * inteiro é caro demais para recalcular a cada pointermove.
 */
export interface GestoDosBlocos {
  /**
   * Começa o traço no ponto bruto (a célula sai dele, sem snap). `apagando`:
   * botão direito ou operação Subtrair (`pincelDeBlocosApaga`). `celula` é o
   * `map.grid` do começo: mudar a grade no meio não parte o traço.
   */
  comecar: (p: Point, apagando: boolean, celula: number) => void
  /** Há traço em curso (o último ponto do ponteiro existe). */
  emCurso: () => boolean
  /** O ponteiro andou: soma as células do trecho desde o último ponto. */
  mover: (p: Point) => void
  /** Fecha o traço: uma peça nova (pintando) ou um apagar. Clique parado também conta. */
  soltar: () => void
  /** Esc ou troca de ferramenta: larga as células sem gravar (o rascunho é limpo por quem chama). */
  descartar: () => void
}

export function criarGestoDosBlocos(dep: { rascunho: Graphics }): GestoDosBlocos {
  let celulas: Map<string, Bloco> | null = null
  let apagando = false
  let tamanho = 0
  /** Último ponto do ponteiro, para amostrar o caminho entre dois pointermove. */
  let ultimoPonto: Point | null = null

  /**
   * Acumula as células do trecho percorrido pelo pincel e redesenha a
   * prévia. Amostra o caminho inteiro de `de` até `ate` (e não só o ponto
   * de chegada): o navegador entrega pointermove em saltos, e sem isso um
   * arrasto rápido deixaria buraco no traço.
   */
  const acumular = (de: Point, ate: Point): void => {
    if (!celulas) return
    const { map, floorBrushSize, floorCamada, pisoAtivo, camadaDoPincelId } = useMapStore.getState()
    for (const bloco of blocosDoTraco(de, ate, tamanho, floorBrushSize)) {
      celulas.set(chaveDoBloco(bloco.col, bloco.row), bloco)
    }
    // A prévia na cor da camada ATIVA, que é onde a tinta vai cair.
    const cor = corDoPincel(map, pisoAtivo, camadaDoPincelId, corDaCamada(floorCamada))
    drawBlocosDraft(dep.rascunho, [...celulas.values()], tamanho, cor, apagando)
  }

  return {
    comecar(p, apagar, celula) {
      apagando = apagar
      tamanho = celula
      celulas = new Map()
      ultimoPonto = p
      acumular(p, p)
    },
    emCurso: () => ultimoPonto !== null,
    mover(p) {
      if (ultimoPonto === null) return
      acumular(ultimoPonto, p)
      ultimoPonto = p
    },
    soltar() {
      const cells = celulas ? [...celulas.values()] : []
      const cell = tamanho
      const apagar = apagando
      celulas = null
      ultimoPonto = null
      dep.rascunho.clear()
      if (cells.length === 0) return
      if (apagar) {
        useMapStore.getState().eraseFloorBlocks(cells, cell)
        return
      }
      // CAMADAS DO PINCEL: o traço soma na camada ativa, sem tirar blocos
      // das outras (`lib/camadasDoPincel.ts`). Dois caminhos de cores
      // diferentes = duas camadas.
      useMapStore.getState().paintFloorBlocks(cells, cell)
    },
    descartar() {
      celulas = null
      ultimoPonto = null
    },
  }
}

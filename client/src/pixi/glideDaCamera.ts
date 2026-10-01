/**
 * "IR ATÉ LÁ" COM A CÂMERA DESLIZANDO — o "Ir até lá" da lista de Objetos, o
 * "Ir lá" do Grupo e das pistas e a chegada por pino na mesma cena trocavam a
 * câmera de uma vez, e o mestre perdia a noção de onde o alvo fica. Agora a
 * vista corre até ele, com a mesma conta do recentrar do jogador
 * (`cameraGlideFrame`, ease-out em `RECENTER_MS`).
 *
 * Quem decide QUANDO deslizar é o PixiCanvas: só pedido com ponto de foco, na
 * mesma cena, sem o "Seguir" ligado (que é instantâneo por decisão) e sem
 * movimento reduzido. Este módulo só faz o deslize correr e parar direito.
 *
 * O zoom do deslize passa pelo zoom adiado da roda (`zoomDaRoda.ts`): nos
 * quadros do meio o `world` só escala, e a geometria em px de tela (paredes,
 * contornos) é refeita UMA vez, já no último quadro — nem a cada quadro, nem
 * 150 ms depois do fim.
 */
import { UPDATE_PRIORITY, type Ticker } from 'pixi.js'
import { cameraGlideFrame, startCameraGlide, type CameraGlide } from '../player/edgeFollow'
import type { ZoomDaRoda } from './zoomDaRoda'
import type { Camera } from './world'

export interface GlideDaCameraOpcoes {
  /** A câmera de agora — a do setup do PixiCanvas, trocada por todo `applyCamera`. */
  lerCamera: () => Camera
  /** Aplica um quadro do deslize (`applyCamera` com origem 'pedido'). */
  aplicar: (camera: Camera) => void
  /** Refaz a geometria que depende da escala (`redrawScaleDependentLayers`). */
  redesenhar: () => void
  zoom: Pick<ZoomDaRoda, 'rodaGirou' | 'cancelar'>
  /** O relógio de quadros do Pixi: o deslize só se inscreve enquanto corre. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** Agora, em ms. Padrão `performance.now()`. */
  agora?: () => number
}

export interface GlideDaCamera {
  /** Corre da câmera de agora até `alvo`. Pedido novo no meio parte de onde a câmera está, sem voltar. */
  deslizar: (alvo: Camera) => void
  /** Para onde estiver: pedido instantâneo, clique no mapa, desmonte. Sem deslize, nada. */
  parar: () => void
  emCurso: () => boolean
}

export function createGlideDaCamera(opcoes: GlideDaCameraOpcoes): GlideDaCamera {
  const agora = opcoes.agora ?? (() => performance.now())
  let atual: { glide: CameraGlide; aplicada: Camera; mudaEscala: boolean } | null = null

  function parar(): void {
    if (atual === null) return
    atual = null
    opcoes.ticker.remove(quadro)
  }

  function quadro(): void {
    const corrente = atual
    if (corrente === null) return
    // Alguém mexeu na câmera por fora (roda, arrasto da vista, F, Ctrl+0): o
    // gesto do mestre manda, e o deslize não briga com ele no quadro seguinte.
    if (opcoes.lerCamera() !== corrente.aplicada) {
      parar()
      return
    }
    const frame = cameraGlideFrame(corrente.glide, agora())
    // Com a escala mudando, todo quadro segura o redesenho como um passo de
    // roda — inclusive o último, para o redesenho dele sair abaixo, na hora,
    // e não de novo no quadro seguinte.
    if (corrente.mudaEscala) opcoes.zoom.rodaGirou()
    opcoes.aplicar(frame.camera)
    if (!frame.done) {
      corrente.aplicada = opcoes.lerCamera()
      return
    }
    parar()
    if (corrente.mudaEscala) {
      opcoes.zoom.cancelar()
      opcoes.redesenhar()
    }
  }

  function deslizar(alvo: Camera): void {
    parar()
    const de = opcoes.lerCamera()
    if (de.x === alvo.x && de.y === alvo.y && de.scale === alvo.scale) {
      opcoes.aplicar(alvo)
      return
    }
    atual = { glide: startCameraGlide(de, alvo, agora()), aplicada: de, mudaEscala: de.scale !== alvo.scale }
    // Antes dos outros ouvintes do quadro (sinais, laser): o que se desenha
    // preso à tela já sai com a câmera nova, sem um quadro de atraso.
    opcoes.ticker.add(quadro, undefined, UPDATE_PRIORITY.HIGH)
  }

  return { deslizar, parar, emCurso: () => atual !== null }
}

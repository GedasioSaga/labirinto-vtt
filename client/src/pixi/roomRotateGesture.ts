import type { MapData, Stair } from '../types/map'
import type { Point } from './world'
import { useMapStore } from '../stores/mapStore'
import { canInteract } from '../lib/itemTransform'
import { canInteractInLayer, stairLayer } from '../lib/layers'
import {
  angleAroundPivot, formatRotationLabel, isOnPropRotateHandle, isOnRoomRotateHandle, roomCentroid, roomRotationOf, rotationDelta, snapRoomRotation,
} from '../lib/roomRotation'
import { isOnStairRotateHandle, rotateStairBy, stairRotateFrame } from '../lib/stairRotation'

/**
 * Gesto da alça de GIRAR SALA, sem Pixi: o PixiCanvas repassa os eventos do
 * stage (mesmo molde de `laserGesture.ts`) e a conta do giro fica aqui, onde
 * dá para testar sem abrir navegador.
 *
 * O giro acompanha o ângulo do ponteiro em volta do centro da sala, com trava
 * de grau inteiro (Shift: 15°). Cada movimento gira só a DIFERENÇA para o
 * quadro anterior, sobre o mapa de agora (`rotateRoomLive`), e o arrasto
 * inteiro vira UM Ctrl+Z: `finish` fecha com `commitDragHistory(antes)`, o
 * mesmo par do arrasto de canto da sala. Esc no meio (`cancel`) gira de volta
 * o que já tinha girado e não grava nada.
 *
 * OBJETO (pedido de 11/11/2026: "seria legal se os objetos pudessem ficar se
 * inclinando que nem as casas"): `beginProp` pega a mesma bolinha sobre o
 * objeto (`propRotateHandle`) e o resto do gesto é o mesmo — a mesma trava, a
 * mesma etiqueta, um Ctrl+Z só. O objeto gira em volta do próprio centro e
 * guarda o ângulo em `Prop.rotation` (`setPropRotationLive`).
 *
 * ESCADA (pedido de 12/11/2026: "uma vez que eu coloco a escada não da para
 * colocar trocar para vertical e horizontal"): `beginStair` pega a mesma
 * bolinha sobre a caixa da escada (`stairRotateHandle`). A escada não guarda
 * ângulo — o giro vai para os lances (`lib/stairRotation.ts`), e cada quadro
 * gira a escada do COMEÇO do gesto (`setStairGeometryLive`), sem acumular erro.
 */

/**
 * Perto disto do centro (px de TELA) o ângulo do ponteiro não quer dizer nada:
 * um px de tremor viraria dezenas de graus. Dentro do raio a sala fica onde
 * estava até o ponteiro sair dele.
 */
const RAIO_MORTO_PX = 6

type RoomRotateStore = Pick<typeof useMapStore, 'getState'>

/** O que está girando: a Sala (giro gravado nos pontos), o Objeto (giro gravado em `rotation`) ou a Escada (giro gravado nos lances). */
type AlvoDoGiro =
  | { kind: 'region'; id: string }
  | { kind: 'prop'; id: string; rotacaoGuardada: number | undefined }
  | { kind: 'stair'; id: string; inicial: Stair }

interface Giro {
  alvo: AlvoDoGiro
  /** O mapa do pointerdown — o que o Ctrl+Z devolve. */
  antes: MapData
  pivo: Point
  /** Direção do ponteiro, vista do centro, quando a alça foi pega. */
  anguloInicial: number
  rotacaoInicial: number
  /** Ângulo em que a sala está agora (já girado no mapa). */
  rotacaoAtual: number
  ultimoPonto: Point
  escala: number
}

export interface RoomRotateFeedback {
  /** Ângulo da sala agora — o mesmo que o campo "Rotação" vai mostrar. */
  rotation: number
  /** A etiqueta perto do ponteiro: "37°". */
  label: string
}

export function createRoomRotateGesture(store: RoomRotateStore = useMapStore) {
  let giro: Giro | null = null

  /** Grava a escada no mapa sem histórico, como as alças dela (`pixi/stairHandleGesture.ts`). */
  const gravarEscada = (id: string, stair: Stair): void => {
    store.getState().setStairGeometryLive(id, { segments: stair.segments, stepWidth: stair.stepWidth, curva: stair.curva })
  }

  const aplicar = (ponto: Point, shift: boolean): RoomRotateFeedback | null => {
    if (!giro) return null
    giro.ultimoPonto = ponto
    const distanciaNaTela = Math.hypot(ponto.x - giro.pivo.x, ponto.y - giro.pivo.y) * giro.escala
    if (distanciaNaTela < RAIO_MORTO_PX) return null
    const andou = rotationDelta(giro.anguloInicial, angleAroundPivot(giro.pivo, ponto))
    const alvo = snapRoomRotation(giro.rotacaoInicial + andou, shift)
    const passo = rotationDelta(giro.rotacaoAtual, alvo)
    if (passo !== 0) {
      if (giro.alvo.kind === 'region') store.getState().rotateRoomLive(giro.alvo.id, passo)
      else if (giro.alvo.kind === 'prop') store.getState().setPropRotationLive(giro.alvo.id, alvo)
      else gravarEscada(giro.alvo.id, rotateStairBy(giro.alvo.inicial, alvo - giro.rotacaoInicial))
    }
    giro.rotacaoAtual = alvo
    return { rotation: alvo, label: formatRotationLabel(alvo) }
  }

  const comecar = (alvo: AlvoDoGiro, pivo: Point, rotacao: number, ponto: Point, cameraScale: number): true => {
    giro = {
      alvo,
      antes: store.getState().map,
      pivo,
      anguloInicial: angleAroundPivot(pivo, ponto),
      rotacaoInicial: rotacao,
      rotacaoAtual: rotacao,
      ultimoPonto: ponto,
      escala: Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1,
    }
    return true
  }

  return {
    /**
     * Pointerdown com a Sala `regionId` selecionada: começa o giro se o ponto
     * cai na alça. Sala travada não tem alça (e não gira por aqui).
     */
    begin(regionId: string, ponto: Point, cameraScale: number): boolean {
      const map = store.getState().map
      const region = map.regions.find((r) => r.id === regionId)
      if (!region?.room || !canInteract(region)) return false
      const rotacao = roomRotationOf(region.room)
      if (!isOnRoomRotateHandle(region.points, rotacao, ponto, cameraScale)) return false
      return comecar({ kind: 'region', id: regionId }, roomCentroid(region.points), rotacao, ponto, cameraScale)
    },

    /** Pointerdown com o Objeto `propId` selecionado: a mesma regra de `begin`, sobre a alça do objeto. */
    beginProp(propId: string, ponto: Point, cameraScale: number): boolean {
      const prop = store.getState().map.props.find((p) => p.id === propId)
      if (!prop || !canInteract(prop) || !isOnPropRotateHandle(prop, ponto, cameraScale)) return false
      const alvo: AlvoDoGiro = { kind: 'prop', id: propId, rotacaoGuardada: prop.rotation }
      return comecar(alvo, { x: prop.x, y: prop.y }, prop.rotation ?? 0, ponto, cameraScale)
    },

    /**
     * Pointerdown com a Escada `stairId` selecionada: a mesma regra, sobre a
     * bolinha acima da caixa dela. Escada travada, ou na camada travada, não
     * gira — a mesma condição das alças dela (`pixi/stairHandleGesture.ts`).
     */
    beginStair(stairId: string, ponto: Point, cameraScale: number): boolean {
      const map = store.getState().map
      const stair = map.stairs.find((s) => s.id === stairId)
      if (stair === undefined || !canInteractInLayer(stair, stairLayer(stair), map.lockedLayers)) return false
      const frame = stairRotateFrame(stair)
      if (frame === null || !isOnStairRotateHandle(stair, ponto, cameraScale)) return false
      return comecar({ kind: 'stair', id: stairId, inicial: stair }, frame.pivot, frame.rotation, ponto, cameraScale)
    },

    /** Pointermove: gira até o ângulo do ponteiro. `null` = nada a mostrar (sem giro, ou no raio morto). */
    move(ponto: Point, shift: boolean): RoomRotateFeedback | null {
      return aplicar(ponto, shift)
    },

    /** Shift apertado ou solto sem mexer o mouse: a trava vale na hora, do ponto onde o ponteiro está. */
    setShift(shift: boolean): RoomRotateFeedback | null {
      return giro ? aplicar(giro.ultimoPonto, shift) : null
    },

    /** Pointerup (e pointerupoutside): sala de fora e ordem dos cantos, e o arrasto vira um Ctrl+Z só. */
    finish(): boolean {
      if (!giro) return false
      const { antes, alvo, rotacaoAtual, rotacaoInicial } = giro
      giro = null
      // Foi e voltou ao mesmo ângulo (ou só clicou na alça): nada mudou aos
      // olhos do mestre, e um Ctrl+Z que "não faz nada" é pior que nenhum.
      if (rotacaoAtual === rotacaoInicial) {
        // O objeto pode ter passado por outro ângulo: volta ao campo de antes, sem histórico.
        if (alvo.kind === 'prop') store.getState().setPropRotationLive(alvo.id, alvo.rotacaoGuardada)
        // A escada também: volta aos lances do começo, sem histórico.
        if (alvo.kind === 'stair') gravarEscada(alvo.id, alvo.inicial)
        return true
      }
      if (alvo.kind === 'region') store.getState().finishRoomRotationLive(antes, alvo.id)
      store.getState().commitDragHistory(antes)
      return true
    },

    /** Esc no meio do arrasto: a sala (o objeto, a escada) volta ao ângulo do começo e nada vai para o histórico. */
    cancel(): boolean {
      if (!giro) return false
      const volta = rotationDelta(giro.rotacaoAtual, giro.rotacaoInicial)
      const alvo = giro.alvo
      giro = null
      if (alvo.kind === 'prop') store.getState().setPropRotationLive(alvo.id, alvo.rotacaoGuardada)
      else if (alvo.kind === 'stair') gravarEscada(alvo.id, alvo.inicial)
      else if (volta !== 0) store.getState().rotateRoomLive(alvo.id, volta)
      return true
    },

    isActive(): boolean {
      return giro !== null
    },
  }
}

export type RoomRotateGesture = ReturnType<typeof createRoomRotateGesture>

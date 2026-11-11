import type { MapData } from '../types/map'
import type { Point } from './world'
import { useMapStore } from '../stores/mapStore'
import { canInteract } from '../lib/itemTransform'
import {
  angleAroundPivot, formatRotationLabel, isOnPropRotateHandle, isOnRoomRotateHandle, roomCentroid, roomRotationOf, rotationDelta, snapRoomRotation,
} from '../lib/roomRotation'

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
 */

/**
 * Perto disto do centro (px de TELA) o ângulo do ponteiro não quer dizer nada:
 * um px de tremor viraria dezenas de graus. Dentro do raio a sala fica onde
 * estava até o ponteiro sair dele.
 */
const RAIO_MORTO_PX = 6

type RoomRotateStore = Pick<typeof useMapStore, 'getState'>

/** O que está girando: a Sala (giro gravado nos pontos) ou o Objeto (giro gravado em `rotation`). */
type AlvoDoGiro = { kind: 'region'; id: string } | { kind: 'prop'; id: string; rotacaoGuardada: number | undefined }

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
      else store.getState().setPropRotationLive(giro.alvo.id, alvo)
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
        return true
      }
      if (alvo.kind === 'region') store.getState().finishRoomRotationLive(antes, alvo.id)
      store.getState().commitDragHistory(antes)
      return true
    },

    /** Esc no meio do arrasto: a sala (ou o objeto) volta ao ângulo do começo e nada vai para o histórico. */
    cancel(): boolean {
      if (!giro) return false
      const volta = rotationDelta(giro.rotacaoAtual, giro.rotacaoInicial)
      const alvo = giro.alvo
      giro = null
      if (alvo.kind === 'prop') store.getState().setPropRotationLive(alvo.id, alvo.rotacaoGuardada)
      else if (volta !== 0) store.getState().rotateRoomLive(alvo.id, volta)
      return true
    },

    isActive(): boolean {
      return giro !== null
    },
  }
}

export type RoomRotateGesture = ReturnType<typeof createRoomRotateGesture>

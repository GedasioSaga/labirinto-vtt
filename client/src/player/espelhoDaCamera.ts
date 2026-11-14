import type { Camera } from '../pixi/world'

/**
 * TERRENO ALTO — a câmera da tela do jogador, repetida na VISTA DO PISO DE
 * BAIXO (a outra `PlayerView`, por trás, borrada). A tela de cima publica a
 * cada `applyCamera`; a de baixo ouve e põe a mesma câmera, sem passar pelo
 * React (um `setState` por quadro de arrasto refaria a tela inteira).
 */
export interface EspelhoDaCamera {
  /** A última câmera publicada; `null` antes da primeira. */
  atual(): Camera | null
  publicar(camera: Camera): void
  /** Ouve as próximas; devolve o "parar de ouvir". */
  ouvir(aoMudar: (camera: Camera) => void): () => void
}

export function criarEspelhoDaCamera(): EspelhoDaCamera {
  let ultima: Camera | null = null
  const ouvintes = new Set<(camera: Camera) => void>()
  return {
    atual: () => ultima,
    publicar(camera) {
      if (ultima !== null && ultima.x === camera.x && ultima.y === camera.y && ultima.scale === camera.scale) return
      ultima = { x: camera.x, y: camera.y, scale: camera.scale }
      for (const ouvinte of ouvintes) ouvinte(ultima)
    },
    ouvir(aoMudar) {
      ouvintes.add(aoMudar)
      return () => {
        ouvintes.delete(aoMudar)
      }
    },
  }
}

import { create } from 'zustand'
import { appendLaserPoints, pruneLaserTrail, type LaserPoint } from '../lib/laser'

/**
 * Laser do mestre no editor. Dois caminhos independentes ARMAM o laser (L
 * segurado sobre o canvas ou botão "Laser" na aba Jogo); armado não desenha
 * nem envia nada. O rastro só sai com o botão esquerdo pressionado sobre o
 * canvas (`drawing`); o fim do traço é o que manda `laser {off}` aos
 * jogadores (App.tsx assina a transição com `laserStrokeEnded`).
 */

interface LaserState {
  held: boolean
  toggled: boolean
  /** Botão esquerdo pressionado com o laser armado: o traço está saindo. */
  drawing: boolean
  /** Rastro do próprio mestre, desenhado pelo ticker do canvas. */
  trail: LaserPoint[]
  setHeld: (held: boolean) => void
  setToggled: (toggled: boolean) => void
  /** Liga o traço só com o laser armado; desligar vale sempre. */
  setDrawing: (drawing: boolean) => void
  addPoint: (x: number, y: number, now?: number) => void
}

export function isLaserArmed(state: Pick<LaserState, 'held' | 'toggled'>): boolean {
  return state.held || state.toggled
}

/** O traço acabou (soltou o botão, saiu da janela ou desarmou): hora do `laser {off}`. */
export function laserStrokeEnded(previous: Pick<LaserState, 'drawing'>, next: Pick<LaserState, 'drawing'>): boolean {
  return previous.drawing && !next.drawing
}

export const useLaserStore = create<LaserState>()((set, get) => ({
  held: false,
  toggled: false,
  drawing: false,
  trail: [],

  setHeld: (held) => {
    const state = get()
    if (state.held === held) return
    set({ held, drawing: state.drawing && isLaserArmed({ held, toggled: state.toggled }) })
  },

  setToggled: (toggled) => {
    const state = get()
    if (state.toggled === toggled) return
    set({ toggled, drawing: state.drawing && isLaserArmed({ held: state.held, toggled }) })
  },

  setDrawing: (drawing) => {
    const state = get()
    const next = drawing && isLaserArmed(state)
    if (state.drawing !== next) set({ drawing: next })
  },

  addPoint: (x, y, now = Date.now()) => {
    set({ trail: appendLaserPoints(pruneLaserTrail(get().trail, now), [{ x, y }], now) })
  },
}))

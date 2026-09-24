import { create } from 'zustand'

/**
 * SEGUIR JOGADOR (G7): quem o mestre está seguindo, um por vez. Não vai ao
 * mapa nem ao disco — é um modo da vista do mestre nesta sessão, como o laser.
 * A câmera em si continua no canvas; quem move a câmera pelo seguir é o App
 * (`useFollowPlayer`), pelo mesmo pedido de câmera do "Ir lá".
 */

/**
 * Quem mudou a câmera do editor. `gesto` é o mestre mexendo na vista (arrasto
 * com o meio/direito, roda, F, Ctrl+0, HUD de zoom); `pedido` é a câmera que o
 * PRÓPRIO app pediu (abrir o mapa, troca de cena, "Ir lá", o seguir). Só o
 * gesto desliga o seguir: se o pedido desligasse, o primeiro centro que o
 * seguir faz o desligaria na hora.
 */
export type CameraOrigin = 'gesto' | 'pedido'

interface FollowState {
  /** `playerId` seguido; `null` = ninguém. */
  playerId: string | null
  /** Botão "Seguir": liga neste jogador (desligando o anterior) ou desliga se já era ele. */
  toggle: (playerId: string) => void
  stop: () => void
  /**
   * "Ir lá" em `playerId` (painel Grupo, aviso de chegada): ir ver OUTRO
   * jogador é o mestre escolhendo a vista, e desliga o seguir — senão o
   * próximo passo do seguido o arrastaria de volta. Ir até o próprio seguido
   * é o que o seguir já faz, e ele continua.
   */
  irAteJogador: (playerId: string) => void
  /** O canvas avisa toda câmera aplicada; o seguir decide se aquilo o desliga. */
  cameraApplied: (origin: CameraOrigin) => void
}

export const useFollowStore = create<FollowState>()((set, get) => ({
  playerId: null,

  toggle: (playerId) => {
    set({ playerId: get().playerId === playerId ? null : playerId })
  },

  stop: () => {
    if (get().playerId !== null) set({ playerId: null })
  },

  irAteJogador: (playerId) => {
    if (get().playerId !== playerId) get().stop()
  },

  cameraApplied: (origin) => {
    if (origin === 'gesto') get().stop()
  },
}))

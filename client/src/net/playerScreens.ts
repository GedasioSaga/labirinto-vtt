import type { ExploredWire } from '../lib/exploration'
import type { MapData, RegionPoint } from '../types/map'
import type { HostMessage } from './protocol'

/**
 * ESPELHO DA TELA DO JOGADOR. O que o mestre vê no "Ver tela" não é montado
 * de novo a partir do mapa dele: é o ÚLTIMO recorte que saiu pelo fio para
 * aquele jogador (`net_send`), guardado tal como foi. Por construção o espelho
 * nunca mostra nada que o jogador não recebeu — a névoa, a zona oculta e a
 * cena de cada um já foram decididas por `hostSession`/`fogFilter` antes de
 * sair — e segue a cena DELE, não a aberta no editor.
 *
 * As regras de "o que muda a tela" copiam as do jogador
 * (`player/playerConnection.ts`): snapshot/delta com `rev` antigo é ignorado,
 * `lobby.waiting` apaga o mapa, `kicked`/`room.closed` encerram a tela.
 */
export type PlayerScreen =
  | { kind: 'waiting' }
  | {
      kind: 'map'
      rev: number
      map: MapData
      vision: RegionPoint[][]
      /** Fio cru: quem desenha decodifica (só quando o espelho está aberto). */
      explored: ExploredWire
      ownTokens: string[]
      concealed: RegionPoint[][]
      /** Cone pelo vão de prédio com teto, quando o recorte trouxe (`fogFilter.ts`). */
      glimpses?: RegionPoint[][]
    }

export interface PlayerScreens {
  /** Anota uma mensagem que saiu para `clientId`. `true` = a tela dele mudou. */
  record(clientId: string, msg: HostMessage): boolean
  /** A tela atual de `clientId`; `null` = nada recebido (ou a tela acabou). */
  get(clientId: string): PlayerScreen | null
  /** A conexão caiu ou foi expulsa: a tela dela não existe mais. `true` = havia tela. */
  forget(clientId: string): boolean
  /** Sala fechada: nenhuma tela. `true` = havia alguma. */
  clear(): boolean
}

const WAITING: PlayerScreen = { kind: 'waiting' }

export function createPlayerScreens(): PlayerScreens {
  const screens = new Map<string, PlayerScreen>()
  // Maior `rev` já aceito por conexão: sobrevive ao `lobby.waiting`, como no jogador.
  const lastRev = new Map<string, number>()

  const forget = (clientId: string): boolean => {
    lastRev.delete(clientId)
    return screens.delete(clientId)
  }

  return {
    record(clientId, msg) {
      switch (msg.type) {
        case 'snapshot':
        case 'delta': {
          const previous = lastRev.get(clientId)
          if (previous !== undefined && msg.rev <= previous) return false
          lastRev.set(clientId, msg.rev)
          screens.set(clientId, {
            kind: 'map',
            rev: msg.rev,
            map: msg.map,
            vision: msg.vision,
            explored: msg.explored,
            ownTokens: msg.ownTokens,
            concealed: msg.concealed,
            ...(msg.glimpses === undefined ? {} : { glimpses: msg.glimpses }),
          })
          return true
        }
        case 'lobby.waiting':
          if (screens.get(clientId) === WAITING) return false
          screens.set(clientId, WAITING)
          return true
        case 'kicked':
        case 'room.closed':
          return forget(clientId)
        default:
          // Sinal, laser, recado, respostas de pedido: não trocam o mapa da tela.
          return false
      }
    },
    get(clientId) {
      return screens.get(clientId) ?? null
    },
    forget,
    clear() {
      const had = screens.size > 0
      screens.clear()
      lastRev.clear()
      return had
    },
  }
}

/**
 * Regras do sinal de mapa (ping do jogador), compartilhadas por mestre e
 * jogador. Tempos em ms e distâncias em px de tela.
 */

/** Quanto tempo um sinal fica desenhado, no mestre e no jogador. */
export const SIGNAL_TTL_MS = 3000
/** Intervalo mínimo entre dois sinais aceitos do mesmo jogador. */
export const SIGNAL_MIN_INTERVAL_MS = 1000
/** Segurar o ponteiro parado por esse tempo dispara o sinal no jogador. */
export const SIGNAL_LONG_PRESS_MS = 500
/** Movimento acima disto cancela o "segurar parado" (vira arrasto de câmera). */
export const SIGNAL_LONG_PRESS_TOLERANCE_PX = 6
/** Teto de sinais simultâneos na tela: o limite por jogador já segura o fluxo, isto só protege a memória. */
export const MAX_ACTIVE_SIGNALS = 32

/** Mesmos tons da lista de atribuir (legíveis no tema escuro), aqui por jogador. */
export const SIGNAL_COLORS: readonly string[] = ['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8', '#4dd0e1', '#ff8a65', '#a1887f']

/** Cor estável por jogador (hash do id): o mesmo jogador sinaliza sempre com a mesma cor. */
export function signalColor(playerId: string): string {
  let hash = 0
  for (let i = 0; i < playerId.length; i += 1) hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0
  return SIGNAL_COLORS[hash % SIGNAL_COLORS.length]
}

/**
 * Cor do sinal que a MESA vê quando a ficha de quem sinaliza não tem cor: o
 * mesmo cinza em que a tela do jogador desenha a ficha dos outros
 * (`OTHER_TOKEN_COLOR`, `player/PlayerView.tsx`). A cor fixa por jogador
 * (`signalColor`) fica só na tela do mestre: na mesa ela denunciava o disfarce.
 */
export const SIGNAL_NEUTRAL_COLOR = '#9ca3af'

/**
 * O que o MESTRE lê no sinal: a jogadora e, se o nome da ficha for outro, a
 * ficha entre parênteses ("Fabi (Contínua do 9)"). Sem ficha ou com o mesmo
 * nome, só a jogadora.
 */
export function signalLabelForMaster(playerName: string, tokenName: string | undefined): string {
  if (tokenName === undefined || tokenName === '' || tokenName === playerName) return playerName
  return `${playerName} (${tokenName})`
}

export const SIGNAL_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/**
 * MARCA "VAMOS PARA CÁ": uma por jogador, SEM prazo — fica até o dono tirar
 * (ou sair da cena onde a pôs). `from` é o nome dele na sala e `color` a cor
 * da ficha; `mine` diz a quem recebe que a marca é a dele (o mestre recebe
 * sempre `false`). Posição em px de mundo da cena de quem recebe.
 */
export interface DestinationMark {
  x: number
  y: number
  from: string
  color: string
  mine: boolean
}

/** Intervalo mínimo entre duas marcas postas pelo mesmo jogador: segura quem martela, e cada marca recalcula a lista de todos. */
export const DESTINATION_MIN_INTERVAL_MS = 500
/** Teto da lista de marcas que o jogador aceita: bem acima de uma mesa real, abaixo de um host hostil inflando a tela. */
export const MAX_DESTINATION_MARKS = 64

/** Sinal pronto para desenhar: posição em px de mundo e instante em que chegou (`Date.now`). */
export interface SignalMark {
  id: string
  x: number
  y: number
  name: string
  color: string
  createdAt: number
  /**
   * Eco de quem sinalizou sem colega À VISTA vendo o ponto: desenhado tracejado.
   * NÃO é "ninguém recebeu" — contrato em `HostMessage` (`net/protocol.ts`).
   */
  unheard?: true
}

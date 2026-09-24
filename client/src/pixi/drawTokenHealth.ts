import type { Graphics } from 'pixi.js'
import type { TokenHealth } from '../types/map'
import { healthFraction, healthState, type HealthState } from '../lib/tokenHealth'

/**
 * BARRA DE VIDA da ficha — o mesmo desenho no mapa do mestre
 * (`pixi/tokensRenderer.ts`) e na tela do jogador (`player/PlayerView.tsx`).
 *
 * Fina, chapada e colada SOB o disco, sem cobri-lo: é o que se lê primeiro
 * depois da própria ficha, e o nome desce para baixo dela. Sem animação de
 * propósito: a vida muda por digitação do mestre, e movimento em resposta a
 * teclado só atrasa a leitura.
 */

/** Nome do Graphics da barra dentro da ficha — é por ele que teste e depuração a acham. */
export const HEALTH_BAR_LABEL = 'barra-de-vida'

/**
 * Folga entre a borda do disco e o topo da barra, em px de mundo. Passa do
 * contorno de seleção (traço de 4 centrado no raio, ou seja, até raio + 2): a
 * barra nunca encosta no realce e o disco continua inteiro à vista.
 */
export const HEALTH_BAR_GAP = 4
/** Altura da barra: FINA — cerca de um décimo do disco de uma casa. */
export const HEALTH_BAR_HEIGHT = 5
/** Largura em fração do diâmetro do disco: mais estreita que a ficha, lê como a base dela. */
export const HEALTH_BAR_WIDTH_RATIO = 0.8
/** Respiro entre a trilha e o preenchimento: a trilha escura contorna a cor sobre qualquer chão. */
const HEALTH_BAR_INSET = 1
/** Folga entre a barra e o nome logo abaixo dela. */
const LABEL_GAP_BELOW_BAR = 2
/** Onde o nome começava antes da barra existir: colado no disco. */
const LABEL_GAP_BELOW_DISK = 2

/**
 * Trilha: a tinta do fundo da aplicação (`--lb-color-ink`, theme.ts), quase
 * opaca — é ela que separa a cor da barra de qualquer chão, do bege padrão ao
 * verde escuro do minimapa antigo.
 */
const TRACK_COLOR = 0x121214
const TRACK_ALPHA = 0.72
/**
 * Fio claro em volta da trilha, o mesmo pergaminho do texto
 * (`--lb-color-parchment`): sobre chão escuro é ele que marca o comprimento
 * inteiro, e sem ele a parte vazia da barra sumiria. Linha fina clara, como a
 * parede do minimapa.
 */
const KEYLINE_COLOR = 0xeceae4
const KEYLINE_ALPHA = 0.3
const KEYLINE_WIDTH = 1

/**
 * Cor por estado — o ECG do Resident Evil (Fine, Caution, Danger). A
 * luminosidade DESCE do bem para o perigo, então quem não separa verde de
 * vermelho ainda lê a ordem pelo claro/escuro (conferido no validador de
 * paleta do skill `dataviz`: pior par para daltonismo ΔE 10,7; contraste acima
 * de 3:1 contra a trilha). O perigo é o `--lb-color-ember` do tema.
 */
export const HEALTH_BAR_COLORS: Readonly<Record<HealthState, number>> = {
  fine: 0x7ee0a0,
  caution: 0xe0a030,
  danger: 0xe2645a,
}

export interface HealthBarLayout {
  /** Canto superior esquerdo da trilha, relativo ao centro da ficha. */
  x: number
  y: number
  width: number
  height: number
  /** Largura do preenchimento, já dentro do respiro da trilha; 0 = vida zerada. */
  fillWidth: number
  color: number
}

/** Geometria da barra de uma ficha de raio `radius` (px de mundo), centrada sob o disco. */
export function healthBarLayout(radius: number, health: TokenHealth): HealthBarLayout {
  const width = 2 * radius * HEALTH_BAR_WIDTH_RATIO
  const inner = Math.max(0, width - 2 * HEALTH_BAR_INSET)
  const innerHeight = HEALTH_BAR_HEIGHT - 2 * HEALTH_BAR_INSET
  const fraction = healthFraction(health)
  // Vivo com um fio de vida continua com um ponto de barra: vazia é só a zerada.
  const fillWidth = health.current <= 0 ? 0 : Math.min(inner, Math.max(innerHeight, inner * fraction))
  return {
    x: -width / 2,
    y: radius + HEALTH_BAR_GAP,
    width,
    height: HEALTH_BAR_HEIGHT,
    fillWidth,
    color: HEALTH_BAR_COLORS[healthState(fraction)],
  }
}

/**
 * Desenha a barra no Graphics dela (ou só limpa, com `null`). Não cria,
 * posiciona nem destrói nada: o Graphics mora dentro da ficha, que já está no
 * centro do token.
 */
export function drawTokenHealthBar(graphics: Graphics, radius: number, health: TokenHealth | null): void {
  graphics.clear()
  if (health === null) return
  const bar = healthBarLayout(radius, health)
  graphics
    .roundRect(bar.x, bar.y, bar.width, bar.height, bar.height / 2)
    .fill({ color: TRACK_COLOR, alpha: TRACK_ALPHA })
    .stroke({ width: KEYLINE_WIDTH, color: KEYLINE_COLOR, alpha: KEYLINE_ALPHA })
  if (bar.fillWidth <= 0) return
  const innerHeight = bar.height - 2 * HEALTH_BAR_INSET
  graphics
    .roundRect(bar.x + HEALTH_BAR_INSET, bar.y + HEALTH_BAR_INSET, bar.fillWidth, innerHeight, innerHeight / 2)
    .fill({ color: bar.color })
}

/** Topo do nome da ficha: colado no disco, ou logo abaixo da barra quando a ficha tem vida. */
export function tokenLabelTop(radius: number, hasBar: boolean): number {
  return hasBar ? radius + HEALTH_BAR_GAP + HEALTH_BAR_HEIGHT + LABEL_GAP_BELOW_BAR : radius + LABEL_GAP_BELOW_DISK
}

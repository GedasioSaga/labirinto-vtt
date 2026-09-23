import type { Graphics } from 'pixi.js'

/**
 * Aro de dono: o que diz "esta ficha é sua" na tela do jogador.
 *
 * BRANCO, e não a cor do dono. Com a cor que o mestre deu à ficha (aliado
 * azul, inimigo vermelho), o aro azul de antes sumia justamente numa ficha
 * azul. Branco puro contrasta com qualquer cor de ficha e com o chão chapado
 * do minimapa; o fio escuro por fora segura o aro quando o chão é claro.
 *
 * Espessura em px de TELA: afastado, o aro ainda se acha; de perto, não vira
 * uma rosca grossa em volta da ficha.
 */
export const OWNER_RING_COLOR = 0xffffff
export const OWNER_RING_WIDTH_PX = 3
export const OWNER_RING_EDGE_COLOR = 0x000000
export const OWNER_RING_EDGE_ALPHA = 0.55
export const OWNER_RING_EDGE_WIDTH_PX = 1

function safeScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/** Raio, em px de TELA, da borda de fora do aro (fio escuro incluso): é de onde o pulso sai. */
export function ownerRingOuterPx(radius: number, scale: number): number {
  return radius * safeScale(scale) + OWNER_RING_WIDTH_PX + OWNER_RING_EDGE_WIDTH_PX
}

/** Aro no espaço da ficha (px de mundo, centro em 0,0), logo por FORA do disco. */
export function drawOwnerRing(g: Graphics, radius: number, scale: number): void {
  const s = safeScale(scale)
  const ring = OWNER_RING_WIDTH_PX / s
  const edge = OWNER_RING_EDGE_WIDTH_PX / s
  g.clear()
  g.circle(0, 0, radius + ring / 2).stroke({ width: ring, color: OWNER_RING_COLOR, alpha: 1 })
  g.circle(0, 0, radius + ring + edge / 2).stroke({ width: edge, color: OWNER_RING_EDGE_COLOR, alpha: OWNER_RING_EDGE_ALPHA })
}

/*
 * Pulso "você está aqui": toca quando a câmera LEVA o jogador até a ficha — a
 * chegada que centrou nela, "Minha ficha", "Centralizar". Duas ondas, a
 * segunda meio passo atrás, e acabou: é um sinal que responde a uma ação, não
 * um enfeite piscando a sessão inteira. A mesma língua das ondas do "Sinalizar"
 * (pixi/drawSignals.ts), em branco e mais curta.
 */
const PULSE_WAVES = 2
const PULSE_WAVE_MS = 650
const PULSE_STAGGER_MS = 300
export const OWNER_PULSE_DURATION_MS = PULSE_WAVE_MS + (PULSE_WAVES - 1) * PULSE_STAGGER_MS
const PULSE_SPREAD_PX = 24
const PULSE_WIDTH_PX = 2.5
const PULSE_START_ALPHA = 0.9

/** Sai rápido do aro e assenta: o olho pega a partida, não a chegada. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Quadro `elapsedMs` do pulso, em px de TELA, centrado em (x, y). Cada onda
 * nasce em `fromRadiusPx` (a borda de fora do aro) e cresce esmaecendo.
 * Devolve `false`, com `g` vazio, quando o pulso acabou.
 */
export function drawOwnerPulse(g: Graphics, x: number, y: number, fromRadiusPx: number, elapsedMs: number): boolean {
  g.clear()
  if (!(elapsedMs >= 0) || elapsedMs >= OWNER_PULSE_DURATION_MS) return false
  for (let wave = 0; wave < PULSE_WAVES; wave += 1) {
    const t = (elapsedMs - wave * PULSE_STAGGER_MS) / PULSE_WAVE_MS
    if (t < 0 || t >= 1) continue
    const radius = fromRadiusPx + easeOutCubic(t) * PULSE_SPREAD_PX
    g.circle(x, y, radius).stroke({ width: PULSE_WIDTH_PX, color: OWNER_RING_COLOR, alpha: PULSE_START_ALPHA * (1 - t) ** 2 })
  }
  return true
}

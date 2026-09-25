import { Color, type Graphics } from 'pixi.js'
import type { Light } from '../types/map'

/**
 * LUZ VISTA DE LONGE na tela do jogador. O recorte do mestre (`lib/fogFilter.ts`)
 * manda a luz marcada "Vista de longe" que está FORA da visão como um ponto:
 * raio 0, sem halo. Aqui ela vira um ponto aceso ACIMA da névoa — é o único
 * jeito de a janela acesa do outro lado do vale aparecer no escuro —, com
 * tamanho fixo na tela, para continuar legível com o mapa afastado.
 */

/** Miolo do ponto, em px de tela. */
export const FAR_LIGHT_CORE_SCREEN_RADIUS = 3.5
/** Brilho em volta do miolo, em px de tela. */
const FAR_LIGHT_GLOW_SCREEN_RADIUS = 9
/** Opacidade do brilho por unidade de intensidade. */
const FAR_LIGHT_GLOW_ALPHA = 0.35
/** Intensidade mínima do miolo: luz fraca continua um ponto que se vê. */
const FAR_LIGHT_CORE_MIN_ALPHA = 0.6

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

/** As luzes que chegaram como ponto: marcadas e sem raio. Luz marcada DENTRO da visão chega inteira e tem o halo de sempre. */
export function farLightPoints(lights: readonly Light[]): Light[] {
  return lights.filter((l) => l.vistaDeLonge === true && l.radius === 0)
}

/** Redesenha os pontos acesos; `cameraScale` mantém o tamanho em px de tela. */
export function drawFarLights(g: Graphics, lights: readonly Light[], cameraScale: number): void {
  g.clear()
  const scale = Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
  for (const light of farLightPoints(lights)) {
    const color = new Color(light.color).toNumber()
    const intensity = clamp01(light.intensity)
    g.circle(light.x, light.y, FAR_LIGHT_GLOW_SCREEN_RADIUS / scale).fill({ color, alpha: FAR_LIGHT_GLOW_ALPHA * intensity })
    g.circle(light.x, light.y, FAR_LIGHT_CORE_SCREEN_RADIUS / scale).fill({ color, alpha: Math.max(FAR_LIGHT_CORE_MIN_ALPHA, intensity) })
  }
}

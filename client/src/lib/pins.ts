import type { Pin, PinKind, RegionPoint } from '../types/map'

/**
 * Regras do pino de ponto de interesse, compartilhadas pelo editor (render e
 * clique) e pelo jogador (render e toque). Puro: sem DOM, sem Pixi, sem store.
 */

/** Altura do pino em px de mundo, da ponta cravada ao topo da cabeça. */
export const PIN_HEIGHT = 34
/** Raio da cabeça redonda onde mora o glifo, em px de mundo. */
export const PIN_HEAD_RADIUS = 11
/** Centro da cabeça fica esta distância acima do ponto cravado. */
export const PIN_HEAD_OFFSET = PIN_HEIGHT - PIN_HEAD_RADIUS

/** Glifo de cada tipo — é o que distingue os dois pinos na tela do jogador. */
export const PIN_GLYPH: Record<PinKind, string> = {
  exclamacao: '!',
  interrogacao: '?',
}

/** Nome de cada tipo na interface do mestre. */
export const PIN_KIND_LABELS: Record<PinKind, string> = {
  exclamacao: 'Exclamação (!)',
  interrogacao: 'Interrogação (?)',
}

/** Ordem em que os dois tipos aparecem no painel. */
export const PIN_KIND_ORDER: readonly PinKind[] = ['exclamacao', 'interrogacao']

/**
 * Só data URL de imagem viaja para o jogador. Caminho de disco do mestre
 * (`C:\...`, `/home/...`, `file://...`) NUNCA sai: quem recorta o mapa
 * (`lib/fogFilter.ts`) apaga o campo quando esta função devolve `false`.
 */
export function isPlayerSafePinImage(image: string | null): image is string {
  return typeof image === 'string' && image.startsWith('data:image/')
}

/**
 * Pino sob o ponto do mundo, do desenhado por último para o primeiro (o de
 * cima ganha). A área de toque é a cabeça mais a haste: um retângulo alto e
 * estreito com a bola em cima, engordado por `tolerance` para o dedo — no
 * celular o alvo real é o dedo, não o desenho.
 */
export function findPinAt(pins: readonly Pin[], point: RegionPoint, tolerance = 0): Pin | null {
  for (let i = pins.length - 1; i >= 0; i--) {
    const pin = pins[i]
    const dx = point.x - pin.x
    const dy = point.y - pin.y
    // Cabeça: círculo em torno do centro dela.
    if (Math.hypot(dx, dy + PIN_HEAD_OFFSET) <= PIN_HEAD_RADIUS + tolerance) return pin
    // Haste: faixa vertical entre a ponta e a base da cabeça.
    if (Math.abs(dx) <= PIN_HEAD_RADIUS / 2 + tolerance && dy <= tolerance && dy >= -PIN_HEIGHT - tolerance) return pin
  }
  return null
}

/** Texto curto do pino para o mestre (lista, título de painel e leitor de tela). */
export function pinSummary(pin: Pin): string {
  const description = pin.description.trim()
  return description === '' ? `Ponto de interesse ${PIN_GLYPH[pin.kind]}` : description
}

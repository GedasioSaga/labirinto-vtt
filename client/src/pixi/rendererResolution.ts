// Resolução do renderer Pixi em telas com escala (Windows 125%/150%, zoom do
// navegador). Sem isso o Pixi desenha em pixels CSS e o sistema estica o canvas:
// linha e texto borrados, linha fina serrilhada ou sumindo.

/** Teto de densidade: acima disso o backbuffer cresce ao quadrado sem ganho visível. */
export const MAX_RENDERER_RESOLUTION = 3
const MIN_RENDERER_RESOLUTION = 1

/** Resolução do renderer a partir do devicePixelRatio: entre 1 e 3; valor inválido vira 1. */
export function chooseRendererResolution(devicePixelRatio: number | undefined): number {
  if (devicePixelRatio === undefined || !Number.isFinite(devicePixelRatio)) return MIN_RENDERER_RESOLUTION
  return Math.min(MAX_RENDERER_RESOLUTION, Math.max(MIN_RENDERER_RESOLUTION, devicePixelRatio))
}

/** Resolução para o devicePixelRatio atual da janela. */
export function currentRendererResolution(): number {
  return chooseRendererResolution(typeof window === 'undefined' ? undefined : window.devicePixelRatio)
}

/**
 * Chama `onChange` quando o devicePixelRatio muda (janela arrastada para outro
 * monitor, zoom do navegador). A media query `(resolution: Xdppx)` só casa com o
 * valor atual, então a cada troca ela é refeita com o valor novo. O 'resize' da
 * janela é a segunda via: nem todo caminho dispara o 'change' da query (medido:
 * a emulação de escala do Chromium muda `matches` sem emitir o evento). As duas
 * vias são deduplicadas pelo último devicePixelRatio visto. Devolve a função que
 * remove os listeners.
 */
export function watchDevicePixelRatio(onChange: (resolution: number) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const canQuery = typeof window.matchMedia === 'function'
  let query: MediaQueryList | null = null
  let lastRatio = window.devicePixelRatio
  let stopped = false

  const listen = () => {
    if (!canQuery) return
    query?.removeEventListener('change', check)
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    query.addEventListener('change', check)
  }
  function check() {
    if (stopped || window.devicePixelRatio === lastRatio) return
    lastRatio = window.devicePixelRatio
    listen()
    onChange(currentRendererResolution())
  }

  listen()
  window.addEventListener('resize', check)
  return () => {
    stopped = true
    query?.removeEventListener('change', check)
    window.removeEventListener('resize', check)
  }
}

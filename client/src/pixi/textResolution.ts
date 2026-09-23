import { Container, Text } from 'pixi.js'

// Nitidez do texto com zoom. O Pixi rasteriza cada `Text` numa textura na
// resolução do renderer; dentro do `world` escalado (zoom 2x, 4x) essa textura
// é esticada e o texto sai mole a 2x e em blocos a 4x (medido em
// screenshot, 14/09/2026). Aqui a resolução do Text acompanha a escala
// efetiva EXATA, quantizada em passos de TEXT_ZOOM_STEP. O degrau antigo em
// potência de 2 rasterizava 150% a 2x e reduzia 0,75 com filtro linear, o que
// deixava rampa de 1 px em cada borda de letra (medido 15/09/2026).

/** Fator máximo aplicado por zoom: acima de 4x a memória cresce ao quadrado sem ganho. */
export const MAX_TEXT_ZOOM_FACTOR = 4
/** Passo da quantização: zoom de 1,5 vira exatamente 1,5; 1,6 vira 1,75. */
export const TEXT_ZOOM_STEP = 0.25
/** Lado maior da textura de um Text, em px físicos (limite seguro de GPU). */
export const MAX_TEXT_TEXTURE_SIDE = 4096
/** Espera depois do último passo de zoom antes de re-rasterizar os textos. */
export const TEXT_RESOLUTION_DEBOUNCE_MS = 120
/** Folga de ponto flutuante: 0,35 × 1,6 não pode virar o passo seguinte. */
const STEP_EPSILON = 1e-6

/** Fator do zoom: escala efetiva arredondada para cima ao passo, entre 1 e o teto. */
export function textZoomStep(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 1) return 1
  const stepped = Math.ceil(scale / TEXT_ZOOM_STEP - STEP_EPSILON) * TEXT_ZOOM_STEP
  return Math.min(MAX_TEXT_ZOOM_FACTOR, stepped)
}

/**
 * Resolução do Text = renderer × degrau da escala efetiva, com o lado maior
 * da textura limitado a MAX_TEXT_TEXTURE_SIDE. Nunca fica abaixo da resolução
 * do renderer (é o que o Pixi já usaria sozinho).
 * `largestSide` = maior dimensão do texto em px locais (sem escala), 0 se desconhecida.
 */
export function chooseTextResolution(rendererResolution: number, effectiveScale: number, largestSide = 0): number {
  const base = Number.isFinite(rendererResolution) && rendererResolution > 0 ? rendererResolution : 1
  const wanted = base * textZoomStep(effectiveScale)
  if (!(largestSide > 0)) return wanted
  const capped = Math.floor(MAX_TEXT_TEXTURE_SIDE / largestSide)
  return Math.max(base, Math.min(wanted, capped))
}

function largestLocalSide(text: Text): number {
  const { width, height } = text.bounds
  return Math.max(Math.abs(width), Math.abs(height))
}

/**
 * Ajusta a resolução de todo `Text` abaixo de `world` (visível ou não: os
 * renderers guardam Text em cache e reexibem depois). `worldScale` é a escala
 * do próprio `world`; a escala de cada nível até o Text entra no produto
 * (moldura do mapa estica o título em x). Só atribui quando muda: atribuir
 * força nova rasterização. Devolve a maior resolução presente depois do ajuste.
 */
export function syncWorldTextResolution(world: Container, worldScale: number, rendererResolution: number): number {
  let highest = 0
  const visit = (node: Container, scale: number) => {
    for (const child of node.children) {
      const childScale = scale * Math.max(Math.abs(child.scale.x), Math.abs(child.scale.y))
      if (child instanceof Text) {
        const next = chooseTextResolution(rendererResolution, childScale, largestLocalSide(child))
        if (child.resolution !== next) child.resolution = next
        // Quad do texto no pixel físico inteiro: textura 1:1 sem meia amostra de borda.
        if (!child.roundPixels) child.roundPixels = true
        highest = Math.max(highest, next)
      }
      if (child.children.length > 0) visit(child, childScale)
    }
  }
  visit(world, worldScale)
  return highest
}

/** Debounce da sincronização: `schedule()` a cada mudança, `flush()` aplica já, `cancel()` no desmonte. */
export function createDebouncedTask(run: () => void, delayMs = TEXT_RESOLUTION_DEBOUNCE_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  return {
    schedule() {
      cancel()
      timer = setTimeout(() => {
        timer = null
        run()
      }, delayMs)
    },
    flush() {
      cancel()
      run()
    },
    cancel,
  }
}

// Nome de sala e de token é informação de leitura, não desenho do mapa: com a
// fonte fixa em px de mundo ele virava mancha a 35-50% de zoom (7 px de tela,
// medido 15/09/2026). Aqui o rótulo ganha uma escala própria que compensa a
// câmera quando o zoom o encolheria abaixo de LABEL_MIN_SCREEN_PX, e some de
// vez abaixo de LABEL_MIN_ZOOM (a planta inteira na tela, nome só polui).
// Texto livre da ferramenta Texto NÃO passa por aqui: é conteúdo do mapa.

/** Menor tamanho de fonte na tela, em px CSS. */
export const LABEL_MIN_SCREEN_PX = 11
/** Abaixo deste zoom o rótulo fica invisível. */
export const LABEL_MIN_ZOOM = 0.3

export interface LabelSizing {
  visible: boolean
  /** Escala local do Text (1 = tamanho de mundo). */
  scale: number
}

export function screenLabelSizing(fontSize: number, cameraScale: number): LabelSizing {
  if (!Number.isFinite(cameraScale) || cameraScale <= 0 || !Number.isFinite(fontSize) || fontSize <= 0) {
    return { visible: true, scale: 1 }
  }
  if (cameraScale < LABEL_MIN_ZOOM) return { visible: false, scale: 1 }
  const onScreen = fontSize * cameraScale
  return { visible: true, scale: onScreen < LABEL_MIN_SCREEN_PX ? LABEL_MIN_SCREEN_PX / onScreen : 1 }
}

/**
 * Moldura de exportação estilo janela de minimapa: painel com borda de 1 px em
 * volta do mapa e, com título, uma barra lateral escura com o nome escrito na
 * vertical (de baixo para cima). Geometria pura, em pixels inteiros; o render
 * fica em `pixi/drawMapFrame.ts`.
 *
 * `MINIMAP_FRAME_STYLE` reproduz a janela de `Objetivo/Mapa1.png` ("Village
 * Lake"), medida pixel a pixel: barra de x=2 a 31, vão de 3 px, painel de
 * x=35 a 834 e y=0 a 863, conteúdo 798×862.
 */

export interface MapFrameStyle {
  marginLeft: number
  marginTop: number
  marginRight: number
  marginBottom: number
  titleBarWidth: number
  /** Vão entre a barra de título e o painel do mapa. */
  gap: number
  /** Distância da borda da barra até o preenchimento (1 px de borda + 1 px vazio). */
  titleBarInset: number
  borderColor: string
  titleBarBorderColor: string
  titleBarFill: string
  titleColor: string
  /** Comprimento do texto do título ao longo da barra, em px. */
  titleLength: number
  /** Espessura do texto (altura da linha girada), em px. */
  titleThickness: number
  /** Distância do fim do texto até o fim do preenchimento da barra. */
  titlePaddingEnd: number
  /** Deslocamento do centro do texto em relação ao centro da barra (px, para a direita). */
  titleCrossOffset: number
}

export const MINIMAP_FRAME_STYLE: MapFrameStyle = {
  marginLeft: 2,
  marginTop: 0,
  marginRight: 1,
  marginBottom: 2,
  titleBarWidth: 30,
  gap: 3,
  titleBarInset: 2,
  borderColor: '#505050',
  titleBarBorderColor: '#4b4b4b',
  titleBarFill: '#0d0d0d',
  titleColor: '#ffffff',
  titleLength: 82,
  titleThickness: 14,
  titlePaddingEnd: 4,
  titleCrossOffset: 2,
}

export interface PixelRect {
  x: number
  y: number
  w: number
  h: number
  color: string
}

export interface MapFrameTitle {
  text: string
  /** Centro do texto no eixo da largura da barra. */
  cx: number
  /** Onde o texto termina (ele sobe a partir daqui), em y. */
  bottom: number
  length: number
  thickness: number
  color: string
}

export interface MapFrameLayout {
  width: number
  height: number
  /** Onde o mapa é desenhado dentro da moldura (1 px de mundo = 1 px). */
  content: { x: number; y: number; w: number; h: number }
  rects: PixelRect[]
  title: MapFrameTitle | null
}

/** Contorno de 1 px do retângulo [x0..x1] × [y0..y1], inclusivo, como 4 retângulos sem sobreposição. */
function outline(x0: number, y0: number, x1: number, y1: number, color: string): PixelRect[] {
  return [
    { x: x0, y: y0, w: x1 - x0 + 1, h: 1, color },
    { x: x0, y: y1, w: x1 - x0 + 1, h: 1, color },
    { x: x0, y: y0 + 1, w: 1, h: y1 - y0 - 1, color },
    { x: x1, y: y0 + 1, w: 1, h: y1 - y0 - 1, color },
  ]
}

export function layoutMapFrame(contentWidth: number, contentHeight: number, title: string | null, style: MapFrameStyle = MINIMAP_FRAME_STYLE): MapFrameLayout {
  const hasTitle = Boolean(title && title.trim())
  const panelX = style.marginLeft + (hasTitle ? style.titleBarWidth + style.gap : 0)
  const panelY = style.marginTop
  const panelRight = panelX + contentWidth + 1
  const panelBottom = panelY + contentHeight + 1
  const rects = outline(panelX, panelY, panelRight, panelBottom, style.borderColor)

  let frameTitle: MapFrameTitle | null = null
  if (hasTitle && title) {
    const barX0 = style.marginLeft
    const barX1 = barX0 + style.titleBarWidth - 1
    rects.push(...outline(barX0, panelY, barX1, panelBottom, style.titleBarBorderColor))
    const fillX0 = barX0 + style.titleBarInset
    const fillY0 = panelY + style.titleBarInset
    const fillX1 = barX1 - style.titleBarInset
    const fillY1 = panelBottom - style.titleBarInset
    rects.push({ x: fillX0, y: fillY0, w: fillX1 - fillX0 + 1, h: fillY1 - fillY0 + 1, color: style.titleBarFill })
    frameTitle = {
      text: title.trim(),
      cx: (fillX0 + fillX1 + 1) / 2 + style.titleCrossOffset,
      bottom: fillY1 + 1 - style.titlePaddingEnd,
      length: style.titleLength,
      thickness: style.titleThickness,
      color: style.titleColor,
    }
  }

  return {
    width: panelRight + 1 + style.marginRight,
    height: panelBottom + 1 + style.marginBottom,
    content: { x: panelX + 1, y: panelY + 1, w: contentWidth, h: contentHeight },
    rects,
    title: frameTitle,
  }
}

/**
 * CONTA-GOTAS DO MAPA — a parte pura. O seletor de cor nativo do WebView2 não
 * tem a pipeta do popup (só o Chrome tem), então o app tem a sua: a pipeta ao
 * lado de cada amostra de cor arma o modo, o próximo clique no mapa lê o pixel
 * desenhado ali (`PixiCanvas`) e a cor volta para o campo no formato do
 * `<input type="color">`.
 */

export interface PixelDaTela {
  x: number
  y: number
}

const CANAL_MAXIMO = 255

/** Um canal 0..255 inteiro, com o que vier fora da faixa (ou NaN) preso nela. */
function canal(valor: number): number {
  if (!Number.isFinite(valor)) return 0
  return Math.min(CANAL_MAXIMO, Math.max(0, Math.round(valor)))
}

/**
 * RGBA (0..255) para `#rrggbb` minúsculo — o único formato que o
 * `<input type="color">` aceita como `value`.
 *
 * O `extract` do Pixi devolve o pixel com alfa PRÉ-MULTIPLICADO; com o fundo do
 * editor opaco o alfa é sempre 255 e isto não muda nada, mas um pixel
 * translúcido volta à cor de verdade em vez de sair escurecido. Alfa zero não
 * tem cor nenhuma: sai preto.
 */
export function rgbaParaHex(r: number, g: number, b: number, a = CANAL_MAXIMO): string {
  const alfa = canal(a)
  const desfazer = alfa > 0 && alfa < CANAL_MAXIMO ? CANAL_MAXIMO / alfa : 1
  const hex = (valor: number) => canal(alfa === 0 ? 0 : valor * desfazer).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * O pixel (px CSS inteiro) sob um ponto da tela do canvas, ou `null` com o
 * ponto fora dela. `x`/`y` vêm do `event.global` do Pixi, que já está em px
 * CSS — a densidade do monitor (devicePixelRatio) fica com o renderer, e o
 * zoom/pan com a câmera do mundo, que o `extract` do stage aplica sozinho.
 */
export function pixelDaTela(x: number, y: number, largura: number, altura: number): PixelDaTela | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (x < 0 || y < 0 || x >= largura || y >= altura) return null
  return { x: Math.floor(x), y: Math.floor(y) }
}

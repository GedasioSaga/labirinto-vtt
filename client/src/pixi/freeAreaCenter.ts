import type { Point } from './world'

/** Passo da amostra, em px de tela: fino o bastante para achar a borda de um painel, barato o bastante para rodar a cada passo da ficha seguida. */
export const FREE_AREA_STEP = 32

/**
 * Centro da parte do canvas que NENHUM painel cobre (o painel lateral, a barra
 * de ferramentas, o HUD de zoom flutuam por cima do mapa). Amostra o canvas em
 * grade e tira o centroide das células livres. `isFree` recebe o ponto em
 * coordenadas do canvas; quem chama decide o que é "livre" (no app, o
 * `elementFromPoint` cair no próprio canvas). `null` quando nada está livre —
 * aí quem chama fica com o centro do canvas.
 */
export function freeAreaCenter(size: { width: number; height: number }, isFree: (x: number, y: number) => boolean, step = FREE_AREA_STEP): Point | null {
  let sx = 0
  let sy = 0
  let n = 0
  for (let y = step / 2; y < size.height; y += step) {
    for (let x = step / 2; x < size.width; x += step) {
      if (!isFree(x, y)) continue
      sx += x
      sy += y
      n += 1
    }
  }
  return n === 0 ? null : { x: sx / n, y: sy / n }
}

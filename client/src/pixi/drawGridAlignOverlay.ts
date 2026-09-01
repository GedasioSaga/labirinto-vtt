import type { Graphics } from 'pixi.js'
import type { GridLine, Viewport } from './grid'
import { strokeDashedSegment } from './grid'

/**
 * Cor/estilo fixos e DELIBERADAMENTE distintos da grade real
 * (`pixi/drawGrid.ts`, que usa `MapData.gridSettings.color`): as duas podem
 * estar visíveis ao mesmo tempo — grade atual por baixo, prévia da grade
 * proposta por cima, enquanto o usuário compara com a imagem antes de
 * clicar "Aplicar" em `components/GridAlignControls.tsx` — e precisam ser
 * discrimináveis sem ambiguidade. Ciano em vez de cinza porque é a cor que
 * menos se confunde com o cinza-padrão de grade E com paredes/portas
 * (laranja) já presentes no canvas.
 */
const OVERLAY_COLOR = 0x2fd6c4
const OVERLAY_LINE_WIDTH = 1.5
const OVERLAY_ALPHA = 0.9

/**
 * Desenha a grade PROPOSTA (ainda não aplicada) por cima da imagem de fundo,
 * para comparação visual antes de confirmar. `lines` vem de
 * `lib/gridAlign.ts` (`computeAlignedGridLines`) — este arquivo só desenha,
 * não calcula geometria, mesma separação de `drawGrid.ts` / `pixi/grid.ts`.
 *
 * Stateless de propósito, como `drawGrid.ts`: recebe o `Graphics` já criado
 * pelo integrador (`pixi/PixiCanvas.tsx`, dentro do `setup()`, nunca em
 * escopo de módulo — mesmo padrão do resto do render pipeline) e só
 * limpa+redesenha. Visibilidade (mostrar/esconder a prévia) é
 * `graphics.visible`, decidida por quem chama — não há lifecycle escondido
 * aqui pra gerenciar.
 */
export function drawGridAlignOverlay(graphics: Graphics, lines: GridLine[], viewport: Viewport): void {
  graphics.clear()
  if (lines.length === 0) return

  for (const line of lines) {
    if (line.axis === 'x') {
      strokeDashedSegment(graphics, line.position, viewport.top, line.position, viewport.bottom, 'dashed')
    } else {
      strokeDashedSegment(graphics, viewport.left, line.position, viewport.right, line.position, 'dashed')
    }
  }

  graphics.stroke({ width: OVERLAY_LINE_WIDTH, color: OVERLAY_COLOR, alpha: OVERLAY_ALPHA, cap: 'round' })
}

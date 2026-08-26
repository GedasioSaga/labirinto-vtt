import type { DrawingTool } from '../types/tools'

/**
 * Textos visíveis da interface do editor.
 *
 * ATENÇÃO: `TOOL_LABELS` e `SELECTION_LABELS` são lidos pelos testes e2e por
 * nome acessível / textContent exato (`getByRole('button', { name, exact: true })`
 * e `toHaveText('Apagar parede selecionada(o)')`). Estilo, ícone e estrutura ao
 * redor podem mudar à vontade; estas strings, não.
 */
// Partial, não Record<DrawingTool, string>: assim a Task 1 pode estender
// DrawingTool (ex.: 'text') sem forçar entrada aqui — o rótulo é escopo da
// Task 3, que o adiciona junto do resto do wiring da ferramenta.
export const TOOL_LABELS: Partial<Record<DrawingTool, string>> = {
  select: 'Selecionar',
  wall: 'Parede',
  light: 'Luz',
  region: 'Região',
  prop: 'Peça',
  brush: 'Pincel',
  line: 'Linha',
  circle: 'Círculo',
  curve: 'Curva',
}

export const SELECTION_LABELS: Record<string, string> = {
  token: 'token',
  wall: 'parede',
  light: 'luz',
  region: 'região',
  prop: 'peça',
  drawing: 'desenho',
}

// 'text' fica de fora de propósito — Partial<Record<...>> não exige a
// entrada, e o hint da ferramenta é escopo da Task 3.
export const TOOL_HINTS: Partial<Record<DrawingTool, string>> = {
  wall: 'Clique e arraste para desenhar uma parede.',
  light: 'Clique para colocar uma luz.',
  region: 'Clique para adicionar vértice. Duplo clique fecha (mín. 3 pontos). Esc cancela.',
  prop: 'Clique no mapa e escolha uma imagem — vira um objeto que pode ser arrastado depois (ferramenta Selecionar).',
  brush: 'Clique e arraste para desenhar um traço livre.',
  line: 'Clique e arraste para desenhar uma linha reta.',
  circle: 'Clique no centro e arraste para definir o raio.',
  curve: 'Clique e arraste para desenhar uma curva suave.',
}

/**
 * Ferramentas agrupadas por intenção — a barra desenha um separador entre
 * grupos. 'text' fica de fora de propósito: DrawingTool foi estendido na
 * Task 1, mas a ferramenta só fica selecionável na barra na Task 3 (junto do
 * handler de clique e da renderização da Task 2, drawTextLabels.ts).
 */
export const TOOL_GROUPS: DrawingTool[][] = [
  ['select'],
  ['wall', 'light', 'region', 'prop'],
  ['brush', 'line', 'circle', 'curve'],
]

/** Ferramentas que expõem os controles de cor/espessura/preenchimento. */
export const DRAWING_TOOLS: DrawingTool[] = ['brush', 'line', 'circle', 'curve']

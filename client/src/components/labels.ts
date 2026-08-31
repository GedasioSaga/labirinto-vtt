import type { DrawingTool } from '../types/tools'

/**
 * Textos visíveis da interface do editor.
 *
 * ATENÇÃO: `TOOL_LABELS` e `SELECTION_LABELS` são lidos pelos testes e2e por
 * nome acessível / textContent exato (`getByRole('button', { name, exact: true })`
 * e `toHaveText('Apagar parede selecionada(o)')`). Estilo, ícone e estrutura ao
 * redor podem mudar à vontade; estas strings, não.
 */
// Partial, não Record<DrawingTool, string>: assim uma futura extensão de
// DrawingTool não força entrada aqui antes do rótulo existir.
export const TOOL_LABELS: Partial<Record<DrawingTool, string>> = {
  select: 'Selecionar',
  wall: 'Parede',
  door: 'Porta',
  light: 'Luz',
  region: 'Região',
  room: 'Sala',
  roomCircle: 'Sala Circular',
  roomPolygon: 'Polígono Regular',
  prop: 'Peça',
  brush: 'Pincel',
  line: 'Linha',
  circle: 'Círculo',
  curve: 'Curva',
  text: 'Texto',
  eraser: 'Borracha',
}

export const SELECTION_LABELS: Record<string, string> = {
  token: 'token',
  wall: 'parede',
  light: 'luz',
  region: 'região',
  prop: 'peça',
  drawing: 'desenho',
}

export const TOOL_HINTS: Partial<Record<DrawingTool, string>> = {
  wall: 'Clique e arraste para desenhar uma parede.',
  door: 'Clique em cima de uma parede para criar uma porta alinhada com ela.',
  light: 'Clique para colocar uma luz.',
  region: 'Clique para adicionar vértice. Duplo clique fecha (mín. 3 pontos). Esc cancela.',
  room: 'Clique e arraste para criar uma sala: uma região preenchida com paredes na borda.',
  roomCircle: 'Clique no centro e arraste até a borda para criar uma sala circular.',
  roomPolygon: 'Clique no centro e arraste até a borda para criar um polígono regular — ajuste o número de lados no painel.',
  prop: 'Clique no mapa e escolha uma imagem — vira um objeto que pode ser arrastado depois (ferramenta Selecionar).',
  brush: 'Clique e arraste para desenhar um traço livre.',
  line: 'Clique e arraste para desenhar uma linha reta.',
  circle: 'Clique no centro e arraste para definir o raio.',
  curve: 'Clique e arraste para desenhar uma curva suave.',
  text: 'Clique pra colocar um rótulo — edite o texto no painel.',
  eraser: 'Clique ou arraste sobre um item do mapa para apagá-lo.',
}

/**
 * Ferramentas agrupadas por intenção — a barra desenha um separador entre
 * grupos.
 */
export const TOOL_GROUPS: DrawingTool[][] = [
  ['select'],
  ['wall', 'door', 'light', 'region', 'room', 'roomCircle', 'roomPolygon', 'prop'],
  ['brush', 'line', 'circle', 'curve', 'text', 'eraser'],
]

/** Ferramentas que expõem os controles de cor/espessura/preenchimento. */
export const DRAWING_TOOLS: DrawingTool[] = ['brush', 'line', 'circle', 'curve']

/**
 * Famílias de fonte oferecidas no seletor de rótulo de texto — nomes
 * cross-platform seguros pra navegador/webview (sem depender de fonte
 * customizada instalada). Sem aspas: PIXI.TextStyle já aspeia nomes com
 * espaço sozinho (ver fontStringFromTextStyle em pixi.js), então guardar
 * o nome cru aqui evita escapar aspas no value do <option> e no Drawing.
 * Compartilhada entre o controle de "próximo texto" (DrawingStyleControls)
 * e o de texto selecionado (TextLabelControls).
 */
export const TEXT_FONT_FAMILIES = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Comic Sans MS',
  'Impact',
]

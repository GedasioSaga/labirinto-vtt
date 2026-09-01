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
  stair: 'Escada',
  token: 'Token',
  prop: 'Peça',
  brush: 'Pincel',
  line: 'Linha',
  circle: 'Círculo',
  ellipse: 'Elipse',
  rect: 'Retângulo',
  polygon: 'Polígono',
  curve: 'Curva',
  text: 'Texto',
  measure: 'Medir',
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
  // F4 (integrador I8): documenta os dois gestos novos desta fase — resize
  // por canto/ponta (B3, "mover e redimensionar") e seleção de área (N3).
  // Sem ferramenta dedicada na barra para N3 (ver relatório do integrador —
  // arquivos de Toolbar.tsx/types/tools.ts fora do escopo desta tarefa):
  // Shift+arraste é o caminho de UI até a capacidade, documentado aqui para
  // não ficar "pronta e inalcançável" (lição do ROADMAP.md, dívida D5).
  select: 'Clique para selecionar. Arraste o corpo do item para mover, os cantos/pontas para redimensionar. Shift+arraste numa área vazia para selecionar vários itens de uma vez e movê-los juntos.',
  wall: 'Clique e arraste para desenhar uma parede. Segure Ctrl para travar horizontal/vertical/diagonal, Alt para inverter o snap na grade.',
  door: 'Clique em cima de uma parede para criar uma porta alinhada com ela.',
  light: 'Clique para colocar uma luz.',
  region: 'Clique para adicionar vértice. Duplo clique fecha (mín. 3 pontos). Esc cancela.',
  room: 'Clique e arraste para criar uma sala: uma região preenchida com paredes na borda.',
  roomCircle: 'Clique no centro e arraste até a borda para criar uma sala circular.',
  roomPolygon: 'Clique no centro e arraste até a borda para criar um polígono regular — ajuste o número de lados no painel.',
  stair: 'Clique e arraste para desenhar um lance de escada.',
  token: 'Clique no mapa para colocar um token — escolha uma imagem depois no painel, ou deixe o círculo genérico.',
  prop: 'Clique no mapa e escolha uma imagem — vira um objeto que pode ser arrastado depois (ferramenta Selecionar).',
  brush: 'Clique e arraste para desenhar um traço livre.',
  line: 'Clique e arraste para desenhar uma linha reta.',
  circle: 'Clique no centro e arraste para definir o raio.',
  ellipse: 'Clique no centro e arraste para definir os dois raios.',
  rect: 'Clique e arraste de um canto ao outro para desenhar um retângulo.',
  polygon: 'Clique para adicionar vértice. Duplo clique fecha (mín. 3 pontos). Esc cancela.',
  curve: 'Clique e arraste para desenhar uma curva suave.',
  text: 'Clique pra colocar um rótulo — edite o texto no painel.',
  measure: 'Clique e arraste para medir a distância entre dois pontos.',
  eraser: 'Clique ou arraste sobre um item do mapa para apagá-lo.',
}

/**
 * Ferramentas agrupadas por intenção — a barra desenha um separador entre
 * grupos.
 */
export const TOOL_GROUPS: DrawingTool[][] = [
  ['select'],
  // stair entra na Fase 2 (escada reta, B2) — já tinha ícone e rótulo desde
  // a Fase 0, só faltava aparecer aqui.
  ['wall', 'door', 'light', 'region', 'room', 'roomCircle', 'roomPolygon', 'stair', 'prop'],
  // ellipse/rect/polygon entram na Fase 1 (formas + transparência, A3); measure
  // entra na Fase 2 (medição efêmera, B4) — mesmo caso de stair acima: ícone e
  // rótulo já existiam, só faltava a linha aqui.
  ['brush', 'line', 'circle', 'ellipse', 'rect', 'polygon', 'curve', 'text', 'measure', 'eraser'],
]

/**
 * Ferramentas que expõem os controles de cor/espessura/preenchimento.
 * `rect`/`ellipse`/`polygon` entram junto de `circle`: os quatro produzem um
 * `Drawing` com `filled`/`fillAlpha` no schema (types/map.ts). `text` fica de
 * fora de propósito — tem seus próprios controles (fonte/tamanho), não estes.
 */
export const DRAWING_TOOLS: DrawingTool[] = ['brush', 'line', 'circle', 'ellipse', 'rect', 'polygon', 'curve']

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

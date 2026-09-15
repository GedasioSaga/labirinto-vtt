import type { DrawingTool, SelectionKind } from '../types/tools'

/**
 * Textos visíveis da interface do editor.
 *
 * ATENÇÃO: `TOOL_LABELS` e `deleteSelectionLabel` são lidos pelos testes e2e por
 * nome acessível / textContent exato (`getByRole('button', { name, exact: true })`
 * e `toHaveText('Apagar parede selecionada')`). Estilo, ícone e estrutura ao
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
  floor: 'Chão',
  concealZone: 'Zona oculta',
}

export interface SelectionNoun {
  noun: string
  gender: 'm' | 'f'
}

/**
 * Nome e gênero de cada tipo selecionável. `Record<SelectionKind, …>` (não
 * `Record<string, …>`): um tipo novo em `SelectionKind` sem entrada aqui é
 * erro de tsc — a escada ficou de fora e o botão dizia
 * "Apagar undefined selecionada(o)" (auditoria 14/09).
 */
export const SELECTION_LABELS: Record<SelectionKind, SelectionNoun> = {
  token: { noun: 'token', gender: 'm' },
  wall: { noun: 'parede', gender: 'f' },
  light: { noun: 'luz', gender: 'f' },
  region: { noun: 'região', gender: 'f' },
  stair: { noun: 'escada', gender: 'f' },
  prop: { noun: 'peça', gender: 'f' },
  drawing: { noun: 'desenho', gender: 'm' },
  floor: { noun: 'peça de chão', gender: 'f' },
}

/** "Apagar sala selecionada", "Apagar token selecionado". */
export function deleteSelectionLabel(kind: SelectionKind): string {
  const { noun, gender } = SELECTION_LABELS[kind]
  return `Apagar ${noun} ${gender === 'f' ? 'selecionada' : 'selecionado'}`
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
  // A sala nasce fechada e o jogador não entra sem porta (P10): a dica diz aqui
  // como abrir a entrada, em vez de só na ferramenta Porta já ativa.
  room: 'Clique e arraste para criar uma sala: uma região preenchida com paredes na borda. Para a entrada, use Porta (D) e clique na parede.',
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
  floor: 'Arraste para criar uma peça de chão (forma e Somar/Subtrair na setinha). Corredor: clique ponto a ponto, duplo clique ou Enter termina, Esc cancela.',
  concealZone: 'Arraste para marcar uma área que os jogadores não veem. Clique numa zona para editar o nome ou revelá-la.',
}

/**
 * Botão da barra que agrupa várias ferramentas (plano de 15/09/2026, fatia 2).
 * O nome acessível é fixo (`label`); o ícone e o `data-tip` mostram a forma
 * que o clique vai ativar.
 */
export interface ToolCluster {
  label: string
  tools: DrawingTool[]
}

export type ToolClusterId = 'drawing'

export const TOOL_CLUSTERS: Record<ToolClusterId, ToolCluster> = {
  // Ordem do usuário. Cada forma continua sendo uma ferramenta própria, com a
  // sua letra (P/L/U/C/O/R/A em lib/keymap.ts).
  drawing: { label: 'Desenho', tools: ['brush', 'line', 'curve', 'circle', 'ellipse', 'rect', 'polygon'] },
}

/** Uma posição da barra: uma ferramenta, ou um grupo (`cluster:<id>`). */
export type ToolbarSlot = DrawingTool | `cluster:${ToolClusterId}`

/**
 * Posições da barra agrupadas por intenção — a barra desenha um separador
 * entre grupos. `token` fica fora de propósito (FEATURES.tokenTool).
 */
export const TOOLBAR_SLOTS: ToolbarSlot[][] = [
  ['select'],
  // floor (chão por peças) fica junto das Salas: mesma camada 'salas'.
  // concealZone (A5) no fim do grupo: não desloca os botões que já existiam.
  ['wall', 'door', 'light', 'region', 'room', 'roomCircle', 'roomPolygon', 'floor', 'stair', 'prop', 'concealZone'],
  ['cluster:drawing', 'text', 'measure', 'eraser'],
]

/** Id do grupo quando a posição é um grupo, `null` quando é uma ferramenta. */
export function clusterIdOf(slot: ToolbarSlot): ToolClusterId | null {
  return slot === 'cluster:drawing' ? 'drawing' : null
}

/** Ferramentas de uma posição, na ordem: o grupo expande, a ferramenta vale por si. */
export function toolsOfSlot(slot: ToolbarSlot): DrawingTool[] {
  const clusterId = clusterIdOf(slot)
  return clusterId ? TOOL_CLUSTERS[clusterId].tools : [slot as DrawingTool]
}

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

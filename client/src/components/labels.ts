import type { DrawingTool, SelectionKind } from '../types/tools'
import type { BlockedMoveReason } from '../lib/moveValidation'

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
  roomFree: 'Sala livre',
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
  path: 'Caminho',
  concealZone: 'Zona oculta',
  revealBrush: 'Pincel de revelar',
  pin: 'Pino',
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
  // Mesma gramática de traçado da Região (é o mesmo rascunho ponto a ponto),
  // mais o que a Região não tem e é o motivo desta ferramenta existir: o
  // resultado é Sala, com parede em todo lado e porta possível.
  roomFree:
    'Clique canto a canto para desenhar uma sala com o formato que quiser. Duplo clique ou Enter fecha (mín. 3 cantos), Backspace/Ctrl+Z tira o último canto, Esc cancela. Nasce com parede em todos os lados — para a entrada, use Porta (D).',
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
  path: 'Escolha a cor DESTE caminho no painel e clique ponto a ponto. Duplo clique ou Enter termina; Backspace tira o último ponto; Esc cancela. Cada caminho guarda a cor dele.',
  floor: 'Arraste para criar uma peça de chão (forma e Somar/Subtrair na setinha). Corredor: clique ponto a ponto, duplo clique ou Enter termina, Esc cancela.',
  concealZone: 'Arraste para marcar uma área que os jogadores não veem. Clique numa zona para editar o nome ou revelá-la.',
  revealBrush:
    'Arraste sobre uma zona oculta para mostrar aos jogadores só o pedaço pintado. Segure Alt (ou escolha Esconder no painel) para esconder de volta.',
  pin: 'Clique no mapa para cravar um ponto de interesse. No painel, escolha o ícone (baú, armadilha, chave...), escreva a descrição e escolha a imagem que o jogador vê ao tocar nele.',
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
  // roomFree entra logo depois das outras Salas: é a quarta forma da MESMA
  // entidade, e ficar ao lado delas é o que faz o usuário achar a ferramenta
  // no lugar onde já procura por sala.
  // Caminho fica colado no Chão, e NÃO dentro do grupo Desenho: quem quer uma
  // trilha de terra procura onde mora o piso, não onde moram linha e polígono
  // — e, ao contrário das formas do grupo, cada caminho carrega a própria cor.
  // O Pincel de revelar mora colado na Zona oculta: só age dentro de uma, e é
  // ali que o mestre procura "como mostro só um pedaço".
  ['wall', 'door', 'light', 'region', 'room', 'roomCircle', 'roomPolygon', 'roomFree', 'floor', 'path', 'stair', 'prop', 'concealZone', 'revealBrush'],
  // Pino fica com Texto/Medir: os três são anotação por cima da planta, não construção.
  ['cluster:drawing', 'text', 'pin', 'measure', 'eraser'],
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
 * O que a tela diz quando o token do mestre NÃO passa (P10, "não consigo
 * entrar na casa"). Cada texto responde duas perguntas, nesta ordem: por que
 * parou, e o que fazer agora. A parede culpada é realçada junto pelo store
 * (`mapStore.moveTokenLive`), então nenhum texto precisa dizer "qual".
 *
 * PALAVRA PROIBIDA: nenhum destes textos diz "parede". O caminho que a
 * mensagem ensina é seguido lendo a tela — quem lê procura na mensagem o nome
 * de um botão visível —, e "Parede" é o nome do botão VIZINHO ao de "Porta" na
 * barra. Dizer "parede" aqui manda o mestre para a ferramenta de desenhar
 * parede, que é o oposto de abrir uma passagem. O nome citado é sempre o do
 * controle que resolve: `TOOL_LABELS.door`.
 */
export const BLOCKED_MOVE_TEXT: Record<BlockedMoveReason, string> = {
  wall:
    'Caminho bloqueado: não tem passagem por aqui. Para abrir a entrada, escolha a ferramenta Porta e clique em cima do trecho realçado.',
  // Só aparece quando abrir a porta NÃO resolveria (outra coisa também barra):
  // a porta que sozinha destranca o caminho abre no próprio arrasto.
  door_closed:
    'A porta do caminho está fechada e segurou o movimento. Ligue "Aberta" no painel, ou tire o que mais estiver barrando o vão.',
  door_locked:
    'A porta do caminho está trancada: com o cadeado ligado ninguém passa, nem o mestre. Desligue "Trancada" no painel para liberar.',
  // Porta secreta barra mesmo aberta (`collision.isDoorPassable`): mandar
  // ligar "Aberta" repetiria o aviso no próximo arrasto.
  door_secret:
    'A porta do caminho é secreta: enquanto ela estiver escondida, ninguém passa, nem com ela aberta. Clique em "Revelar passagem" no painel da porta para liberar.',
}

/**
 * Arrastar o token PARA DENTRO do vão de uma porta fechada e destrancada abre
 * a porta e deixa passar — o gesto é o de empurrar a porta. O aviso existe
 * porque isso muda o mapa (o jogador passa a enxergar pelo vão): mudança de
 * mapa que o mestre não pediu por botão tem de aparecer escrita, e dizer como
 * voltar atrás.
 */
export const DOOR_OPENED_BY_MOVE_TEXT = 'A porta estava fechada e abriu na passagem. Ctrl+Z desfaz.'

/**
 * "Abrir vão aqui" / "Desabar parede" na divisa com uma sala SECRETA: o lado de
 * cá abre, a parede da sala secreta fica (é ela que guarda o segredo dos
 * jogadores — `lib/abrirVao.ts`). O aviso diz por que não se passa e o que fazer.
 */
export const SALA_SECRETA_SEGURA_O_VAO_TEXT =
  'Do outro lado há uma sala secreta: a parede dela continua de pé para os jogadores não verem lá dentro. Revele a sala e abra o vão de novo.'

/**
 * Clique parado com a Escada armada (relato de 18/09/2026). A Escada precisa de
 * um lance — dois pontos —, mas as duas vizinhas de barra (Porta e Luz) nascem
 * com UM clique, então o gesto errado é o gesto óbvio. Até aqui o clique parado
 * não produzia nada: nem escada, nem contorno, nem mensagem; a pessoa repetia o
 * mesmo clique achando que não tinha "pegado".
 *
 * Não repete `TOOL_HINTS.stair` palavra por palavra de propósito, e o teste ao
 * lado prende isso: a dica da barra JÁ estava na tela quando a pessoa clicou, e
 * reexibi-la seria dizer de novo o que ela leu e não a ajudou. Este texto diz o
 * que a dica não diz — que o gesto FALHOU, e por quê.
 */
export const STAIR_CLICK_WITHOUT_DRAG_TEXT =
  'Não deu para criar a escada: um clique parado não tem lance. Segure o botão e arraste até onde a escada termina.'

/**
 * Pincel de revelar arrastado fora de qualquer zona oculta ativa: não revela
 * nada, e a tela diz por quê e onde está a saída (o nome citado é o do botão
 * que resolve, `TOOL_LABELS.concealZone`).
 */
export const AVISO_PINCEL_SEM_ZONA =
  'O Pincel de revelar só age dentro de uma zona oculta. Marque a área com a ferramenta Zona oculta e pinte por dentro dela.'

/**
 * Trocou de forma no menu do Chão com um Corredor de UM ponto só (achado 7 do
 * passeio de 20/09/2026). Um ponto não tem comprimento, então não há chão a
 * salvar — mas o rascunho estava na tela, e sumir sem dizer é o defeito. Com 2
 * pontos ou mais a troca FINALIZA o corredor e não precisa de aviso: o chão
 * fica à vista.
 */
export const CORRIDOR_DISCARDED_TEXT =
  'O traço do corredor foi descartado: com um ponto só ainda não havia chão. Escolha Corredor e clique pelo menos dois pontos.'

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

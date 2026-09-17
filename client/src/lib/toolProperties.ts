/**
 * Mapa PURO (sem React) ferramenta ativa + seleção → quais seções do painel
 * de propriedades (`PropertiesPanel.tsx`) são relevantes agora. Existe pra
 * resolver o bug real documentado em `docs/DOSSIE-FEEDBACK-F4.md`,
 * "inventario painel contextual": 6 seções (Grade, Medição, Alinhar grade,
 * Camadas, Cenário, Seleção) renderizam **sempre**, e `GridControls` +
 * `GridAlignControls` sozinhas somam ~15 controles antes de chegar em
 * "Medição" — por isso ela fica cortada embaixo. `PropertiesPanel.tsx`
 * (integrador) troca os `show*` booleanos espalhados hoje (linhas 108-121)
 * por uma chamada só a `relevantPropertyGroups`, checando cada seção com
 * `groups.has('...')` — ver CONTRATO no relatório do agente F4-N2.
 *
 * Cada `PropertyGroupId` espelha 1:1 uma seção existente de
 * `PropertiesPanel.tsx`, MAIS 3 grupos novos desta fase (pedido literal do
 * usuário — ver ROADMAP.md "Fase 4"): `lineCap` (ponta da linha, campo
 * `Drawing.cap` do agente F4-0), `fill` (tirar o fundo — cobre Region.filled,
 * também novo do F4-0, e o `Drawing.filled` que já existia mas não tinha UI
 * de EDIÇÃO pra forma já selecionada) e `stairSize` (tipo de escada P/M/G —
 * previsto aqui, UI real é de outro agente: `StairControls.tsx` não está no
 * meu escopo de arquivos nesta fase).
 */
import type { Drawing } from '../types/map'
import type { DrawingTool } from '../types/tools'

export type PropertyGroupId =
  | 'drawingStyle'
  | 'lineCap'
  | 'fill'
  | 'regionStyle'
  | 'polygonSides'
  | 'textLabel'
  | 'wallStyle'
  | 'wallDoor'
  | 'doorKind'
  | 'portal'
  | 'itemTransform'
  | 'tokenImage'
  | 'lightControls'
  | 'stairControls'
  | 'stairSize'
  | 'room'
  /** Camadas (e o acesso rápido da grade). Grade, Medição, Alinhar grade e
   *  Link de cenário deixaram de ser grupos do painel: são configuração do
   *  mapa inteiro e vão para a janela "Configurações do mapa". */
  | 'layers'
  | 'selection'
  /** Chão por peças: controles da peça selecionada (FloorPieceControls). */
  | 'floorPiece'
  /** Chão por peças: estilo do chão do mapa (FloorStyleControls). */
  | 'floorStyle'
  /** A5 — "Oculto para jogadores" de Região/Escada/Desenho selecionado
   *  (Token e Objeto têm o toggle dentro de `itemTransform`). */
  | 'playerVisibility'
  /** A5 — Nome, "Revelar para jogadores" e excluir da zona oculta aberta. */
  | 'concealZone'
  /** Tipo (! / ?), descrição e imagem do ponto de interesse. */
  | 'pin'

/** Todos os IDs, na mesma ordem do type acima — usado pelo teste pra
 *  conferir exaustão sem precisar listar os valores de novo lá. */
export const PROPERTY_GROUP_IDS: readonly PropertyGroupId[] = [
  'drawingStyle', 'lineCap', 'fill', 'regionStyle', 'polygonSides', 'textLabel',
  'wallStyle', 'wallDoor', 'doorKind', 'portal', 'itemTransform', 'tokenImage',
  'lightControls', 'stairControls', 'stairSize', 'room',
  'layers', 'selection',
  'floorPiece', 'floorStyle', 'playerVisibility', 'concealZone', 'pin',
]

/**
 * O que está selecionado agora, no grão que as condições de
 * `PropertiesPanel.tsx` (linhas 108-190) já usam — não precisa do objeto
 * inteiro (`Wall`/`Region`/...), só do "tem ou não" e do único detalhe que
 * cada seção mais checa. Todos os campos são opcionais e default pra "nada
 * selecionado" — chamar `relevantPropertyGroups(tool)` sem seleção é válido.
 */
export interface ToolPropertiesSelection {
  /** Espelha `selectedWall !== null`. */
  wall?: boolean
  /** Espelha `selectedWall?.door !== null` — só importa quando `wall` é true. */
  wallHasDoor?: boolean
  /** Espelha `selectedProp !== null`. */
  prop?: boolean
  /** Espelha `selectedToken !== null`. */
  token?: boolean
  /** Espelha `selectedTextLabel !== null` (rótulo de texto já colocado). */
  textLabel?: boolean
  /** Espelha `selectedRegion !== null`. */
  region?: boolean
  /** Espelha `selectedRegion?.room !== undefined` — só importa quando `region` é true. */
  regionIsRoom?: boolean
  /** Espelha `selectedLight !== null`. */
  light?: boolean
  /** Espelha `selectedStair !== null`. */
  stair?: boolean
  /**
   * `Drawing.kind` do desenho selecionado, quando NÃO é texto (texto já é
   * coberto por `textLabel` acima — evita contar a mesma seleção duas vezes).
   * Granularidade que nenhum boolean acima cobre: decide `lineCap`
   * (freehand/line/curve) vs `fill` (circle/rect/ellipse/polygon).
   * `null`/`undefined` = nenhum desenho não-texto selecionado.
   */
  drawingKind?: Exclude<Drawing['kind'], 'text'> | null
  /** Espelha `selectedFloorPiece !== null` (peça de chão selecionada). */
  floorPiece?: boolean
  /** A5 — zona oculta aberta no painel (`selectedConcealZoneId` existente no mapa). */
  concealZone?: boolean
  /** Ponto de interesse aberto no painel (`selectedPinId` existente no mapa). */
  pin?: boolean
}

/**
 * Ferramenta de desenho → `Drawing.kind` que ela produz, quando o desenho é
 * texto, `undefined` (tratado à parte). Espelha `DRAWING_TOOLS` de
 * `components/labels.ts` — não importado de lá de propósito: `lib/` não
 * depende de `components/` em nenhum outro arquivo do projeto (mesma direção
 * de dependência do resto da árvore). `toolProperties.test.ts` confere que as
 * duas listas continuam batendo, pra esta duplicação não apodrecer.
 */
const DRAWING_TOOL_KIND: Partial<Record<DrawingTool, Exclude<Drawing['kind'], 'text'>>> = {
  brush: 'freehand',
  line: 'line',
  circle: 'circle',
  curve: 'curve',
  rect: 'rect',
  ellipse: 'ellipse',
  polygon: 'polygon',
}

/** Ferramentas que mostram `DrawingStyleControls` (cor/espessura/preench./
 *  fonte do PRÓXIMO desenho) — mesmo conjunto de `DRAWING_TOOLS`. */
const DRAWING_STYLE_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'brush', 'line', 'circle', 'ellipse', 'rect', 'polygon', 'curve',
])

/** `Drawing.kind` com traço visível — os 3 que ganharam `cap` no F4-0. */
const CAP_KINDS: ReadonlySet<Exclude<Drawing['kind'], 'text'>> = new Set(['freehand', 'line', 'curve'])

/** `Drawing.kind` preenchível — os 4 com `filled`/`fillAlpha` no schema. */
const FILL_KINDS: ReadonlySet<Exclude<Drawing['kind'], 'text'>> = new Set(['circle', 'rect', 'ellipse', 'polygon'])

const EMPTY_SELECTION: ToolPropertiesSelection = {}

/**
 * Ferramentas cuja PRÓPRIA seção de propriedade já imprime, letra por letra, o
 * nome que o botão delas tem na barra: `wall` → `WallStyleControls` ("Parede"),
 * `region` → `RegionStyleControls` ("Região"). Nessas duas o painel já se
 * apresenta sozinho — repetir o nome viraria dois títulos idênticos colados.
 *
 * O resto da barra NÃO tem essa sorte: `room`/`roomCircle`/`roomPolygon`
 * reaproveitam a mesma `RegionStyleControls`, então com Sala ativa o primeiro
 * título do painel é "REGIÃO", que é o nome de OUTRA ferramenta da barra — o
 * usuário lê e acha que apertou o botão errado (passeio cego, jornada
 * `task-jornada-painel-com-nome-certo.spec.ts`). Escada/Peça/Luz são piores
 * ainda: abrem em "SELEÇÃO DE ÁREA", que não fala da ferramenta nenhuma.
 */
const TOOLS_NAMED_BY_THEIR_OWN_SECTION: ReadonlySet<DrawingTool> = new Set<DrawingTool>(['wall', 'region'])

/**
 * Qual ferramenta o painel precisa NOMEAR no próprio topo, antes de qualquer
 * seção — `null` quando não precisa de nenhum título extra. Puro: só decide
 * QUEM é nomeado; o texto visível sai de `TOOL_LABELS`
 * (`components/labels.ts`, a mesma fonte do rótulo do botão da barra — é o
 * chamador quem traduz, porque `lib/` não depende de `components/`).
 *
 * Duas exceções, as duas por "o painel já diz isso":
 * - `hasSelection` — com algo selecionado o painel é do ITEM selecionado
 *   (Sala/Token/Parede… já abrem com o nome do item no topo), não da
 *   ferramenta que por acaso está armada.
 * - `select` e as de `TOOLS_NAMED_BY_THEIR_OWN_SECTION` — Selecionar não cria
 *   nada (o painel ali é do mapa), e Parede/Região já são o título da própria
 *   seção.
 */
export function panelHeadingTool(activeTool: DrawingTool, hasSelection: boolean): DrawingTool | null {
  if (hasSelection) return null
  if (activeTool === 'select') return null
  if (TOOLS_NAMED_BY_THEIR_OWN_SECTION.has(activeTool)) return null
  return activeTool
}

/**
 * Decide quais seções aparecem para `activeTool` + o que está selecionado.
 * Pura: mesma entrada sempre devolve o mesmo `Set`, sem ler DOM/store/React.
 *
 * Camadas (e Chão) aparecem só num "momento de mapa" — ferramenta Selecionar
 * ativa OU já existe alguma seleção — nunca enquanto uma ferramenta de
 * DESENHO está ativa sem nada selecionado, que é quando empurravam as seções
 * da ferramenta pra fora da tela (DOSSIE-FEEDBACK-F4.md). Grade, Medição,
 * Alinhar grade e Link de cenário não são mais grupos daqui: são
 * configuração do mapa e saem do painel. `selection` (SelectionControls) fica de fora dessa
 * regra: tem o botão "Adicionar token", que não depende de haver seleção —
 * escondê-la removeria a única forma de adicionar token pelo painel.
 */
export function relevantPropertyGroups(
  activeTool: DrawingTool,
  selection: ToolPropertiesSelection = EMPTY_SELECTION,
): Set<PropertyGroupId> {
  const {
    wall = false,
    wallHasDoor = false,
    prop = false,
    token = false,
    textLabel = false,
    region = false,
    regionIsRoom = false,
    light = false,
    stair = false,
    drawingKind = null,
    floorPiece = false,
    concealZone = false,
    pin = false,
  } = selection

  const groups = new Set<PropertyGroupId>()
  const toolDrawingKind = DRAWING_TOOL_KIND[activeTool] ?? null

  // Estilo de desenho: cor/espessura/preenchimento/fonte do PRÓXIMO desenho
  // (ferramenta de desenho ou Texto sem rótulo selecionado) OU cor/espessura
  // de um desenho não-texto JÁ SELECIONADO — auditoria 14/09: retângulo,
  // linha e pincel desenhados não tinham Cor nem Espessura no painel. Quem
  // renderiza (App.tsx) escolhe a fonte: desenho selecionado primeiro.
  if (DRAWING_STYLE_TOOLS.has(activeTool) || (activeTool === 'text' && !textLabel) || drawingKind !== null) {
    groups.add('drawingStyle')
  }

  // Ponta da linha — NOVO (F4-N2, campo `Drawing.cap` do F4-0). Dual, mesmo
  // padrão de RegionStyleControls: ferramenta que PRODUZ freehand/line/curve
  // (preferência do próximo desenho) OU um desses três JÁ SELECIONADO
  // (editar o existente) — o componente `LineCapControls` não decide a
  // fonte, o chamador escolhe qual das duas ligar.
  if (
    (toolDrawingKind !== null && CAP_KINDS.has(toolDrawingKind)) ||
    (drawingKind !== null && CAP_KINDS.has(drawingKind))
  ) {
    groups.add('lineCap')
  }

  // Região/Sala: cor + hachurado (RegionStyleControls, já existe) — mesma
  // condição de `showRegionStyle`, PropertiesPanel.tsx:110-115.
  const showRegionGroup =
    activeTool === 'region' ||
    activeTool === 'room' ||
    activeTool === 'roomCircle' ||
    activeTool === 'roomPolygon' ||
    activeTool === 'roomFree' ||
    region
  if (showRegionGroup) groups.add('regionStyle')

  // Tirar o fundo — NOVO (F4-N2). Dois casos, doc no relatório do F4-0:
  // (a) Região/Sala — schema `Region.filled` é novo, NÃO tinha UI nenhuma,
  //     nem pra próxima região nem pra selecionada: mesma condição de
  //     `showRegionGroup` acima, o componente `FillControls` fica ao lado de
  //     `RegionStyleControls`.
  // (b) forma preenchível (rect/ellipse/circle/polygon) JÁ SELECIONADA —
  //     `Drawing.filled`/`fillAlpha` já existem e já tinham UI pra a PRÓXIMA
  //     forma (`DrawingStyleControls`, inalterado), mas nenhuma pra editar
  //     uma forma já desenhada: as actions `setDrawingFilled`/
  //     `setDrawingFillAlpha` existem na store e não são usadas em nenhum
  //     componente (`rg` confirmou) — é exatamente a "lição 2" do prompt
  //     desta fase. Por isso aqui NÃO entra `toolDrawingKind` (ferramenta
  //     rect/ellipse/circle/polygon ativa): esse caso já é 100% coberto por
  //     `DrawingStyleControls`, duplicar aqui geraria dois toggles
  //     "Preenchido" ao mesmo tempo.
  if (showRegionGroup || (drawingKind !== null && FILL_KINDS.has(drawingKind))) {
    groups.add('fill')
  }

  // PolygonSidesControls — mesma condição de PropertiesPanel.tsx:140.
  if (activeTool === 'roomPolygon') groups.add('polygonSides')

  // TextLabelControls — mesma condição de PropertiesPanel.tsx:141.
  if (textLabel) groups.add('textLabel')

  // Parede/Porta — mesmas condições de `showWallStyle`/`showDoorKind`,
  // PropertiesPanel.tsx:116-121.
  if (activeTool === 'wall' || wall) groups.add('wallStyle')
  if (wall) groups.add('wallDoor')
  if (activeTool === 'door' || (wall && wallHasDoor)) groups.add('doorKind')

  // Objeto (Prop) / Token — mesmas condições de PropertiesPanel.tsx:158-177.
  if (prop) {
    groups.add('portal')
    groups.add('itemTransform')
  }
  if (token) {
    groups.add('tokenImage')
    groups.add('itemTransform')
  }

  if (light) groups.add('lightControls')

  // Escada — `stairControls` é a seção de hoje (direção); `stairSize` é NOVA
  // (P/M/G, pedido do usuário) e sempre acompanha a mesma condição — quem
  // implementar a UI de tamanho (fora do meu escopo de arquivos) só precisa
  // renderizar dentro deste grupo, a visibilidade já está correta aqui.
  if (stair) {
    groups.add('stairControls')
    groups.add('stairSize')
  }

  // RoomControls (nome/dimensões da Sala) — mesma condição de
  // PropertiesPanel.tsx:180.
  if (region && regionIsRoom) groups.add('room')

  if (floorPiece) groups.add('floorPiece')

  // A5 — texto conta como desenho: também pode ser "Oculto para jogadores".
  // O pino entra pelo mesmo motivo: o recorte já sabe escondê-lo do jogador,
  // e sem esta linha o toggle não teria onde aparecer.
  if (region || stair || textLabel || drawingKind !== null || pin) groups.add('playerVisibility')
  if (concealZone) groups.add('concealZone')
  // Pino: com a ferramenta na mão aparece só o tipo do PRÓXIMO pino; com um
  // pino aberto no painel, o tipo dele mais descrição e imagem.
  if (activeTool === 'pin' || pin) groups.add('pin')

  const hasAnySelection =
    wall || prop || token || textLabel || region || light || stair || drawingKind !== null || floorPiece
  const isMapWideMoment = activeTool === 'select' || hasAnySelection

  // Estilo do chão é configuração do MAPA (como Grade): aparece no momento
  // de mapa e também com a ferramenta Chão ativa, que é quem mais precisa dele.
  if (isMapWideMoment || activeTool === 'floor') groups.add('floorStyle')

  if (isMapWideMoment) groups.add('layers')

  // Sempre — ver docstring da função ("Adicionar token" independe de seleção).
  groups.add('selection')

  return groups
}

import type { DrawingTool } from '../types/tools'

/**
 * FRENTE A (ONDA 1, item #1 do PLANO-REFINAMENTO.md) — política de cursor.
 *
 * Problema medido: `el.style.cursor` em `pixi/PixiCanvas.tsx:645-647` só
 * conhece 2 estados (`'crosshair'` pra Borracha, `'default'` pro resto) —
 * as outras 20 ferramentas e os 33 valores de `mode` (a state machine de
 * gesto local ao `useEffect`, `PixiCanvas.tsx:384-420`) nunca tocam o
 * cursor. Cursor parado é o único feedback que existe a 60fps sem clique
 * nenhum; congelado, é a definição visual de "travado" (ver diagnóstico
 * textual no cabeçalho do plano).
 *
 * Este módulo é PURO por regra de arquitetura da onda (nenhuma frente edita
 * `PixiCanvas.tsx` — cada uma entrega `(estado) → decisão`, o integrador
 * pluga com uma chamada de 1 linha). `resolveCursor` não lê `PixiJS`, DOM,
 * nem a store — só a assinatura abaixo.
 *
 * ## `GestureMode` é uma cópia deliberada, não um import
 *
 * O `mode` de `PixiCanvas.tsx` é um `let` local à closure do `useEffect`,
 * nunca exportado — e nem poderia: é o próprio estado proibido de tocar.
 * `GestureMode` abaixo replica os 33 literais de `PixiCanvas.tsx:385-420`
 * byte a byte. Isso é uma FEATURE, não uma duplicação acidental: como os
 * dois tipos são literais de string, o TypeScript compara estruturalmente —
 * se algum dia `PixiCanvas.tsx` ganhar um `mode` novo sem essa cópia ser
 * atualizada, o `mode` local passa a ter um literal que `GestureMode` não
 * cobre, e `tsc --noEmit` recusa a chamada `resolveCursor({ mode, ... })`
 * no ponto de integração — o mesmo truque de "parâmetro obrigatório força o
 * compilador a listar os call sites" que `applySnap` já usa nesse arquivo
 * (comentário em `PixiCanvas.tsx:521-525`). Se `PixiCanvas.tsx` mudar esse
 * union, sincronize aqui — o erro do `tsc` vai apontar exatamente onde.
 */
export type GestureMode =
  | 'idle'
  | 'panning'
  | 'dragging-token'
  | 'dragging-prop'
  | 'drawing-wall'
  | 'drawing-freehand'
  | 'drawing-line'
  | 'drawing-circle'
  | 'drawing-rect'
  | 'drawing-ellipse'
  | 'drawing-polygon'
  | 'drawing-light'
  | 'drawing-curve'
  | 'dragging-curve-point'
  | 'dragging-curve-body'
  | 'dragging-light-radius'
  | 'erasing'
  | 'drawing-room'
  | 'drawing-polygon-room'
  | 'drawing-stair'
  | 'resizing-room-corner'
  | 'dragging-wall-point'
  | 'dragging-region-point'
  | 'dragging-wall-body'
  | 'dragging-region-body'
  | 'dragging-stair-body'
  | 'dragging-line-point'
  | 'dragging-line-body'
  | 'resizing-drawing-corner'
  // Onda 3, item 18 (Frente B) — alça de raio do Drawing 'circle'. PixiCanvas
  // ganhou este `mode` novo; sincronizado aqui (ver docstring do tipo acima).
  | 'resizing-drawing-radius'
  | 'resizing-token'
  | 'resizing-prop-corner'
  | 'area-marquee-drag'
  | 'dragging-area-selection'
  // Chão por peças: arrasto de criação (retângulo/elipse/polígono) e mover
  // o corpo de uma peça selecionada.
  | 'drawing-floor'
  | 'dragging-floor-body'
  // Pincel de blocos: arrasto que pinta ou apaga célula da grade.
  | 'painting-floor-blocks'
  // A4 — arrastar só o nome da Sala.
  | 'dragging-room-label'
  // A5 — arrasto de criação da Zona oculta.
  | 'drawing-conceal-zone'

/**
 * O que está sob o ponteiro em `mode === 'idle'`, achado por um hit-test
 * leve que o integrador roda no `pointermove` ocioso (reaproveitando
 * `findSelectableAt`/`findBoxCornerAt`/`findRoomCornerAt`/
 * `findLightRadiusHandleAt`/`findCurveControlPointAt`, todos já importados
 * em `PixiCanvas.tsx`). Este módulo não faz hit-test — só decide o cursor a
 * partir do resultado.
 *
 * `'resize-corner'` / `'vertex'` / `'radius'` / `'area-selection'` só fazem
 * sentido quando `activeTool === 'select'`, porque só ali `PixiCanvas.tsx`
 * liga as alças (todo o bloco `PixiCanvas.tsx:826-1032` é gated em
 * `activeTool === 'select'`). `resolveCursor` não valida essa precondição —
 * é o integrador quem só deve produzir esses valores nesse contexto, mesmo
 * padrão de confiança que o resto do arquivo já usa entre os `if`s da
 * cadeia de `pointerdown`.
 */
export type HoverKind = 'none' | 'selectable' | 'resize-corner' | 'vertex' | 'radius' | 'area-selection'

/**
 * Índice de canto de alça de resize — MESMA convenção de `Corner`
 * (`lib/objectTransform.ts:27`) e `RoomCorner` (`lib/roomOps.ts:12`):
 * 0 topo-esquerda, 1 topo-direita, 2 baixo-direita, 3 baixo-esquerda.
 * Tipo próprio (não importado) pelo mesmo motivo de `GestureMode`: manter
 * este módulo sem dependência de arquivo de produção além de `types/tools`
 * — os 3 tipos são `0 | 1 | 2 | 3`, estruturalmente idênticos, então um
 * `resizingCorner`/`resizingDrawingCorner`/`resizingPropCorner` já existente
 * no integrador encaixa aqui sem cast nenhum.
 */
export type ResizeCorner = 0 | 1 | 2 | 3

export interface ResolveCursorInput {
  mode: GestureMode
  activeTool: DrawingTool
  /** Ignorado fora de `mode === 'idle'`. */
  hoverKind: HoverKind
  /**
   * Canto sendo redimensionado — usado em 2 situações: (a) `mode` é um dos
   * 4 modos `resizing-*`, onde é o canto que o gesto já travou no
   * `pointerdown`; (b) `mode === 'idle'` com `hoverKind === 'resize-corner'`,
   * onde é o canto que o hit-test de hover acabou de achar. Nas outras
   * combinações é ignorado — passe `null`.
   */
  corner: ResizeCorner | null
  /**
   * Espaço pressionado (item #8 do plano, "pan universal") — maior
   * prioridade que qualquer ferramenta/hover quando `mode === 'idle'`,
   * porque Espaço+arrastar funciona em QUALQUER ferramenta. Uma vez que o
   * arrasto começa, `mode` já virou `'panning'` e este campo deixa de
   * importar (mas continue passando o valor real; não force `false`).
   */
  spaceHeld: boolean
}

const CURSOR_DEFAULT = 'default'
const CURSOR_CROSSHAIR = 'crosshair'
const CURSOR_POINTER = 'pointer'
const CURSOR_MOVE = 'move'
const CURSOR_GRAB = 'grab'
const CURSOR_GRABBING = 'grabbing'
/**
 * Cursor próprio da Borracha (plano, linha do item #1: "um cursor proprio
 * se fizer sentido"). `crosshair` já é o cursor de TODA ferramenta de
 * criação (mira de precisão pra desenhar); usar o mesmo pra apagar
 * confundiria "vou criar" com "vou destruir" — o único sinal que os
 * distingue hoje seria a barra de ferramentas, fora do campo de visão
 * enquanto o mouse está sobre o canvas. `'cell'` (o retângulo cortado que
 * os spreadsheets usam pra "célula alvo de uma ação") é o cursor CSS
 * padrão mais próximo de "isto aqui é o alvo de uma operação destrutiva"
 * sem cair em `not-allowed` (que sinaliza "proibido", o oposto do que a
 * Borracha faz).
 */
const CURSOR_ERASE = 'cell'
const CURSOR_NWSE = 'nwse-resize'
const CURSOR_NESW = 'nesw-resize'

/**
 * As 18 ferramentas de CRIAÇÃO (colocam algo novo no mapa a partir de um
 * clique/arrasto) — `activeTool` ocioso nelas é `crosshair`, mira de
 * precisão. Todo o resto de `DrawingTool` (21 valores, `types/tools.ts`)
 * se resolve nos outros 2 ramos de `resolveIdleCursor`: `'eraser'`
 * (constante própria, ver `CURSOR_ERASE`) e `'select'`/`'token'` (ramo
 * "hover-driven" abaixo). `cursorPolicy.test.ts` prova que os 21 valores
 * de `DrawingTool` caem em exatamente um desses 3 grupos.
 */
const CREATION_TOOLS = new Set<DrawingTool>([
  'wall',
  'door',
  'light',
  'region',
  'room',
  'roomCircle',
  'roomPolygon',
  'stair',
  'prop',
  'brush',
  'line',
  'circle',
  'ellipse',
  'rect',
  'polygon',
  'curve',
  'text',
  'measure',
  'floor',
  'concealZone',
])

function resizeCursorForCorner(corner: ResizeCorner | null): string {
  // `corner === null` só acontece se o integrador chamar um modo de resize
  // sem rastrear o canto — não deveria acontecer com o wiring do CONTRATO,
  // mas a função é pura e não lança por estado incompleto (regra de não
  // travar o app por um cursor errado); cai no mais comum das 2 diagonais.
  if (corner === null) return CURSOR_NWSE
  // 0 (topo-esquerda) e 2 (baixo-direita) são a MESMA diagonal NW↔SE;
  // 1 (topo-direita) e 3 (baixo-esquerda) são a diagonal NE↔SW — convenção
  // de `Corner`/`RoomCorner` documentada no docstring de `ResizeCorner` acima.
  return corner === 0 || corner === 2 ? CURSOR_NWSE : CURSOR_NESW
}

function resolveIdleCursor(activeTool: DrawingTool, hoverKind: HoverKind, corner: ResizeCorner | null, spaceHeld: boolean): string {
  if (spaceHeld) return CURSOR_GRAB
  if (activeTool === 'eraser') return CURSOR_ERASE
  if (CREATION_TOOLS.has(activeTool)) return CURSOR_CROSSHAIR

  // A sobra de DrawingTool é exatamente 'select' e 'token'. 'token' NÃO tem
  // branch própria no `if (activeTool === ...)` de `pointerdown`
  // (`PixiCanvas.tsx:656-824`) — cai direto no hit-test genérico de
  // seleção/pan do fim da cadeia (`PixiCanvas.tsx:1034`, incondicional),
  // que SELECIONA e arrasta corpo de item normalmente. Por isso herda a
  // MESMA tabela de cursor de 'select' aqui; a diferença entre as duas
  // ferramentas (alças de resize/vértice/raio só existem sob 'select',
  // `PixiCanvas.tsx:826-1032`) é responsabilidade do hit-test que o
  // integrador roda pra produzir `hoverKind` — sob 'token' ele nunca deve
  // produzir 'resize-corner'/'vertex'/'radius'/'area-selection', só
  // 'selectable' ou 'none'. Ver docstring de `HoverKind`.
  switch (hoverKind) {
    case 'resize-corner':
      return resizeCursorForCorner(corner)
    case 'vertex':
    case 'radius':
    case 'selectable':
    case 'area-selection':
      return CURSOR_POINTER
    case 'none':
      return CURSOR_DEFAULT
    default:
      return assertNeverHoverKind(hoverKind)
  }
}

function assertNeverMode(value: never): never {
  throw new Error(`cursorPolicy: GestureMode sem cursor definido: ${JSON.stringify(value)}`)
}

function assertNeverHoverKind(value: never): never {
  throw new Error(`cursorPolicy: HoverKind sem cursor definido: ${JSON.stringify(value)}`)
}

/**
 * Decide o valor de `el.style.cursor` (CSS puro: `'default' | 'crosshair' |
 * 'pointer' | 'move' | 'grab' | 'grabbing' | 'cell' | 'nwse-resize' |
 * 'nesw-resize'`) a partir do estado do gesto. Função total: todo
 * `GestureMode` e todo `HoverKind` tem um `case` explícito no `switch`
 * (o `default` de cada um força `never`, então remover um `case` sem
 * atualizar os dois quebra `tsc --noEmit`, não só o teste em runtime).
 *
 * Tabela por `mode` (prioridade sobre `activeTool`/`hoverKind`, que só
 * importam quando `mode === 'idle'`):
 *  - `panning` → `grabbing` (câmera sendo arrastada)
 *  - `drawing-*` (12 modos) e `area-marquee-drag` → `crosshair` (mesmo
 *    cursor do início do gesto, mantém consistência do começo ao fim)
 *  - `erasing` → `cell`
 *  - `dragging-token`/`dragging-prop`/`dragging-*-body`/
 *    `dragging-area-selection` (8 modos) → `move` (corpo inteiro em
 *    movimento livre)
 *  - `dragging-*-point`/`dragging-light-radius` (5 modos) → `grabbing`
 *    (mão fechada: você está segurando um PONTO específico, não o objeto
 *    inteiro — distingue de `move` acima)
 *  - `resizing-*` (4 modos) → `nwse-resize`/`nesw-resize` conforme `corner`
 *  - `idle` → `resolveIdleCursor` (ver tabela no docstring de cada tipo)
 */
export function resolveCursor(input: ResolveCursorInput): string {
  const { mode, activeTool, hoverKind, corner, spaceHeld } = input

  switch (mode) {
    case 'idle':
      return resolveIdleCursor(activeTool, hoverKind, corner, spaceHeld)

    case 'panning':
      return CURSOR_GRABBING

    case 'drawing-wall':
    case 'drawing-freehand':
    case 'drawing-line':
    case 'drawing-circle':
    case 'drawing-rect':
    case 'drawing-ellipse':
    case 'drawing-polygon':
    case 'drawing-light':
    case 'drawing-curve':
    case 'drawing-room':
    case 'drawing-polygon-room':
    case 'drawing-stair':
    case 'drawing-floor':
    // O pincel é gesto de criação como qualquer outro: a mira não muda do
    // começo ao fim do traço (nem quando ele apaga — o que apaga é o botão,
    // e trocar o cursor no meio do arrasto seria dizer que a ferramenta mudou).
    case 'painting-floor-blocks':
    case 'drawing-conceal-zone':
    case 'area-marquee-drag':
      return CURSOR_CROSSHAIR

    case 'erasing':
      return CURSOR_ERASE

    case 'dragging-token':
    case 'dragging-prop':
    case 'dragging-wall-body':
    case 'dragging-region-body':
    case 'dragging-stair-body':
    case 'dragging-curve-body':
    case 'dragging-line-body':
    case 'dragging-floor-body':
    case 'dragging-area-selection':
    case 'dragging-room-label':
      return CURSOR_MOVE

    case 'dragging-wall-point':
    case 'dragging-region-point':
    case 'dragging-curve-point':
    case 'dragging-line-point':
    case 'dragging-light-radius':
    // Onda 3, item 18 — mesma leitura de `dragging-light-radius`: mão
    // fechada segurando a alça de raio, não o objeto inteiro (`move`).
    case 'resizing-drawing-radius':
      return CURSOR_GRABBING

    case 'resizing-room-corner':
    case 'resizing-drawing-corner':
    case 'resizing-token':
    case 'resizing-prop-corner':
      return resizeCursorForCorner(corner)

    default:
      return assertNeverMode(mode)
  }
}

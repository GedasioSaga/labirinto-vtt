import type { DrawingTool } from '../types/tools'
import type { DoorKind, FreehandTexture, Region, Wall } from '../types/map'
import type { StairSizePreset } from './stairs'

/**
 * Catálogo de dados puro (sem JSX, sem store) da feature N1 do usuário
 * ("setinha do lado de cada ferramenta abrindo variantes" — ROADMAP.md,
 * Fase 4). Mesmo padrão de `lib/mapTypes.ts`: testável sem
 * `@testing-library/react` (não instalado neste projeto).
 *
 * Princípio que governou este arquivo: NÃO inventar variante. Cada entrada
 * `available: true` já tem schema + ação de store existentes hoje — só
 * faltava a superfície de UI perto do botão da barra (ver CONTRATO no
 * relatório do agente). Cada entrada `available: false` documenta, com
 * arquivo:linha, o que faltaria construir — para nunca entregar um item de
 * menu que não faz nada (lição registrada 3× no ROADMAP.md, dívida D5).
 *
 * Fonte das decisões: `docs/DOSSIE-FEEDBACK-F4.md`, seção "inventario
 * variantes de ferramenta".
 *
 * Fase 5: dos 4 exemplos que o usuário deu por nome (Pincel, Borracha, Linha,
 * Escada — ROADMAP.md, tabela N1), 3 saíram de `available:false` pra `true`
 * (brush/eraser/stair) — schema/render/store entraram nesta fase. `line`
 * continua `false`: a capacidade de converter reta⇄curva já existe (painel
 * esquerdo, `LineShapeControls.tsx`), só falta a SETINHA — que exigiria
 * fundir os botões "Linha"/"Curva" em `TOOL_GROUPS` (components/labels.ts),
 * arquivo de integrador/fundação fora do escopo desta fase.
 */

/** Uma opção dentro de um grupo de variantes. `value` é o literal que a ação
 *  de store espera (ex. `DoorKind`); `id` é só chave estável de UI/teste —
 *  os dois coincidem em texto para as variantes atuais, mas são campos
 *  distintos de propósito: `id` nunca muda mesmo que o rótulo mude. */
export interface ToolVariantOption<V> {
  id: string
  label: string
  /** O que a variante muda, em uma frase — texto de apoio (ex. tooltip/
   *  descrição), nunca o rótulo do botão. */
  description: string
  value: V
}

/**
 * Um eixo de variante dentro de uma ferramenta (uma ferramenta pode ter mais
 * de um — `roomPolygon` tem `regionFillPattern` E `polygonSides`). `storeKey`
 * é o nome do par valor/ação em `mapStore.ts` que esta variante edita — é
 * também o discriminante que `ToolVariantMenu` usa para resolver o binding
 * certo sem `as` (o tipo de `options` já amarra o tipo de `value` esperado
 * por cada `storeKey`).
 */
export type ToolVariantGroup =
  | { storeKey: 'doorKind'; label: string; options: ToolVariantOption<DoorKind>[] }
  | { storeKey: 'wallKind'; label: string; options: ToolVariantOption<NonNullable<Wall['wallKind']>>[] }
  | { storeKey: 'regionFillPattern'; label: string; options: ToolVariantOption<Region['fillPattern']>[] }
  | { storeKey: 'polygonSides'; label: string; options: ToolVariantOption<number>[] }
  | { storeKey: 'stairSizePreset'; label: string; options: ToolVariantOption<StairSizePreset>[] }
  | { storeKey: 'drawTexture'; label: string; options: ToolVariantOption<FreehandTexture>[] }
  | { storeKey: 'eraseMode'; label: string; options: ToolVariantOption<'objeto' | 'parte'>[] }

/** Ferramenta com variante PRONTA — schema e ação de store já existem. */
export interface ToolVariantReady {
  available: true
  tool: DrawingTool
  groups: ToolVariantGroup[]
}

/** Ferramenta que o usuário pediu variante para, mas nada existe ainda no
 *  schema/store — documenta o pedido e o que falta, sem fingir pronto. */
export interface ToolVariantUnavailable {
  available: false
  tool: DrawingTool
  /** O que o usuário pediu, com as palavras dele (ROADMAP.md, tabela N1). */
  requested: string
  /** O que faltaria construir — schema, ação de store, render, ou wiring de
   *  arquivo fora do escopo deste agente — com arquivo:linha de evidência. */
  missing: string
}

export type ToolVariantEntry = ToolVariantReady | ToolVariantUnavailable

/**
 * Comprimento do vão por `DoorKind`, espelhado de
 * `stores/mapStore.ts:266` (`DOOR_LENGTH_BY_KIND`) só para a descrição da
 * opção — não importado de lá de propósito: `mapStore.ts` é arquivo de
 * integrador/fundação (fora do meu escopo de escrita), e um valor de texto
 * de apoio não vale o acoplamento de importar de um módulo que só existe
 * para expor ações de store, não constantes de catálogo.
 */
const DOOR_LENGTH_BY_KIND: Record<DoorKind, number> = { normal: 32, double: 64, gate: 96 }

const DOOR_KIND_GROUP: ToolVariantGroup = {
  storeKey: 'doorKind',
  label: 'Tipo de porta',
  options: [
    { id: 'normal', label: 'Normal', value: 'normal', description: `Uma folha, vão de ${DOOR_LENGTH_BY_KIND.normal}px.` },
    { id: 'double', label: 'Dupla', value: 'double', description: `Duas folhas, vão de ${DOOR_LENGTH_BY_KIND.double}px.` },
    { id: 'gate', label: 'Portão', value: 'gate', description: `Grade sem dobradiça, vão de ${DOOR_LENGTH_BY_KIND.gate}px.` },
  ],
}

const WALL_KIND_GROUP: ToolVariantGroup = {
  storeKey: 'wallKind',
  label: 'Tipo de parede',
  options: [
    { id: 'exterior', label: 'Externa', value: 'exterior', description: 'Traço grosso e claro — aparência padrão.' },
    { id: 'interior', label: 'Interna', value: 'interior', description: 'Traço mais fino, cor diferente.' },
  ],
}

const REGION_FILL_PATTERN_GROUP: ToolVariantGroup = {
  storeKey: 'regionFillPattern',
  label: 'Preenchimento',
  options: [
    { id: 'solid', label: 'Sólido', value: 'solid', description: 'Preenchimento uniforme — aparência padrão.' },
    { id: 'hatch', label: 'Hachurado', value: 'hatch', description: 'Preenchimento em linhas diagonais.' },
  ],
}

/**
 * Presets curados do slider já existente (`PolygonSidesControls.tsx`, 3–12
 * lados) — a setinha dá acesso rápido aos formatos mais comuns; o slider
 * completo continua no painel esquerdo para qualquer valor entre eles.
 */
const POLYGON_SIDES_GROUP: ToolVariantGroup = {
  storeKey: 'polygonSides',
  label: 'Lados do polígono',
  options: [
    { id: 'sides-3', label: 'Triângulo', value: 3, description: '3 lados.' },
    { id: 'sides-4', label: 'Quadrado', value: 4, description: '4 lados.' },
    { id: 'sides-5', label: 'Pentágono', value: 5, description: '5 lados.' },
    { id: 'sides-6', label: 'Hexágono', value: 6, description: '6 lados — padrão.' },
    { id: 'sides-8', label: 'Octógono', value: 8, description: '8 lados.' },
    { id: 'sides-10', label: 'Decágono', value: 10, description: '10 lados.' },
    { id: 'sides-12', label: 'Dodecágono', value: 12, description: '12 lados — máximo.' },
  ],
}

/**
 * Presets nomeados (P/M/G) do campo `stepWidth` já existente em `Stair`,
 * como múltiplo de `map.grid` — critério em `lib/stairs.ts`
 * (`STAIR_SIZE_PRESET_RATIO`). 'medium' bate exatamente com o default de
 * criação de hoje (`stepWidth === map.grid`), por isso escolher "Média" na
 * setinha não muda a aparência de uma escada recém-criada.
 */
const STAIR_SIZE_GROUP: ToolVariantGroup = {
  storeKey: 'stairSizePreset',
  label: 'Tamanho',
  options: [
    { id: 'small', label: 'Pequena', value: 'small', description: 'Metade de uma célula de grade — passagem justa.' },
    { id: 'medium', label: 'Média', value: 'medium', description: 'Uma célula de grade — mesmo tamanho de hoje.' },
    { id: 'large', label: 'Grande', value: 'large', description: 'Duas células de grade — cabem 2 tokens lado a lado.' },
  ],
}

/** As 3 texturas de traço livre viáveis sem shader/dependência nova — ver
 *  `lib/brushTexture.ts`. 'pen' é o traço sólido de hoje. */
const BRUSH_TEXTURE_GROUP: ToolVariantGroup = {
  storeKey: 'drawTexture',
  label: 'Textura do traço',
  options: [
    { id: 'pen', label: 'Caneta', value: 'pen', description: 'Traço sólido e uniforme — aparência padrão.' },
    { id: 'pencil', label: 'Lápis', value: 'pencil', description: 'Traço irregular e mais claro, textura de grafite.' },
    { id: 'marker', label: 'Marcador', value: 'marker', description: 'Traço grosso e translúcido, com sobreposição visível.' },
  ],
}

/** Modo de gesto da Borracha — 'objeto' é o comportamento de hoje (remove a
 *  entidade inteira sob o cursor); 'parte' recorta freehand/curve/line e
 *  decide remove/mantém pros kinds sem recorte possível (ver
 *  `lib/eraseGeometry.ts`, usado por `eraseAt` em `PixiCanvas.tsx`). */
const ERASE_MODE_GROUP: ToolVariantGroup = {
  storeKey: 'eraseMode',
  label: 'Modo',
  options: [
    { id: 'objeto', label: 'Objeto inteiro', value: 'objeto', description: 'Apaga a entidade inteira sob o cursor — comportamento padrão.' },
    { id: 'parte', label: 'Só uma parte', value: 'parte', description: 'Recorta o trecho tocado de um traço; formas fechadas somem só se o círculo tocar.' },
  ],
}

export const TOOL_VARIANTS: Partial<Record<DrawingTool, ToolVariantEntry>> = {
  // ---- confirmadas prontas (DOSSIE-FEEDBACK-F4.md, tabela "Variantes já
  // existentes no schema/código") ----------------------------------------
  wall: { available: true, tool: 'wall', groups: [WALL_KIND_GROUP] },
  door: { available: true, tool: 'door', groups: [DOOR_KIND_GROUP] },
  // region/room/roomCircle/roomPolygon: as 4 ferramentas criam uma Region e
  // leem a MESMA preferência `regionFillPattern` na hora de desenhar —
  // confirmado em pixi/PixiCanvas.tsx:1032,1050,1666 (buildRoomFromDraft/
  // buildRegularPolygonRoomFromDraft/buildRegionFromPoints, todas recebem
  // `regionFillPattern` do store).
  region: { available: true, tool: 'region', groups: [REGION_FILL_PATTERN_GROUP] },
  room: { available: true, tool: 'room', groups: [REGION_FILL_PATTERN_GROUP] },
  roomCircle: { available: true, tool: 'roomCircle', groups: [REGION_FILL_PATTERN_GROUP] },
  // roomPolygon tem DOIS eixos independentes: preenchimento (igual às outras
  // 3 Salas) E número de lados (só ela lê `polygonSides` —
  // PropertiesPanel.tsx: `activeTool === 'roomPolygon'`).
  roomPolygon: { available: true, tool: 'roomPolygon', groups: [REGION_FILL_PATTERN_GROUP, POLYGON_SIDES_GROUP] },

  // ---- Fase 5: as 3 variantes abaixo saíram de available:false pra true —
  // schema/render já existiam (F4-0/agentes de feature), só faltava a
  // preferência de store + o grupo neste catálogo. Ver ROADMAP.md Fase 5. ---
  brush: { available: true, tool: 'brush', groups: [BRUSH_TEXTURE_GROUP] },
  eraser: { available: true, tool: 'eraser', groups: [ERASE_MODE_GROUP] },
  stair: { available: true, tool: 'stair', groups: [STAIR_SIZE_GROUP] },

  // ---- pedida pelo usuário, capacidade agora existe mas SEM setinha ------
  line: {
    available: false,
    tool: 'line',
    requested: 'Linha reta ou linha que se curva',
    missing:
      'A conversão em si agora existe NOS DOIS SENTIDOS: convertLineToCurve e convertCurveToLine ' +
      '(lib/drawingFactory.ts), ligadas em mapStore.ts (convertDrawingToCurve/convertDrawingToLine, com ' +
      'histórico) e alcançáveis pelo usuário via LineShapeControls.tsx no painel esquerdo — aparece na seção ' +
      '"Formato da linha" com uma line ou curve selecionada. O que continua faltando é só a SETINHA da barra: ' +
      '"line" e "curve" são hoje duas ferramentas SEPARADAS em TOOL_GROUPS (components/labels.ts:81), não uma ' +
      'variante de uma ferramenta só — fundir os dois botões num com submenu exigiria editar TOOL_GROUPS/' +
      'labels.ts, arquivo de integrador/fundação fora do escopo desta fase (a mesma lista de "não tocar" que ' +
      'existe pra evitar colisão de escrita concorrente entre fases), e continua sendo decisão de produto em ' +
      'aberto (DOSSIE-FEEDBACK-F4.md, seção "bug2 linha reta ou curva", "Qual o usuário quis dizer"). Não ' +
      'confundir com B2 (ponta arredondada vs reta do TRAÇO, "cap") — B2 já está disponível via LineCapControls ' +
      'no painel, sem relação com esta entrada.',
  },
}

/** Só as entradas com variante pronta — o que `ToolVariantMenu`/`Toolbar`
 *  usam para decidir se desenham a setinha. */
export function readyToolVariants(): ToolVariantReady[] {
  return Object.values(TOOL_VARIANTS).filter((entry): entry is ToolVariantReady => entry.available)
}

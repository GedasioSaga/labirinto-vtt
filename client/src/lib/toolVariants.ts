import type { DrawingTool } from '../types/tools'
import type { DoorKind, FloorPiece, FreehandTexture, Region, Wall } from '../types/map'
import type { StairSizePreset } from './stairs'
import type { FloorShapeKind } from './floorTool'
import { TAMANHOS_DE_PINCEL, type TamanhoDePincel } from './floorBlocks'
import { TOOL_SHORTCUTS } from './keymap'

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
 * continua `false`: não tem eixo próprio para a próxima linha. Desde 15/09 a
 * escolha Linha/Curva mora no grupo Forma do botão Desenho
 * (`DRAWING_SHAPE_GROUP`, abaixo).
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
  | { storeKey: 'floorShapeKind'; label: string; options: ToolVariantOption<FloorShapeKind>[] }
  | { storeKey: 'floorOp'; label: string; options: ToolVariantOption<FloorPiece['op']>[] }
  | { storeKey: 'floorPolygonSides'; label: string; options: ToolVariantOption<number>[] }
  | { storeKey: 'floorBrushSize'; label: string; options: ToolVariantOption<TamanhoDePincel>[] }
  /** Forma do botão "Desenho": escolher ATIVA a ferramenta (não é preferência da próxima entidade). */
  | { storeKey: 'drawShape'; label: string; options: ToolVariantOption<DrawingTool>[] }

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
// Opções soltas numa const para o chão reusar os mesmos presets num eixo próprio
// (`floorPolygonSides`) sem compartilhar a preferência da Sala.
const POLYGON_SIDES_OPTIONS: ToolVariantOption<number>[] = [
  { id: 'sides-3', label: 'Triângulo', value: 3, description: '3 lados.' },
  { id: 'sides-4', label: 'Quadrado', value: 4, description: '4 lados.' },
  { id: 'sides-5', label: 'Pentágono', value: 5, description: '5 lados.' },
  { id: 'sides-6', label: 'Hexágono', value: 6, description: '6 lados — padrão.' },
  { id: 'sides-8', label: 'Octógono', value: 8, description: '8 lados.' },
  { id: 'sides-10', label: 'Decágono', value: 10, description: '10 lados.' },
  { id: 'sides-12', label: 'Dodecágono', value: 12, description: '12 lados — máximo.' },
]

const POLYGON_SIDES_GROUP: ToolVariantGroup = {
  storeKey: 'polygonSides',
  label: 'Lados do polígono',
  options: POLYGON_SIDES_OPTIONS,
}

/**
 * Chão por peças: o que a ferramenta tem na mão. As 4 primeiras são as formas
 * geométricas de sempre; as 2 últimas são os gestos presos à grade pedidos em
 * 15/09/2026 — o pincel, que pinta célula inteira e apaga com o botão direito,
 * e o balde, que enche uma área fechada de uma vez.
 */
const FLOOR_SHAPE_GROUP: ToolVariantGroup = {
  storeKey: 'floorShapeKind',
  label: 'Forma',
  options: [
    { id: 'rect', label: 'Retângulo', value: 'rect', description: 'Arraste de um canto ao outro. Shift faz quadrado.' },
    { id: 'ellipse', label: 'Elipse', value: 'ellipse', description: 'Arraste do centro para fora. Shift faz círculo.' },
    { id: 'polygon', label: 'Polígono regular', value: 'polygon', description: 'Arraste do centro até um vértice.' },
    { id: 'corridor', label: 'Corredor', value: 'corridor', description: 'Clique ponto a ponto; duplo clique ou Enter termina.' },
    {
      id: 'blocos',
      label: 'Pincel de blocos',
      value: 'blocos',
      description: 'Arraste para pintar chão preso à grade; o botão DIREITO apaga no mesmo traço.',
    },
    { id: 'balde', label: 'Balde', value: 'balde', description: 'Clique dentro de uma área fechada para enchê-la de uma vez.' },
  ],
}

/**
 * Lado do pincel de blocos. Fica sempre no menu, como `floorPolygonSides` já
 * fica: esconder um eixo quando a forma muda tira do lugar o que a pessoa
 * acabou de achar ali.
 */
const FLOOR_BRUSH_SIZE_GROUP: ToolVariantGroup = {
  storeKey: 'floorBrushSize',
  label: 'Tamanho do pincel',
  options: TAMANHOS_DE_PINCEL.map((tamanho) => ({
    id: `pincel-${tamanho}`,
    label: tamanho === 1 ? '1 bloco' : `${tamanho} blocos`,
    value: tamanho,
    description: tamanho === 1 ? 'Uma célula por vez.' : `Quadrado de ${tamanho}×${tamanho} células.`,
  })),
}

const FLOOR_OP_GROUP: ToolVariantGroup = {
  storeKey: 'floorOp',
  label: 'Operação',
  options: [
    { id: 'add', label: 'Somar', value: 'add', description: 'A peça acrescenta chão.' },
    { id: 'subtract', label: 'Subtrair', value: 'subtract', description: 'A peça abre um buraco no chão desenhado antes dela.' },
  ],
}

const FLOOR_POLYGON_SIDES_GROUP: ToolVariantGroup = {
  storeKey: 'floorPolygonSides',
  label: 'Lados do polígono',
  options: POLYGON_SIDES_OPTIONS,
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

  // Chão por peças: schema/motor/store já existiam (floorSdf/floorContour/
  // add*FloorPiece*); a setinha é o caminho até forma e operação.
  floor: {
    available: true,
    tool: 'floor',
    groups: [FLOOR_SHAPE_GROUP, FLOOR_BRUSH_SIZE_GROUP, FLOOR_OP_GROUP, FLOOR_POLYGON_SIDES_GROUP],
  },

  // ---- pedida pelo usuário, capacidade existe mas SEM eixo próprio ------
  line: {
    available: false,
    tool: 'line',
    requested: 'Linha reta ou linha que se curva',
    missing:
      'Linha e Curva agora ficam no mesmo botão "Desenho" da barra (TOOL_CLUSTERS.drawing em ' +
      'components/labels.ts): a setinha dele escolhe entre as duas no grupo Forma. A conversão de um desenho JÁ ' +
      'criado existe nos dois sentidos (convertLineToCurve/convertCurveToLine em lib/drawingFactory.ts, ligadas ' +
      'em mapStore.ts) e fica no painel esquerdo, seção "Formato da linha" (LineShapeControls.tsx). O que não ' +
      'existe é um eixo de variante só da Linha para a PRÓXIMA linha, então com a Linha como forma o menu ' +
      'mostra só o grupo Forma. Não confundir com B2 (ponta arredondada vs reta do traço, "cap"), que está no ' +
      'painel via LineCapControls.',
  },
}

/**
 * Grupo "Forma" do botão Desenho: as 7 formas na ordem de
 * `TOOL_CLUSTERS.drawing` (components/labels.ts). Rótulo igual a
 * `TOOL_LABELS` (labels.test.ts prova); a descrição é a dica curta e a letra.
 */
const SHAPE_HINTS: ReadonlyArray<[DrawingTool, string, string]> = [
  ['brush', 'Pincel', 'Traço livre'],
  ['line', 'Linha', 'Reta entre dois pontos'],
  ['curve', 'Curva', 'Curva suave'],
  ['circle', 'Círculo', 'Do centro para fora'],
  ['ellipse', 'Elipse', 'Oval do centro para fora'],
  ['rect', 'Retângulo', 'De canto a canto'],
  ['polygon', 'Polígono', 'Vértice a vértice'],
]

export const DRAWING_SHAPE_GROUP: Extract<ToolVariantGroup, { storeKey: 'drawShape' }> = {
  storeKey: 'drawShape',
  label: 'Forma',
  options: SHAPE_HINTS.map(([tool, label, hint]) => ({
    id: tool,
    label,
    value: tool,
    description: `${hint} (${TOOL_SHORTCUTS[tool]})`,
  })),
}

/** Grupos do menu do botão Desenho: Forma e, abaixo, as variantes prontas da forma corrente. */
export function drawingClusterGroups(shape: DrawingTool): ToolVariantGroup[] {
  const entry = TOOL_VARIANTS[shape]
  return entry && entry.available ? [DRAWING_SHAPE_GROUP, ...entry.groups] : [DRAWING_SHAPE_GROUP]
}

/** Só as entradas com variante pronta — o que `ToolVariantMenu`/`Toolbar`
 *  usam para decidir se desenham a setinha. */
export function readyToolVariants(): ToolVariantReady[] {
  return Object.values(TOOL_VARIANTS).filter((entry): entry is ToolVariantReady => entry.available)
}

/* ------------------------------------------------- eco da escolha na barra */

/** Eixo de variante, pelo nome do par valor/ação em `mapStore.ts`. */
export type ToolVariantStoreKey = ToolVariantGroup['storeKey']

/**
 * Sujeito da frase que a barra mostra depois de uma escolha na setinha
 * ("PRÓXIMA PAREDE" + "Interna"). Escrito eixo a eixo, e não derivado de
 * `TOOL_LABELS`, por duas razões concretas:
 *
 *  - gênero: "Próxima Parede" e "Próximo Chão" não saem da mesma fórmula, e o
 *    app já paga esse preço em `SELECTION_LABELS` (components/labels.ts);
 *  - `regionFillPattern` é UM valor compartilhado por Região, Sala, Sala
 *    Circular e Polígono Regular (ver TOOL_VARIANTS acima), então nenhum nome
 *    de ferramenta seria verdade para os quatro — o sujeito aqui é o que a
 *    preferência realmente controla, o preenchimento.
 *
 * `drawShape` fica de FORA de propósito: escolher uma forma ATIVA a ferramenta
 * (contrato documentado em `components/ToolVariantMenu.tsx`), e a troca de
 * ferramenta já deixa rastro sozinha — ícone, `aria-pressed` e dica mudam. Um
 * eco ali seria uma segunda voz dizendo o que a barra inteira já diz.
 */
const VARIANT_ECHO_SUBJECT: Partial<Record<ToolVariantStoreKey, string>> = {
  doorKind: 'Próxima porta',
  wallKind: 'Próxima parede',
  regionFillPattern: 'Próximo preenchimento',
  polygonSides: 'Próximo polígono',
  stairSizePreset: 'Próxima escada',
  drawTexture: 'Próximo traço',
  // Não é "próxima" coisa nenhuma: é o modo com que a ferramenta apaga.
  eraseMode: 'Borracha',
  floorShapeKind: 'Próxima peça de chão',
  floorOp: 'Próxima peça de chão',
  floorPolygonSides: 'Próxima peça de chão',
  // Não é a "próxima peça": é o tamanho com que o pincel pinta, agora.
  floorBrushSize: 'Pincel de blocos',
}

/** Todos os grupos por eixo — a barra precisa achar o RÓTULO da opção a partir
 *  do valor cru que está na store, sem depender de quem abriu o menu. */
const GROUP_BY_STORE_KEY: Record<ToolVariantStoreKey, ToolVariantGroup> = {
  doorKind: DOOR_KIND_GROUP,
  wallKind: WALL_KIND_GROUP,
  regionFillPattern: REGION_FILL_PATTERN_GROUP,
  polygonSides: POLYGON_SIDES_GROUP,
  stairSizePreset: STAIR_SIZE_GROUP,
  drawTexture: BRUSH_TEXTURE_GROUP,
  eraseMode: ERASE_MODE_GROUP,
  floorShapeKind: FLOOR_SHAPE_GROUP,
  floorOp: FLOOR_OP_GROUP,
  floorPolygonSides: FLOOR_POLYGON_SIDES_GROUP,
  floorBrushSize: FLOOR_BRUSH_SIZE_GROUP,
  drawShape: DRAWING_SHAPE_GROUP,
}

/** Existe frase para este eixo? — `false` só para `drawShape` (ver acima). */
export function hasVariantEcho(storeKey: ToolVariantStoreKey): boolean {
  return VARIANT_ECHO_SUBJECT[storeKey] !== undefined
}

export interface VariantEcho {
  /** "Próxima parede" — o que a escolha vai afetar. */
  subject: string
  /** "Interna" — o MESMO rótulo que o usuário clicou no menu (H6: ele
   *  reconhece em vez de lembrar). */
  value: string
}

/**
 * O que a barra diz sobre um eixo, a partir do VALOR CORRENTE dele — nunca de
 * uma cópia guardada na hora do clique. A diferença importa: as mesmas
 * preferências são editáveis pelo painel esquerdo (PropertiesPanel), e uma
 * frase congelada no momento do clique viraria mentira no primeiro ajuste feito
 * por fora. Lendo o valor de agora, a frase ou está certa ou some.
 *
 * `null` quando o eixo não tem frase (`drawShape`) ou quando o valor não bate
 * com opção nenhuma do catálogo — caso real: `polygonSides` aceita 3 a 12 pelo
 * slider do painel e o menu só oferece 7 presets. Preferir o silêncio a
 * inventar rótulo para 9 lados.
 */
export function variantEcho(storeKey: ToolVariantStoreKey, value: unknown): VariantEcho | null {
  const subject = VARIANT_ECHO_SUBJECT[storeKey]
  if (!subject) return null
  const options: ToolVariantOption<unknown>[] = GROUP_BY_STORE_KEY[storeKey].options
  const option = options.find((candidate) => candidate.value === value)
  return option ? { subject, value: option.label } : null
}

/**
 * A ferramenta ativa tem este eixo no menu dela? A barra usa isto para decidir
 * se o eco sobrevive a uma troca de ferramenta: escolher "Interna" e depois
 * ativar a Parede mantém a frase (ela ficou MAIS relevante), enquanto ir para a
 * Luz a apaga — ali a barra volta a falar só da ferramenta ativa.
 */
export function toolHasVariantAxis(tool: DrawingTool, storeKey: ToolVariantStoreKey): boolean {
  const entry = TOOL_VARIANTS[tool]
  return entry !== undefined && entry.available && entry.groups.some((group) => group.storeKey === storeKey)
}

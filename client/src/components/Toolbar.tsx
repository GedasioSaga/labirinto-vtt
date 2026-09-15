import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import type { DrawingTool } from '../types/tools'
import { theme } from '../theme'
import { TOOLBAR_SLOTS, TOOL_CLUSTERS, TOOL_HINTS, TOOL_LABELS, clusterIdOf, type ToolbarSlot } from './labels'
import { TOOL_SHORTCUTS } from '../lib/keymap'
import { placeHint, type HintPlacement } from './hintPlacement'
import { TOOL_VARIANTS, drawingClusterGroups, type ToolVariantGroup } from '../lib/toolVariants'
import { ToolVariantMenu, type ToolVariantBindings } from './ToolVariantMenu'
import {
  BrushIcon,
  CircleIcon,
  ConcealZoneIcon,
  CurveIcon,
  CursorIcon,
  DoorIcon,
  EllipseIcon,
  EraserIcon,
  FloorIcon,
  LightIcon,
  LineIcon,
  MeasureIcon,
  PolygonIcon,
  PropIcon,
  RectIcon,
  RegionIcon,
  RegularPolygonIcon,
  RoomCircleIcon,
  RoomIcon,
  StairIcon,
  TextIcon,
  TokenIcon,
  WallIcon,
} from './icons'

interface ToolbarProps {
  activeTool: DrawingTool
  onSelectTool: (tool: DrawingTool) => void
  /** Última forma de desenho ativada (mapStore) — o botão Desenho mostra e reativa esta quando nenhuma forma está ativa. */
  lastDrawingTool: DrawingTool
  /**
   * Valor/ação por eixo de variante (doorKind/wallKind/regionFillPattern/
   * polygonSides/drawShape...) — a setinha de cada ferramenta com entrada
   * `available: true` em `TOOL_VARIANTS` (lib/toolVariants.ts), e a do botão
   * Desenho, lê e escreve daqui. Mesmas preferências de sessão que
   * `PropertiesPanel` já edita no painel esquerdo (App.tsx) — a setinha é só
   * um segundo caminho de UI até o MESMO estado, não um estado novo.
   */
  variantBindings: ToolVariantBindings
}

// Partial, não Record<DrawingTool, ...>: assim uma futura extensão de
// DrawingTool não força entrada aqui antes do ícone existir.
const TOOL_ICONS: Partial<Record<DrawingTool, ComponentType<{ size?: number }>>> = {
  select: CursorIcon,
  wall: WallIcon,
  door: DoorIcon,
  light: LightIcon,
  region: RegionIcon,
  room: RoomIcon,
  roomCircle: RoomCircleIcon,
  roomPolygon: RegularPolygonIcon,
  floor: FloorIcon,
  stair: StairIcon,
  token: TokenIcon,
  prop: PropIcon,
  brush: BrushIcon,
  line: LineIcon,
  circle: CircleIcon,
  ellipse: EllipseIcon,
  rect: RectIcon,
  polygon: PolygonIcon,
  curve: CurveIcon,
  text: TextIcon,
  measure: MeasureIcon,
  eraser: EraserIcon,
  concealZone: ConcealZoneIcon,
}

/** Tamanho do ícone dentro de uma opção do grupo Forma. */
const MENU_ICON_SIZE = 16

function menuIconFor(tool: DrawingTool): ReactNode {
  const Icon = TOOL_ICONS[tool]
  return Icon ? <Icon size={MENU_ICON_SIZE} /> : null
}

/**
 * Setinha de variantes — canto do botão principal. Ícone LOCAL de propósito:
 * `components/icons.tsx` é arquivo de integrador/fundação (fora do escopo de
 * escrita desta tarefa), então não recebe entrada nova. Mesma convenção de
 * contorno das demais famílias de ícone do app: viewBox 24, sem fill,
 * strokeWidth 1.6.
 */
function ChevronDownIcon() {
  return (
    <svg
      width={9}
      height={9}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 9l7 7 7-7" />
    </svg>
  )
}

const EDGE_GAP = parseFloat(theme.layout.edgeGap)
/** Primeiro x livre à direita do painel lateral. */
const HINT_MIN_LEFT = parseFloat(theme.layout.railWidth) + EDGE_GAP * 2

/** O que uma posição da barra desenha: nome, ícone, dica, ação e menu. */
interface SlotView {
  label: string
  Icon: ComponentType<{ size?: number }>
  pressed: boolean
  tip: string
  target: DrawingTool
  /** Grupos do popover da setinha; `null` = sem setinha. */
  groups: ToolVariantGroup[] | null
  iconFor?: (tool: DrawingTool) => ReactNode
}

function slotView(slot: ToolbarSlot, activeTool: DrawingTool, lastDrawingTool: DrawingTool): SlotView | null {
  const clusterId = clusterIdOf(slot)
  if (clusterId) {
    const cluster = TOOL_CLUSTERS[clusterId]
    const pressed = cluster.tools.includes(activeTool)
    // O ícone diz o que o clique fará (D5): a forma ativa, ou a última usada.
    const shape = pressed ? activeTool : lastDrawingTool
    const Icon = TOOL_ICONS[shape]
    if (!Icon) return null
    return {
      label: cluster.label,
      Icon,
      pressed,
      tip: `${cluster.label}: ${TOOL_LABELS[shape]} (${TOOL_SHORTCUTS[shape]})`,
      target: shape,
      groups: drawingClusterGroups(shape),
      iconFor: menuIconFor,
    }
  }
  const tool = slot as DrawingTool
  const Icon = TOOL_ICONS[tool]
  const label = TOOL_LABELS[tool]
  // TOOLBAR_SLOTS só lista ferramentas com ícone e rótulo — se faltar, é bug
  // de wiring ao adicionar a ferramenta, não caso de runtime a tratar.
  if (!Icon || !label) return null
  const variantEntry = TOOL_VARIANTS[tool]
  return {
    label,
    Icon,
    pressed: activeTool === tool,
    tip: `${label} (${TOOL_SHORTCUTS[tool]})`,
    target: tool,
    groups: variantEntry && variantEntry.available ? variantEntry.groups : null,
  }
}

/**
 * Barra de ferramentas flutuante e a dica contextual ancorada na ferramenta
 * ativa.
 *
 * Os botões são só de ícone: o nome acessível — e o tooltip de hover — vêm de
 * `TOOL_LABELS` (ou do rótulo do grupo), que os testes e2e leem com
 * `exact: true`. Nada de texto dentro do `<button>`, para o nome acessível
 * continuar sendo exatamente o rótulo.
 *
 * A dica não fica centralizada sob a barra inteira: ela nasce sob o ícone que a
 * disparou, com uma seta apontando para ele. A posição precisa ser medida
 * porque depende da largura do texto e de onde a janela deixa o balão caber —
 * `placeHint` faz a conta, este componente só fornece as medidas.
 *
 * A barra quebra em mais de uma linha quando não cabe na largura central. A
 * unidade de quebra é o GRUPO de `TOOLBAR_SLOTS`, não o botão: cada grupo vira
 * um `.lb-toolbar__group` com `flex-wrap: nowrap` interno, e é a barra
 * (`.lb-toolbar`, `flex-wrap: wrap`) que distribui grupos inteiros entre
 * linhas, sem separador órfão na borda de uma linha.
 *
 * Botão Desenho (plano de 15/09/2026, fatia 2): as 7 formas (Pincel a
 * Polígono) dividem UM botão. O nome acessível é fixo em "Desenho" (D6); o
 * ícone e o `data-tip` mostram a forma ativa ou a última usada, e o clique no
 * corpo reativa essa forma (D5). As formas continuam alcançáveis pela UI em
 * dois cliques — setinha "Opções de Desenho" e o rádio da forma, que é o
 * caminho do helper `e2e/helpers/tools.ts` (`pickTool`) — e em uma tecla
 * (P/L/U/C/O/R/A, D4).
 *
 * Setinha de variantes (Fase 4, N1): cada ferramenta com `available: true` em
 * `TOOL_VARIANTS` ganha uma SEGUNDA `<button>`, irmã da principal (nunca
 * aninhada — dois `<button>` um dentro do outro é HTML inválido), com nome
 * acessível próprio (`Opções de <nome>`) que abre um popover
 * (`ToolVariantMenu`). O clique no CORPO do botão principal só chama
 * `onSelectTool`, e a setinha só existe para quem tem opção pronta.
 */
export function Toolbar({ activeTool, onSelectTool, lastDrawingTool, variantBindings }: ToolbarProps) {
  /**
   * Passo 3, F1: a dica some depois do primeiro uso da ferramenta no canvas e
   * volta ao trocar de ferramenta. Estado só de UI, nunca vai para o mapa.
   * O reset na troca é feito durante o render (padrão "estado derivado da
   * prop"), porque a ferramenta também muda por atalho de teclado, fora do Toolbar.
   */
  const [hintDismissed, setHintDismissed] = useState(false)
  const [hintTool, setHintTool] = useState(activeTool)
  if (hintTool !== activeTool) {
    setHintTool(activeTool)
    setHintDismissed(false)
  }
  const hint = hintDismissed ? undefined : TOOL_HINTS[activeTool]
  const dockRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLParagraphElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)
  const [placement, setPlacement] = useState<HintPlacement | null>(null)

  /**
   * Posição da barra cuja setinha está aberta agora (no máximo uma, mesmo
   * padrão de "um dropdown por vez" de qualquer barra de ferramentas). `null`
   * = nenhuma aberta.
   */
  const [openVariantSlot, setOpenVariantSlot] = useState<ToolbarSlot | null>(null)
  /** Um `<div>` âncora por posição (guarda o botão + a setinha) — usado só
   *  pra decidir "o clique foi dentro do popover aberto ou fora dele" no
   *  listener de pointerdown abaixo. */
  const variantAnchorRefs = useRef<Map<ToolbarSlot, HTMLDivElement>>(new Map())
  /** Um botão de setinha por posição — usado só pra devolver o foco a ela
   *  quando o popover fecha (Escape, clique fora, ou opção escolhida). */
  const variantArrowRefs = useRef<Map<ToolbarSlot, HTMLButtonElement>>(new Map())

  const closeVariantMenu = () => {
    const slot = openVariantSlot
    setOpenVariantSlot(null)
    if (slot) variantArrowRefs.current.get(slot)?.focus()
  }

  // Fecha ao clicar fora do popover aberto. `pointerdown` (não `click`) pra
  // fechar ANTES do clique seguinte poder acertar outro alvo por baixo do
  // popover — mesma ordem de eventos que um <select> nativo usa.
  useEffect(() => {
    if (!openVariantSlot) return
    const handlePointerDown = (event: PointerEvent) => {
      const anchor = variantAnchorRefs.current.get(openVariantSlot)
      if (anchor && event.target instanceof Node && anchor.contains(event.target)) return
      setOpenVariantSlot(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openVariantSlot])

  // Primeiro pointerdown de botão principal num <canvas> (o do Pixi) = ferramenta usada.
  // Captura, para o Pixi não conseguir engolir o evento antes; botão do meio é pan, não uso.
  useEffect(() => {
    if (hintDismissed) return
    const handleCanvasPointerDown = (event: PointerEvent) => {
      if (event.button === 0 && event.target instanceof HTMLCanvasElement) setHintDismissed(true)
    }
    document.addEventListener('pointerdown', handleCanvasPointerDown, true)
    return () => document.removeEventListener('pointerdown', handleCanvasPointerDown, true)
  }, [hintDismissed])

  useLayoutEffect(() => {
    if (!hint) {
      setPlacement(null)
      return
    }

    const measure = () => {
      const dock = dockRef.current
      const balloon = hintRef.current
      const button = activeButtonRef.current
      if (!dock || !balloon || !button) return

      const buttonBox = button.getBoundingClientRect()
      setPlacement(
        placeHint({
          anchorCenter: buttonBox.left + buttonBox.width / 2,
          originLeft: dock.getBoundingClientRect().left,
          hintWidth: balloon.offsetWidth,
          viewportWidth: window.innerWidth,
          minLeft: HINT_MIN_LEFT,
          edgeGap: EDGE_GAP,
        }),
      )
    }

    // Em `useLayoutEffect` a medida entra antes do paint, então o balão nunca
    // aparece na posição provisória.
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeTool, hint])

  const hintStyle: CSSProperties = placement
    ? ({ left: placement.left, '--lb-hint-arrow': `${placement.arrow}px` } as CSSProperties)
    : // Ainda sem medida: some, mas continua ocupando layout para poder ser medido.
      { visibility: 'hidden' }

  return (
    <div className="lb-toolbar-dock" ref={dockRef}>
      <div className="lb-panel lb-toolbar" role="toolbar" aria-label="Ferramentas do mapa">
        {TOOLBAR_SLOTS.map((group, index) => (
          // Grupo inteiro é a unidade de quebra de linha — ver comentário do
          // componente. O separador mora dentro do grupo que ele abre, então
          // os dois sempre migram juntos para a linha seguinte.
          <div className="lb-toolbar__group" key={group[0]}>
            {index > 0 && <span className="lb-toolbar__sep" aria-hidden="true" />}
            {group.map((slot) => {
              const view = slotView(slot, activeTool, lastDrawingTool)
              if (!view) return null
              const { Icon } = view
              const menuOpen = openVariantSlot === slot
              return (
                // Âncora do par botão+setinha. A setinha é um `<button>` IRMÃO
                // do principal (nunca aninhado), então o clique no corpo do
                // botão principal só chama `onSelectTool`, nunca abre o popover.
                <div
                  key={slot}
                  className="lb-toolvariant-anchor"
                  ref={(node) => {
                    if (node) variantAnchorRefs.current.set(slot, node)
                    else variantAnchorRefs.current.delete(slot)
                  }}
                >
                  <button
                    // A dica da ferramenta ativa ancora no botão que está
                    // pressionado — no grupo Desenho, o próprio botão do grupo.
                    ref={view.pressed ? activeButtonRef : undefined}
                    type="button"
                    className="lb-iconbtn lb-tip"
                    aria-label={view.label}
                    aria-pressed={view.pressed}
                    // Onda 1, item 6 do plano — atalho invisível é atalho
                    // inexistente. `aria-label` fica intocado; só o balão de
                    // dica ganha a letra.
                    data-tip={view.tip}
                    onClick={() => onSelectTool(view.target)}
                  >
                    <Icon />
                  </button>
                  {view.groups && (
                    <button
                      ref={(node) => {
                        if (node) variantArrowRefs.current.set(slot, node)
                        else variantArrowRefs.current.delete(slot)
                      }}
                      type="button"
                      className="lb-toolvariant-arrow"
                      aria-label={`Opções de ${view.label}`}
                      aria-haspopup="true"
                      aria-expanded={menuOpen}
                      onClick={(event) => {
                        // Defensivo: os dois botões são irmãos, mas não custa
                        // garantir que o clique não chegue ao principal.
                        event.stopPropagation()
                        setOpenVariantSlot((current) => (current === slot ? null : slot))
                      }}
                    >
                      <ChevronDownIcon />
                    </button>
                  )}
                  {view.groups && menuOpen && (
                    <ToolVariantMenu
                      title={view.label}
                      groups={view.groups}
                      bindings={variantBindings}
                      iconFor={view.iconFor}
                      onClose={closeVariantMenu}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {hint && (
        <p className="lb-hint" role="status" ref={hintRef} style={hintStyle}>
          {hint}
        </p>
      )}
    </div>
  )
}

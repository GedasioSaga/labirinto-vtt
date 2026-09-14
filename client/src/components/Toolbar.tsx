import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { DrawingTool } from '../types/tools'
import { theme } from '../theme'
import { TOOL_GROUPS, TOOL_HINTS, TOOL_LABELS } from './labels'
import { TOOL_SHORTCUTS } from '../lib/keymap'
import { placeHint, type HintPlacement } from './hintPlacement'
import { TOOL_VARIANTS, type ToolVariantReady } from '../lib/toolVariants'
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
  /**
   * Valor/ação por eixo de variante (doorKind/wallKind/regionFillPattern/
   * polygonSides) — a setinha de cada ferramenta com entrada `available: true`
   * em `TOOL_VARIANTS` (lib/toolVariants.ts) lê e escreve daqui. Mesmas
   * preferências de sessão que `PropertiesPanel` já edita no painel esquerdo
   * (App.tsx) — a setinha é só um segundo caminho de UI até o MESMO estado,
   * não um estado novo. Ver CONTRATO do agente N1 pro trecho pronto de
   * App.tsx.
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

/**
 * Barra de ferramentas flutuante e a dica contextual ancorada na ferramenta
 * ativa.
 *
 * Os botões são só de ícone: o nome acessível — e o tooltip de hover — vêm de
 * `TOOL_LABELS`, que os testes e2e leem com `exact: true`. Nada de texto dentro
 * do `<button>`, para o nome acessível continuar sendo exatamente o rótulo.
 *
 * A dica não fica centralizada sob a barra inteira: ela nasce sob o ícone que a
 * disparou, com uma seta apontando para ele. A posição precisa ser medida
 * porque depende da largura do texto e de onde a janela deixa o balão caber —
 * `placeHint` faz a conta, este componente só fornece as medidas.
 *
 * A barra quebra em mais de uma linha quando não cabe na largura central
 * (ROADMAP.md, dívida D2: 20 botões ≈ 846px, área central ≈ 688px em
 * 1280×800 — já estourava ~40px por lado na Fase 1, ~80px agora). A unidade
 * de quebra é o GRUPO (`TOOL_GROUPS`), não o botão: cada grupo vira um
 * `.lb-toolbar__group` com `flex-wrap: nowrap` interno, e é a barra
 * (`.lb-toolbar`, `flex-wrap: wrap`) que distribui grupos inteiros entre
 * linhas. Isso evita separador órfão na borda de uma linha — o ponto de
 * quebra nunca cai no meio de um grupo, porque um grupo não pode encolher
 * abaixo da sua largura mínima. Nenhum botão sai do DOM nem fica
 * `display: none`: todos continuam clicáveis por `getByRole('button', {
 * name })` direto, sem passo de abrir menu antes — é a restrição dura dos
 * 105 specs e2e que clicam nos botões pelo nome acessível (dossiê F4 corrige
 * a contagem de "87" pra "105" — ROADMAP.md estava desatualizado).
 *
 * Fase 4 (N1, "setinha de variantes"): cada ferramenta listada como
 * `available: true` em `TOOL_VARIANTS` (lib/toolVariants.ts) ganha uma
 * SEGUNDA `<button>`, irmã da principal (nunca aninhada — dois `<button>`
 * um dentro do outro é HTML inválido), com nome acessível PRÓPRIO
 * (`Opções de <ferramenta>`) que abre um popover (`ToolVariantMenu`) de
 * preferências pra próxima entidade daquele tipo. O clique no CORPO do
 * botão principal nunca muda — continua só chamando `onSelectTool` — e a
 * setinha só existe para quem tem variante pronta, nunca um item de menu
 * morto.
 */
export function Toolbar({ activeTool, onSelectTool, variantBindings }: ToolbarProps) {
  const hint = TOOL_HINTS[activeTool]
  const dockRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLParagraphElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)
  const [placement, setPlacement] = useState<HintPlacement | null>(null)

  /**
   * Ferramenta cuja setinha está aberta agora (no máximo uma, mesmo padrão
   * de "um dropdown por vez" de qualquer barra de ferramentas). `null` =
   * nenhuma aberta.
   */
  const [openVariantTool, setOpenVariantTool] = useState<DrawingTool | null>(null)
  /** Um `<div>` âncora por ferramenta (guarda o botão + a setinha) — usado só
   *  pra decidir "o clique foi dentro do popover aberto ou fora dele" no
   *  listener de pointerdown abaixo. */
  const variantAnchorRefs = useRef<Map<DrawingTool, HTMLDivElement>>(new Map())
  /** Um botão de setinha por ferramenta — usado só pra devolver o foco a ela
   *  quando o popover fecha (Escape, clique fora, ou opção escolhida). */
  const variantArrowRefs = useRef<Map<DrawingTool, HTMLButtonElement>>(new Map())

  const closeVariantMenu = () => {
    const tool = openVariantTool
    setOpenVariantTool(null)
    if (tool) variantArrowRefs.current.get(tool)?.focus()
  }

  // Fecha ao clicar fora do popover aberto. `pointerdown` (não `click`) pra
  // fechar ANTES do clique seguinte poder acertar outro alvo por baixo do
  // popover — mesma ordem de eventos que um <select> nativo usa.
  useEffect(() => {
    if (!openVariantTool) return
    const handlePointerDown = (event: PointerEvent) => {
      const anchor = variantAnchorRefs.current.get(openVariantTool)
      if (anchor && event.target instanceof Node && anchor.contains(event.target)) return
      setOpenVariantTool(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openVariantTool])

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
        {TOOL_GROUPS.map((group, index) => (
          // Grupo inteiro é a unidade de quebra de linha — ver comentário do
          // componente. O separador mora dentro do grupo que ele abre, então
          // os dois sempre migram juntos para a linha seguinte.
          <div className="lb-toolbar__group" key={group[0]}>
            {index > 0 && <span className="lb-toolbar__sep" aria-hidden="true" />}
            {group.map((tool) => {
              // TOOL_GROUPS só lista ferramentas com entrada em TOOL_ICONS —
              // se faltar, é bug de wiring ao adicionar a ferramenta, não
              // caso de runtime a tratar silenciosamente.
              const ToolIcon = TOOL_ICONS[tool]
              if (!ToolIcon) return null
              // `variantEntry && variantEntry.available ? variantEntry : null`
              // (não `?.`) de propósito: só essa forma estreita o tipo pro
              // TypeScript reconhecer `readyEntry` como `ToolVariantReady`,
              // não só `boolean | undefined` — precisa disso pra passar pra
              // `<ToolVariantMenu entry={readyEntry}>` sem `as`.
              const variantEntry = TOOL_VARIANTS[tool]
              const readyEntry: ToolVariantReady | null = variantEntry && variantEntry.available ? variantEntry : null
              return (
                // Âncora do par botão+setinha. NÃO substitui o `<button>`
                // principal no DOM nem muda seu nome acessível — os 105
                // specs e2e que clicam por `getByRole('button', { name })`
                // continuam achando o MESMO botão, só que agora dentro de um
                // `<div>` a mais. A setinha é um `<button>` IRMÃO (nunca
                // aninhado dentro do botão principal — dois `<button>`
                // aninhados é HTML inválido), então o clique no corpo do
                // botão principal continua só chamando `onSelectTool`, nunca
                // abrindo o popover.
                <div
                  key={tool}
                  className="lb-toolvariant-anchor"
                  ref={(node) => {
                    if (node) variantAnchorRefs.current.set(tool, node)
                    else variantAnchorRefs.current.delete(tool)
                  }}
                >
                  <button
                    ref={activeTool === tool ? activeButtonRef : undefined}
                    type="button"
                    className="lb-iconbtn lb-tip"
                    aria-label={TOOL_LABELS[tool]}
                    aria-pressed={activeTool === tool}
                    // Onda 1, item 6 do plano — atalho invisível é atalho
                    // inexistente. `aria-label` (nome acessível, lido pelos
                    // e2e via `getByRole`) fica intocado; só o balão de dica
                    // ganha a letra.
                    data-tip={`${TOOL_LABELS[tool]} (${TOOL_SHORTCUTS[tool]})`}
                    onClick={() => onSelectTool(tool)}
                  >
                    <ToolIcon />
                  </button>
                  {readyEntry && (
                    <button
                      ref={(node) => {
                        if (node) variantArrowRefs.current.set(tool, node)
                        else variantArrowRefs.current.delete(tool)
                      }}
                      type="button"
                      className="lb-toolvariant-arrow"
                      aria-label={`Opções de ${TOOL_LABELS[tool]}`}
                      aria-haspopup="true"
                      aria-expanded={openVariantTool === tool}
                      onClick={(event) => {
                        // Nunca deixa o clique borbulhar pro botão principal
                        // por baixo (são irmãos, não aninhados, então isto é
                        // defensivo, não estritamente necessário — mas barato
                        // e evita depender da ordem de handlers do React).
                        event.stopPropagation()
                        setOpenVariantTool((current) => (current === tool ? null : tool))
                      }}
                    >
                      <ChevronDownIcon />
                    </button>
                  )}
                  {readyEntry && openVariantTool === tool && (
                    <ToolVariantMenu entry={readyEntry} bindings={variantBindings} onClose={closeVariantMenu} />
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

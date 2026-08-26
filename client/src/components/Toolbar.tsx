import { Fragment, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { DrawingTool } from '../types/tools'
import { theme } from '../theme'
import { TOOL_GROUPS, TOOL_HINTS, TOOL_LABELS } from './labels'
import { placeHint, type HintPlacement } from './hintPlacement'
import {
  BrushIcon,
  CircleIcon,
  CurveIcon,
  CursorIcon,
  LightIcon,
  LineIcon,
  PropIcon,
  RegionIcon,
  TextIcon,
  WallIcon,
} from './icons'

interface ToolbarProps {
  activeTool: DrawingTool
  onSelectTool: (tool: DrawingTool) => void
}

// text: entrada obrigatória (Record<DrawingTool, ...> é exaustivo desde a
// Task 1), mas o botão nunca renderiza — 'text' não está em TOOL_GROUPS até
// a Task 3 ligar handler de clique e renderização (Task 2).
const TOOL_ICONS: Record<DrawingTool, ComponentType<{ size?: number }>> = {
  select: CursorIcon,
  wall: WallIcon,
  light: LightIcon,
  region: RegionIcon,
  prop: PropIcon,
  brush: BrushIcon,
  line: LineIcon,
  circle: CircleIcon,
  curve: CurveIcon,
  text: TextIcon,
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
 */
export function Toolbar({ activeTool, onSelectTool }: ToolbarProps) {
  const hint = TOOL_HINTS[activeTool]
  const dockRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLParagraphElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)
  const [placement, setPlacement] = useState<HintPlacement | null>(null)

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
          <Fragment key={group[0]}>
            {index > 0 && <span className="lb-toolbar__sep" aria-hidden="true" />}
            {group.map((tool) => {
              const ToolIcon = TOOL_ICONS[tool]
              return (
                <button
                  key={tool}
                  ref={activeTool === tool ? activeButtonRef : undefined}
                  type="button"
                  className="lb-iconbtn lb-tip"
                  aria-label={TOOL_LABELS[tool]}
                  aria-pressed={activeTool === tool}
                  data-tip={TOOL_LABELS[tool]}
                  onClick={() => onSelectTool(tool)}
                >
                  <ToolIcon />
                </button>
              )
            })}
          </Fragment>
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

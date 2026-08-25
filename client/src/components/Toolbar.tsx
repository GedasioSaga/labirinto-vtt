import { Fragment, type ComponentType } from 'react'
import type { DrawingTool } from '../types/tools'
import { TOOL_GROUPS, TOOL_HINTS, TOOL_LABELS } from './labels'
import {
  BrushIcon,
  CircleIcon,
  CursorIcon,
  LightIcon,
  LineIcon,
  PropIcon,
  RegionIcon,
  WallIcon,
} from './icons'

interface ToolbarProps {
  activeTool: DrawingTool
  onSelectTool: (tool: DrawingTool) => void
}

const TOOL_ICONS: Record<DrawingTool, ComponentType<{ size?: number }>> = {
  select: CursorIcon,
  wall: WallIcon,
  light: LightIcon,
  region: RegionIcon,
  prop: PropIcon,
  brush: BrushIcon,
  line: LineIcon,
  circle: CircleIcon,
}

/**
 * Barra de ferramentas flutuante e a dica contextual logo abaixo.
 *
 * Os botões são só de ícone: o nome acessível — e o tooltip — vêm de
 * `TOOL_LABELS`, que os testes e2e leem com `exact: true`. Nada de texto dentro
 * do `<button>`, para o nome acessível continuar sendo exatamente o rótulo.
 */
export function Toolbar({ activeTool, onSelectTool }: ToolbarProps) {
  const hint = TOOL_HINTS[activeTool]

  return (
    <>
      <div className="lb-panel lb-toolbar" role="toolbar" aria-label="Ferramentas do mapa">
        {TOOL_GROUPS.map((group, index) => (
          <Fragment key={group[0]}>
            {index > 0 && <span className="lb-toolbar__sep" aria-hidden="true" />}
            {group.map((tool) => {
              const ToolIcon = TOOL_ICONS[tool]
              return (
                <button
                  key={tool}
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
        <p className="lb-hint" role="status">
          {hint}
        </p>
      )}
    </>
  )
}

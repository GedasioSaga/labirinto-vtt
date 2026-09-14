import { useEffect, useRef } from 'react'
import type { DoorKind, FloorPiece, FreehandTexture, Region, Wall } from '../types/map'
import type { StairSizePreset } from '../lib/stairs'
import type { FloorShapeKind } from '../lib/floorTool'
import type { ToolVariantGroup, ToolVariantOption, ToolVariantReady } from '../lib/toolVariants'
import { TOOL_LABELS } from './labels'

/**
 * Binding de valor/ação por eixo de variante (`ToolVariantGroup['storeKey']`)
 * — o chamador (Toolbar, alimentado pela store via App.tsx — ver CONTRATO do
 * agente) resolve a fonte; este componente só mostra o controle e chama
 * `onChange`. Mesma separação "chamador decide a fonte" de DoorKindControls/
 * WallStyleControls/RegionStyleControls/PolygonSidesControls — só que aqui os
 * eixos presentes na ferramenta ativa cabem todos no mesmo popover.
 *
 * Os 4 eixos SEMPRE editam a preferência da PRÓXIMA entidade a nascer
 * (`doorKind`/`wallKind`/`regionFillPattern`/`polygonSides` em mapStore.ts,
 * sem histórico de undo — mesma classe de `wallKind`/`polygonSides` já
 * documentada lá) — nunca uma entidade já selecionada. Editar a selecionada
 * continua sendo papel do painel esquerdo (PropertiesPanel), que já faz isso
 * hoje via as ações `setWallKindForWall`/`setWallDoorKind`/`setRegionPattern`.
 */
export interface ToolVariantBindings {
  doorKind: { value: DoorKind; onChange: (value: DoorKind) => void }
  wallKind: { value: Wall['wallKind']; onChange: (value: NonNullable<Wall['wallKind']>) => void }
  regionFillPattern: { value: Region['fillPattern']; onChange: (value: Region['fillPattern']) => void }
  polygonSides: { value: number; onChange: (value: number) => void }
  /** Fase 5 — preset nomeado (P/M/G) da PRÓXIMA escada. */
  stairSizePreset: { value: StairSizePreset; onChange: (value: StairSizePreset) => void }
  /** Fase 5 — textura do PRÓXIMO traço livre (pincel). */
  drawTexture: { value: FreehandTexture; onChange: (value: FreehandTexture) => void }
  /** Fase 5 — modo de gesto da Borracha. */
  eraseMode: { value: 'objeto' | 'parte'; onChange: (value: 'objeto' | 'parte') => void }
  /** Chão por peças — forma, operação e lados da PRÓXIMA peça. */
  floorShapeKind: { value: FloorShapeKind; onChange: (value: FloorShapeKind) => void }
  floorOp: { value: FloorPiece['op']; onChange: (value: FloorPiece['op']) => void }
  floorPolygonSides: { value: number; onChange: (value: number) => void }
}

export interface ToolVariantMenuProps {
  entry: ToolVariantReady
  bindings: ToolVariantBindings
  /** Fecha o popover — chamado por Escape e por qualquer opção escolhida
   *  (selecionar fecha, mesmo comportamento de um <select> nativo). O
   *  chamador (Toolbar) também usa isto para devolver o foco à setinha. */
  onClose: () => void
}

/** Um grupo de botões-rádio para UM eixo — genérico em `V` (o tipo do
 *  `value` da opção), reaproveitado pelos 4 `storeKey` possíveis. Type-safe
 *  sem `as`: o chamador (`GroupOptions` abaixo) só instancia isto dentro do
 *  `case` de switch certo, onde o TypeScript já estreitou `group.options`
 *  para `ToolVariantOption<V>[]` e a `binding` correspondente para o mesmo `V`. */
function renderOptions<V>(
  options: ToolVariantOption<V>[],
  value: V,
  onChange: (value: V) => void,
  onPicked: () => void,
) {
  return options.map((option) => (
    <button
      key={option.id}
      type="button"
      role="radio"
      aria-checked={value === option.value}
      className="lb-toolvariant-menu__option"
      onClick={() => {
        onChange(option.value)
        onPicked()
      }}
    >
      <span>{option.label}</span>
      <span className="lb-toolvariant-menu__option-desc">{option.description}</span>
    </button>
  ))
}

function GroupOptions({
  group,
  bindings,
  onPicked,
}: {
  group: ToolVariantGroup
  bindings: ToolVariantBindings
  onPicked: () => void
}) {
  switch (group.storeKey) {
    case 'doorKind':
      return <>{renderOptions(group.options, bindings.doorKind.value, bindings.doorKind.onChange, onPicked)}</>
    case 'wallKind': {
      // Wall['wallKind'] === undefined significa 'exterior' — convenção
      // documentada em types/map.ts (Wall.wallKind) e replicada em
      // WallStyleControlsProps ("`undefined` conta como 'exterior'").
      // Normalizado só pra comparação de aria-checked abaixo; nunca
      // repassado assim pro `onChange`, que já exige NonNullable (mesma
      // assinatura de setWallKind/setWallKindForWall em mapStore.ts).
      const wallKindValue = bindings.wallKind.value ?? 'exterior'
      return <>{renderOptions(group.options, wallKindValue, bindings.wallKind.onChange, onPicked)}</>
    }
    case 'regionFillPattern':
      return <>{renderOptions(group.options, bindings.regionFillPattern.value, bindings.regionFillPattern.onChange, onPicked)}</>
    case 'polygonSides':
      return <>{renderOptions(group.options, bindings.polygonSides.value, bindings.polygonSides.onChange, onPicked)}</>
    case 'stairSizePreset':
      return <>{renderOptions(group.options, bindings.stairSizePreset.value, bindings.stairSizePreset.onChange, onPicked)}</>
    case 'drawTexture':
      return <>{renderOptions(group.options, bindings.drawTexture.value, bindings.drawTexture.onChange, onPicked)}</>
    case 'eraseMode':
      return <>{renderOptions(group.options, bindings.eraseMode.value, bindings.eraseMode.onChange, onPicked)}</>
    case 'floorShapeKind':
      return <>{renderOptions(group.options, bindings.floorShapeKind.value, bindings.floorShapeKind.onChange, onPicked)}</>
    case 'floorOp':
      return <>{renderOptions(group.options, bindings.floorOp.value, bindings.floorOp.onChange, onPicked)}</>
    case 'floorPolygonSides':
      return <>{renderOptions(group.options, bindings.floorPolygonSides.value, bindings.floorPolygonSides.onChange, onPicked)}</>
    default:
      return null
  }
}

/**
 * Popover de variantes ancorado na setinha de uma ferramenta da barra — a
 * "mesma ideia para cada ferramenta" que o usuário pediu (ROADMAP.md, N1).
 * Puramente presentacional: só sabe desenhar `entry.groups` e delegar
 * clique/valor para `bindings`; quem decide QUANDO renderizar (a setinha
 * clicada) e a ANCORAGEM (posição relativa ao botão) é `Toolbar.tsx`.
 *
 * Fecha com Escape (handler abaixo) ou clicando fora (handled em
 * `Toolbar.tsx`, que é quem sabe qual é "fora" de cada ferramenta). Abre por
 * clique OU teclado de graça: a setinha é um `<button>` nativo, e Enter/Space
 * nele já disparam `onClick` sem nenhum código extra aqui.
 */
export function ToolVariantMenu({ entry, bindings, onClose }: ToolVariantMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  // Foco entra no popover ao abrir — Tab a partir daqui já alcança a
  // primeira opção, sem precisar de um ref por botão.
  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="lb-panel lb-toolvariant-menu"
      role="group"
      aria-label={`Opções de ${TOOL_LABELS[entry.tool] ?? entry.tool}`}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Não deixa o Escape borbulhar pra cima e fechar algo mais (ex. um
        // diálogo pai) além deste popover.
        event.stopPropagation()
        onClose()
      }}
    >
      {entry.groups.map((group) => (
        <div className="lb-toolvariant-menu__group" key={group.storeKey}>
          <h3 className="lb-eyebrow">{group.label}</h3>
          <div className="lb-toolvariant-menu__options" role="radiogroup" aria-label={group.label}>
            <GroupOptions group={group} bindings={bindings} onPicked={onClose} />
          </div>
        </div>
      ))}
    </div>
  )
}

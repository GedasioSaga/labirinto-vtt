import type { GridSettings, GridShape } from '../types/map'
import type { SnapTargetKind, SnapTargets } from '../pixi/grid'
import { GridShapePicker } from './GridShapePicker'
import { Toggle } from './Toggle'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'
import { useTelhadosNoEditor } from '../stores/telhadosNoEditor'
import { useParedesTortas } from '../stores/paredesTortas'
import { useMapStore } from '../stores/mapStore'
import { paredesTortasDoPiso } from '../lib/alinhamento'

const LINE_STYLES: Array<{ value: GridSettings['lineStyle']; label: string }> = [
  { value: 'solid', label: 'Sólida' },
  { value: 'dashed', label: 'Tracejada' },
  { value: 'dotted', label: 'Pontilhada' },
]

/**
 * Array explícito (não `Object.keys(SNAP_TARGET_LABELS)`) para não precisar
 * de `as SnapTargetKind[]` — `Object.keys` sempre tipa como `string[]`,
 * mesmo vindo de um `Record` com union de chaves fechada.
 */
const SNAP_TARGET_ORDER: SnapTargetKind[] = ['token', 'wall', 'prop']

const SNAP_TARGET_LABELS: Record<SnapTargetKind, string> = {
  token: 'Grudar Token no centro',
  wall: 'Grudar Parede na grade',
  prop: 'Grudar Objeto na grade',
}

export interface GridControlsProps {
  showGrid: boolean
  onShowGridChange: (show: boolean) => void
  gridShape: GridShape
  onGridShapeChange: (shape: GridShape) => void
  /**
   * Substitui o antigo `snapEnabled` único: cada alvo (Token/Parede/Objeto)
   * liga o snap independentemente. Token gruda no CENTRO da célula; Parede
   * e Objeto grudam no VÉRTICE/aresta — a regra vive em
   * `pixi/tokenInteraction.ts` (`snapPointForTarget`), não aqui.
   */
  snapTargets: SnapTargets
  onSnapTargetChange: (kind: SnapTargetKind, on: boolean) => void
  gridSettings: GridSettings
  onGridSettingsChange: (patch: Partial<GridSettings>) => void
}

export type GridQuickTogglesProps = Pick<
  GridControlsProps,
  'showGrid' | 'onShowGridChange' | 'snapTargets' | 'onSnapTargetChange'
>

/**
 * Acesso rápido da grade: "Mostrar grade" e o snap por alvo. São os
 * interruptores que se mexe durante a edição, então ficam no painel; o resto
 * da grade (formato, cor, opacidade, espessura, estilo) é configuração do
 * mapa e fica em `GridControls`.
 */
export function GridQuickToggles({ showGrid, onShowGridChange, snapTargets, onSnapTargetChange }: GridQuickTogglesProps) {
  return (
    <div className="lb-quick-toggles" role="group" aria-label="Grade">
      <Toggle label="Mostrar grade" checked={showGrid} onChange={onShowGridChange} />
      {SNAP_TARGET_ORDER.map((kind) => (
        <Toggle
          key={kind}
          label={SNAP_TARGET_LABELS[kind]}
          checked={snapTargets[kind]}
          onChange={(on) => onSnapTargetChange(kind, on)}
        />
      ))}
      <MostrarParedesTortas />
    </div>
  )
}

const NOTA_DAS_PAREDES_TORTAS_ID = 'lb-paredes-tortas-nota'

/** O que o interruptor achou, em palavras: o mestre sabe se ainda falta consertar sem contar no mapa. */
export function notaDasParedesTortas(tortas: number): string {
  if (tortas === 0) return 'Nenhuma parede torta neste piso.'
  if (tortas === 1) return '1 parede torta neste piso, marcada de laranja.'
  return `${tortas} paredes tortas neste piso, marcadas de laranja.`
}

/**
 * MOSTRAR PAREDES TORTAS (pedido de 17/11/2026: "nunca sei quando uma parede ta
 * alinhada"): marca de laranja no mapa as paredes de 1° a 5° fora da reta, até
 * o mestre desligar (`stores/paredesTortas.ts`, de sessão). Mora junto dos
 * interruptores da grade: é o mesmo assunto — parede no lugar certo.
 *
 * A nota só existe ligado, e a conta também: desligado o seletor devolve `null`
 * sem olhar o mapa, e o painel não re-renderiza a cada parede mexida. Ligado,
 * o número só troca quando a quantidade muda (seletor de número, não de lista).
 */
function MostrarParedesTortas() {
  const mostrar = useParedesTortas((state) => state.mostrar)
  const tortas = useMapStore((state) => (mostrar ? paredesTortasDoPiso(state.map, state.pisoAtivo).length : null))
  const { setMostrar } = useParedesTortas.getState()
  return (
    <>
      <Toggle
        label="Mostrar paredes tortas"
        checked={mostrar}
        onChange={setMostrar}
        describedBy={tortas === null ? undefined : NOTA_DAS_PAREDES_TORTAS_ID}
      />
      {tortas !== null && (
        <span className="lb-camadas__nota" id={NOTA_DAS_PAREDES_TORTAS_ID} role="status">
          {notaDasParedesTortas(tortas)}
        </span>
      )}
    </>
  )
}

/**
 * TELHADOS NO EDITOR (fatia 6): o olho do mestre da camada Telhados, no painel
 * de Camadas, substitui o antigo botão "Telhados" (decisão do usuário). Fica
 * "Transparente", o atalho SÓ do mestre: deixa o telhado a 32% para ele
 * enxergar o que tem dentro. É de sessão (liga a cada abertura do editor,
 * `stores/telhadosNoEditor.ts`), não vai ao arquivo nem aos jogadores. Mora
 * aninhado na linha Telhados, e só aparece enquanto o mestre vê os telhados.
 */
export function TransparenteDosTelhados() {
  const transparentes = useTelhadosNoEditor((state) => state.transparentes)
  const { setTransparentes } = useTelhadosNoEditor.getState()
  return (
    <div className="lb-quick-toggles" role="group" aria-label="Telhados">
      <Toggle label="Transparente" checked={transparentes} onChange={setTransparentes} />
      <span className="lb-camadas__nota">Só para você, até fechar o editor.</span>
    </div>
  )
}

/** Formato e estilo visual da grade (visibilidade e snap: `GridQuickToggles`). */
export function GridControls({ gridShape, onGridShapeChange, gridSettings, onGridSettingsChange }: GridControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Grade</h2>

      <div className="lb-field">
        <span className="lb-label">Formato</span>
        <GridShapePicker value={gridShape} onChange={onGridShapeChange} groupLabel="Formato da grade" />
      </div>

      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-grid-color">
          Cor da grade
        </label>
        <CampoDeCorComPipeta
          id="lb-grid-color"
          value={gridSettings.color}
          onChange={(cor) => onGridSettingsChange({ color: cor })}
        />
      </div>

      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-grid-opacity">
            Opacidade
          </label>
          <span className="lb-num">{Math.round(gridSettings.opacity * 100)}%</span>
        </div>
        <input
          id="lb-grid-opacity"
          className="lb-range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={gridSettings.opacity}
          onChange={(event) => onGridSettingsChange({ opacity: Number(event.target.value) })}
        />
      </div>

      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-grid-linewidth">
            Espessura
          </label>
          <span className="lb-num">{gridSettings.lineWidth} px</span>
        </div>
        <input
          id="lb-grid-linewidth"
          className="lb-range"
          type="range"
          min={1}
          max={6}
          step={1}
          value={gridSettings.lineWidth}
          onChange={(event) => onGridSettingsChange({ lineWidth: Number(event.target.value) })}
        />
      </div>

      <div className="lb-field">
        <span className="lb-label">Estilo da linha</span>
        <div className="lb-seg" role="radiogroup" aria-label="Estilo da linha da grade">
          {LINE_STYLES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={gridSettings.lineStyle === value}
              className="lb-seg__option"
              onClick={() => onGridSettingsChange({ lineStyle: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

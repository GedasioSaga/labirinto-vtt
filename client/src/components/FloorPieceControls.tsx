import type { FloorPiece, FloorShape } from '../types/map'
import { Toggle } from './Toggle'
import { FLOOR_POLYGON_SIDES_MAX, FLOOR_POLYGON_SIDES_MIN, clampFloorPolygonSides } from '../lib/floorTool'

export type FloorPiecePatch = Partial<Omit<FloorPiece, 'id'>>

export interface FloorPieceControlsProps {
  piece: FloorPiece
  /** `map.floorStyle.fillColor` — a cor do chão do mapa inteiro, que é o que a
   *  peça usa enquanto não tem cor própria (`FloorPiece.fillColor`). */
  floorFillColor: string
  /** Posição da peça na ordem de aplicação (0 = aplicada primeiro) e o total de peças. */
  index: number
  count: number
  /** `map.grid` — só para o valor inicial da borda irregular ao ligá-la. */
  grid: number
  onChange: (patch: FloorPiecePatch) => void
  /** Negativo = aplicada mais cedo (fica "por baixo"); positivo = mais tarde. */
  onReorder: (delta: number) => void
  onRemove: () => void
}

const SHAPE_TITLES: Record<FloorShape['kind'], string> = {
  rect: 'Retângulo',
  ellipse: 'Elipse',
  polygon: 'Polígono regular',
  corridor: 'Corredor',
  poly: 'Polígono livre',
  blocos: 'Blocos',
}

const OP_OPTIONS: Array<{ value: FloorPiece['op']; label: string }> = [
  { value: 'add', label: 'Somar' },
  { value: 'subtract', label: 'Subtrair' },
]

/** Tamanho mínimo de lado/raio/largura: 0 some com a peça sem apagá-la. */
const MIN_SIZE = 1

/** Campo mostra 2 casas: o arrasto com snap desligado gera frações longas. */
function roundForField(value: number): number {
  return Math.round(value * 100) / 100
}

interface NumberFieldProps {
  id: string
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}

function NumberField({ id, label, value, min, max, step = 1, onChange }: NumberFieldProps) {
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="lb-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={roundForField(value)}
        onChange={(event) => {
          // Campo apagado chega como '' — Number('') é 0, que para coordenada
          // é um valor real e jogaria a peça na origem no meio da digitação.
          if (event.target.value === '') return
          const parsed = Number(event.target.value)
          if (Number.isNaN(parsed)) return
          const clampedMin = min === undefined ? parsed : Math.max(min, parsed)
          onChange(max === undefined ? clampedMin : Math.min(max, clampedMin))
        }}
      />
    </div>
  )
}

function ShapeFields({ shape, onShapeChange }: { shape: FloorShape; onShapeChange: (shape: FloorShape) => void }) {
  switch (shape.kind) {
    case 'rect':
      return (
        <>
          <NumberField id="lb-floor-cx" label="Centro X (px)" value={shape.cx} onChange={(cx) => onShapeChange({ ...shape, cx })} />
          <NumberField id="lb-floor-cy" label="Centro Y (px)" value={shape.cy} onChange={(cy) => onShapeChange({ ...shape, cy })} />
          <NumberField id="lb-floor-w" label="Largura (px)" value={shape.w} min={MIN_SIZE} onChange={(w) => onShapeChange({ ...shape, w })} />
          <NumberField id="lb-floor-h" label="Altura (px)" value={shape.h} min={MIN_SIZE} onChange={(h) => onShapeChange({ ...shape, h })} />
        </>
      )
    case 'ellipse':
      return (
        <>
          <NumberField id="lb-floor-cx" label="Centro X (px)" value={shape.cx} onChange={(cx) => onShapeChange({ ...shape, cx })} />
          <NumberField id="lb-floor-cy" label="Centro Y (px)" value={shape.cy} onChange={(cy) => onShapeChange({ ...shape, cy })} />
          <NumberField id="lb-floor-rx" label="Raio horizontal (px)" value={shape.rx} min={MIN_SIZE} onChange={(rx) => onShapeChange({ ...shape, rx })} />
          <NumberField id="lb-floor-ry" label="Raio vertical (px)" value={shape.ry} min={MIN_SIZE} onChange={(ry) => onShapeChange({ ...shape, ry })} />
        </>
      )
    case 'polygon':
      return (
        <>
          <NumberField id="lb-floor-cx" label="Centro X (px)" value={shape.cx} onChange={(cx) => onShapeChange({ ...shape, cx })} />
          <NumberField id="lb-floor-cy" label="Centro Y (px)" value={shape.cy} onChange={(cy) => onShapeChange({ ...shape, cy })} />
          <NumberField id="lb-floor-radius" label="Raio (px)" value={shape.radius} min={MIN_SIZE} onChange={(radius) => onShapeChange({ ...shape, radius })} />
          <NumberField
            id="lb-floor-sides"
            label="Lados"
            value={shape.sides}
            min={FLOOR_POLYGON_SIDES_MIN}
            max={FLOOR_POLYGON_SIDES_MAX}
            onChange={(sides) => onShapeChange({ ...shape, sides: clampFloorPolygonSides(sides) })}
          />
        </>
      )
    case 'corridor':
      return (
        <>
          {shape.points.map((point, i) => (
            <NumberField
              key={i}
              id={`lb-floor-corridor-width-${i}`}
              label={`Largura no ponto ${i + 1} (px)`}
              value={point.width}
              min={MIN_SIZE}
              onChange={(width) =>
                onShapeChange({ ...shape, points: shape.points.map((p, k) => (k === i ? { ...p, width } : p)) })
              }
            />
          ))}
        </>
      )
    case 'poly':
      // Vértices vindos de imagem: editar um a um por número não é um fluxo real.
      return <span className="lb-label">{shape.points.length} vértices</span>
    case 'blocos':
      // Célula é o que está preso à grade: mexer nela por número tiraria a peça
      // da grade, que é a única promessa desta forma. Quem muda a área é o
      // pincel (botão esquerdo pinta, direito apaga) e o balde.
      return (
        <span className="lb-label">
          {shape.cells.length} {shape.cells.length === 1 ? 'bloco' : 'blocos'} de {shape.cell}px
        </span>
      )
  }
}

/**
 * Peça de chão SELECIONADA: operação, medidas da forma, rotação, arredondar,
 * borda irregular, ordem e apagar. Toda edição passa por `onChange` com
 * histórico (`updateFloorPiece`) — mesmo contrato de campo numérico de
 * `StairControls` (1 entrada de undo por valor digitado).
 */
export function FloorPieceControls({
  piece,
  floorFillColor,
  index,
  count,
  grid,
  onChange,
  onReorder,
  onRemove,
}: FloorPieceControlsProps) {
  const noise = piece.modifiers.noise

  const setNoiseEnabled = (enabled: boolean) => {
    const modifiers = { ...piece.modifiers }
    if (enabled) {
      // Valores iniciais relativos à célula: dentes visíveis sem desfigurar a forma.
      modifiers.noise = { amplitude: Math.max(1, Math.round(grid / 8)), scale: grid, seed: 1 }
    } else {
      delete modifiers.noise
    }
    onChange({ modifiers })
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Peça de chão · {SHAPE_TITLES[piece.shape.kind]}</h2>

      <div className="lb-field">
        <span className="lb-label">Operação</span>
        <div className="lb-seg" role="radiogroup" aria-label="Operação da peça de chão">
          {OP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={piece.op === option.value}
              className="lb-seg__option"
              onClick={() => onChange({ op: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ShapeFields shape={piece.shape} onShapeChange={(shape) => onChange({ shape })} />

      {/* Cor SÓ desta peça — é o que faz um caminho ter uma cor e o chão em
          volta ter outra. Enquanto ela não existe, o swatch mostra a cor do
          chão do mapa (o que está na tela), para a pessoa mexer a partir do
          que vê em vez de partir de um preto vindo do nada. */}
      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-floor-piece-color">
          Cor desta peça
        </label>
        <input
          id="lb-floor-piece-color"
          className="lb-swatch"
          type="color"
          value={piece.fillColor ?? floorFillColor}
          onChange={(event) => onChange({ fillColor: event.target.value })}
        />
      </div>
      {piece.fillColor !== undefined && (
        <button type="button" className="lb-btn lb-btn--block" onClick={() => onChange({ fillColor: undefined })}>
          Voltar à cor do chão
        </button>
      )}

      {/* Blocos não giram: a peça é feita de célula da grade, e um giro de
          alguns graus a tiraria da grade sem nada para colocar no lugar. */}
      {piece.shape.kind !== 'blocos' && (
        <NumberField id="lb-floor-rotation" label="Rotação (graus)" value={piece.rotation ?? 0} onChange={(rotation) => onChange({ rotation })} />
      )}
      <NumberField
        id="lb-floor-rounding"
        label="Arredondar (px)"
        value={piece.modifiers.rounding ?? 0}
        min={0}
        onChange={(rounding) => onChange({ modifiers: { ...piece.modifiers, rounding } })}
      />

      <Toggle label="Borda irregular" checked={noise !== undefined} onChange={setNoiseEnabled} />
      {noise && (
        <>
          <NumberField
            id="lb-floor-noise-amplitude"
            label="Intensidade (px)"
            value={noise.amplitude}
            min={0}
            onChange={(amplitude) => onChange({ modifiers: { ...piece.modifiers, noise: { ...noise, amplitude } } })}
          />
          <NumberField
            id="lb-floor-noise-scale"
            label="Tamanho do dente (px)"
            value={noise.scale}
            min={MIN_SIZE}
            onChange={(scale) => onChange({ modifiers: { ...piece.modifiers, noise: { ...noise, scale } } })}
          />
          <NumberField
            id="lb-floor-noise-seed"
            label="Semente"
            value={noise.seed}
            onChange={(seed) => onChange({ modifiers: { ...piece.modifiers, noise: { ...noise, seed: Math.round(seed) } } })}
          />
        </>
      )}

      <div className="lb-field">
        <span className="lb-label">
          Ordem de aplicação: {index + 1} de {count}
        </span>
        <div className="lb-seg">
          <button type="button" className="lb-seg__option" disabled={index <= 0} onClick={() => onReorder(-1)}>
            Descer
          </button>
          <button type="button" className="lb-seg__option" disabled={index >= count - 1} onClick={() => onReorder(1)}>
            Subir
          </button>
        </div>
      </div>

      <button type="button" className="lb-btn lb-btn--block lb-btn--danger" onClick={onRemove}>
        Apagar peça de chão
      </button>
    </section>
  )
}

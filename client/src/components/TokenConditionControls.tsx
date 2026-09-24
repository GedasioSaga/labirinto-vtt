import type { TokenCondition } from '../types/map'
import {
  CONDITION_GLYPH_FRACTION,
  CONDITION_GLYPH_STROKE_FRACTION,
  CONDITION_INK,
  CONDITION_OUTLINE_FRACTION,
  TOKEN_CONDITION_LABELS,
  TOKEN_CONDITION_ORDER,
  TOKEN_CONDITION_SYMBOLS,
  type ConditionSymbolPoint,
} from '../lib/tokenConditions'

export interface TokenConditionControlsProps {
  /** Condições marcadas na ficha selecionada, já limpas (`tokenConditionsOf`). */
  conditions: readonly TokenCondition[]
  /** Um clique: marca a condição se ela não está na ficha, desmarca se está. */
  onToggleCondition: (condition: TokenCondition) => void
}

/** Centro e raio da pastilha no `viewBox` de 24: sobra 1 unidade para o contorno não ser cortado na borda. */
const CENTRO = 12
const RAIO = 10.5

/**
 * A pastilha da condição como SVG — a mesma geometria que `pixi/drawTokenConditions.ts`
 * desenha em cima da ficha, lida da mesma fonte (`lib/tokenConditions.ts`) e
 * nas mesmas proporções: o botão mostra a marca que vai sair no mapa.
 *
 * Decorativa (`aria-hidden`): quem carrega o nome é o texto do botão.
 */
function TokenConditionArt({ condition }: { condition: TokenCondition }) {
  const symbol = TOKEN_CONDITION_SYMBOLS[condition]
  const scale = RAIO * CONDITION_GLYPH_FRACTION
  const width = RAIO * CONDITION_GLYPH_STROKE_FRACTION
  const ponto = (p: ConditionSymbolPoint): string => `${(CENTRO + p.x * scale).toFixed(2)},${(CENTRO + p.y * scale).toFixed(2)}`
  return (
    <svg className="lb-token-condition__badge" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx={CENTRO} cy={CENTRO} r={RAIO} fill={symbol.fill} stroke={CONDITION_INK} strokeWidth={RAIO * CONDITION_OUTLINE_FRACTION} />
      {(symbol.solids ?? []).map((solid, i) => (
        <polygon key={`cheio-${i}`} points={solid.map(ponto).join(' ')} fill={CONDITION_INK} />
      ))}
      {symbol.strokes.map((stroke, i) => {
        const traco = {
          points: stroke.points.map(ponto).join(' '),
          fill: 'none',
          stroke: CONDITION_INK,
          strokeWidth: width,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
        }
        return stroke.closed === true ? <polygon key={`traco-${i}`} {...traco} /> : <polyline key={`traco-${i}`} {...traco} />
      })}
      {(symbol.dots ?? []).map((dot, i) => (
        <circle
          key={`ponto-${i}`}
          cx={CENTRO + dot.x * scale}
          cy={CENTRO + dot.y * scale}
          r={dot.r * scale}
          fill={dot.hole === true ? symbol.fill : CONDITION_INK}
        />
      ))}
    </svg>
  )
}

/**
 * Condições da ficha selecionada — envenenado, caído, dormindo, atordoado,
 * invisível. É o controle de MESA do painel: mexido a cada rodada, um clique
 * por condição, e o mapa responde na hora com a pastilha em cima da ficha.
 *
 * Botões de LIGAR/DESLIGAR (`aria-pressed`) num grupo, e não rádios: uma
 * ficha pode estar caída E envenenada ao mesmo tempo. Marcar e desmarcar são o
 * mesmo gesto; Ctrl+Z desfaz (`toggleTokenCondition` passa pelo histórico).
 *
 * Duas colunas de pastilha + nome, como a legenda de um mapa (`lb-seg--pairs`):
 * em três colunas "Envenenado" não cabia na largura do rail.
 */
export function TokenConditionControls({ conditions, onToggleCondition }: TokenConditionControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Condições</h2>
      <div className="lb-seg lb-seg--pairs" role="group" aria-label="Condições da ficha">
        {TOKEN_CONDITION_ORDER.map((condition) => (
          <button
            key={condition}
            type="button"
            aria-pressed={conditions.includes(condition)}
            className="lb-seg__option"
            onClick={() => onToggleCondition(condition)}
          >
            <TokenConditionArt condition={condition} />
            {TOKEN_CONDITION_LABELS[condition]}
          </button>
        ))}
      </div>
      {/* O mestre precisa saber que a marca NÃO é anotação só dele — diferente
          de "Oculto para jogadores", ela sai para quem vê a ficha. */}
      <span className="lb-label">Aparece em cima da ficha, também na tela dos jogadores que a veem.</span>
    </section>
  )
}

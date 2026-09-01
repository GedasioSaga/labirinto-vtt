import type { Wall } from '../types/map'
import type { WallLineStyle, WallThickness } from '../pixi/drawWalls'
import { Toggle } from './Toggle'

/** Mesmo padrão de `LineCapControls.tsx`/`GridControls.tsx` (`LINE_STYLES`):
 *  array explícito de opções, não `Object.keys` (que tiparia `string[]`). */
const THICKNESS_OPTIONS: Array<{ value: WallThickness; label: string }> = [
  { value: 'thin', label: 'Fina' },
  { value: 'medium', label: 'Média' },
  { value: 'thick', label: 'Grossa' },
]

const LINE_STYLE_OPTIONS: Array<{ value: WallLineStyle; label: string }> = [
  { value: 'round', label: 'Arredondada' },
  { value: 'straight', label: 'Reta' },
]

export interface WallStyleControlsProps {
  /** `undefined` conta como 'exterior' — mesmo default do schema (ver
   *  Wall.wallKind em types/map.ts). */
  wallKind: Wall['wallKind']
  onWallKindChange: (kind: NonNullable<Wall['wallKind']>) => void
  /**
   * Fase 6 — pedido literal do usuário: "se eu quero poligono finos ou
   * medios ou gordos". `undefined` conta como 'medium' (ver `WallThickness`
   * em `pixi/drawWalls.ts` — campo ainda não existe em `types/map.ts`,
   * CONTRATO no relatório do agente G1). Eixo SEPARADO de `wallKind`: dá pra
   * ter parede externa fina (rua/construção artesanal) ou interna grossa.
   *
   * `thickness`/`onThicknessChange` (e o par `lineStyle`/`onLineStyleChange`
   * abaixo) são OPCIONAIS de propósito, diferente de `wallKind`/
   * `onWallKindChange` (obrigatórios, eixo pré-existente): `PropertiesPanel`/
   * `App.tsx` são arquivos de integrador fora do meu escopo de escrita, e o
   * call site de hoje só passa `wallKind`/`onWallKindChange` — se estes 2
   * pares fossem obrigatórios, o `tsc` do projeto quebraria em arquivo que
   * não é meu até o integrador aplicar o CONTRATO. Com `onThicknessChange`
   * ausente o botão nasce `disabled` (ver render abaixo) — visivelmente
   * inerte, nunca um clique que silenciosamente não faz nada (D5,
   * ROADMAP.md: "feature pronta e inalcançável" já aconteceu 3× por esse
   * motivo exato).
   */
  thickness?: WallThickness
  onThicknessChange?: (thickness: WallThickness) => void
  /**
   * Fase 6 — pedido literal: "essas paredes tem a ponta redonda, quero a
   * opcao de colocar reta ou redondo" + "as linhas dos poligonos se eu
   * quero eles arredondados ou retos". `undefined` conta como 'round'
   * (comportamento de antes desta fase). Um único controle cobre os dois
   * pedidos: numa parede solta vira a PONTA (cap); num canto fechado de
   * Sala/polígono vira o CANTO (join) — ver `pixi/drawWalls.ts`. Opcional
   * pelo mesmo motivo de `thickness` acima.
   */
  lineStyle?: WallLineStyle
  onLineStyleChange?: (lineStyle: WallLineStyle) => void
}

/**
 * Classificação visual da parede: interna/externa (semântica, herdada),
 * espessura (fina/média/grossa, estilo) e ponta/canto (arredondado/reto) —
 * três eixos independentes, controlam só `pixi/drawWalls.ts`, nunca
 * `blocksLight`/`blocksMove`/collision.
 *
 * Igual RegionStyleControls/LineCapControls: o chamador decide a FONTE deste
 * componente só mostra os controles. Duas ligações possíveis por eixo —
 *  - preferência da PRÓXIMA parede: `wallKind`/`setWallKind` (store, sem histórico);
 *  - a parede JÁ SELECIONADA: `selectedWall.wallKind`/`(k) => setWallKindForWall(selectedWall.id, k)` (com histórico).
 * Mesmo par dual esperado para `thickness`/`lineStyle` (ver CONTRATO).
 */
export function WallStyleControls({
  wallKind,
  onWallKindChange,
  thickness,
  onThicknessChange,
  lineStyle,
  onLineStyleChange,
}: WallStyleControlsProps) {
  const resolvedThickness = thickness ?? 'medium'
  const resolvedLineStyle = lineStyle ?? 'round'
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Parede</h2>
      <Toggle
        label="Parede interna"
        checked={wallKind === 'interior'}
        onChange={(checked) => onWallKindChange(checked ? 'interior' : 'exterior')}
      />
      <div className="lb-field">
        <span className="lb-label">Espessura</span>
        <div className="lb-seg" role="radiogroup" aria-label="Espessura da parede">
          {THICKNESS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={resolvedThickness === value}
              className="lb-seg__option"
              disabled={!onThicknessChange}
              // Ausência de onThicknessChange é caso legítimo (call site
              // ainda não integrado, ver doc de WallStyleControlsProps) — o
              // botão já nasce disabled acima, então este `?.` nunca dispara
              // silenciosamente num controle que parece ativo.
              onClick={() => onThicknessChange?.(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="lb-field">
        <span className="lb-label">Ponta e canto</span>
        <div className="lb-seg" role="radiogroup" aria-label="Ponta e canto da parede">
          {LINE_STYLE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={resolvedLineStyle === value}
              className="lb-seg__option"
              disabled={!onLineStyleChange}
              onClick={() => onLineStyleChange?.(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
